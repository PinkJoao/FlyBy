// =============================================================================
// Play: o play mode, a ficha para jogar na mesa
// =============================================================================
// O QUE FAZ
//   A interface PRÓPRIA do play mode (DDL-0004, docs/PLAY-MODE-PLAN.md 3.9),
//   separada do builder: lê o mesmo personagem e a mesma derivação, mais o
//   catálogo de jogo (engine/playCatalog) e o documento de jogo (usePlayDoc).
//   Fase C2: o topo (retrato, nome, HP, CA, iniciativa, deslocamento, PB), os
//   testes (atributos, saves, perícias, iniciativa), os ataques com acerto e
//   dano, o diálogo de rolagem e o histórico com desfazer e refazer.
//   Fase C3: o HP é um botão (dano, cura, temporário, engine/playHealth); a
//   faixa de estado mostra a morte (os pips e o teste), a concentração (começar,
//   o save, terminar) e os descansos curto e longo (engine/playRest).
//   Fase C4: a aba Features (pools com ajuste, ações de feature com consumo
//   automático, recuperações especiais, engine/playUse) e a aba Spells (slots,
//   lançar escolhendo a forma, e o ataque, o dano e a cura da magia no círculo
//   lançado, engine/playCast).
//   Fase C5: condições e efeitos (engine/playEffects) na faixa de estado; cada
//   rolagem leva os efeitos que valem para ela (o diálogo mostra cada um para
//   desligar); a CA e o deslocamento já saem com eles.
//   Fase C6: a aba Inventory (consumíveis, munição, cargas, moedas, engine/
//   playInventory) e o combate leve (iniciativa, rodada, economia do turno e
//   durações em rodadas, engine/playCombat) numa barra na faixa de estado.
//
// FUNÇÕES
//   Play(): carrega o personagem (os hooks ficam no PlayInner); com os recursos
//     experimentais desligados, mostra o aviso no lugar da tela.
//   signed(n): o número com sinal.
//   PlayInner(props): a tela.
//     roll(build, dialog, quick): pergunta (ou não), rola, grava e mostra.
//     rollTest(test, name, quick), rollAttack(attack, quick, spend),
//       rollDamage(attack, opts, quick): os três tipos de rolagem da C2.
//     damageFromHistory(attackKey, opts): o "Roll damage" do cartão do ataque.
//     moveCursor(fn, verb), undo(), redo(): mexem no cursor e avisam um
//       conflito de inventário.
//     record(event, cost): grava (marcando o custo do turno, em combate) e mostra o aviso.
//     openHp(): o painel de HP; com concentração, o dano já pede o save.
//     rollDeathSave(quick), rollConcentration(dc, quick), askConcentrationSave(),
//       startConcentration(), endConcentration(): morte e concentração.
//     shortRest(), longRest(): os descansos.
//     applyFeature(action, activity), special(action, rule), adjust(key, delta):
//       usar uma feature, as recuperações especiais e o ajuste à mão.
//     rollOf(test): a descrição de um teste para o rollEffects.
//     addCondition(), setCondition(id, level), addEffect(), removeEffect(id):
//       condições e efeitos.
//     castSpell(origin, spell), spellRoll(spellKey, level, kind),
//       rollSpellHeal(origin, spell, level): lançar e as rolagens da magia.
//     consumeItem(entry), changeQuantity(entry, delta), spendMoney(): o inventário.
//     startCombat(quick), nextTurn(), endCombat(), toggleEconomy(cost): o combate.
//     replayTutorials(), openSettings(): o submenu Settings (o replay abre o tour do play).
//   AttackRow(props): uma linha da lista de ataques.
//   toastNumber(event): o número do aviso de um evento.
//
// DECISÕES E ARMADILHAS
//   - O histórico é uma COLUNA no desktop (a partir de 1000px) e uma GAVETA no
//     celular, aberta pelo botão do topo; a gaveta fecha com o voltar do celular
//     (useBackLayer). Depois de cada rolagem, um aviso curto embaixo mostra o
//     total (some sozinho; tocar abre o histórico no celular).
//   - O play mode é um recurso EXPERIMENTAL (DDL-0111): os botões Play só
//     aparecem com "Features in development" ligado, e um link direto com ele
//     desligado mostra o aviso com o botão de ligar (liberdade com aviso).
//   - O play mode NÃO edita decisões de build (pergunta 7 do plano): "Edit sheet"
//     leva ao builder.
//   - Dano sofrido com concentração abre logo o save de CON com a CD (como o
//     aviso do Foundry); cancelar deixa o botão no cartão do dano para depois.
//   - Descanso com 0 HP: a regra exige 1 HP, então a tela PERGUNTA (liberdade com
//     aviso, §6.4). O longo mostra o que vai voltar antes de gravar.
//   - Usar uma feature sem nada a escolher (um utilitário que só gasta) grava
//     direto; com escala, slot, cura ou rolagem, o UsePanel pergunta antes.
//     Faltando recurso, a tela pergunta (liberdade com aviso, §6.4).
//   - Depois de lançar, a rolagem da magia já abre: o ataque, se ela ataca; senão o
//     dano, ou a cura. Cancelar deixa os botões no cartão da magia.
//   - Os efeitos de uma rolagem saem do estado de AGORA: a rolagem aberta logo
//     depois de lançar uma magia não vê o efeito que essa magia acabou de ligar
//     (a próxima já vê). O atalho (toque longo, Shift) usa o padrão de cada um.
//   - O ataque da lista de ataques (spend) gasta a ação e 1 munição; o que abre
//     sozinho depois de lançar uma magia não marca de novo (a magia já marcou).
//     Uma feature marca o custo da activity; uma magia, o tempo dela; a poção, a
//     ação bônus. Fora de combate nada disso é marcado.
//   - Uma poção de cura pergunta se é bebida ou dada: dada, rola a cura no
//     cartão e não mexe no HP.
//   - O tour `play` abre na 1a visita; o `play-combat`, no 1o combate (a barra só
//     existe então). O histórico leva a mesma âncora na coluna e no botão.
//   - O aviso diz "Critical" só num ataque (ou no dano dele); outro 20 natural sai
//     como "Natural 20", como no histórico.
//   - toastNumber escolhe o número do aviso pelo tipo do evento (o total da
//     rolagem, o dano sofrido, a cura, o temporário).
//   - O catálogo é derivado de novo só quando o personagem muda; o estado de
//     jogo muda a cada evento e nunca recalcula o catálogo.
//   - Um erro do dado físico (um 7 num d6) vem do dice.js ao rolar; vira um
//     alerta e nada é gravado.
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useCharacterStore from '../store/characterStore';
import useSettingsStore from '../store/settingsStore';
import { useData } from '../data/dataContext';
import useDerived from '../hooks/useDerived';
import usePlayDoc from '../hooks/usePlayDoc';
import { useBackLayer } from '../hooks/useBack';
import { classSummary } from '../schema/character';
import { derivePlayCatalog } from '../engine/playCatalog';
import {
  vitals as vitalsOf, damageEvent, healEvent, tempHpEvent, deathSaveEvent, concentrationEvent, concentrationCheckEvent,
} from '../engine/playHealth';
import { shortRestEvent, longRestEvent, hitDiceLeft } from '../engine/playRest';
import { emptyPlayState } from '../engine/playState';
import { activityEvent, slotRecoveryEvent, fontOfMagicEvent, adjustResourceEvent, resolveCosts, left as leftOf } from '../engine/playUse';
import { castWays, castEvent, spellAttackOf, healParts, spellHealEvent } from '../engine/playCast';
import {
  CONDITIONS, rollEffects, applyEffects, effectiveAc, effectiveSpeed, conditionEvent, modifierEvent, removeModifierEvent,
} from '../engine/playEffects';
import { testParts, rollTestEvent, rollAttackEvent, damageParts, rollDamageEvent } from '../engine/playActions';
import { itemUseEvent, quantityEvent, ammoOps, currencyEvent, itemCostOf, healOf } from '../engine/playInventory';
import { ECONOMY, startCombatEvent, nextTurnEvent, endCombatEvent, economyEvent, economyOp, costOfActivation, withRounds } from '../engine/playCombat';
import { askRoll } from '../components/play/rollDialog';
import { askHp, askShortRest, askUse, askCast, askSlotRecovery, askFontOfMagic, askModifier, askCurrency } from '../components/play/playDialogs';
import FeaturesTab from '../components/play/FeaturesTab';
import SpellsTab from '../components/play/SpellsTab';
import InventoryTab from '../components/play/InventoryTab';
import RollButton from '../components/play/RollButton';
import PlayHistory from '../components/play/PlayHistory';
import BackButton from '../components/common/BackButton';
import MenuButton from '../components/common/MenuButton';
import Icon from '../components/common/Icon';
import AnimatedNumber from '../components/common/AnimatedNumber';
import { alert, ask, confirm, menu } from '../components/common/dialog';
import { SettingsMenu } from '../components/common/AppMenus';
import { openGlossary } from '../store/glossaryStore';
import useTutorialStore, { maybeStartTutorial, startTutorial } from '../store/tutorialStore';
import { TUT } from '../tutorial/anchors';
import { ABILITY_FULL, ABILITY_SHORT, SKILL_LABEL } from '../components/builder/labels';
import styles from './Play.module.css';

const TABS = ['Actions', 'Features', 'Spells', 'Inventory', 'Checks'];

const ECONOMY_LABEL = { action: 'Action', bonus: 'Bonus', reaction: 'Reaction' };

const TOAST_MS = 4000;

/** O número com sinal ("+3", "-1"). */
const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);

/** O número do aviso de um evento: o total rolado, o dano, a cura ou o temporário. */
const toastNumber = (e) => e.rolls?.total ?? e.payload?.taken ?? e.payload?.healed ?? e.payload?.to ?? e.payload?.round ?? null;

export default function Play() {
  const { id } = useParams();
  const loaded = useCharacterStore((s) => s.loaded);
  const load = useCharacterStore((s) => s.load);
  const character = useCharacterStore((s) => s.getById(id));
  const experimental = useSettingsStore((s) => s.experimental);
  const setExperimental = useSettingsStore((s) => s.setExperimental);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  if (!experimental) {
    return (
      <div className={styles.page}>
        <BackButton to="/" label="characters" />
        <h1 className={styles.name}>Play mode</h1>
        <p className={styles.hint}>
          The play mode is still being built. It is behind Settings &gt; Experimental &gt; Features in development, and it may change.
        </p>
        <button type="button" className={styles.ghostBtn} onClick={() => setExperimental(true)}>Turn it on</button>
      </div>
    );
  }
  if (!loaded) return <div className={styles.page}>Loading…</div>;
  if (!character) {
    return (
      <div className={styles.page}>
        <p>Character not found.</p>
        <BackButton to="/" label="characters" />
      </div>
    );
  }
  return <PlayInner key={character.id} character={character} />;
}

/** Uma linha da lista de ataques: acerto (ou CD) e dano, com os botões de rolar. */
function AttackRow({ attack, onAttack, onDamage }) {
  const hit = attack.toHit ? signed(attack.toHit.total) : attack.attack ? signed(attack.attack.bonus ?? 0) : null;
  const dmg = attack.damage
    ? `${attack.damage.dice ?? ''}${attack.damage.bonus ? (attack.damage.dice ? signed(attack.damage.bonus) : attack.damage.bonus) : ''}`
    : '';
  const notes = [
    attack.kind === 'cantrip' ? 'Cantrip' : null,
    attack.mastery ? `Mastery: ${attack.mastery}` : null,
    attack.versatile ? `Versatile ${attack.versatile}` : null,
    attack.distance ? `${attack.distance} ft` : null,
    attack.kind === 'weapon' && !attack.equipped ? 'Not equipped' : null,
  ].filter(Boolean);
  return (
    <li className={styles.attack}>
      <div className={styles.attackInfo}>
        <span className={styles.attackName}>{attack.name}</span>
        <span className={styles.attackSub}>
          {dmg} {(attack.damage?.types ?? []).join('/')}
          {notes.length > 0 && <span className={styles.attackNotes}> · {notes.join(' · ')}</span>}
        </span>
      </div>
      <div className={styles.attackButtons}>
        {hit != null ? (
          <RollButton className={styles.rollBtn} title={`${attack.name}: attack roll`} onRoll={(quick) => onAttack(attack, quick)}>
            <span className={styles.rollLabel}>Hit</span>
            <span className={styles.rollValue}>{hit}</span>
          </RollButton>
        ) : attack.save ? (
          <span className={styles.dc} title="The target makes this saving throw">
            <span className={styles.rollLabel}>DC</span>
            <span className={styles.rollValue}>{attack.save.dc ?? '?'} {ABILITY_SHORT[attack.save.ability] ?? ''}</span>
          </span>
        ) : null}
        {attack.damage && (
          <RollButton className={styles.rollBtn} title={`${attack.name}: damage`} onRoll={(quick) => onDamage(attack, {}, quick)}>
            <span className={styles.rollLabel}>Damage</span>
            <Icon name="dice" />
          </RollButton>
        )}
      </div>
    </li>
  );
}

/** A tela do play mode, com o personagem garantido. */
function PlayInner({ character }) {
  const { db } = useData();
  const navigate = useNavigate();
  const derived = useDerived(character);
  const catalog = useMemo(() => derivePlayCatalog(character, db, { derived }), [character, db, derived]);
  const play = usePlayDoc(character.id);
  const [tab, setTab] = useState('Actions');
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState(null);

  useBackLayer(drawer, () => setDrawer(false));

  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setDrawer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const state = play.state ?? emptyPlayState();
  const inCombat = !!state.combat;

  useEffect(() => {
    const t = setTimeout(() => maybeStartTutorial('play'), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!inCombat) return undefined;
    const t = setTimeout(() => maybeStartTutorial('play-combat'), 300);
    return () => clearTimeout(t);
  }, [inCombat]);
  const hp = vitalsOf(state, catalog);
  const hitDice = hitDiceLeft(catalog, state);

  /** Pergunta no diálogo (ou não, no atalho), rola, grava o evento e mostra o total. */
  const roll = async (build, dialog, quick, effects = [], cost = null) => {
    let options = { mode: 'normal', critical: !!dialog.defaultCritical };
    if (!quick) {
      options = await askRoll({ ...dialog, effects });
      if (!options) return;
    }
    options = { ...options, applied: applyEffects(effects, quick ? null : options.effectIds) };
    let event;
    try {
      event = build(options);
    } catch (e) {
      await alert({ title: 'Could not roll', message: String(e?.message ?? e) });
      return;
    }
    record(event, cost);
  };

  /** Grava o evento (com o custo do turno, em combate) e mostra o aviso. */
  const record = (event, cost = null) => {
    const op = cost ? economyOp(state, cost) : null;
    const final = op ? { ...event, ops: [...event.ops, op] } : event;
    const conflicts = play.record(final);
    setToast(final);
    if (conflicts?.length) alert({ title: 'Not applied to the sheet', message: 'The sheet does not have that much, so the item or coins were left as they are.' });
  };

  /** O painel de HP; com concentração, o dano já pede o save de CON. */
  const openHp = async () => {
    const r = await askHp({ catalog, vitals: hp });
    if (!r) return;
    if (r.action === 'heal') {
      record(healEvent({ state, catalog, amount: r.amount }));
      return;
    }
    if (r.action === 'temp') {
      record(tempHpEvent({ state, amount: r.amount, replace: r.replace }));
      return;
    }
    const event = damageEvent({ state, catalog, amount: r.amount, type: r.type, critical: r.critical });
    record(event);
    if (event.payload.concentrationDc) rollConcentration(event.payload.concentrationDc);
  };

  const rollDeathSave = (quick) =>
    roll(
      (options) => deathSaveEvent({ state, catalog, options }),
      { title: 'Death saving throw', kind: 'd20', parts: [], rollData: catalog.rollData, note: '10 or higher succeeds. A 1 counts twice; a 20 brings you back with 1 HP.' },
      quick,
      rollEffects(state, catalog, { kind: 'deathSave' }),
    );

  const rollConcentration = (dc, quick = false) =>
    roll(
      (options) => concentrationCheckEvent({ state, catalog, dc, options }),
      {
        title: 'Concentration save',
        kind: 'd20',
        parts: [{ label: 'Constitution save', formula: checks.concentration.bonus }],
        rollData: catalog.rollData,
        note: `DC ${dc} to keep concentrating${state.concentration?.name ? ` on ${state.concentration.name}` : ''}`,
      },
      quick,
      rollEffects(state, catalog, { kind: 'concentration' }),
    );

  /** O save de concentração pedido pela tela: pergunta a CD (10 por padrão). */
  const askConcentrationSave = async () => {
    const r = await ask({
      title: 'Concentration save',
      message: 'The DC is 10 or half the damage you took, whichever is higher (up to 30).',
      fields: [{ type: 'text', name: 'dc', label: 'DC', default: '10' }],
      actions: [{ label: 'Cancel', value: false }, { label: 'Roll', value: true, tone: 'primary' }],
    });
    const dc = Number.parseInt(r?.values?.dc, 10);
    if (r?.action && Number.isFinite(dc)) rollConcentration(dc);
  };

  /** Começa a concentração no que o jogador digitar. */
  const startConcentration = async () => {
    const r = await ask({
      title: 'Concentrate',
      message: state.concentration ? `Starting a new one ends ${state.concentration.name}.` : 'What are you concentrating on?',
      fields: [{ type: 'text', name: 'name', label: 'Spell or effect', placeholder: 'e.g. Bless' }],
      actions: [{ label: 'Cancel', value: false }, { label: 'Start', value: true, tone: 'primary' }],
    });
    const name = String(r?.values?.name ?? '').trim();
    if (r?.action && name) record(concentrationEvent({ state, name }));
  };

  const endConcentration = () => record(concentrationEvent({ state }));

  /** Liga uma condição escolhida da lista. */
  const addCondition = async () => {
    const free = Object.entries(CONDITIONS).filter(([id]) => !state.conditions?.[id]);
    const r = await ask({
      title: 'Add a condition',
      fields: [{ type: 'select', name: 'id', label: 'Condition', options: free.map(([id, c]) => ({ label: c.name, value: id })) }],
      actions: [{ label: 'Cancel', value: false }, { label: 'Add', value: true, tone: 'primary' }],
    });
    if (r?.action && r.values?.id) record(conditionEvent({ state, id: r.values.id, level: 1 }));
  };

  const setCondition = (id, level) => record(conditionEvent({ state, id, level }));

  /** Liga um efeito manual (o do mestre, ou o de uma magia sem registro). */
  const addEffect = async () => {
    const modifier = await askModifier({ rollData: catalog.rollData, inCombat: !!state.combat });
    if (modifier) record(modifierEvent({ modifier: withRounds(modifier, state, modifier.rounds) }));
  };

  const removeEffect = (id) => record(removeModifierEvent({ state, id }));

  /** O descanso curto: pergunta se está com 0 HP, rola os dados de vida no painel. */
  const shortRest = async () => {
    if (hp.current === 0) {
      const go = await confirm({ title: 'Short rest at 0 HP?', message: 'The rules need at least 1 hit point to start a Short Rest.', confirmLabel: 'Rest anyway' });
      if (!go) return;
    }
    const r = await askShortRest({ catalog, state });
    if (r) record(shortRestEvent({ state, catalog, spends: r.spends }));
  };

  /** Usa uma feature: pergunta o que ela precisa, avisa o que falta, grava. */
  const applyFeature = async (action, activity) => {
    const needs = activity.scalable || activity.heal || activity.attack || (activity.damage ?? []).length > 0
      || (activity.consumes ?? []).some((c) => c.spellSlot != null);
    let options = {};
    if (needs) {
      options = await askUse({ title: action.name === activity.name || !activity.name ? action.name : `${action.name}: ${activity.name}`, catalog, state, action, activity });
      if (!options) return;
    }
    const short = resolveCosts(catalog, state, activity, options).filter((c) => c.amount > 0 && leftOf(catalog, state, c.key) < c.amount);
    if (short.length && !(await confirm({ title: 'Not enough left', message: 'There is not enough left to pay for this. Use it anyway?', confirmLabel: 'Use anyway' }))) return;
    let event;
    try {
      const applied = activity.attack ? applyEffects(rollEffects(state, catalog, { kind: 'attack', attackAbility: activity.attack.ability })) : undefined;
      event = activityEvent({ catalog, state, action, activity, options: { ...options, applied } });
    } catch (e) {
      await alert({ title: 'Could not use it', message: String(e?.message ?? e) });
      return;
    }
    record(event, costOfActivation(activity.activation?.type));
  };

  /** As recuperações especiais: Arcane Recovery, Natural Recovery, Font of Magic. */
  const special = async (action, rule) => {
    if (rule.kind === 'fontOfMagic') {
      const r = await askFontOfMagic({ catalog, state, rule });
      if (r) record(fontOfMagicEvent({ catalog, state, action, mode: r.mode, level: r.level }));
      return;
    }
    const r = await askSlotRecovery({ title: action.name, catalog, state, rule });
    if (r) record(slotRecoveryEvent({ catalog, state, action, picks: r.picks }));
  };

  const adjust = (key, delta) => record(adjustResourceEvent({ catalog, key, delta }));

  /** Lança uma magia: escolhe a forma, grava e abre a rolagem dela. */
  const castSpell = async (origin, spell) => {
    const ways = castWays(catalog, state, spell);
    let way = ways.length === 1 && ways[0].left == null ? ways[0] : null;
    let onSelf = false;
    if (!way) {
      const r = await askCast({ catalog, state, origin, spell });
      if (!r) return;
      way = r.way;
      onSelf = !!r.onSelf;
    }
    if (way.key && (way.left ?? 0) < 1 && !(await confirm({ title: 'Nothing left', message: `No ${way.label.toLowerCase()} is left. Cast anyway?`, confirmLabel: 'Cast anyway' }))) return;
    record(castEvent({ catalog, state, origin, spell, way, onSelf }), costOfActivation(spell.time));
    if (spell.mechanics?.attack) rollAttack(spellAttackOf(origin, spell, way.level));
    else if (spell.mechanics?.damage?.dice) rollDamage(spellAttackOf(origin, spell, way.level));
    else if (spell.mechanics?.heal?.dice) rollSpellHeal(origin, spell, way.level);
  };

  /** Rola a cura de uma magia; o diálogo pergunta se é no próprio personagem. */
  const rollSpellHeal = (origin, spell, level, quick = false) =>
    roll(
      (options) => spellHealEvent({ catalog, state, origin, spell, level, options }),
      { title: `${spell.name}: healing`, kind: 'damage', parts: healParts(origin, spell, level), rollData: catalog.rollData, healOption: true },
      quick,
    );

  /** Os botões do cartão de uma magia lançada: ataque, dano e cura no círculo dela. */
  const spellRoll = (spellKey, level, kind) => {
    const origin = catalog.spells.find((o) => o.spells.some((s) => s.key === spellKey));
    const spell = origin?.spells.find((s) => s.key === spellKey);
    if (!spell) {
      alert({ title: 'Spell not found', message: 'This spell is no longer on the sheet.' });
      return;
    }
    setDrawer(false);
    if (kind === 'attack') rollAttack(spellAttackOf(origin, spell, level));
    else if (kind === 'damage') rollDamage(spellAttackOf(origin, spell, level));
    else rollSpellHeal(origin, spell, level);
  };

  /** O descanso longo: mostra o que vai voltar e grava. */
  const longRest = async () => {
    const event = longRestEvent({ state, catalog });
    const lines = event.payload.lines;
    const ok = await confirm({
      title: 'Long rest',
      message: lines.length ? lines.map((l) => `${l.name}: ${l.detail}`).join('\n') : 'You are fully rested; nothing to recover.',
      confirmLabel: 'Finish long rest',
    });
    if (ok) record(event);
  };

  /** A descrição de um teste para o rollEffects (o tipo, o atributo, a perícia). */
  const rollOf = (test) => {
    if (test.type === 'save') return { kind: 'save', ability: test.id };
    if (test.type === 'initiative') return { kind: 'initiative', ability: 'dex' };
    if (test.type === 'skill') {
      const s = checks.skills.find((x) => x.skill === test.id);
      return { kind: 'check', ability: s?.ability, skill: test.id, proficient: (s?.prof ?? 0) >= 1 };
    }
    return { kind: 'check', ability: test.id };
  };

  const rollTest = (test, name, quick) =>
    roll(
      (options) => rollTestEvent({ catalog, test, name, options }),
      { title: name, kind: 'd20', parts: testParts(catalog, test), rollData: catalog.rollData },
      quick,
      rollEffects(state, catalog, rollOf(test)),
    );

  const rollAttack = (attack, quick, spend = false) =>
    roll(
      (options) => {
        const event = rollAttackEvent({ catalog, attack, options });
        if (!spend) return event;
        const ammo = ammoOps({ character, derivedInventory: derived.inventory, attack });
        return { ...event, ops: [...event.ops, ...ammo.ops], payload: { ...event.payload, ammo: ammo.ammo, ammoLeft: ammo.left, ammoMissing: ammo.missing } };
      },
      {
        title: `${attack.name}: attack`,
        kind: 'd20',
        parts: attack.toHit?.parts ?? [{ label: 'Spell attack', formula: attack.attack?.bonus ?? 0 }],
        rollData: catalog.rollData,
      },
      quick,
      rollEffects(state, catalog, { kind: 'attack', weapon: attack.kind === 'weapon' || attack.kind === 'unarmed', attackAbility: attack.ability }),
      spend ? 'action' : null,
    );

  const rollDamage = (attack, { critical = false } = {}, quick = false) =>
    roll(
      (options) => rollDamageEvent({ catalog, attack, options }),
      {
        title: `${attack.name}: damage`,
        kind: 'damage',
        parts: damageParts(attack),
        rollData: catalog.rollData,
        defaultCritical: critical,
        versatileDice: attack.versatile ?? null,
        note: attack.save ? `The target makes a DC ${attack.save.dc} ${ABILITY_FULL[attack.save.ability] ?? ''} saving throw` : '',
      },
      quick,
      rollEffects(state, catalog, { kind: 'damage', weapon: attack.kind === 'weapon' || attack.kind === 'unarmed', attackAbility: attack.ability }),
    );

  /** O "Roll damage" do cartão de um ataque no histórico. */
  const damageFromHistory = (attackKey, opts) => {
    const attack = catalog.attacks.find((a) => a.key === attackKey);
    if (!attack) {
      alert({ title: 'Attack not found', message: 'This attack is no longer on the sheet.' });
      return;
    }
    setDrawer(false);
    rollDamage(attack, opts);
  };

  /** Usa um consumível; a poção de cura pergunta se é bebida ou dada. */
  const consumeItem = async (entry) => {
    let applyHeal = true;
    if (healOf(entry.raw)) {
      const r = await ask({
        title: entry.raw.name,
        message: 'Drink it yourself, or give it to someone else? Either way one is spent.',
        actions: [{ label: 'Cancel', value: null }, { label: 'Give it', value: 'other' }, { label: 'Drink', value: 'self', tone: 'primary' }],
      });
      if (!r) return;
      applyHeal = r === 'self';
    }
    let event;
    try {
      event = itemUseEvent({ catalog, state, character, entry, options: { applyHeal } });
    } catch (e) {
      await alert({ title: 'Could not use it', message: String(e?.message ?? e) });
      return;
    }
    record(event, itemCostOf(entry.raw));
  };

  const changeQuantity = (entry, delta) => record(quantityEvent({ character, entry, delta }));

  /** Gastar ou ganhar moedas pelo diálogo. */
  const spendMoney = async () => {
    const r = await askCurrency({ currency: character.currency ?? {} });
    if (r) record(currencyEvent(r));
  };

  const startCombat = (quick) =>
    roll(
      (options) => startCombatEvent({ catalog, options }),
      { title: 'Initiative', kind: 'd20', parts: testParts(catalog, { type: 'initiative' }), rollData: catalog.rollData, note: 'Starts combat at round 1' },
      quick,
      rollEffects(state, catalog, { kind: 'initiative', ability: 'dex' }),
    );

  const nextTurn = () => record(nextTurnEvent({ state }));

  const endCombat = () => record(endCombatEvent({ state }));

  const toggleEconomy = (cost) => record(economyEvent({ state, cost, used: !state.combat?.used?.[cost] }));

  /** Desfaz ou refaz e avisa se um item do inventário não pôde voltar. */
  const moveCursor = (fn, verb) => {
    const r = fn();
    if (r?.conflicts?.length) {
      alert({ title: `Could not ${verb} everything`, message: 'An item changed on the sheet since this action, so it was left as it is now.' });
    }
  };
  const undo = () => moveCursor(play.undo, 'undo');
  const redo = () => moveCursor(play.redo, 'redo');

  const lastApplied = play.doc && play.doc.cursor > 0 ? play.doc.events[play.doc.cursor - 1] : null;
  const nextUndone = play.doc && play.doc.cursor < play.doc.events.length ? play.doc.events[play.doc.cursor] : null;

  const setTutEnabled = useTutorialStore((s) => s.setEnabled);
  const resetTutorials = useTutorialStore((s) => s.resetSeen);
  /** Liga e zera os tutoriais e abre o tour do play mode; os outros voltam nas telas deles. */
  const replayTutorials = () => {
    setTutEnabled(true);
    resetTutorials();
    startTutorial('play');
  };
  const openSettings = () => menu({ title: 'Settings', content: <SettingsMenu onReplayTutorials={replayTutorials} /> });

  const checks = catalog.checks;

  return (
    <div className={`${styles.page} motion-page`}>
      <div className={styles.topBar}>
        <BackButton to="/" label="characters" />
        <div className={styles.topActions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={undo}
            data-tour={TUT.PLAY_UNDO}
            disabled={!play.canUndo}
            title={lastApplied ? `Undo: ${lastApplied.label}` : 'Nothing to undo'}
            aria-label="Undo"
          >
            <Icon name="undo" />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={redo}
            disabled={!play.canRedo}
            title={nextUndone ? `Redo: ${nextUndone.label}` : 'Nothing to redo'}
            aria-label="Redo"
          >
            <Icon name="redo" />
          </button>
          <button type="button" className={`${styles.iconBtn} ${styles.historyBtn}`} onClick={() => setDrawer(true)} title="History" aria-label="History" data-tour={TUT.PLAY_HISTORY}>
            <Icon name="history" />
          </button>
          <MenuButton
            buttonClassName={styles.iconBtn}
            buttonTitle="Menu"
            items={[
              { label: 'Edit sheet', sub: 'Choices, level, gear and spells', onClick: () => navigate(`/build/${character.id}`) },
              { label: 'Glossary', sub: 'Search every rule, spell, item and feature', onClick: openGlossary },
              { label: 'Settings', sub: 'Theme and play history', onClick: openSettings },
            ]}
          >
            <span aria-hidden="true"><Icon name="menu" /></span>
          </MenuButton>
        </div>
      </div>

      <header className={styles.hero}>
        <span className={styles.portrait} aria-hidden="true">
          {character.meta.portrait ? <img src={character.meta.portrait} alt="" /> : <Icon name="portrait" />}
        </span>
        <span className={styles.heroText}>
          <span className={styles.name}>{character.meta.name || 'Unnamed'}</span>
          <span className={styles.sub}>{classSummary(character) || 'No class set'}</span>
        </span>
      </header>

      <div className={styles.stats} data-tour={TUT.PLAY_STATS}>
        <button type="button" className={`${styles.stat} ${styles.statBtn} ${styles.hpStat}`} onClick={openHp} title="Damage, healing or temporary hit points">
          <span className={styles.statLabel}>Hit points</span>
          <span className={styles.statValue}>
            <AnimatedNumber value={hp.current} /><span className={styles.statMax}>/{hp.max}</span>
          </span>
          {hp.temp > 0 && <span className={styles.statNote}>+{hp.temp} temp</span>}
        </button>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Armor class</span>
          <span className={effectiveAc(catalog, state) !== catalog.stats.ac ? `${styles.statValue} ${styles.changed}` : styles.statValue}>
            {effectiveAc(catalog, state) ?? '-'}
          </span>
        </div>
        <RollButton className={`${styles.stat} ${styles.statBtn}`} title="Initiative" onRoll={(quick) => rollTest({ type: 'initiative' }, 'Initiative', quick)}>
          <span className={styles.statLabel}>Initiative</span>
          <span className={styles.statValue}>{signed(checks.initiative.bonus)}</span>
        </RollButton>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Speed</span>
          <span className={effectiveSpeed(catalog, state) !== catalog.stats.speed ? `${styles.statValue} ${styles.changed}` : styles.statValue}>
            {effectiveSpeed(catalog, state) != null ? `${effectiveSpeed(catalog, state)} ft` : '-'}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Proficiency</span>
          <span className={styles.statValue}>{signed(catalog.stats.profBonus)}</span>
        </div>
      </div>

      <section className={styles.status} data-tour={TUT.PLAY_STATUS}>
        {(hp.current === 0 && hp.max > 0) || hp.death.dead ? (
          <div className={hp.death.dead ? `${styles.deathCard} ${styles.deadCard}` : styles.deathCard}>
            <span className={styles.deathTitle}>{hp.death.dead ? 'Dead' : hp.death.stable ? 'Stable' : 'Dying'}</span>
            {hp.dying && (
              <>
                <span className={styles.pips} title="Successes">
                  {[0, 1, 2].map((i) => <span key={i} className={i < hp.death.success ? `${styles.pip} ${styles.pipOk}` : styles.pip} />)}
                </span>
                <span className={styles.pips} title="Failures">
                  {[0, 1, 2].map((i) => <span key={i} className={i < hp.death.failure ? `${styles.pip} ${styles.pipBad}` : styles.pip} />)}
                </span>
                <RollButton className={styles.rollBtn} title="Death saving throw" onRoll={rollDeathSave}>
                  <span className={styles.rollLabel}>Death save</span>
                  <Icon name="dice" />
                </RollButton>
              </>
            )}
            <span className={styles.deathHint}>{hp.death.dead ? 'Healing or the DM can bring you back.' : 'Any healing brings you back.'}</span>
          </div>
        ) : null}
        <div className={styles.statusRow}>
          {Object.entries(state.conditions ?? {}).filter(([, level]) => level > 0).map(([id, level]) => (
            <span key={id} className={`${styles.chip} ${styles.condChip}`} title={(CONDITIONS[id]?.notes ?? []).join('. ')}>
              <span className={styles.chipText}>{CONDITIONS[id]?.name ?? id}{CONDITIONS[id]?.levels ? ` ${level}` : ''}</span>
              {CONDITIONS[id]?.levels && (
                <>
                  <button type="button" className={styles.chipBtn} onClick={() => setCondition(id, level - 1)} aria-label="One level less">-</button>
                  <button type="button" className={styles.chipBtn} onClick={() => setCondition(id, Math.min(CONDITIONS[id].levels, level + 1))} aria-label="One level more">+</button>
                </>
              )}
              {!CONDITIONS[id]?.levels && <button type="button" className={styles.chipBtn} onClick={() => setCondition(id, 0)} aria-label={`End ${CONDITIONS[id]?.name ?? id}`}>x</button>}
            </span>
          ))}
          {(state.modifiers ?? []).map((m) => (
            <span key={m.id} className={styles.chip} title={m.concentration ? 'Ends with your concentration' : undefined}>
              <span className={styles.chipText}>{m.label}{state.combat && m.rounds && m.startRound != null ? ` (${m.startRound + m.rounds - state.combat.round} rd)` : ''}</span>
              <button type="button" className={styles.chipBtn} onClick={() => removeEffect(m.id)} aria-label={`End ${m.label}`}>x</button>
            </span>
          ))}
          <button type="button" className={styles.ghostBtn} onClick={addCondition}>+ Condition</button>
          <button type="button" className={styles.ghostBtn} onClick={addEffect}>+ Effect</button>
        </div>
        {(state.conditions?.exhaustion ?? 0) >= 6 && <p className={styles.deathHint}>Exhaustion 6: the character dies.</p>}
        {state.combat ? (
          <div className={styles.combatBar} data-tour={TUT.PLAY_COMBAT}>
            <span className={styles.combatRound}>Round {state.combat.round} · Init {state.combat.initiative}</span>
            <span className={styles.econ}>
              {ECONOMY.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={state.combat.used?.[c] ? `${styles.econBtn} ${styles.econUsed}` : styles.econBtn}
                  onClick={() => toggleEconomy(c)}
                  aria-pressed={!!state.combat.used?.[c]}
                  title={state.combat.used?.[c] ? `${ECONOMY_LABEL[c]} used (tap to give it back)` : `${ECONOMY_LABEL[c]} available (tap to mark it used)`}
                >
                  {ECONOMY_LABEL[c]}
                </button>
              ))}
            </span>
            <span className={styles.restBtns}>
              <button type="button" className={styles.ghostBtn} onClick={nextTurn}>Next turn</button>
              <button type="button" className={styles.ghostBtn} onClick={endCombat}>End combat</button>
            </span>
          </div>
        ) : null}
        <div className={styles.statusRow}>
          {state.concentration ? (
            <span className={styles.chip}>
              <span className={styles.chipText}>Concentrating: {state.concentration.name}{state.combat && state.concentration.expiresRound ? ` (${state.concentration.expiresRound - state.combat.round} rd)` : ''}</span>
              <button type="button" className={styles.chipBtn} onClick={askConcentrationSave}>Save</button>
              <button type="button" className={styles.chipBtn} onClick={endConcentration}>End</button>
            </span>
          ) : (
            <button type="button" className={styles.ghostBtn} onClick={startConcentration}>+ Concentration</button>
          )}
          <span className={styles.hitDice} title="Hit Point Dice left">
            Hit dice {hitDice.map((h) => `${h.left}/${h.max} d${h.faces}`).join(' · ') || '-'}
          </span>
          <span className={styles.restBtns}>
            {!state.combat && (
              <RollButton className={styles.ghostBtn} title="Roll initiative and start combat" onRoll={startCombat}>
                Start combat
              </RollButton>
            )}
            <button type="button" className={styles.ghostBtn} onClick={shortRest}>Short rest</button>
            <button type="button" className={styles.ghostBtn} onClick={longRest}>Long rest</button>
          </span>
        </div>
      </section>

      <div className={styles.layout}>
        <main className={styles.main}>
          <nav className={styles.tabBar} data-tour={TUT.PLAY_TABS}>
            {TABS.map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={tab === t ? `${styles.tab} ${styles.tabActive}` : styles.tab}>
                {t}
              </button>
            ))}
          </nav>

          {tab === 'Actions' && (
            <section className={styles.panel}>
              <h2 className={styles.heading}>Attacks</h2>
              <ul className={styles.attacks} data-tour={TUT.PLAY_ROLLS}>
                {catalog.attacks.map((a) => (
                  <AttackRow key={a.key} attack={a} onAttack={(x, quick) => rollAttack(x, quick, true)} onDamage={rollDamage} />
                ))}
              </ul>
              <p className={styles.hint}>Tap to choose advantage, a bonus or physical dice. Hold (or Shift-click) to roll right away.</p>
            </section>
          )}

          {tab === 'Features' && (
            <FeaturesTab catalog={catalog} state={state} onUse={applyFeature} onSpecial={special} onAdjust={adjust} />
          )}

          {tab === 'Spells' && (
            <SpellsTab catalog={catalog} state={state} onCast={castSpell} onAdjust={adjust} />
          )}

          {tab === 'Inventory' && (
            <InventoryTab
              catalog={catalog}
              state={state}
              character={character}
              inventory={derived.inventory}
              onUse={consumeItem}
              onQuantity={changeQuantity}
              onAdjust={adjust}
              onMoney={spendMoney}
            />
          )}

          {tab === 'Checks' && (
            <section className={styles.panel}>
              <h2 className={styles.heading}>Abilities and saving throws</h2>
              <div className={styles.abilities}>
                {checks.abilities.map((a) => (
                  <div key={a.ability} className={styles.ability}>
                    <span className={styles.abilityName}>{ABILITY_FULL[a.ability]}</span>
                    <div className={styles.abilityButtons}>
                      <RollButton className={styles.rollBtn} title={`${ABILITY_FULL[a.ability]} check`} onRoll={(quick) => rollTest({ type: 'ability', id: a.ability }, `${ABILITY_FULL[a.ability]} check`, quick)}>
                        <span className={styles.rollLabel}>Check</span>
                        <span className={styles.rollValue}>{signed(a.mod)}</span>
                      </RollButton>
                      <RollButton className={a.saveProf ? `${styles.rollBtn} ${styles.prof}` : styles.rollBtn} title={`${ABILITY_FULL[a.ability]} saving throw`} onRoll={(quick) => rollTest({ type: 'save', id: a.ability }, `${ABILITY_FULL[a.ability]} save`, quick)}>
                        <span className={styles.rollLabel}>Save</span>
                        <span className={styles.rollValue}>{signed(a.save)}</span>
                      </RollButton>
                    </div>
                  </div>
                ))}
              </div>

              <h2 className={styles.heading}>Skills</h2>
              <ul className={styles.skills}>
                {[...checks.skills].sort((x, y) => (SKILL_LABEL[x.skill] ?? x.skill).localeCompare(SKILL_LABEL[y.skill] ?? y.skill)).map((s) => (
                  <li key={s.skill}>
                    <RollButton className={styles.skill} title={SKILL_LABEL[s.skill]} onRoll={(quick) => rollTest({ type: 'skill', id: s.skill }, SKILL_LABEL[s.skill] ?? s.skill, quick)}>
                      <span className={s.prof >= 2 ? `${styles.dot} ${styles.dotExpert}` : s.prof >= 1 ? `${styles.dot} ${styles.dotProf}` : styles.dot} aria-hidden="true" />
                      <span className={styles.skillName}>{SKILL_LABEL[s.skill] ?? s.skill}</span>
                      <span className={styles.skillAbility}>{ABILITY_SHORT[s.ability]}</span>
                      <span className={styles.skillValue}>{signed(s.bonus)}</span>
                    </RollButton>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>

        <aside className={styles.side} data-tour={TUT.PLAY_HISTORY}>
          <h2 className={styles.heading}>History</h2>
          <PlayHistory doc={play.doc} onDamage={damageFromHistory} onConcentration={(dc) => rollConcentration(dc)} concentrating={!!state.concentration} onSpell={spellRoll} />
        </aside>
      </div>

      {drawer && (
        <div className={styles.drawerOverlay} onMouseDown={(e) => e.target === e.currentTarget && setDrawer(false)}>
          <div className={`${styles.drawer} motion-rise`} role="dialog" aria-label="History">
            <div className={styles.drawerHead}>
              <h2 className={styles.heading}>History</h2>
              <button type="button" className={styles.iconBtn} onClick={() => setDrawer(false)} aria-label="Close">
                <Icon name="close" />
              </button>
            </div>
            <PlayHistory
              doc={play.doc}
              onDamage={damageFromHistory}
              onConcentration={(dc) => {
                setDrawer(false);
                rollConcentration(dc);
              }}
              concentrating={!!state.concentration}
              onSpell={spellRoll}
            />
          </div>
        </div>
      )}

      {toast && (
        <button key={toast.id} type="button" className={`${styles.toast} motion-pop`} onClick={() => { setToast(null); setDrawer(true); }}>
          <span className={styles.toastLabel}>{toast.label}</span>
          <span className={styles.toastTotal}>{toastNumber(toast)}</span>
          {(toast.rolls?.isCritical || toast.payload?.critical) && (
            <span className={styles.toastTag}>{['attack', 'damageRoll', 'use'].includes(toast.kind) ? 'Critical' : 'Natural 20'}</span>
          )}
          {toast.rolls?.isFumble && <span className={styles.toastTag}>Natural 1</span>}
        </button>
      )}
    </div>
  );
}
