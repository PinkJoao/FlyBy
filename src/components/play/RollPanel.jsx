// =============================================================================
// RollPanel: o conteúdo do diálogo antes de uma rolagem do play mode
// =============================================================================
// O QUE FAZ
//   O equivalente ao diálogo de rolagem do Foundry (docs/PLAY-MODE-PLAN.md 3.5):
//   mostra a fórmula que vai ser rolada e deixa o jogador mudar o que o mestre
//   impõe antes de rolar. Num teste de d20: desvantagem, normal ou vantagem. Em
//   todos: um bônus livre em fórmula ("+1d4", "-2"), conferido ao digitar. No
//   dano: crítico e o dado versátil, no controle segmentado (DDL-0158). E os dados
//   rolados na mesa, quando Settings > Physical dice pede (só o d20, ou todos): o
//   campo aparece direto, em ordem; os que faltarem, o app rola.
//   Fecha com { mode, bonus, manual, critical, versatile, applyHeal }, ou null se
//   cancelado; `healOption` mostra o "Heal myself" (a cura de uma magia).
//   `effects` são os efeitos que valem para esta rolagem (engine/playEffects:
//   condições, Bless, Rage, Sneak Attack): cada um com uma caixa, ligada ou não
//   pelo padrão dele, e a resposta leva `effectIds`, os que ficaram ligados.
//   Quem o abre num diálogo é o rollDialog.jsx.
//
// FUNÇÕES
//   parseManual(text): os números digitados, ou null se algum não é número.
//   previewFormula(props, state): a fórmula que vai ser rolada, em texto (com o reroll do
//     1, os 3d20 da Elven Accuracy, o `max` do Savage Attacker e o piso do dado de dano
//     do Great Weapon Fighting e do Clean Hits, `diceMin`, como rollDamageEvent faz).
//   shownFormula(text, data): a fórmula com as refs trocadas pelo valor; o extra do Rage
//     aparecia como "@scale.barbarian.rage-damage" (passe ao vivo, DDL-0219). Os dados
//     que um Cunning Strike tira do Sneak Attack (`forgo`) também saem da prévia.
//   gripOptions(hands, oneDice, twoDice): as empunhaduras do controle (versátil: uma ou duas mãos com
//     o dado de cada; a Lance: montado com uma mão ou a pé com duas).
//   RollPanel(props): o conteúdo do diálogo.
//     changeGrip(next): troca a empunhadura e liga ou desliga os efeitos que dependem dela.
//     submit(e): fecha com as opções.
//
// DECISÕES E ARMADILHAS
//   - O nome é RollPanel, e NÃO RollDialog: num filesystem que ignora caixa,
//     RollDialog.jsx e o rollDialog.jsx do abridor são o mesmo arquivo (a
//     armadilha do DialogHost, DDL-0007; aconteceu de novo em 2026-10-24).
//   - É um FORM: Enter rola (o DialogHost não tem botões neste diálogo e deixa o
//     Enter passar), Esc e o X cancelam. O botão Roll ganha o foco num
//     setTimeout DEPOIS da montagem: o DialogHost foca o próprio cartão no efeito
//     dele, que roda depois do nosso, e com o foco no cartão o Enter não rolava.
//   - A prévia mostra o modo LÍQUIDO: o do seletor somado às vantagens e
//     desvantagens dos efeitos ligados (o Poisoned já aparece como 2d20kl).
//   - O bônus é validado com os MESMOS dados das fórmulas do catálogo
//     (`rollData`), então "+@prof" funciona e uma ref errada aparece na hora,
//     com o botão de rolar desligado, nunca um erro depois.
//   - Dado físico fora da face (um 7 num d6) só é pego ao rolar (o sequenceRng
//     do dice.js); quem abre o diálogo mostra o erro num alerta.
//   - A EMPUNHADURA (DDL-0247): `hands` vem do catálogo ('versatile' ou 'mounted', a Lance, que pede
//     duas mãos a não ser montado) e `defaultGrip` do motor (a Lance com escudo começa montada). Um
//     efeito com `grip` (o Dueling só com uma mão, o Great Weapon Fighting só com duas) acompanha a
//     troca; o jogador ainda pode mudá-lo à mão. Com escudo na mão (`shield`, menos o que deixa as
//     mãos livres, o Animated Shield), duas mãos fica oferecido com o aviso: liberdade com aviso.
//   - O crítico só aparece no dano de uma rolagem de ataque (`canCrit`, DDL-0248): o de uma salvaguarda
//     (Fireball, Sacred Flame, a ação de save de um summon) e o automático (Magic Missile) não dobram,
//     nem na falha crítica, porque quem rola é o alvo.
//   - Os dados da mesa saíram do diálogo para as configurações (DDL-0158): com "Only
//     the d20", o campo só aparece nos testes de d20, e o d20 digitado é o primeiro
//     da fila (o Bless e o resto o app rola). Campo vazio, o app rola tudo.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { validateFormula, resolveMode, resolveRefs } from '../../engine/dice';
import DamageTypePicker from './DamageTypePicker';
import { forgoDice, withDiceMin } from '../../engine/playActions';
import { useDialogClose } from '../common/dialogContext';
import SegmentedControl from '../common/SegmentedControl';
import useSettingsStore from '../../store/settingsStore';
import styles from './RollPanel.module.css';
import Button from '../common/Button';
import Toggle from '../common/Toggle';

const HITS = [
  { value: 'normal', label: 'Normal hit' },
  { value: 'critical', label: 'Critical hit' },
];

const MODES = [
  { value: 'disadvantage', label: 'Disadvantage' },
  { value: 'normal', label: 'Normal' },
  { value: 'advantage', label: 'Advantage' },
];

/** Os números digitados ("17 4" ou "17, 4"), ou null se algum não é número. */
function parseManual(text) {
  const tokens = String(text ?? '').split(/[\s,;]+/).filter(Boolean);
  const values = tokens.map(Number);
  return values.every((v) => Number.isInteger(v) && v > 0) ? values : null;
}

/** As empunhaduras do controle: a versátil com o dado de cada, a Lance montada ou a pé. */
function gripOptions(hands, oneDice, twoDice) {
  if (hands === 'mounted') return [{ value: 'one', label: 'Mounted, one hand' }, { value: 'two', label: 'On foot, two hands' }];
  return [{ value: 'one', label: `One hand (${oneDice})` }, { value: 'two', label: `Two hands (${twoDice})` }];
}

/** A fórmula que vai ser rolada, em texto ("2d20kh + 5 + 1d4"). */
function previewFormula({ kind, parts, versatileDice, rollData }, { mode, bonus, critical, versatile, rerollOnes, elven, twice, diceMin }) {
  const list = (parts ?? []).map((p, i) => {
    const base = i === 0 && versatile && versatileDice ? versatileDice : String(p.formula);
    const f = shownFormula(i === 0 && diceMin && kind !== 'd20' ? withDiceMin(base, diceMin, rollData) : base, rollData);
    return i === 0 && twice && kind !== 'd20' ? `max(${f}, ${f})` : f;
  });
  if (kind === 'd20') {
    const count = mode === 'normal' ? 1 : mode === 'advantage' && elven ? 3 : 2;
    list.unshift(`${count}d20${rerollOnes ? 'ro1' : ''}${mode === 'advantage' ? 'kh' : mode === 'disadvantage' ? 'kl' : ''}`);
  }
  if (String(bonus ?? '').trim()) list.push(String(bonus).trim());
  const text = list.filter((f) => f !== '0').join(' + ').replace(/\+ -/g, '- ');
  return critical && /d/.test(text) ? `${text} (dice doubled)` : text;
}

/** A fórmula com as refs trocadas pelo valor (a ref sem valor fica como está). */
function shownFormula(text, data) {
  try {
    return resolveRefs(text, data ?? {}).replace(/^\((-?\d+|\d*d\d+)\)$/, '$1');
  } catch {
    return text;
  }
}

/**
 * O conteúdo do diálogo de rolagem.
 * @param {{ kind: 'd20'|'damage', parts: { label: string, formula: string|number }[], rollData: object,
 *   defaultMode?: string, defaultCritical?: boolean, versatileDice?: string|null, note?: string, healOption?: boolean, effects?: object[] }} props
 */
export default function RollPanel({ kind, parts, rollData, defaultMode = 'normal', defaultCritical = false, canCrit = true, versatileDice = null, hands = null, defaultGrip = 'one', shield = null, damageTypes = null, note = '', healOption = false, effects = [] }) {
  const close = useDialogClose();
  const [mode, setMode] = useState(defaultMode);
  const [bonus, setBonus] = useState('');
  const [critical, setCritical] = useState(canCrit && defaultCritical);
  const gripHands = hands === 'mounted' || (versatileDice && (hands ?? 'versatile') === 'versatile') ? (hands ?? 'versatile') : null;
  const [grip, setGrip] = useState(gripHands ? defaultGrip : 'one');
  const versatile = gripHands === 'versatile' && grip === 'two';
  const [damageType, setDamageType] = useState(damageTypes?.[0] ?? null);
  const physicalDice = useSettingsStore((s) => s.physicalDice);
  const physical = physicalDice === 'all' || (physicalDice === 'd20' && kind === 'd20');
  const [manualText, setManualText] = useState('');
  const [applyHeal, setApplyHeal] = useState(false);
  const [effectIds, setEffectIds] = useState(() => effects.filter((e) => e.defaultOn).map((e) => e.id));
  const rollRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => rollRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  const on = effects.filter((e) => effectIds.includes(e.id));
  const forgo = on.reduce((s, e) => s + (e.forgo ?? 0), 0);
  const netMode = resolveMode((mode === 'advantage' ? 1 : 0) + on.reduce((s, e) => s + (e.adv ?? 0), 0), (mode === 'disadvantage' ? 1 : 0) + on.reduce((s, e) => s + (e.dis ?? 0), 0));
  const bonusError = String(bonus).trim() ? validateFormula(bonus, rollData) : null;
  const manual = physical ? parseManual(manualText) : [];
  const manualError = physical && manual === null ? 'Type whole numbers, separated by spaces' : null;

  /** Troca a empunhadura; o Dueling e o Great Weapon Fighting acompanham. */
  const changeGrip = (next) => {
    setGrip(next);
    const follow = effects.filter((e) => e.grip);
    setEffectIds((ids) => [...ids.filter((id) => !follow.some((e) => e.id === id)), ...follow.filter((e) => e.grip === next).map((e) => e.id)]);
  };
  const shieldWarning = gripHands && grip === 'two' && shield && !shield.handsFree ? `Your ${shield.name} is equipped: holding the weapon with two hands needs it off` : '';

  /** Fecha com as opções escolhidas. */
  const submit = (e) => {
    e.preventDefault();
    if (bonusError || manualError) return;
    close({ mode, bonus: String(bonus).trim(), manual: manual ?? [], critical, versatile, applyHeal, effectIds, ...(damageType ? { damageType } : {}) });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <p className={styles.formula}>
        {previewFormula(
          { kind, parts: [...parts, ...on.filter((e) => e.part).map((e) => (forgo && e.part.forgoable ? { ...e.part, formula: forgoDice(e.part.formula, forgo, rollData) } : e.part))], versatileDice, rollData },
          { mode: netMode, bonus, critical, versatile, rerollOnes: on.some((e) => e.rerollOnes), elven: on.some((e) => e.elven), twice: on.some((e) => e.twice), diceMin: on.reduce((m, e) => (e.diceMin ? Math.max(m ?? 0, e.diceMin) : m), null) },
        )}
      </p>
      {note && <p className={styles.note}>{note}</p>}

      {effects.length > 0 && (
        <div className={styles.effects}>
          {effects.map((e) => (
            <Toggle
              key={e.id}
              size="sm"
              title={e.note}
              checked={effectIds.includes(e.id)}
              onChange={(on) => setEffectIds(on ? [...effectIds, e.id] : effectIds.filter((x) => x !== e.id))}
              label={`${e.label}${e.adv ? ': Advantage' : ''}${e.dis ? ': Disadvantage' : ''}`}
              hint={e.note || null}
            />
          ))}
        </div>
      )}

      {kind === 'd20' && (
        <SegmentedControl
          block
          role="radiogroup"
          ariaLabel="Roll mode"
          value={mode}
          options={MODES}
          onChange={setMode}
        />
      )}

      {healOption && (
        <Toggle checked={applyHeal} onChange={setApplyHeal} label="Heal myself with it" />
      )}

      {kind === 'damage' && !healOption && canCrit && (
        <SegmentedControl
          block
          role="radiogroup"
          ariaLabel="Critical hit"
          value={critical ? 'critical' : 'normal'}
          options={HITS}
          onChange={(v) => setCritical(v === 'critical')}
        />
      )}
      {kind === 'damage' && !healOption && damageTypes?.length > 1 && (
        <DamageTypePicker types={damageTypes} value={damageType} onChange={setDamageType} />
      )}
      {kind === 'damage' && !healOption && gripHands && (
        <SegmentedControl
          block
          role="radiogroup"
          ariaLabel="Grip"
          value={grip}
          options={gripOptions(gripHands, parts[0]?.formula ?? '', versatileDice)}
          onChange={changeGrip}
        />
      )}
      {shieldWarning && <p className={styles.note}>{shieldWarning}</p>}

      <label className={styles.field}>
        <span className={styles.label}>Situational bonus</span>
        <input
          className={bonusError ? `${styles.input} ${styles.invalid}` : styles.input}
          value={bonus}
          onChange={(e) => setBonus(e.target.value)}
          placeholder="e.g. 1d4 or -2"
          autoComplete="off"
        />
        {bonusError && <span className={styles.error}>{bonusError}</span>}
      </label>

      {physical && (
        <label className={styles.field}>
          <span className={styles.label}>{physicalDice === 'all' ? 'Dice you rolled, in order' : kind === 'd20' && netMode !== 'normal' ? 'Your two d20s' : 'Your d20'}</span>
          <input
            className={manualError ? `${styles.input} ${styles.invalid}` : styles.input}
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder={kind === 'd20' && netMode !== 'normal' ? 'e.g. 17 4' : kind === 'd20' && physicalDice === 'd20' ? 'e.g. 17' : 'e.g. 6 3'}
            autoComplete="off"
            inputMode="numeric"
          />
          <span className={manualError ? styles.error : styles.hint}>
            {manualError ?? 'Leave it empty, or leave dice out, and the app rolls them.'}
          </span>
        </label>
      )}

      <div className={styles.actions}>
        <Button onClick={() => close(null)}>Cancel</Button>
        <Button ref={rollRef} type="submit" variant="primary" disabled={!!(bonusError || manualError)}>
          Roll
        </Button>
      </div>
    </form>
  );
}
