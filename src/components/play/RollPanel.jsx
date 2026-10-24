// =============================================================================
// RollPanel: o conteúdo do diálogo antes de uma rolagem do play mode
// =============================================================================
// O QUE FAZ
//   O equivalente ao diálogo de rolagem do Foundry (docs/PLAY-MODE-PLAN.md 3.5):
//   mostra a fórmula que vai ser rolada e deixa o jogador mudar o que o mestre
//   impõe antes de rolar. Num teste de d20: desvantagem, normal ou vantagem. Em
//   todos: um bônus livre em fórmula ("+1d4", "-2"), conferido ao digitar. No
//   dano: crítico e o dado versátil. E, opcional, os dados rolados na mesa
//   ("Physical dice"), em ordem; os que faltarem, o app rola.
//   Fecha com { mode, bonus, manual, critical, versatile, applyHeal }, ou null se
//   cancelado; `healOption` mostra o "Heal myself" (a cura de uma magia).
//   `effects` são os efeitos que valem para esta rolagem (engine/playEffects:
//   condições, Bless, Rage, Sneak Attack): cada um com uma caixa, ligada ou não
//   pelo padrão dele, e a resposta leva `effectIds`, os que ficaram ligados.
//   Quem o abre num diálogo é o rollDialog.jsx.
//
// FUNÇÕES
//   parseManual(text): os números digitados, ou null se algum não é número.
//   previewFormula(props, state): a fórmula que vai ser rolada, em texto.
//   RollPanel(props): o conteúdo do diálogo.
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
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { validateFormula, resolveMode } from '../../engine/dice';
import { useDialogClose } from '../common/dialogContext';
import styles from './RollPanel.module.css';

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

/** A fórmula que vai ser rolada, em texto ("2d20kh + 5 + 1d4"). */
function previewFormula({ kind, parts, versatileDice }, { mode, bonus, critical, versatile }) {
  const list = (parts ?? []).map((p, i) => (i === 0 && versatile && versatileDice ? versatileDice : String(p.formula)));
  if (kind === 'd20') list.unshift(mode === 'advantage' ? '2d20kh' : mode === 'disadvantage' ? '2d20kl' : '1d20');
  if (String(bonus ?? '').trim()) list.push(String(bonus).trim());
  const text = list.filter((f) => f !== '0').join(' + ').replace(/\+ -/g, '- ');
  return critical && /d/.test(text) ? `${text} (dice doubled)` : text;
}

/**
 * O conteúdo do diálogo de rolagem.
 * @param {{ kind: 'd20'|'damage', parts: { label: string, formula: string|number }[], rollData: object,
 *   defaultMode?: string, defaultCritical?: boolean, versatileDice?: string|null, note?: string, healOption?: boolean, effects?: object[] }} props
 */
export default function RollPanel({ kind, parts, rollData, defaultMode = 'normal', defaultCritical = false, versatileDice = null, note = '', healOption = false, effects = [] }) {
  const close = useDialogClose();
  const [mode, setMode] = useState(defaultMode);
  const [bonus, setBonus] = useState('');
  const [critical, setCritical] = useState(defaultCritical);
  const [versatile, setVersatile] = useState(false);
  const [physical, setPhysical] = useState(false);
  const [manualText, setManualText] = useState('');
  const [applyHeal, setApplyHeal] = useState(false);
  const [effectIds, setEffectIds] = useState(() => effects.filter((e) => e.defaultOn).map((e) => e.id));
  const rollRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => rollRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  const on = effects.filter((e) => effectIds.includes(e.id));
  const netMode = resolveMode((mode === 'advantage' ? 1 : 0) + on.reduce((s, e) => s + (e.adv ?? 0), 0), (mode === 'disadvantage' ? 1 : 0) + on.reduce((s, e) => s + (e.dis ?? 0), 0));
  const bonusError = String(bonus).trim() ? validateFormula(bonus, rollData) : null;
  const manual = physical ? parseManual(manualText) : [];
  const manualError = physical && manual === null ? 'Type whole numbers, separated by spaces' : null;

  /** Fecha com as opções escolhidas. */
  const submit = (e) => {
    e.preventDefault();
    if (bonusError || manualError) return;
    close({ mode, bonus: String(bonus).trim(), manual: manual ?? [], critical, versatile, applyHeal, effectIds });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <p className={styles.formula}>
        {previewFormula(
          { kind, parts: [...parts, ...on.filter((e) => e.part).map((e) => e.part)], versatileDice },
          { mode: netMode, bonus, critical, versatile },
        )}
      </p>
      {note && <p className={styles.note}>{note}</p>}

      {effects.length > 0 && (
        <div className={styles.effects}>
          {effects.map((e) => (
            <label key={e.id} className={styles.check} title={e.note}>
              <input
                type="checkbox"
                checked={effectIds.includes(e.id)}
                onChange={(ev) => setEffectIds(ev.target.checked ? [...effectIds, e.id] : effectIds.filter((x) => x !== e.id))}
              />
              <span>
                {e.label}{e.adv ? ': Advantage' : ''}{e.dis ? ': Disadvantage' : ''}
                {e.note && <span className={styles.effectNote}> ({e.note})</span>}
              </span>
            </label>
          ))}
        </div>
      )}

      {kind === 'd20' && (
        <div className={styles.seg} role="radiogroup" aria-label="Roll mode">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={mode === m.value}
              className={mode === m.value ? `${styles.segBtn} ${styles.segOn}` : styles.segBtn}
              onClick={() => setMode(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {healOption && (
        <label className={styles.check}>
          <input type="checkbox" checked={applyHeal} onChange={(e) => setApplyHeal(e.target.checked)} />
          <span>Heal myself with it</span>
        </label>
      )}

      {kind === 'damage' && !healOption && (
        <div className={styles.checks}>
          <label className={styles.check}>
            <input type="checkbox" checked={critical} onChange={(e) => setCritical(e.target.checked)} />
            <span>Critical hit</span>
          </label>
          {versatileDice && (
            <label className={styles.check}>
              <input type="checkbox" checked={versatile} onChange={(e) => setVersatile(e.target.checked)} />
              <span>Two hands ({versatileDice})</span>
            </label>
          )}
        </div>
      )}

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

      <label className={styles.check}>
        <input type="checkbox" checked={physical} onChange={(e) => setPhysical(e.target.checked)} />
        <span>I rolled physical dice</span>
      </label>
      {physical && (
        <label className={styles.field}>
          <span className={styles.label}>Dice results, in order</span>
          <input
            className={manualError ? `${styles.input} ${styles.invalid}` : styles.input}
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="e.g. 17 4"
            autoComplete="off"
            inputMode="numeric"
          />
          <span className={manualError ? styles.error : styles.hint}>
            {manualError ?? 'Any dice you leave out are rolled by the app.'}
          </span>
        </label>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.btn} onClick={() => close(null)}>Cancel</button>
        <button ref={rollRef} type="submit" className={`${styles.btn} ${styles.primary}`} disabled={!!(bonusError || manualError)}>
          Roll
        </button>
      </div>
    </form>
  );
}
