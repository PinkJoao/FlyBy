// =============================================================================
// Play: o modo jogo da página do personagem
// =============================================================================
// O QUE FAZ
//   O play mode (docs/PLAY-MODE-PLAN.md), o modo JOGO da página do personagem
//   (pages/Character, DDL-0117: o seletor Sheet | Play no topo): lê o mesmo
//   personagem e a mesma derivação, mais o catálogo de jogo (engine/playCatalog) e
//   o documento de jogo (usePlayDoc).
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
//   Fase C5: condições e efeitos (engine/playEffects), hoje em cards próprios; cada
//   rolagem leva os efeitos que valem para ela (o diálogo mostra cada um para
//   desligar); a CA e o deslocamento já saem com eles.
//   Polimento (DDL-0112, DDL-0113): o topo é o da ficha, os tiles (iniciativa,
//   HP, CA, movimento: PlayTiles), os atributos em mini cards (AbilityCards) e o
//   painel de proficiências da própria ficha (ProficienciesCard).
//   Fase C6: a aba Inventory (consumíveis, munição, cargas, moedas, engine/
//   playInventory) e o combate leve (iniciativa, rodada, economia do turno e
//   durações em rodadas, engine/playCombat) numa barra na faixa de estado.
//   DDL-0120: o card de HP expande com Heal, Hurt e Hit dice, o de movimento com
//   Move e Dash; Conditions e Effects viram cards expansíveis abaixo do de
//   proficiências, e saves, perícias e ferramentas desse card rolam ao toque.
//
// FUNÇÕES
//   signed(n): o número com sinal.
//   PlayInner(props): o modo jogo, com o personagem garantido (quem carrega é a
//     pages/Character); os descansos e a coluna do histórico entram por portal nos
//     lugares dela (`levelSlot`, `sideSlot`).
//     roll(build, dialog, quick): pergunta (ou não), rola, grava e mostra.
//     rollTest(test, name, quick), rollAttack(attack, quick, spend),
//       rollDamage(attack, opts, quick): os três tipos de rolagem da C2.
//     damageFromHistory(attackKey, opts): o "Roll damage" do cartão do ataque.
//     openTab(tab): troca de aba lembrando a direção (para o painel entrar do
//       lado certo).
//     moveCursor(fn, verb), undo(), redo(): mexem no cursor e avisam um
//       conflito de inventário.
//     record(event, cost): grava (marcando o custo do turno, em combate) e mostra o aviso.
//     openHeal(), openHurt(), openHitDice(): os botões do card de HP; com
//       concentração, o dano já pede o save.
//     rollDeathSave(quick), rollConcentration(dc, quick), askConcentrationSave(),
//       startConcentration(), endConcentration(): morte e concentração.
//     shortRest(), longRest(): os descansos.
//     applyFeature(action, activity), special(action, rule), adjust(key, delta):
//       usar uma feature, as recuperações especiais e o ajuste à mão.
//     checkAbility(ability), saveAbility(ability, quick): o Check (o seletor de
//       perícia e então a rolagem) e o Save de um card de atributo.
//     addCondition(), setCondition(id, level), addEffect(), removeEffect(id):
//       condições e efeitos.
//     castSpell(origin, spell), spellRoll(spellKey, level, kind),
//       rollSpellHeal(origin, spell, level): lançar e as rolagens da magia.
//     consumeItem(entry), changeQuantity(entry, delta), spendMoney(): o inventário.
//     startCombat(quick), nextTurn(), endCombat(), toggleEconomy(cost): o combate.
//     rollInitiative(quick): o tile: fora de combate começa um; nele, só rola.
//     moveFeet(dash): o Move e o Dash do card de movimento (quantos pés).
//     rollTool(name): o teste de uma ferramenta, com o atributo escolhido.
//   AttackRow(props): uma linha da lista de ataques.
//   HistoryHead(props): o título do histórico com desfazer e refazer.
//   toastNumber(event): o número do aviso de um evento.
//
// DECISÕES E ARMADILHAS
//   - O histórico é uma COLUNA ao lado da página a partir de 1140px (WIDE_QUERY,
//     o mesmo número do Play.module.css) e, mais estreito, a PRIMEIRA aba
//     (DDL-0115); não há botão nem gaveta. Saindo do estreito para o largo com a
//     aba History aberta, a tela mostra Actions. Depois de cada rolagem, um aviso
//     curto embaixo mostra o total (some sozinho; tocar abre a aba History).
//   - Desfazer e refazer moram no HISTÓRICO (HistoryHead, DDL-0116): no topo da
//     coluna e da aba History, ao lado do que eles mexem. O topo da página fica com
//     o voltar e o menu, como na ficha.
//   - O PERFIL é o da página (CharacterIdentity, DDL-0119), o mesmo da ficha e
//     editável aqui também; no lugar do controle de nível entram os botões Short
//     rest e Long rest (`levelSlot`).
//   - O LAYOUT é o da ficha (DDL-0114): a página, o topo, os tiles e atributos no
//     .header da ficha, o painel de proficiências no .stack, a barra de abas, o
//     painel que entra deslizando (slideClass) e o arrastar para trocar de aba
//     (useSwipeNav), tudo com as classes da própria ficha. Só o perfil, a faixa de
//     estado (condições, efeitos, combate) e o histórico são do play mode; a
//     coluna do histórico é posta pela pages/Character (sideSlot).
//   - O play mode é um recurso EXPERIMENTAL (DDL-0111): sem "Features in
//     development" ligado não há seletor nem botão Play, e /play/:id vira a ficha.
//   - Os atributos são os mini cards da ficha (AbilityCards, o mesmo CSS): aberto,
//     Check leva ao seletor de perícia (SkillCheckPanel, com os bônus em fixos,
//     rolados e condicionais) e Save à rolagem. Não há mais aba Checks.
//   - `data-flip` marca o que a troca de modo anima (pages/Character, DDL-0118): os
//     descansos, as proficiências, a faixa de estado, a barra de abas e o painel.
//   - Ficha e jogo são MODOS da mesma página (DDL-0117): o voltar leva à lista de
//     personagens, e o menu é o da página, o mesmo da ficha (DDL-0120).
//   - Rolar a iniciativa É começar o combate: o tile Roll initiative substitui o
//     antigo "Start combat"; em combate, ele só rola (o combate segue).
//   - O play mode NÃO edita decisões de build (pergunta 7 do plano): elas são do
//     modo ficha.
//   - Dano sofrido com concentração abre logo o save de CON com a CD (como o
//     aviso do Foundry); cancelar deixa o botão no cartão do dano para depois.
//   - O Hurt do card de HP não tem tipo de dano (DDL-0120): só o número e se corta
//     o máximo. Os dados de vida pelo card rolam sem diálogo de rolagem (são vários
//     de uma vez) e vão inteiros para o evento.
//   - Ferramenta: o 2024 não fixa o atributo, então o jogador escolhe (Destreza
//     primeiro, a mais comum nas ferramentas de ladrão e afins).
//   - Descanso com 0 HP: a regra exige 1 HP, então a tela PERGUNTA (liberdade com
//     aviso, §6.4). O longo mostra o que vai voltar antes de gravar.
//   - Usar uma feature sem nada a escolher (um utilitário que só gasta) grava
//     direto; com escala, slot, cura ou rolagem, o UsePanel pergunta antes.
//     Faltando recurso, a tela pergunta (liberdade com aviso, §6.4).
//   - Depois de lançar, a rolagem da magia já abre: o ataque, se ela ataca; senão o
//     dano, ou a cura. Cancelar deixa os botões no cartão da magia.
//   - Os efeitos de uma rolagem saem do estado de AGORA: a rolagem aberta logo
//     depois de lançar uma magia não vê o efeito que essa magia acabou de ligar
//     (a próxima já vê). O atalho (Shift, no desktop) usa o padrão de cada um.
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

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../data/dataContext';
import usePlayDoc from '../hooks/usePlayDoc';
import { useSwipeNav } from '../hooks/useSwipeNav';
import useMediaQuery from '../hooks/useMediaQuery';
import { directionOf, slideClass } from '../motion';
import { derivePlayCatalog } from '../engine/playCatalog';
import {
  vitals as vitalsOf, healEvent, tempHpEvent, maxHpEvent, hurtEvent, deathSaveEvent, concentrationEvent, concentrationCheckEvent,
} from '../engine/playHealth';
import { shortRestEvent, longRestEvent, hitDiceLeft, hitDiceEvent } from '../engine/playRest';
import { emptyPlayState } from '../engine/playState';
import { activityEvent, slotRecoveryEvent, fontOfMagicEvent, adjustResourceEvent, resolveCosts, left as leftOf } from '../engine/playUse';
import { castWays, castEvent, spellAttackOf, healParts, spellHealEvent } from '../engine/playCast';
import {
  CONDITIONS, rollEffects, applyEffects, effectiveAc, effectiveSpeed, effectiveSpeeds, conditionEvent, modifierEvent, removeModifierEvent,
} from '../engine/playEffects';
import { testParts, rollTestEvent, rollAttackEvent, damageParts, rollDamageEvent } from '../engine/playActions';
import { itemUseEvent, quantityEvent, ammoOps, currencyEvent, itemCostOf, healOf } from '../engine/playInventory';
import {
  ECONOMY, startCombatEvent, nextTurnEvent, endCombatEvent, economyEvent, economyOp, costOfActivation, withRounds,
  movementLeft, moveEvent, dashEvent,
} from '../engine/playCombat';
import { askRoll } from '../components/play/rollDialog';
import { askHeal, askHurt, askHitDice, askShortRest, askUse, askCast, askSlotRecovery, askFontOfMagic, askModifier, askCurrency, askSkillCheck, askMove } from '../components/play/playDialogs';
import FeaturesTab from '../components/play/FeaturesTab';
import SpellsTab from '../components/play/SpellsTab';
import InventoryTab from '../components/play/InventoryTab';
import RollButton from '../components/play/RollButton';
import PlayHistory from '../components/play/PlayHistory';
import Icon from '../components/common/Icon';
import { alert, ask, confirm } from '../components/common/dialog';
import { maybeStartTutorial } from '../store/tutorialStore';
import { TUT } from '../tutorial/anchors';
import { ABILITY_FULL, ABILITY_SHORT } from '../components/builder/labels';
import { rollOf } from '../engine/playChecks';
import AbilityCards from '../components/play/AbilityCards';
import PlayTiles from '../components/play/PlayTiles';
import ProficienciesCard from '../components/builder/ProficienciesCard';
import ConditionsCard from '../components/play/ConditionsCard';
import EffectsCard from '../components/play/EffectsCard';
import { SKILL_LABEL } from '../components/builder/labels';
import sheetPage from './Builder.module.css';
import sheetHeader from '../components/builder/StatsHeader.module.css';
import styles from './Play.module.css';

const TABS = ['Actions', 'Features', 'Spells', 'Inventory'];

// ATENÇÃO: o mesmo número do @media do .shell no Play.module.css.
const WIDE_QUERY = '(min-width: 1140px)';

const ECONOMY_LABEL = { action: 'Action', bonus: 'Bonus', reaction: 'Reaction' };

const TOAST_MS = 4000;

/** O número com sinal ("+3", "-1"). */
const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);

/** O número do aviso de um evento: o total rolado, o dano, a cura ou o temporário. */
const toastNumber = (e) => e.rolls?.total ?? e.payload?.taken ?? e.payload?.healed ?? e.payload?.to ?? e.payload?.round ?? e.payload?.left ?? null;

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

/** O título do histórico com desfazer e refazer (na coluna e na aba). */
function HistoryHead({ onUndo, onRedo, canUndo, canRedo, lastLabel, nextLabel }) {
  return (
    <div className={styles.historyHead}>
      <h2 className={styles.heading}>History</h2>
      <span className={styles.historyActions}>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onUndo}
          disabled={!canUndo}
          title={lastLabel ? `Undo: ${lastLabel}` : 'Nothing to undo'}
          aria-label="Undo"
        >
          <Icon name="undo" />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onRedo}
          disabled={!canRedo}
          title={nextLabel ? `Redo: ${nextLabel}` : 'Nothing to redo'}
          aria-label="Redo"
        >
          <Icon name="redo" />
        </button>
      </span>
    </div>
  );
}

/** A tela do play mode, com o personagem garantido. */
export function PlayInner({ character, derived, sideSlot, levelSlot }) {
  const { db } = useData();
  const catalog = useMemo(() => derivePlayCatalog(character, db, { derived }), [character, db, derived]);
  const play = usePlayDoc(character.id);
  const wide = useMediaQuery(WIDE_QUERY);
  const tabs = wide ? TABS : ['History', ...TABS];
  const [tab, setTab] = useState('Actions');
  const activeTab = tabs.includes(tab) ? tab : 'Actions';
  const [tabDir, setTabDir] = useState(null);
  const swipeRef = useRef(null);
  const tabIndex = tabs.indexOf(activeTab);
  /** Troca de aba lembrando a direção, para o painel novo entrar do lado certo. */
  const openTab = (next) => {
    if (!next || next === activeTab) return;
    setTabDir(directionOf(tabs.indexOf(activeTab), tabs.indexOf(next)));
    setTab(next);
  };
  useSwipeNav(swipeRef, {
    onPrev: () => openTab(tabs[tabIndex - 1]),
    onNext: () => openTab(tabs[tabIndex + 1]),
    canPrev: tabIndex > 0,
    canNext: tabIndex < tabs.length - 1,
  });
  const [toast, setToast] = useState(null);


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

  /** O Heal do card de HP: curar, temporário ou máximo. */
  const openHeal = async () => {
    const r = await askHeal({ vitals: hp });
    if (!r) return;
    if (r.kind === 'temp') record(tempHpEvent({ state, amount: r.amount, replace: r.replace }));
    else if (r.kind === 'max') record(maxHpEvent({ state, catalog, amount: r.amount }));
    else record(healEvent({ state, catalog, amount: r.amount }));
  };

  /** O Hurt do card de HP; com concentração, o dano já pede o save de CON. */
  const openHurt = async () => {
    const r = await askHurt({ vitals: hp });
    if (!r) return;
    const event = hurtEvent({ state, catalog, amount: r.amount, affectMax: r.affectMax });
    record(event);
    if (event.payload.concentrationDc) rollConcentration(event.payload.concentrationDc);
  };

  /** O Hit dice do card de HP: gastar (rolando) ou devolver. */
  const openHitDice = async () => {
    const r = await askHitDice({ dice: hitDice, vitals: hp });
    if (r) record(hitDiceEvent({ state, catalog, count: r.count }));
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


  const rollTest = (test, name, quick) =>
    roll(
      (options) => rollTestEvent({ catalog, test, name, options }),
      { title: name, kind: 'd20', parts: testParts(catalog, test), rollData: catalog.rollData },
      quick,
      rollEffects(state, catalog, rollOf(catalog, test)),
    );

  /** O Check de um atributo: escolhe a perícia (ou o teste puro) e rola. */
  const checkAbility = async (ability) => {
    const r = await askSkillCheck({ catalog, state, ability });
    if (r) rollTest(r.test, r.name);
  };

  const saveAbility = (ability, quick) => rollTest({ type: 'save', id: ability }, `${ABILITY_FULL[ability]} save`, quick);

  /** O teste de uma ferramenta: pergunta o atributo e rola. */
  const rollTool = async (name) => {
    const r = await ask({
      title: name,
      message: 'Which ability does this check use? The DM says; Dexterity is the usual one for hands-on tools.',
      fields: [{ type: 'select', name: 'ability', label: 'Ability', default: 'dex', options: ['dex', 'int', 'wis', 'str', 'con', 'cha'].map((a) => ({ label: ABILITY_FULL[a], value: a })) }],
      actions: [{ label: 'Cancel', value: false }, { label: 'Next', value: true, tone: 'primary' }],
    });
    const ability = r?.values?.ability;
    if (r?.action && ability) rollTest({ type: 'tool', id: name, ability }, `${name} (${ABILITY_FULL[ability]})`);
  };

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

  const rollInitiative = (quick) => (state.combat ? rollTest({ type: 'initiative' }, 'Initiative', quick) : startCombat(quick));

  /** O Move e o Dash do card de movimento: quantos pés, e quanto sobra. */
  const moveFeet = async (dash) => {
    const speed = effectiveSpeed(catalog, state) ?? 0;
    const r = await askMove({ dash, speed, left: movementLeft(state, speed) });
    if (!r) return;
    record(dash ? dashEvent({ state, speed, feet: r.feet }) : moveEvent({ state, feet: r.feet, speed }));
  };

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

  const checks = catalog.checks;
  const historyHead = (
    <HistoryHead onUndo={undo} onRedo={redo} canUndo={play.canUndo} canRedo={play.canRedo} lastLabel={lastApplied?.label} nextLabel={nextUndone?.label} />
  );

  return (
    <>
      {levelSlot && createPortal(
        <div className={styles.restGroup} data-flip="slot-rest">
          <button type="button" className={styles.restBtn} onClick={shortRest}>Short rest</button>
          <button type="button" className={styles.restBtn} onClick={longRest}>Long rest</button>
        </div>,
        levelSlot,
      )}

      <div className={sheetHeader.header}>
        <PlayTiles
          hp={hp}
          hitDice={hitDice}
          initiative={checks.initiative.bonus}
          combat={state.combat}
          ac={effectiveAc(catalog, state)}
          baseAc={catalog.stats.ac}
          acBreakdown={catalog.stats.acBreakdown ?? []}
          acEffects={(state.modifiers ?? []).filter((m) => Number(m.ac)).map((m) => ({ label: m.label, value: Number(m.ac) }))}
          speed={effectiveSpeed(catalog, state)}
          baseSpeed={catalog.stats.speed}
          speeds={effectiveSpeeds(catalog, state)}
          moveLeft={movementLeft(state, effectiveSpeed(catalog, state))}
          onInitiative={rollInitiative}
          onHeal={openHeal}
          onHurt={openHurt}
          onHitDice={openHitDice}
          onMove={() => moveFeet(false)}
          onDash={() => moveFeet(true)}
          dataTour={TUT.PLAY_STATS}
        />

        <AbilityCards abilities={checks.abilities} onCheck={checkAbility} onSave={saveAbility} dataTour={TUT.PLAY_ABILITIES} />
      </div>

      <div className={sheetPage.stack} data-flip="profs">
        <ProficienciesCard
          derived={derived}
          onSave={saveAbility}
          onSkill={(skill) => rollTest({ type: 'skill', id: skill }, `${SKILL_LABEL[skill] ?? skill} check`)}
          onTool={rollTool}
        />
      </div>
      <div className={sheetPage.stack} data-tour={TUT.PLAY_CONDITIONS}>
        <ConditionsCard conditions={state.conditions} onAdd={addCondition} onSet={setCondition} />
        <EffectsCard modifiers={state.modifiers} combat={state.combat} onAdd={addEffect} onRemove={removeEffect} />
      </div>

      <section className={styles.status} data-tour={TUT.PLAY_STATUS} data-flip="status">
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
        </div>
      </section>

      <nav className={sheetPage.tabBar} data-tour={TUT.PLAY_TABS} data-flip="tabs" data-flip-fade="">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => openTab(t)}
            className={activeTab === t ? `${sheetPage.tab} ${sheetPage.tabActive}` : sheetPage.tab}
            data-tour={t === 'History' ? TUT.PLAY_HISTORY : undefined}
          >
            {t}
          </button>
        ))}
      </nav>

      <div ref={swipeRef} data-flip="panel-play">
        <div key={activeTab} className={`${sheetPage.panel} ${slideClass(tabDir)}`}>
          {activeTab === 'History' && (
            <>
              {historyHead}
              <PlayHistory doc={play.doc} onDamage={damageFromHistory} onConcentration={(dc) => rollConcentration(dc)} concentrating={!!state.concentration} onSpell={spellRoll} />
            </>
          )}

          {activeTab === 'Actions' && (
            <section className={styles.actionsTab}>
              <h2 className={styles.heading}>Attacks</h2>
              <ul className={styles.attacks} data-tour={TUT.PLAY_ROLLS}>
                {catalog.attacks.map((a) => (
                  <AttackRow key={a.key} attack={a} onAttack={(x, quick) => rollAttack(x, quick, true)} onDamage={rollDamage} />
                ))}
              </ul>
              <p className={styles.hint}>Tap a roll to choose advantage, a bonus or physical dice.</p>
            </section>
          )}

          {activeTab === 'Features' && (
            <FeaturesTab catalog={catalog} state={state} onUse={applyFeature} onSpecial={special} onAdjust={adjust} />
          )}

          {activeTab === 'Spells' && (
            <SpellsTab catalog={catalog} state={state} onCast={castSpell} onAdjust={adjust} />
          )}

          {activeTab === 'Inventory' && (
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
        </div>
      </div>

      {wide && sideSlot && createPortal(
        <div className={styles.sideContent} data-tour={TUT.PLAY_HISTORY}>
          {historyHead}
          <PlayHistory doc={play.doc} onDamage={damageFromHistory} onConcentration={(dc) => rollConcentration(dc)} concentrating={!!state.concentration} onSpell={spellRoll} />
        </div>,
        sideSlot,
      )}

      {toast && (
        <button key={toast.id} type="button" className={`${styles.toast} motion-pop`} onClick={() => { setToast(null); if (!wide) openTab('History'); }}>
          <span className={styles.toastLabel}>{toast.label}</span>
          <span className={styles.toastTotal}>{toastNumber(toast)}</span>
          {(toast.rolls?.isCritical || toast.payload?.critical) && (
            <span className={styles.toastTag}>{['attack', 'damageRoll', 'use'].includes(toast.kind) ? 'Critical' : 'Natural 20'}</span>
          )}
          {toast.rolls?.isFumble && <span className={styles.toastTag}>Natural 1</span>}
        </button>
      )}
    </>
  );
}
