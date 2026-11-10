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
//   DDL-0147 (docs/PLAY-MODE-V2-PLAN.md): a aba Actions são as ações básicas do
//   livro (ActionsTab, engine/playBasicActions) que o personagem tem o que fazer,
//   com os custos dele; tocar abre o ActionPanel (o custo e o meio), e takeAction
//   executa pelo fluxo que já existe (rollAttack, castSpell, rollTest, moveFeet,
//   consumeItem, applyFeature); o painel abre sempre (DDL-0158). O custo que vem de
//   uma feature com gasto (o Focus do monge) vai NUM evento só com a ação (withOps):
//   em dois, o segundo partiria do estado antigo e apagaria o custo marcado pelo
//   primeiro. A lista de ataques solta saiu: ela é o "como" da ação Attack.
//
// FUNÇÕES
//   PlayInner(props): o modo jogo, com o personagem garantido (quem carrega é a
//     pages/Character); os descansos e a coluna do histórico entram por portal nos
//     lugares dela (`levelSlot`, `sideSlot`).
//     roll(build, dialog, quick): pergunta (ou não), rola, grava e mostra.
//     rollTest(test, name, quick), rollAttack(attack, quick, spend),
//       rollDamage(attack, opts, quick): os três tipos de rolagem da C2.
//     damageFromHistory(attackKey, opts): o "Roll damage" do cartão do ataque.
//     lightRoll(group, kind), lightKinds(group): a rolagem da instância leve (S4,
//       DDL-0194), a da magia no círculo gravado, com o custo que a prosa diz.
//     transformWildShape(feature), pickForm(m), revertForm(): a forma (DDL-0195): o
//       Wild Shape pelas formas conhecidas, a magia de transformação pelo painel
//       seletor, e sair dela; o catálogo da tela é o da forma (formCatalog).
//     summonHp(group, member, kind), summonRoll(view, action, kind),
//       summonFromFeature(feature), dismissSummon(group): a aba Summons (DDL-0192): PV de um membro, o ataque e o
//       dano de uma ação (sem os efeitos do jogador) e dispensar. Ao conjurar uma
//       magia com `miscTags` SMN, o bestiário carrega e o CastPanel oferece invocar
//       (o Find Familiar, as feras de ND 0); a feature de companheiro tem "Summon"; a
//       regra de turno vem da prosa e aparece na linha dos summons do combate (DDL-0193).
//     attackFromInventory(attack): o "Attack" de uma arma na aba Inventory (DDL-0165).
//     askRollKind(opts), damageText(attack): a pergunta "d20 ou os outros dados" e o
//       texto do dano (DDL-0156).
//     attackOrDamage(attack, cost, extraOps), withAmmo(event, attack): o ataque da
//       aba Actions, que pergunta o que rolar; a munição no mesmo evento (nada com
//       Settings > Track ammunition desligado, DDL-0161).
//     featureEffectFromHistory(event): o dano ou a cura de uma feature que rolou só o
//       ataque, sem gastar de novo.
//     openTab(tab): troca de aba lembrando a direção (para o painel entrar do
//       lado certo).
//     moveCursor(fn, verb), undo(), redo(): mexem no cursor e avisam um
//       conflito de inventário.
//     record(event, cost): grava (marcando o custo do turno, em combate) e mostra o aviso;
//       um teste de d20 do app abre antes o d20 em destaque (D20Overlay, DDL-0152) e,
//       com "All dice", o resto abre a bandeja (DiceTrayOverlay, DDL-0153); o aviso
//       vem quando a camada fecha (closeRoll).
//     openHeal(), openHurt(), openHitDice(): os botões do card de HP; com
//       concentração, o dano já pede o save.
//     rollDeathSave(quick), rollConcentration(dc, quick), askConcentrationSave(),
//       startConcentration(), endConcentration(): morte e concentração.
//     shortRest(), longRest(): os descansos.
//     applyFeature(action, activity), special(action, rule), adjust(key, delta):
//       usar uma feature, as recuperações especiais e o ajuste à mão.
//     checkAbility(ability), saveAbility(ability, quick): o Check (o seletor de
//       perícia e então a rolagem) e o Save de um card de atributo.
//     pickCondition(raw), conditionInfo(id): a condição escolhida no painel seletor
//       (a concentração pergunta no quê) e a regra dela.
//     pickEffectSource(source): o causador escolhido no Add effect (o efeito
//       curado entra sozinho; o resto abre o efeito próprio já preenchido).
//     addCustomEffect(): o efeito próprio (o do mestre).
//     addCondition(), setCondition(id, level), addEffect(), removeEffect(id):
//       condições e efeitos.
//     castSpell(origin, spell), spellRoll(spellKey, level, kind): lançar (com o gasto
//       do turno escolhido entre os de spellCosts, e o recurso dele, DDL-0165),
//       rollSpellHeal(origin, spell, level): lançar e as rolagens da magia.
//     consumeItem(entry): usar um item do inventário.
//     startCombat(quick), nextTurn(), endCombat(): o combate.
//     slotInfo, pickSlot(slot): o que a ação, a bônus e a reação pagam, e o toque nos
//       botões de combate (CombatControls, DDL-0161).
//     rollInitiative(quick): o tile: fora de combate começa um; nele, só rola.
//     moveFeet(dash): o Move e o Dash do card de movimento (quantos pés).
//     rollTool(name): o teste de uma ferramenta, com o atributo escolhido.
//   withOps(event, ops): o evento com operações a mais na frente (o gasto de Focus
//     ou dos usos da feature que deu o custo alternativo, num evento só).
//   HistoryHead(props): o título do histórico com desfazer, refazer e limpar.
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
//   - Condições e efeitos (DDL-0121): o Add condition e o Add effect abrem o
//     PAINEL SELETOR do app (SelectorPanel, `picker`), com as entities condition
//     (condições, status e doenças) e effectSource (o causador). A concentração
//     mora no card de condições; a faixa de estado só aparece com a morte ou o
//     combate.
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
import useActiveInView from '../hooks/useActiveInView';
import useMediaQuery from '../hooks/useMediaQuery';
import { directionOf, slideClass } from '../motion';
import { derivePlayCatalog } from '../engine/playCatalog';
import { transformRuleOf, transformOps, revertOps, formTempHp, formCatalog, formStats, formEligible, wildShapeOf } from '../engine/playForms';
import creatureEntity from '../selector/entities/creature';
import {
  vitals as vitalsOf, healEvent, tempHpEvent, maxHpEvent, hurtEvent, deathSaveEvent, concentrationEvent, concentrationCheckEvent,
} from '../engine/playHealth';
import { shortRestEvent, longRestEvent, hitDiceLeft, hitDiceEvent } from '../engine/playRest';
import { emptyPlayState, makeEvent, hpView } from '../engine/playState';
import { activityEvent, slotRecoveryEvent, fontOfMagicEvent, adjustResourceEvent, resolveCosts, left as leftOf } from '../engine/playUse';
import { castWays, castEvent, spellAttackOf, healParts, spellHealEvent } from '../engine/playCast';
import {
  rollEffects, applyEffects, featureModifier, effectiveAc, effectiveSpeed, effectiveSpeeds, conditionEvent, modifierEvent, removeModifierEvent, conditionId, sourceModifier,
} from '../engine/playEffects';
import { testParts, rollTestEvent, rollAttackEvent, damageParts, rollDamageEvent } from '../engine/playActions';
import { itemUseEvent, ammoOps, itemCostOf, healOf } from '../engine/playInventory';
import {
  ECONOMY, startCombatEvent, nextTurnEvent, endCombatEvent, economyEvent, economyOp, costOfActivation, withRounds, roundsOf,
  movementLeft, moveEvent, dashEvent, readyEvent, readiedReactionEvent,
} from '../engine/playCombat';
import { askRoll } from '../components/play/rollDialog';
import { askHeal, askHurt, askHitDice, askShortRest, askUse, askCast, askSlotRecovery, askFontOfMagic, askModifier, askSkillCheck, askMove, askAction, askSlot, askCost } from '../components/play/playDialogs';
import ActionsTab from '../components/play/ActionsTab';
import { actionContext, attackStepOp, basicActionList, costAvailable, offhandAttack, slotChoices, spellCosts } from '../engine/playBasicActions';
import FeaturesTab from '../components/play/FeaturesTab';
import SpellsTab from '../components/play/SpellsTab';
import InventoryTab from '../components/play/InventoryTab';
import SummonsTab from '../components/play/SummonsTab';
import useBestiary from '../hooks/useBestiary';
import { summonCreaturesFor, summonOps, summonGroupView, summonHpEvent, dismissEvent, summonAttack, summonTurnOf, turnText, featureSummons, familiarForms, isLightSummon, lightRulesOf, lightOps } from '../engine/playSummons';
import { resolveClassObj, resolveSubclassObj } from '../engine/resolve';
import { resolveSpellObj } from '../engine/spells';
import RollButton from '../components/play/RollButton';
import { CombatDock, CombatFloat, RoundBadge } from '../components/play/CombatControls';
import PlayHistory from '../components/play/PlayHistory';
import Icon from '../components/common/Icon';
import { alert, ask, confirm } from '../components/common/dialog';
import { maybeStartTutorial } from '../store/tutorialStore';
import { TUT } from '../tutorial/anchors';
import { ABILITY_FULL } from '../components/builder/labels';
import { rollOf } from '../engine/playChecks';
import AbilityCards from '../components/play/AbilityCards';
import PlayTiles from '../components/play/PlayTiles';
import ProficienciesCard from '../components/builder/ProficienciesCard';
import ConditionsCard from '../components/play/ConditionsCard';
import EffectsCard from '../components/play/EffectsCard';
import { SKILL_LABEL } from '../components/builder/labels';
import SelectorPanel from '../selector/SelectorPanel';
import Button from '../components/common/Button';
import conditionEntity from '../selector/entities/condition';
import effectSourceEntity from '../selector/entities/effectSource';
import { showDetailPopup } from '../components/common/detailPopup';
import useSettingsStore from '../store/settingsStore';
import { formatBonus } from '../engine/math';
import { reducedMotion } from '../motion';
import { d20Show, shouldAnimate, shouldTray, trayShow } from '../dice3d/rollShow';
import D20Overlay from '../dice3d/D20Overlay';
import DiceTrayOverlay from '../dice3d/DiceTrayOverlay';
import sheetPage from './Builder.module.css';
import sheetHeader from '../components/builder/StatsHeader.module.css';
import styles from './Play.module.css';

const TABS = ['Actions', 'Features', 'Spells', 'Inventory'];

// ATENÇÃO: o mesmo número do @media do .shell no Play.module.css.
const WIDE_QUERY = '(min-width: 1140px)';

const SLOT_LABEL = { action: 'Action', bonus: 'Bonus Action', reaction: 'Reaction' };

const TOAST_MS = 4000;

/** O número do aviso de um evento: o total rolado, o dano, a cura ou o temporário. */
const toastNumber = (e) => e.rolls?.total ?? e.payload?.taken ?? e.payload?.healed ?? e.payload?.to ?? e.payload?.round ?? e.payload?.left ?? null;

/**
 * O que rolar, quando a coisa tem o d20 e outros dados (dano, cura): resolve
 * 'attack', 'effect' ou null (cancelou).
 */
const askRollKind = ({ title, attack, effect, effectLabel = 'Damage' }) =>
  ask({
    title,
    message: 'Roll the attack (d20) or the other dice?',
    actions: [
      { label: 'Cancel', value: null },
      { label: `${effectLabel}${effect ? ` (${effect})` : ''}`, value: 'effect' },
      { label: `Attack${attack ? ` (${attack})` : ''}`, value: 'attack', tone: 'primary' },
    ],
  });

/** O texto curto do dano de um ataque ("1d8 + 4"). */
const damageText = (attack) => {
  const d = attack?.damage;
  if (!d) return '';
  const bonus = d.bonus ? `${d.bonus > 0 ? ' + ' : ' - '}${Math.abs(d.bonus)}` : '';
  return d.dice ? `${d.dice}${bonus}` : String(Math.max(0, d.bonus ?? 0));
};

/** O evento com operações a mais na frente (o gasto da feature que deu o custo). */
const withOps = (event, ops = []) => (ops.length ? { ...event, ops: [...ops, ...event.ops] } : event);

/** O título do histórico com desfazer e refazer (na coluna e na aba). */
function HistoryHead({ onUndo, onRedo, onClear, canUndo, canRedo, canClear, lastLabel, nextLabel, round = null }) {
  return (
    <div className={styles.historyHead}>
      <span className={styles.historyTitle}>
        <h2 className={styles.heading}>History</h2>
        {round != null && <RoundBadge round={round} />}
      </span>
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
        <button type="button" className={styles.iconBtn} onClick={onClear} disabled={!canClear} title="Clear the history" aria-label="Clear the history">
          <Icon name="trash" />
        </button>
      </span>
    </div>
  );
}

/** A tela do play mode, com o personagem garantido. */
// ATENÇÃO: as condições do XPHB que incluem Incapacitated (a regra do Wild Shape acaba com ela).
const INCAPACITATING = ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'];

export function PlayInner({ character, derived, sideSlot, levelSlot }) {
  const { db } = useData();
  const baseCatalog = useMemo(() => derivePlayCatalog(character, db, { derived }), [character, db, derived]);
  const play = usePlayDoc(character.id);
  const wide = useMediaQuery(WIDE_QUERY);
  const summonsActive = (play.state?.summons?.length ?? 0) > 0;
  const form = play.state?.form ?? null;
  const bestiary = useBestiary(summonsActive || !!form);
  const formBlock = form ? bestiary.list.find((m) => m.name === form.ref?.name && m.source === form.ref?.source) ?? null : null;
  const catalog = useMemo(() => (form && formBlock ? formCatalog(baseCatalog, form, formStats(formBlock)) : baseCatalog), [baseCatalog, form, formBlock]);
  const beastDb = useMemo(() => ({ ...db, bestiary: { monster: bestiary.list } }), [db, bestiary.list]);
  const [formPick, setFormPick] = useState(null);
  const tabList = summonsActive ? [...TABS.slice(0, 3), 'Summons', ...TABS.slice(3)] : TABS;
  const tabs = wide ? tabList : ['History', ...tabList];
  const [tab, setTab] = useState('Actions');
  const activeTab = tabs.includes(tab) ? tab : 'Actions';
  const [tabDir, setTabDir] = useState(null);
  const swipeRef = useRef(null);
  const tabIndex = tabs.indexOf(activeTab);
  const tabBarRef = useRef(null);
  useActiveInView(tabBarRef, activeTab);
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
  const [rollShow, setRollShow] = useState(null);
  const diceAnimation = useSettingsStore((s) => s.diceAnimation);
  const trackAmmo = useSettingsStore((s) => s.trackAmmo);
  const [picker, setPicker] = useState(null);


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

  const onSummonsTab = activeTab === 'Summons' && !bestiary.loading;
  useEffect(() => {
    if (!onSummonsTab) return undefined;
    const t = setTimeout(() => maybeStartTutorial('play-summons'), 300);
    return () => clearTimeout(t);
  }, [onSummonsTab]);

  const formOn = !!state.form;
  useEffect(() => {
    if (!formOn) return undefined;
    const t = setTimeout(() => maybeStartTutorial('play-form'), 300);
    return () => clearTimeout(t);
  }, [formOn]);
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
    const motion = { setting: diceAnimation, reduced: reducedMotion() };
    const show = d20Show(final);
    const tray = show ? null : trayShow(final);
    if (shouldAnimate(show, motion)) {
      setToast(null);
      setRollShow({ show, event: final, kind: 'd20' });
    } else if (shouldTray(tray, motion)) {
      setToast(null);
      setRollShow({ show: tray, event: final, kind: 'tray' });
    } else setToast(final);
    if (conflicts?.length) alert({ title: 'Not applied to the sheet', message: 'The sheet does not have that much, so the item or coins were left as they are.' });
  };

  /** Fecha o d20 em destaque e mostra o aviso da rolagem. */
  const closeRoll = () => {
    setToast(rollShow?.event ?? null);
    setRollShow(null);
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

  const addCondition = () => setPicker('condition');

  /** A condição escolhida no painel seletor; a concentração pergunta no quê. */
  const pickCondition = (raw) => {
    setPicker(null);
    if (raw.name === 'Concentration') {
      startConcentration();
      return;
    }
    const id = conditionId(raw.name);
    if (!state.conditions?.[id]) record(conditionEvent({ state, id, level: 1 }));
  };

  /** A regra de uma condição, status ou doença, no popup do app. */
  const conditionInfo = (id) => {
    const raw = conditionEntity.list(db).find((c) => conditionId(c.name) === id);
    if (raw) showDetailPopup({ entity: conditionEntity, raw, db });
  };

  const setCondition = (id, level) => record(conditionEvent({ state, id, level }));

  const addEffect = () => setPicker('effect');

  /** Liga um efeito próprio (o do mestre), já preenchido quando vem de um causador. */
  const addCustomEffect = async (initial = {}) => {
    const modifier = await askModifier({ rollData: catalog.rollData, inCombat: !!state.combat, ...initial });
    if (modifier) record(modifierEvent({ modifier: withRounds(modifier, state, modifier.rounds) }));
  };

  /** O causador escolhido no Add effect: o efeito curado entra sozinho, o resto vai ao efeito próprio. */
  const pickEffectSource = (source) => {
    setPicker(null);
    const rounds = source.kind === 'entity' ? roundsOf(source.raw?.duration) : null;
    const curated = source.categoryLabel === 'Spell' ? sourceModifier(source.name) : null;
    if (curated) record(modifierEvent({ modifier: withRounds(curated, state, rounds) }));
    else addCustomEffect({ initialLabel: source.name, initialRounds: rounds });
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
  const applyFeature = async (action, activity, extra = {}) => {
    let only = extra.only ?? null;
    if (!only && activity.attack && (activity.heal || (activity.damage ?? []).length)) {
      only = await askRollKind({ title: action.name, effect: (activity.damage ?? []).map((p) => p.formula).join(' + ') || activity.heal?.formula, effectLabel: activity.heal ? 'Healing' : 'Damage' });
      if (!only) return;
    }
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
      event = activityEvent({ catalog, state, action, activity, options: { ...options, applied, only, free: !!extra.free, critical: options.critical || !!extra.critical } });
    } catch (e) {
      await alert({ title: 'Could not use it', message: String(e?.message ?? e) });
      return;
    }
    record(event, extra.free ? null : costOfActivation(activity.activation?.type));
  };

  /** O "Roll damage" do cartão de uma feature que rolou só o ataque: sem gastar de novo. */
  const featureEffectFromHistory = (event) => {
    const action = catalog.actions.find((a) => a.key === event.payload?.actionKey);
    const activity = action?.activities.find((x) => x.id === event.payload?.activityId);
    if (!activity) {
      alert({ title: 'Feature not found', message: 'This feature is no longer on the sheet.' });
      return;
    }
    applyFeature(action, activity, { only: 'effect', free: true, critical: !!event.payload?.attack?.critical });
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
    if (state.form && !state.form.spells && !(await confirm({ title: 'No spellcasting in this form', message: `${state.form.source}: you can't cast spells in this form. Cast anyway?`, confirmLabel: 'Cast anyway' }))) return;
    const transformRule = transformRuleOf(spell.name);
    const costs = spellCosts(spell, catalog);
    let cost = costs[0];
    if (costs.length > 1) {
      cost = await askCost({ title: spell.name, costs: costs.map((c) => ({ ...c, available: costAvailable(c.cost, state) })), inCombat: !!state.combat });
      if (!cost) return;
    }
    if (cost.spend && leftOf(catalog, state, cost.spend.key) < cost.spend.amount
      && !(await confirm({ title: `Not enough ${cost.spend.name}`, message: `${cost.source} costs ${cost.spend.amount} ${cost.spend.name}. Cast anyway?`, confirmLabel: 'Cast anyway' }))) return;
    const ways = castWays(catalog, state, spell);
    let way = cost.noSlot ? { id: 'free', label: cost.source, level: spell.level, key: null, left: null } : ways.length === 1 && ways[0].left == null ? ways[0] : null;
    let onSelf = false;
    let summon = null;
    const rawSpell = resolveSpellObj(db, spell.name, spell.source);
    const summoning = (rawSpell?.miscTags ?? []).includes('SMN');
    const beasts = summoning ? await bestiary.load() : [];
    const creatures = !summoning ? [] : /^find familiar$/i.test(spell.name) ? familiarForms(beasts) : summonCreaturesFor(beasts, spell);
    const light = !creatures.length && isLightSummon(spell);
    let transformSelf = false;
    if (!way || creatures.length || light || transformRule) {
      const r = await askCast({ catalog, state, origin, spell, creatures, light, transform: transformRule });
      if (!r) return;
      way = way ?? r.way;
      onSelf = !!r.onSelf;
      summon = r.summon;
      transformSelf = !!r.transform;
    }
    const classLevel = character.classes?.find((c) => `class:${c.classId}` === origin.key)?.level ?? null;
    const turn = summon ? summonTurnOf([...(rawSpell?.entries ?? []), ...(rawSpell?.entriesHigherLevel ?? [])]) : null;
    const summonExtra = summon?.light
      ? lightOps({ state, spell, level: way.level, origin, catalog, rules: lightRulesOf(rawSpell?.entries), casterHpMax: hpView(state, catalog.stats?.hpMax ?? 0).max })
      : summon ? summonOps({ state, creature: summon.creature, spell, level: way.level, variant: summon.variant, count: summon.count, origin, catalog, classLevel, turn }) : [];
    if (way.key && (way.left ?? 0) < 1 && !(await confirm({ title: 'Nothing left', message: `No ${way.label.toLowerCase()} is left. Cast anyway?`, confirmLabel: 'Cast anyway' }))) return;
    record(withOps(castEvent({ catalog, state, origin, spell, way, onSelf }), [...(cost.spend ? [{ op: 'spend', key: cost.spend.key, amount: cost.spend.amount }] : []), ...summonExtra]), costOfActivation(cost.cost));
    if (summon) setTab('Summons');
    if (transformRule && transformSelf) {
      await bestiary.load();
      setFormPick({ rule: transformRule });
      setPicker('form');
      return;
    }
    if (spell.mechanics?.attack && spell.mechanics?.damage?.dice) {
      const atk = spellAttackOf(origin, spell, way.level);
      const kind = await askRollKind({ title: spell.name, attack: atk.attack?.bonus != null ? formatBonus(atk.attack.bonus) : '', effect: damageText(atk) });
      if (kind === 'attack') rollAttack(atk);
      else if (kind === 'effect') rollDamage(atk);
    } else if (spell.mechanics?.attack) rollAttack(spellAttackOf(origin, spell, way.level));
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

  /** A rolagem de uma instância leve (Spiritual Weapon de novo): a da magia, no círculo gravado, com o custo que a prosa diz. */
  const lightRoll = (group, kind) => {
    const origin = catalog.spells.find((o) => o.spells.some((s) => s.key === group.spell?.key));
    const spell = origin?.spells.find((s) => s.key === group.spell?.key);
    if (!spell) {
      alert({ title: 'Spell not found', message: 'This spell is no longer on the sheet.' });
      return;
    }
    const cost = costOfActivation(group.turn?.command);
    const pay = cost ? [economyOp(state, cost)].filter(Boolean) : [];
    const atk = spellAttackOf(origin, spell, group.ctx?.spellLevel ?? spell.level);
    if (kind === 'attack') rollAttack(atk, false, false, null, pay);
    else if (kind === 'damage') rollDamage(atk, {}, false, false, null, pay);
    else rollSpellHeal(origin, spell, group.ctx?.spellLevel ?? spell.level);
  };

  /** O que a instância leve rola: ataque, dano ou cura da magia. */
  const lightKinds = (group) => {
    const spell = catalog.spells.flatMap((o) => o.spells).find((s) => s.key === group.spell?.key);
    const m = spell?.mechanics ?? {};
    return [m.attack && 'attack', m.damage?.dice && 'damage', m.heal?.dice && 'heal'].filter(Boolean);
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


  const rollTest = (test, name, quick, cost = null, extraOps = []) =>
    roll(
      (options) => withOps(rollTestEvent({ catalog, test, name, options }), extraOps),
      { title: name, kind: 'd20', parts: testParts(catalog, test), rollData: catalog.rollData },
      quick,
      rollEffects(state, catalog, rollOf(catalog, test)),
      cost,
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

  /** As vistas dos grupos de summon: a criatura resolvida e os PV de cada membro. */
  const summonViews = (state.summons ?? []).map((g) =>
    summonGroupView(g, bestiary.list.find((m) => m.name === g.ref?.name && m.source === g.ref?.source) ?? null));

  /** A linha dos summons no controle de turno: quem age e como. */
  const summonLine = (state.summons ?? []).map((g) => ({ label: g.label, note: turnText(g.turn) || 'acts as the text says' }));

  /** Dano ou cura num membro de um summon, pelo valor digitado. */
  const summonHp = async (group, member, kind) => {
    const r = await ask({
      title: kind === 'hurt' ? `${group.label}: damage` : `${group.label}: healing`,
      fields: [{ type: 'text', name: 'n', label: kind === 'hurt' ? 'Damage' : 'Healing', default: '' }],
      actions: [{ label: 'Cancel', value: false }, { label: kind === 'hurt' ? 'Hurt' : 'Heal', value: true, tone: 'primary' }],
    });
    const n = Number.parseInt(r?.values?.n, 10);
    if (r?.action && Number.isFinite(n) && n > 0) record(summonHpEvent(group, member, kind === 'hurt' ? n : -n));
  };

  /** O ataque e o dano de uma ação de summon, sem os efeitos do jogador. */
  const summonRoll = (view, action, kind) => {
    const atk = summonAttack(view.group, action, view.stats);
    if (kind === 'attack') {
      roll((options) => rollAttackEvent({ catalog, attack: atk, options }), { title: `${atk.name}: attack`, kind: 'd20', parts: [{ label: 'Attack', formula: atk.attack?.bonus ?? 0 }], rollData: catalog.rollData }, false, []);
    } else {
      roll((options) => rollDamageEvent({ catalog, attack: atk, options }), { title: `${atk.name}: damage`, kind: 'damage', parts: damageParts(atk), rollData: catalog.rollData }, false, []);
    }
  };

  /** O companheiro de uma feature de classe (Steel Defender, Primal Companion): escolhe a criatura e invoca. */
  const summonFromFeature = async (feature) => {
    const list = featureSummons(await bestiary.load(), feature.name, feature.source);
    if (!list.length) {
      await alert({ title: feature.name, message: 'The creature is not in the bestiary of this data source.' });
      return;
    }
    let creature = list[0];
    if (list.length > 1) {
      const r = await ask({
        title: feature.name,
        fields: [{ type: 'select', name: 'c', label: 'Creature', default: '0', options: list.map((c, i) => ({ label: c.name, value: String(i) })) }],
        actions: [{ label: 'Cancel', value: false }, { label: 'Summon', value: true, tone: 'primary' }],
      });
      if (!r?.action) return;
      creature = list[Number(r.values?.c) || 0];
    }
    const cls = character.classes?.find((c) => {
      const co = resolveClassObj(db, c.classId, c.source);
      const so = c.subclassId ? resolveSubclassObj(db, c.classId, c.subclassId, c.subclassSource) : null;
      return co?.name === feature.section || so?.name === feature.section;
    }) ?? character.classes?.[0];
    const origin = catalog.spells?.find((o) => o.key === `class:${cls?.classId}`) ?? null;
    const turn = summonTurnOf([...(feature.entries ?? []), ...(creature.trait ?? []), ...(creature.actionEntries ?? [])]);
    const ops = summonOps({ state, creature, spell: null, level: null, origin, catalog, classLevel: cls?.level ?? null, turn, feature: feature.name });
    record(makeEvent('summon', { label: `${creature.name} summoned`, ops, payload: { summon: creature.name } }));
    setTab('Summons');
  };

  /** O Wild Shape: escolhe uma das formas conhecidas, gasta o uso e a Ação Bônus. */
  const transformWildShape = async (feature) => {
    const known = character.wildShapeForms ?? [];
    if (!known.length) {
      await alert({ title: 'No known forms', message: 'Choose your Wild Shape forms in the sheet, on the Class tab.' });
      return;
    }
    const r = await ask({
      title: feature.name,
      fields: [{ type: 'select', name: 'f', label: 'Form', default: '0', options: known.map((f, i) => ({ label: f.name, value: String(i) })) }],
      actions: [{ label: 'Cancel', value: false }, { label: 'Transform', value: true, tone: 'primary' }],
    });
    if (!r?.action) return;
    const pick = known[Number(r.values?.f) || 0];
    const list = await bestiary.load();
    const creature = list.find((m) => m.name === pick.name && m.source === pick.source) ?? list.find((m) => m.name === pick.name);
    if (!creature) {
      await alert({ title: pick.name, message: 'This form is not in the bestiary of this data source.' });
      return;
    }
    const ws = (character.classes ?? []).map((c) => wildShapeOf(db, c)).find(Boolean);
    const rule = transformRuleOf('wild shape');
    const pool = baseCatalog.resources.find((x) => String(x.name).toLowerCase() === 'wild shape');
    if (pool && leftOf(baseCatalog, state, pool.key) < 1
      && !(await confirm({ title: 'No Wild Shape left', message: 'You have no uses of Wild Shape left. Transform anyway?', confirmLabel: 'Transform anyway' }))) return;
    const wis = baseCatalog.rollData?.abilities?.wis?.mod ?? 0;
    const ops = [
      ...(pool ? [{ op: 'spend', key: pool.key, amount: 1 }] : []),
      ...transformOps({
        state, rule, creature,
        tempHp: formTempHp(rule, { classLevel: ws?.level ?? 0, circleForms: !!ws?.circleForms }),
        acFloor: ws?.circleForms ? 13 + wis : null,
        spells: baseCatalog.features.includes('beast spells'),
      }),
    ];
    record(makeEvent('form', { label: `Wild Shape: ${creature.name}`, ops, payload: { form: creature.name } }), 'bonus');
  };

  /** A forma escolhida no painel depois de uma magia de transformação. */
  const pickForm = (m) => {
    const rule = formPick?.rule;
    setPicker(null);
    setFormPick(null);
    if (!rule) return;
    const ops = transformOps({ state, rule, creature: m, tempHp: formTempHp(rule, { stats: formStats(m) }) });
    record(makeEvent('form', { label: `${rule.label}: ${m.name}`, ops, payload: { form: m.name } }));
  };

  /** Sai da forma (o Wild Shape gasta a Ação Bônus). */
  const revertForm = () => {
    if (!state.form) return;
    record(makeEvent('form', { label: `${state.form.label} ends`, ops: revertOps(state), payload: { reverted: true } }), state.form.kind === 'wildShape' ? 'bonus' : null);
  };

  /** Dispensa o grupo, perguntando antes. */
  const dismissSummon = async (group) => {
    if (await confirm({ title: `Dismiss ${group.label}?`, message: 'It leaves the Summons tab. You can undo it in the history.', confirmLabel: 'Dismiss' })) record(dismissEvent(group));
  };

  const rollAttack = (attack, quick, spend = false, cost = 'action', extraOps = []) =>
    roll(
      (options) => {
        const event = withOps(rollAttackEvent({ catalog, attack, options }), extraOps);
        return spend ? withAmmo(event, attack) : event;
      },
      {
        title: `${attack.name}: attack`,
        kind: 'd20',
        parts: attack.toHit?.parts ?? [{ label: 'Spell attack', formula: attack.attack?.bonus ?? 0 }],
        rollData: catalog.rollData,
      },
      quick,
      rollEffects(state, catalog, { kind: 'attack', weapon: attack.kind === 'weapon' || attack.kind === 'unarmed', attackAbility: attack.ability }),
      spend ? cost : null,
    );

  /** A munição gasta pelo ataque, no mesmo evento. */
  const withAmmo = (event, attack) => {
    if (trackAmmo === false) return event;
    const ammo = ammoOps({ character, derivedInventory: derived.inventory, attack });
    return { ...event, ops: [...event.ops, ...ammo.ops], payload: { ...event.payload, ammo: ammo.ammo, ammoLeft: ammo.left, ammoMissing: ammo.missing } };
  };

  const rollDamage = (attack, { critical = false } = {}, quick = false, spend = false, cost = null, extraOps = []) =>
    roll(
      (options) => {
        const event = withOps(rollDamageEvent({ catalog, attack, options }), extraOps);
        return spend ? withAmmo(event, attack) : event;
      },
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
      spend ? cost : null,
    );

  /**
   * Um ataque da aba Actions: pergunta se rola o d20 ou o dano (DDL-0156); o custo do
   * turno, o passo do Extra Attack e a munição vão em quem for rolado.
   */
  const attackOrDamage = async (attack, cost, extraOps = []) => {
    const kind = attack.damage
      ? await askRollKind({ title: attack.name, attack: attack.toHit ? formatBonus(attack.toHit.total) : '', effect: damageText(attack) })
      : 'attack';
    if (kind === 'attack') rollAttack(attack, false, true, cost, extraOps);
    else if (kind === 'effect') rollDamage(attack, {}, false, true, cost, extraOps);
  };

  /** O "Attack" de uma arma na aba Inventory: o mesmo da ação Attack (o passo do Extra Attack, o gasto, a munição). */
  const attackFromInventory = (attack) => {
    const step = attackStepOp(catalog, state);
    attackOrDamage(attack, step ? null : 'action', step ? [step] : []);
  };

  /** O "Roll damage" do cartão de um ataque no histórico. */
  const damageFromHistory = (attackKey, opts) => {
    const offhand = String(attackKey).endsWith('#offhand');
    const base = catalog.attacks.find((a) => a.key === (offhand ? String(attackKey).slice(0, -'#offhand'.length) : attackKey));
    const attack = base && offhand ? offhandAttack(base, catalog) : base;
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



  const startCombat = (quick) =>
    roll(
      (options) => startCombatEvent({ catalog, options }),
      { title: 'Initiative', kind: 'd20', parts: testParts(catalog, { type: 'initiative' }), rollData: catalog.rollData, note: 'Starts combat at round 1' },
      quick,
      rollEffects(state, catalog, { kind: 'initiative', ability: 'dex' }),
    );

  const rollInitiative = (quick) => (state.combat ? rollTest({ type: 'initiative' }, 'Initiative', quick) : startCombat(quick));

  /** O Move e o Dash do card de movimento: quantos pés, e quanto sobra. */
  const moveFeet = async (dash, cost = 'action', extraOps = []) => {
    const speed = effectiveSpeed(catalog, state) ?? 0;
    const r = await askMove({ dash, speed, left: movementLeft(state, speed), cost: dash ? cost : null });
    if (!r) return;
    record(dash ? withOps(dashEvent({ state, speed, feet: r.feet, cost }), extraOps) : moveEvent({ state, feet: r.feet, speed }));
  };

  const inventoryUsable = derived.inventory;
  const actionCtx = useMemo(() => actionContext(catalog, state, inventoryUsable), [catalog, state, inventoryUsable]);
  const basicActions = useMemo(() => basicActionList(catalog, state, actionCtx), [catalog, state, actionCtx]);

  /** Gasta uma carga de um item mágico (delta positivo gasta), com o custo do turno. */
  const spendCharge = (resource, cost = 'action') => record(adjustResourceEvent({ catalog, key: resource.key, delta: 1 }), cost);

  /** Uma ação básica da aba Actions: pergunta como, e usa o fluxo que já existe. */
  const takeAction = async (item) => {
    const rule = (db?.actions?.action ?? []).find((a) => a.name === item.name && a.source === 'XPHB') ?? null;
    const r = await askAction({ item, ctx: actionCtx, catalog, state, rule });
    if (!r) return;
    if (r.kind === 'skill' && !r.name) r.name = `${item.name}: ${SKILL_LABEL[r.skill] ?? r.skill}${item.name === 'Hide' ? ' (DC 15)' : ''}`;
    const owner = r.cost.via ? catalog.actions.find((a) => a.key === r.cost.via.action) : null;
    const activity = owner?.activities.find((x) => x.id === r.cost.via.activity) ?? null;
    const viaEvent = owner && activity ? activityEvent({ catalog, state, action: owner, activity }) : null;
    const effect = viaEvent ? featureModifier(item.action, catalog) : null;
    const extra = [...(viaEvent?.ops ?? []), ...(effect ? [{ op: 'modifier', add: withRounds(effect, state, effect.maxRounds) }] : [])];
    const cost = ECONOMY.includes(r.cost.cost) ? r.cost.cost : null;
    const step = r.kind === 'attack' && item.name === 'Attack' && !r.cost.via ? attackStepOp(catalog, state) : null;
    if (r.kind === 'attack' && step) attackOrDamage(r.attack, null, [...extra, step]);
    else if (r.kind === 'attack' && item.name === 'Two-Weapon Fighting') attackOrDamage(offhandAttack(r.attack, catalog), cost ?? 'bonus', extra);
    else if (r.kind === 'attack') attackOrDamage(r.attack, cost ?? 'action', extra);
    else if (r.kind === 'spell') castSpell(r.origin, r.spell);
    else if (r.kind === 'charge') spendCharge(r.resource, cost);
    else if (r.kind === 'item') consumeItem(r.entry);
    else if (r.kind === 'skill') rollTest({ type: 'skill', id: r.skill }, r.name, false, cost, extra);
    else if (r.kind === 'dash') moveFeet(true, cost, extra);
    else if (r.kind === 'ready') record(withOps(readyEvent({ state, trigger: r.trigger, cost }), extra));
    else if (r.kind === 'readiedReaction') record(readiedReactionEvent({ state }));
    else if (r.kind === 'endConcentration') endConcentration();
    else if (viaEvent) record(withOps(viaEvent, extra.slice(viaEvent.ops.length)), cost);
    else {
      const basic = item.action.activities[0];
      applyFeature(item.action, { ...basic, activation: { ...basic.activation, type: r.cost.cost } });
    }
  };

  const nextTurn = () => record(nextTurnEvent({ state }));

  const endCombat = () => record(endCombatEvent({ state }));

  const slotInfo = Object.fromEntries(ECONOMY.map((slot) => [slot, slotChoices(slot, basicActions, catalog, state)]));
  const slotAvailable = Object.fromEntries(ECONOMY.map((slot) => [slot, slotInfo[slot].available]));

  /** Um botão de combate (ação, bônus, reação): o que aquele gasto paga, e faz. */
  const pickSlot = async (slot) => {
    const r = await askSlot({ slotLabel: SLOT_LABEL[slot], choices: slotInfo[slot] });
    if (!r) return;
    if (r.kind === 'basic') takeAction(r.item);
    else if (r.kind === 'feature') applyFeature(r.action, r.activity);
    else if (r.kind === 'mark') record(economyEvent({ state, cost: slot, used: true }));
  };

  /** Desfaz ou refaz e avisa se um item do inventário não pôde voltar. */
  const moveCursor = (fn, verb) => {
    const r = fn();
    if (r?.conflicts?.length) {
      alert({ title: `Could not ${verb} everything`, message: 'An item changed on the sheet since this action, so it was left as it is now.' });
    }
  };
  const undo = () => moveCursor(play.undo, 'undo');
  /** Limpa o histórico depois de confirmar (o estado atual fica; o desfazer acaba). */
  const clearHistory = async () => {
    const ok = await confirm({
      title: 'Clear the history?',
      message: 'Hit points, resources and everything else stay as they are now, but the actions so far can no longer be undone.',
      confirmLabel: 'Clear',
      danger: true,
    });
    if (ok) play.clear();
  };
  const redo = () => moveCursor(play.redo, 'redo');

  const lastApplied = play.doc && play.doc.cursor > 0 ? play.doc.events[play.doc.cursor - 1] : null;
  const nextUndone = play.doc && play.doc.cursor < play.doc.events.length ? play.doc.events[play.doc.cursor] : null;

  const checks = catalog.checks;
  const wildLevel = state.form?.kind === 'wildShape' ? (character.classes ?? []).map((c) => wildShapeOf(db, c)).find(Boolean)?.level ?? 0 : 0;
  const formNote = !state.form ? '' : [
    formBlock ? `AC ${catalog.stats.ac}` : bestiary.loading ? 'Loading the form…' : 'Form not in the bestiary',
    state.form.spells ? null : "Can't cast spells",
    wildLevel ? `Up to ${Math.floor(wildLevel / 2)} hour${Math.floor(wildLevel / 2) === 1 ? '' : 's'}` : null,
    state.form.endsAtZeroTemp ? 'Ends when its temporary HP run out' : null,
    state.form.kind === 'wildShape' && INCAPACITATING.some((id) => state.conditions?.[id]) ? 'Incapacitated: Wild Shape ends' : null,
  ].filter(Boolean).join(' · ');
  const historyHead = (
    <HistoryHead onUndo={undo} onRedo={redo} onClear={clearHistory} canUndo={play.canUndo} canRedo={play.canRedo} canClear={!!play.doc?.events.length} lastLabel={lastApplied?.label} nextLabel={nextUndone?.label} />
  );

  return (
    <>
      {levelSlot && createPortal(
        <div className={styles.restGroup} data-flip="slot-mode" data-flip-morph="">
          <button type="button" className={styles.restBtn} onClick={shortRest}>Short rest</button>
          <button type="button" className={styles.restBtn} onClick={longRest}>Long rest</button>
        </div>,
        levelSlot,
      )}

      {state.form && (
        <section className={styles.formCard} data-tour={TUT.PLAY_FORM}>
          <span className={styles.formTitle}>{state.form.label}</span>
          <span className={styles.formNote}>{formNote}</span>
          <Button size="sm" onClick={revertForm}>Revert</Button>
        </section>
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
        <ConditionsCard
          conditions={state.conditions}
          concentration={state.concentration}
          combat={state.combat}
          onAdd={addCondition}
          onSet={setCondition}
          onInfo={conditionInfo}
          onConcentrationSave={askConcentrationSave}
          onConcentrationEnd={endConcentration}
        />
        <EffectsCard modifiers={state.modifiers} combat={state.combat} onAdd={addEffect} onAddCustom={() => addCustomEffect()} onRemove={removeEffect} />
      </div>

      {(hp.current === 0 && hp.max > 0) || hp.death.dead ? (
      <section className={styles.status} data-tour={TUT.PLAY_STATUS} data-flip="status" data-flip-scale="" data-flip-after="">
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
      </section>
      ) : null}

      <nav ref={tabBarRef} className={sheetPage.tabBar} data-wheel-x="" data-tour={TUT.PLAY_TABS} data-flip="tabs" data-flip-fade="">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => openTab(t)}
            className={activeTab === t ? `${sheetPage.tab} ${sheetPage.tabActive}` : sheetPage.tab}
            data-active={activeTab === t ? 'true' : undefined}
            data-tour={t === 'History' ? TUT.PLAY_HISTORY : undefined}
          >
            {t}
          </button>
        ))}
      </nav>

      <div ref={swipeRef} data-flip="panel-play" data-flip-after="">
        <div key={activeTab} className={`${sheetPage.panel} ${slideClass(tabDir)}`}>
          {activeTab === 'History' && (
            <>
              {historyHead}
              <PlayHistory doc={play.doc} onDamage={damageFromHistory} onConcentration={(dc) => rollConcentration(dc)} concentrating={!!state.concentration} onSpell={spellRoll} onFeatureEffect={featureEffectFromHistory} />
            </>
          )}

          {activeTab === 'Actions' && <ActionsTab list={basicActions} state={state} onAct={takeAction} dataTour={TUT.PLAY_ROLLS} />}

          {activeTab === 'Features' && (
            <FeaturesTab catalog={catalog} state={state} onUse={applyFeature} onSpecial={special} onAdjust={adjust} onSummon={summonFromFeature} onTransform={transformWildShape} />
          )}

          {activeTab === 'Spells' && (
            <SpellsTab catalog={catalog} state={state} derived={derived} db={db} onCast={castSpell} />
          )}

          {activeTab === 'Summons' && (
            <SummonsTab
              views={summonViews}
              loading={bestiary.loading}
              onHp={summonHp}
              onAttack={(v, a) => summonRoll(v, a, 'attack')}
              onDamage={(v, a) => summonRoll(v, a, 'damage')}
              onDismiss={dismissSummon}
              onLight={lightRoll}
              dataTour={TUT.PLAY_SUMMONS}
              lightKinds={lightKinds}
            />
          )}
          {activeTab === 'Inventory' && (
            <InventoryTab
              catalog={catalog}
              state={state}
              inventory={derived.inventory}
              db={db}
              onUse={consumeItem}
              onCharge={(r) => spendCharge(r)}
              onAttack={attackFromInventory}
            />
          )}
        </div>
      </div>

      {wide && sideSlot && createPortal(
        <div className={styles.sideContent} data-tour={TUT.PLAY_HISTORY}>
          <div className={styles.sideHead}>
            <HistoryHead onUndo={undo} onRedo={redo} onClear={clearHistory} canUndo={play.canUndo} canRedo={play.canRedo} canClear={!!play.doc?.events.length} lastLabel={lastApplied?.label} nextLabel={nextUndone?.label} round={state.combat ? state.combat.round : null} />
          </div>
          <div className={styles.sideScroll}>
            <PlayHistory doc={play.doc} onDamage={damageFromHistory} onConcentration={(dc) => rollConcentration(dc)} concentrating={!!state.concentration} onSpell={spellRoll} onFeatureEffect={featureEffectFromHistory} />
            {state.combat && <CombatDock available={slotAvailable} onPick={pickSlot} onNextTurn={nextTurn} onEndCombat={endCombat} dataTour={TUT.PLAY_COMBAT} summons={summonLine} />}
          </div>
        </div>,
        sideSlot,
      )}

      {!wide && state.combat && (
        <CombatFloat round={state.combat.round} available={slotAvailable} onPick={pickSlot} onNextTurn={nextTurn} onEndCombat={endCombat} dataTour={TUT.PLAY_COMBAT} summons={summonLine} />
      )}

      {picker === 'condition' && (
        <SelectorPanel
          entity={conditionEntity}
          db={db}
          currentId={null}
          heading="Add a condition"
          hint="Conditions, statuses like Concentration, and diseases."
          exclude={(c) => c.name !== 'Concentration' && !!state.conditions?.[conditionId(c.name)]}
          onSelect={pickCondition}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === 'form' && (
        <SelectorPanel
          entity={creatureEntity}
          db={beastDb}
          currentId={null}
          heading={`${formPick?.rule?.label ?? 'Form'}: choose the form`}
          hint={bestiary.loading ? 'Loading the creatures…' : 'Forms the spell allows at your level.'}
          exclude={(m) => !formEligible(m, formPick?.rule, { level: baseCatalog.stats.level })}
          onSelect={pickForm}
          onClose={() => { setPicker(null); setFormPick(null); }}
        />
      )}
      {picker === 'effect' && (
        <SelectorPanel
          entity={effectSourceEntity}
          db={db}
          currentId={null}
          heading="What caused the effect?"
          hint="Find the spell or feature someone used on you. Automatic ones turn on by themselves; the rest open a custom effect with the name filled in."
          onSelect={pickEffectSource}
          onClose={() => setPicker(null)}
        />
      )}

      {rollShow?.kind === 'd20' && <D20Overlay key={rollShow.event.id} show={rollShow.show} onDone={closeRoll} />}
      {rollShow?.kind === 'tray' && <DiceTrayOverlay key={rollShow.event.id} show={rollShow.show} onDone={closeRoll} />}

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
