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
//     roll(build, dialog, quick): pergunta (ou não), rola, grava e mostra; o gasto dos
//       extras ligados (Peerless Skill, Eldritch Smite) vai no mesmo evento.
//     rollTest(test, name, quick), rollAttack(attack, quick, spend),
//       rollDamage(attack, opts, quick): os três tipos de rolagem da C2.
//     damageFromHistory(attackKey, opts): o "Roll damage" do cartão do ataque; a magia de círculo não está
//       na lista de ataques e é achada nas magias, no círculo gravado (TC-0174, DDL-0249).
//     rollPieces(group, origin, spell, pay): gasta um ou dois pedaços da magia (os meteoros do Melf's) e
//       rola o dano de cada um, no lançamento e na instância leve; o último acaba a magia e a concentração
//       nela (DDL-0247). O extra de uma rolagem por lançamento (Empowered Evocation) já usado fica no
//       grupo (`castUsed`, pela op do próprio dano) e sai desligado nos meteoros seguintes (DDL-0250).
//     lightRoll(group, kind), lightKinds(group): a rolagem da instância leve (S4,
//       DDL-0194), a da magia no círculo gravado, com o custo que a prosa diz.
//     transformWildShape(feature), pickForm(m), revertForm(): a forma (DDL-0195): o
//       Wild Shape pelas formas conhecidas, a magia de transformação pelo painel
//       seletor, e sair dela; o catálogo da tela é o da forma (formCatalog, por `screenCatalog`). O mesmo
//       painel escolhe a criatura do Find Familiar (`formPick.summon`, DDL-0197).
//     historyLive: o estado vivo dos cards do histórico (os summons em campo, o
//       evento da forma atual, Dismiss e Revert por ali, DDL-0201).
//     summonHp(group, member, kind) (os painéis Heal e Hurt do jogador, DDL-0201), summonRoll(view, action, kind),
//       summonFromFeature(feature), dismissSummon(group): a aba Summons (DDL-0192): PV de um membro, o ataque e o
//       dano de uma ação (sem os efeitos do jogador) e dispensar. Ao conjurar uma
//       magia com `miscTags` SMN, o bestiário carrega e o CastPanel oferece invocar
//       (o Find Familiar, as feras de ND 0); a feature de companheiro tem "Summon"; a
//       regra de turno vem da prosa e aparece na linha dos summons do combate (DDL-0193).
//     attackFromInventory(attack): o "Attack" de uma arma na aba Inventory (DDL-0165).
//     historySource(event), canReadHistory(event), readFromHistory(event) (no PlayInner): o que um card do
//     histórico abre, se abre, e a descrição da magia ou da feature (DDL-0243, DDL-0245).
//     attackNotes(attack, catalog): as notas do ataque (a da arma e a da Weapon Mastery, DDL-0242).
//     shieldNote(attack, catalog): o aviso da arma Two-Handed com o escudo na mão (DDL-0247).
//     shownTestExtra(state, catalog): o que a rolagem de cada salvaguarda e perícia soma, ligado e
//       fixo, além do número da ficha (a Aura of Protection, DDL-0247).
//     withFixedDamage(attack, state, catalog): o ataque com os extras fixos ligados no dano (o rótulo
//       mostra o mesmo número que o diálogo rola: o +4 do Agonizing Blast, DDL-0239).
//     askRollKind(opts), damageText(attack): a pergunta "d20 ou os outros dados" e o
//       texto do dano (DDL-0156).
//     attackOrDamage(attack, cost, extraOps), withAmmo(event, attack): o ataque da
//       aba Actions, que pergunta o que rolar; a munição no mesmo evento (nada com
//       Settings > Track ammunition desligado, DDL-0161).
//     featureEffectFromHistory(event): o dano ou a cura de uma feature que rolou só o
//       ataque, sem gastar de novo.
//     rerollFromHistory(event): o "Reroll" do card do teste e do ataque: pergunta a regra
//       (engine/playRerolls) e grava a nova rolagem com o gasto dela (DDL-0214).
//     rerollDiceFromHistory(event): o "Reroll dice" do card do dano e da cura: a regra, os
//       dados (askRerollDice) e o evento novo (DDL-0215).
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
//     applyFeature(action, activity), special(action, rule): usar uma feature e as
//       recuperações especiais.
//     logFeature(feature, spend): o "Log to history" de uma feature (o detalhe, o Use
//       da que só a prosa diz que gasta, o Use do pool sem activity); em combate, com
//       mais de um custo, pergunta qual (DDL-0203). Com o registro curado
//       (playFeatureRolls, DDL-0205), liga o efeito (Reckless Attack) ou gasta e mostra
//       a salvaguarda (Stunning Strike). O gasto variável (`amount` { min, max }, o Touch of
//       the Long Death de 1 a 10 Focus) é perguntado numa lista antes de gravar (DDL-0224).
//     adjustByHand(resource): o ajuste do mestre (o que resta ou o máximo) pelo
//       ResourcePanel, aberto pelos contadores das abas Features, Spells e Inventory
//       (DDL-0202, DDL-0209). O catálogo da tela já vem com o máximo ajustado
//       (withResourceMax), então toda aba e todo evento leem o mesmo número.
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
//       rollSpellHeal(origin, spell, level): lançar e as rolagens da magia. A magia cujo dano só vem
//       depois (`damage.later`: Hunter's Mark, Hex, Produce Flame, Flaming Sphere) não abre a rolagem
//       quando outro caminho a rola (o efeito curado no dano, a instância leve; DDL-0247).
//     rollShots(origin, spell, level, shots): os projéteis da magia (Eldritch Blast, Scorching Ray: um
//       ataque por raio; Magic Missile: o dano por alvo, quantos dardos em cada; TC-0175, DDL-0249); o
//       extra de uma rolagem por lançamento só vem ligado na primeira em que entrou (DDL-0250).
//     useZone(origin, spell): o "Use" da magia de área ativa (encerrar, lançar de novo, o dano de novo;
//       DDL-0249); o lançamento dela não abre a rolagem.
//     consumeItem(entry): usar um item do inventário.
//     startCombat(quick), nextTurn(), endCombat(): o combate.
//     slotInfo, pickSlot(slot): o que a ação, a bônus e a reação pagam, e o toque nos
//       botões de combate (CombatControls, DDL-0161).
//     rollInitiative(quick): o tile: fora de combate começa um; nele, só rola.
//     moveFeet(dash): o Move e o Dash do card de movimento (quantos pés).
//     rollTool(name): o teste de uma ferramenta, com o atributo escolhido.
//   withOps(event, ops): o evento com operações a mais na frente (o gasto de Focus
//     ou dos usos da feature que deu o custo alternativo, num evento só).
//   chosenOptions(character, db): as opções de classe escolhidas, resolvidas (as formas especiais
//     de familiar do Pact of the Chain saem do texto delas, DDL-0238).
//   HistoryHead(props): o título do histórico com desfazer, refazer e limpar.
//   toastNumber(event): o número do aviso de um evento.
//
// DECISÕES E ARMADILHAS
//   - O estado da arma (DDL-0242, engine/playWeapons): a magia de arma pede a arma (`pickWeapon`) e, se
//     houver, o tipo; o IMBUE e o CREATE gravam um efeito com `weapon` no evento do lançamento (com a
//     concentração da magia); o STRIKE abre o ataque com a arma escolhida (`strikeAttack`). A feature
//     com activity (Sacred Weapon) faz o mesmo no `applyFeature`; a sem activity (Blessing of the
//     Forge, Hex Warrior) pelo "Use" da linha (`useWeaponFeature`). Os diálogos de ataque e de dano
//     mostram a nota da arma e a da Weapon Mastery (`attackNotes`).
//   - DDL-0245 (TC-0171): a instância leve tem "Use" quando a prosa dá um custo e não há o que rolar
//     (Eyebite) ou ela se move (`light.moves`: mover a Spiritual Weapon sem atacar); o "again" pode ser um ataque (`light.repeat.attack`: Storm Sphere, Wall of
//     Light); o dano do Transfix e do Songal's cai sem gasto (FREE_LIGHT_ROLLS). `historySource` diz o que o
//     card do histórico abre (a magia também pelo `attackKey`), e `canReadHistory` só acende o que abre.
//   - DDL-0243: o Blessing of the Forge pergunta arma ou armadura (`armorOption`; a armadura é um efeito
//     de +1 de CA, `armorBlessing`); o Two-Weapon Fighting com arma Nick não gasta a ação bônus; o Cleave
//     é uma variante do ataque (`withMasteryAttacks`); o Magic Stone cria a pedra com o ataque de magia
//     do lançador (`origin`); o "again" do Witch Bolt rola só o dano automático (`light.repeat`). O card
//     do histórico abre a descrição (`readFromHistory`) e destaca a opção usada (`payload.option`).
//   - O "Bond" do Pact of the Blade (DDL-0239): um botão por arma carregada, "Conjure a weapon" abre o
//     painel seletor de armas (só as que o pacto deixa invocar, `pactChoices`) e "End the bond"; a lista
//     nativa de 34 armas saiu (UI-PATTERNS: escolher é pelo painel).
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
import { transformRuleOf, transformOps, revertOps, formTempHp, formStats, formEligible, wildShapeOf, formEventId } from '../engine/playForms';
import creatureEntity, { beastFormEntity } from '../selector/entities/creature';
import {
  vitals as vitalsOf, healEvent, tempHpEvent, maxHpEvent, hurtEvent, deathSaveEvent, concentrationEvent, concentrationCheckEvent,
} from '../engine/playHealth';
import { shortRestEvent, longRestEvent, hitDiceLeft, hitDiceEvent } from '../engine/playRest';
import { emptyPlayState, makeEvent, hpView, remainingOf } from '../engine/playState';
import { pactChoices, pactEvent, hasPactOfTheBlade } from '../engine/playPact';
import { weaponRuleOf, eligibleWeapons, weaponModifier, strikeAttack, masteryNote, armorBlessing } from '../engine/playWeapons';
import { screenCatalog } from '../engine/playView';
import { activityEvent, apotheosisApplies, activityLabel, slotRecoveryEvent, fontOfMagicEvent, adjustResourceEvent, setResourceEvent, featureLogEvent, resolveCosts, left as leftOf } from '../engine/playUse';
import { featureCosts } from '../engine/playFeatures';
import { featureUseOf, riderSpendOps } from '../engine/playFeatureRolls';
import { rerollOptions, rerollEvent, rerollDiceOptions, rerollDiceEvent, rerollableDice } from '../engine/playRerolls';
import { castWays, castEvent, spellAttackOf, healParts, spellHealEvent, castTriggers, spellRecallEvent, slotRegainEvent, isZoneSpell, activeZone, endZoneEvent, projectileCount, timesFormula } from '../engine/playCast';
import {
  rollEffects, applyEffects, featureModifier, effectiveAc, effectiveSpeed, effectiveSpeeds, conditionEvent, modifierEvent, removeModifierEvent, conditionId, sourceModifier, makeModifier, effectiveDefenses, conditionList, fixedRollBonus, attackRollContext, defaultGrip, spellModifier, castOnceEffects,
} from '../engine/playEffects';
import { testParts, rollTestEvent, rollAttackEvent, damageParts, rollDamageEvent, canCrit } from '../engine/playActions';
import { itemUseEvent, ammoOps, itemCostOf, healOf } from '../engine/playInventory';
import {
  ECONOMY, startCombatEvent, nextTurnEvent, endCombatEvent, economyEvent, economyOp, costOfActivation, withRounds, roundsOf,
  movementLeft, moveEvent, dashEvent, readyEvent, readiedReactionEvent,
} from '../engine/playCombat';
import { askRoll } from '../components/play/rollDialog';
import { askHeal, askHurt, askHitDice, askShortRest, askUse, askCast, askSlotRecovery, askFontOfMagic, askModifier, askSkillCheck, askMove, askAction, askSlot, askCost, askResource, askRerollDice } from '../components/play/playDialogs';
import ActionsTab from '../components/play/ActionsTab';
import { actionContext, attackStepOp, basicActionList, costAvailable, offhandAttack, slotChoices, spellCosts } from '../engine/playBasicActions';
import FeaturesTab from '../components/play/FeaturesTab';
import SpellsTab from '../components/play/SpellsTab';
import InventoryTab from '../components/play/InventoryTab';
import SummonsTab from '../components/play/SummonsTab';
import useBestiary from '../hooks/useBestiary';
import { summonCreaturesFor, summonOps, summonGroupView, summonRiders, summonVitalsEvent, dismissEvent, summonAttack, summonTurnOf, turnText, featureSummons, familiarForms, familiarSpecialForms, isLightSummon, lightRulesOf, lightOps } from '../engine/playSummons';
import { resolveClassObj, resolveSubclassObj, resolveOptionalFeature } from '../engine/resolve';
import { resolveSpellObj } from '../engine/spells';
import RollButton from '../components/play/RollButton';
import { CombatDock, CombatFloat, RoundBadge } from '../components/play/CombatControls';
import PlayHistory from '../components/play/PlayHistory';
import RevertFormButton from '../components/play/RevertFormButton';
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
import conditionEntity from '../selector/entities/condition';
import weaponEntity from '../selector/entities/weapon';
import spellEntity from '../selector/entities/spell';
import { showFeatureText } from '../components/play/featureText';
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
import Tag from '../components/common/Tag';

const TABS = ['Actions', 'Features', 'Spells', 'Inventory'];

// ATENÇÃO: o mesmo número do @media do .shell no Play.module.css.
const WIDE_QUERY = '(min-width: 1140px)';

const SLOT_LABEL = { action: 'Action', bonus: 'Bonus Action', reaction: 'Reaction' };

const TOAST_MS = 4000;

// ATENÇÃO: o dano destas cai no turno do alvo, sem gasto seu; mudar de alvo é o "Use" (TC-0171).
const FREE_LIGHT_ROLLS = new Set(['transfix', "songal's elemental suffusion"]);

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
  const extra = (d.extra ?? []).map((x) => ` + ${x.formula}`).join('');
  return d.dice ? `${d.dice}${bonus}${extra}` : `${Math.max(0, d.bonus ?? 0)}${extra}`;
};

/** O ataque com os extras fixos ligados por padrão somados ao dano (o CAR do Agonizing Blast), para o rótulo. */
const withFixedDamage = (attack, state, catalog) => (attack?.damage ? { ...attack, damage: { ...attack.damage, bonus: (attack.damage.bonus ?? 0) + fixedRollBonus(state, catalog, attackRollContext(attack, 'damage', catalog)) } } : attack);

/** As notas de um ataque: a da arma (Shadow Blade, Booming Blade) e a da Weapon Mastery, com os números. */
const attackNotes = (attack, catalog) => [attack?.note, masteryNote(attack, catalog), shieldNote(attack, catalog)].filter(Boolean).join('. ');

/** O que a rolagem de cada salvaguarda e perícia soma, ligado e fixo, além do número da ficha (a Aura of Protection). */
function shownTestExtra(state, catalog) {
  const saves = {};
  const skills = {};
  for (const a of catalog.checks?.abilities ?? []) saves[a.ability] = fixedRollBonus(state, catalog, rollOf(catalog, { type: 'save', id: a.ability }));
  for (const s of catalog.checks?.skills ?? []) skills[s.skill] = fixedRollBonus(state, catalog, rollOf(catalog, { type: 'skill', id: s.skill }));
  return { saves, skills };
}

/** O aviso da arma de duas mãos com o escudo na outra (o Animated Shield deixa as mãos livres; a Lance vale com escudo se montado). */
const shieldNote = (attack, catalog) => (attack?.hands === 'two' && catalog?.shield && !catalog.shield.handsFree ? `Two-Handed weapon: your ${catalog.shield.name} must be off to wield it` : '');

/** O evento com operações a mais na frente (o gasto da feature que deu o custo). */
const withOps = (event, ops = []) => (ops.length ? { ...event, ops: [...ops, ...event.ops] } : event);

/** O título do histórico com desfazer e refazer (na coluna e na aba). */
/** As opções de classe escolhidas pelo personagem (invocações, manobras), resolvidas no compêndio. */
function chosenOptions(character, db) {
  return (character?.classes ?? []).flatMap((c) => Object.values(c.choices ?? {}))
    .filter((e) => e?.kind === 'optionalfeature')
    .flatMap((e) => (e.picks ?? []).map((p) => resolveOptionalFeature(db, p)))
    .filter(Boolean);
}

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
  const resourceMax = play.state?.resourceMax;
  const pactWeapon = play.state?.pactWeapon ?? null;
  const catalog = useMemo(
    () => screenCatalog(baseCatalog, { form, resourceMax, pactWeapon, modifiers: play.state?.modifiers }, form && formBlock ? formStats(formBlock) : null),
    [baseCatalog, form, formBlock, resourceMax, pactWeapon, play.state?.modifiers],
  );
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
    const riders = riderSpendOps(options.applied, catalog);
    if (riders.ops.length) event = { ...event, ops: [...event.ops, ...riders.ops], payload: { ...event.payload, spent: riders.lines } };
    record(event, cost);
    return options.applied;
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
    if (conflicts?.length) alert({ title: 'Not applied to the character', message: 'The character does not have that much, so the item or coins were left as they are.' });
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
    if (r.kind === 'temp') record(tempHpEvent({ state, catalog, amount: r.amount, replace: r.replace }));
    else if (r.kind === 'max') record(maxHpEvent({ state, catalog, amount: r.amount }));
    else record(healEvent({ state, catalog, amount: r.amount }));
  };

  /** O Hurt do card de HP; com concentração, o dano já pede o save de CON. */
  const openHurt = async () => {
    const evasion = (catalog.features ?? []).some((f) => f === 'evasion' || f === 'leading evasion') && !conditionList(state).ids.includes('incapacitated');
    const r = await askHurt({ vitals: hp, defenses: effectiveDefenses(catalog, state), evasion });
    if (!r) return;
    const event = hurtEvent({ state, catalog, amount: r.amount, type: r.type, affectMax: r.affectMax, save: r.save, evasion: r.evasion });
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

  /** O Pact of the Blade: vincular uma arma que carrega, invocar uma, ou desfazer o vínculo (ação bônus). */
  const bondPactWeapon = async () => {
    const { carried } = pactChoices(db, baseCatalog);
    const v = await ask({
      title: 'Pact of the Blade',
      message: `${state.pactWeapon ? `Your pact weapon: ${state.pactWeapon.name}. ` : ''}Bond with a magic weapon you carry or conjure a weapon (Bonus Action). The conjured weapon goes to your inventory.`,
      actions: [
        ...carried.map((c, i) => ({ label: `Bond: ${c.name}`, value: `b${i}` })),
        { label: 'Conjure a weapon', value: 'conjure', tone: 'primary' },
        ...(state.pactWeapon ? [{ label: 'End the bond', value: 'end', tone: 'danger' }] : []),
        { label: 'Cancel', value: null },
      ],
    });
    if (v == null || v === false) return;
    if (v === 'conjure') {
      setPicker('pact');
      return;
    }
    const choice = v === 'end' ? null : carried[Number(String(v).slice(1))];
    if (v !== 'end' && !choice) return;
    record(pactEvent({ choice, state, character }), v === 'end' ? null : 'bonus');
  };

  /** A arma escolhida no painel para invocar como arma de pacto. */
  const conjurePactWeapon = (raw) => {
    setPicker(null);
    const choice = pactChoices(db, baseCatalog).conjure.find((c) => c.name === raw.name);
    if (choice) record(pactEvent({ choice, state, character }), 'bonus');
  };

  /** Uma feature de arma sem activity (Blessing of the Forge, Hex Warrior): escolhe a arma e grava o estado. */
  const useWeaponFeature = async (feature, spend = null) => {
    const rule = weaponRuleOf(feature.name);
    if (spend && leftOf(catalog, state, spend) < 1 && !(await confirm({ title: feature.name, message: 'None left. Use anyway?', confirmLabel: 'Use anyway' }))) return;
    const ops = rule ? await weaponStateOps(rule) : null;
    if (!ops) return;
    const target = ops.find((o) => o.add)?.add;
    const ev = featureLogEvent({ catalog, state, feature, spend, amount: spend ? 1 : 0, option: target?.weapon ? (target.notes?.[0] ?? '').replace(`${rule.name}: `, '') || null : target?.ac ? 'Armor (+1 AC)' : null });
    record({ ...ev, ops: [...ev.ops, ...ops] });
  };

  /** A descrição da fonte de um evento do histórico: a magia lançada ou a feature usada. */
  const historySource = (event) => {
    const p = event.payload ?? {};
    const key = p.spellKey ?? String(p.attackKey ?? '').replace(/#.*$/, '');
    const spell = key ? catalog.spells.flatMap((o) => o.spells).find((s) => s.key === key) : null;
    const raw = spell ? resolveSpellObj(db, spell.name, spell.source) : null;
    if (raw) return { raw };
    const name = p.feature ?? catalog.actions.find((a) => a.key === p.actionKey)?.name ?? null;
    const feature = name ? (catalog.featureList ?? []).find((f) => f.name === name) : null;
    return feature ? { feature } : null;
  };

  const canReadHistory = (event) => event.kind === 'cast' || !!historySource(event);

  const readFromHistory = (event) => {
    const src = historySource(event);
    if (src?.raw) return showDetailPopup({ entity: spellEntity, raw: src.raw, db });
    if (src?.feature) return showFeatureText(src.feature);
    return alert({ title: event.label, message: 'This is no longer on the character.' });
  };

  /** O Arcane Apotheosis: pagar o Metamagic ou usá-lo de graça; null cancela. */
  const askApotheosis = (title) => ask({
    title,
    message: 'Arcane Apotheosis: while Innate Sorcery is active, one Metamagic option on each of your turns costs no Sorcery Points.',
    actions: [{ label: 'Pay', value: 'pay' }, { label: 'Free', value: 'free', tone: 'primary' }],
  });

  /** Usa uma feature: pergunta o que ela precisa, avisa o que falta, grava. */
  const applyFeature = async (action, activity, extra = {}) => {
    const weaponRule = !extra.free && !extra.only ? weaponRuleOf(action.name) : null;
    const weaponOps = weaponRule ? await weaponStateOps(weaponRule) : [];
    if (!weaponOps) return;
    let only = extra.only ?? null;
    if (!only && activity.attack && (activity.heal || (activity.damage ?? []).length)) {
      only = await askRollKind({ title: action.name, effect: (activity.damage ?? []).map((p) => p.formula).join(' + ') || activity.heal?.formula, effectLabel: activity.heal ? 'Healing' : 'Damage' });
      if (!only) return;
    }
    const needs = activity.scalable || activity.heal || activity.attack || (activity.damage ?? []).length > 0
      || (activity.consumes ?? []).some((c) => c.spellSlot != null);
    let options = {};
    if (needs) {
      options = await askUse({ title: activityLabel(action, activity), catalog, state, action, activity });
      if (!options) return;
    }
    let noCost = false;
    if (apotheosisApplies(catalog, { action })) {
      const v = await askApotheosis(action.name);
      if (!v) return;
      noCost = v === 'free';
    }
    const short = noCost ? [] : resolveCosts(catalog, state, activity, options).filter((c) => c.amount > 0 && leftOf(catalog, state, c.key) < c.amount);
    if (short.length && !(await confirm({ title: 'Not enough left', message: 'There is not enough left to pay for this. Use it anyway?', confirmLabel: 'Use anyway' }))) return;
    let event;
    try {
      const applied = activity.attack ? applyEffects(rollEffects(state, catalog, { kind: 'attack', attackAbility: activity.attack.ability })) : undefined;
      event = activityEvent({ catalog, state, action, activity, options: { ...options, applied, only, noCost, free: !!extra.free, critical: options.critical || !!extra.critical } });
      if (weaponOps.length) event = { ...event, ops: [...event.ops, ...weaponOps] };
    } catch (e) {
      await alert({ title: 'Could not use it', message: String(e?.message ?? e) });
      return;
    }
    record(event, extra.free ? null : costOfActivation(activity.activation?.type));
  };

  /** O "Roll damage" do cartão de uma feature que rolou só o ataque: sem gastar de novo. */
  /** Rola de novo um teste ou ataque do histórico, pela regra que o jogador escolher. */
  const rerollFromHistory = async (event) => {
    const options = rerollOptions(event, catalog, state);
    if (!options.length) return;
    let option = options[0];
    if (options.length > 1) {
      const id = await ask({
        title: `Reroll ${event.label}`,
        message: 'Which rule lets you roll it again, or raise it?',
        actions: options.map((o) => ({ label: `${o.label}${o.spendKey ? ` (1 ${(catalog.resources ?? []).find((r) => r.key === o.spendKey)?.name ?? ''}${o.left < 1 ? ', none left' : ''})` : ''}`, value: o.id })),
      });
      option = options.find((o) => o.id === id);
      if (!option) return;
    }
    if (option.spendKey && option.left < 1 && !(await confirm({ title: 'Nothing left', message: `${option.label} has nothing left to spend. Reroll anyway?`, confirmLabel: 'Reroll anyway' }))) return;
    record(rerollEvent({ event, catalog, option }));
  };

  /** Rola de novo alguns dados de um dano ou de uma cura do histórico, pela regra escolhida. */
  const rerollDiceFromHistory = async (event) => {
    const options = rerollDiceOptions(event, catalog, state);
    if (!options.length) return;
    let option = options[0];
    if (options.length > 1) {
      const id = await ask({
        title: `Reroll dice: ${event.label}`,
        message: 'Which rule lets you roll some of these dice again?',
        actions: options.map((o) => ({ label: `${o.label}${o.spendKey ? ` (1 ${(catalog.resources ?? []).find((r) => r.key === o.spendKey)?.name ?? ''}${o.left < 1 ? ', none left' : ''})` : ''}`, value: o.id })),
      });
      option = options.find((o) => o.id === id);
      if (!option) return;
    }
    if (option.spendKey && option.left < 1 && !(await confirm({ title: 'Nothing left', message: `${option.label} has nothing left to spend. Reroll anyway?`, confirmLabel: 'Reroll anyway' }))) return;
    const picks = await askRerollDice({ title: option.label, dice: rerollableDice(event), max: option.max, ones: option.ones, note: option.note });
    if (picks?.length) record(rerollDiceEvent({ event, catalog, option, picks }));
  };

  const featureEffectFromHistory = (event) => {
    const action = catalog.actions.find((a) => a.key === event.payload?.actionKey);
    const activity = action?.activities.find((x) => x.id === event.payload?.activityId);
    if (!activity) {
      alert({ title: 'Feature not found', message: 'This feature is no longer on the character.' });
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

  /** Leva uma feature ao histórico com o custo do turno; `spend` gasta um do pool. */
  const logFeature = async (feature, spend = null) => {
    const costs = featureCosts(feature, catalog.actions.find((a) => a.key === feature.actionKey));
    let cost = costs.length === 1 ? costs[0] : null;
    if (costs.length > 1 && state.combat) {
      const v = await ask({
        title: feature.name,
        message: 'Which part of your turn does it take?',
        actions: [...costs.map((c) => ({ label: SLOT_LABEL[c], value: c })), { label: 'None', value: 'none' }],
      });
      if (v == null) return;
      cost = v === 'none' ? null : v;
    }
    let use = featureUseOf(feature, catalog);
    let optionLabel = null;
    if (use?.options?.length > 1) {
      const pick = await ask({
        title: feature.name,
        message: 'Which option?',
        actions: use.options.map((label, i) => ({ label, value: String(i), tone: i === 0 ? 'primary' : undefined })),
      });
      if (pick == null || pick === false) return;
      use = featureUseOf(feature, catalog, null, Number(pick));
      optionLabel = use?.options?.[Number(pick)] ?? null;
    }
    if (use?.amount && typeof use.amount === 'object') {
      const r = await ask({
        title: feature.name,
        message: `How many points of ${(catalog.resources ?? []).find((x) => x.key === use.spend)?.name ?? 'the resource'} do you spend (${use.amount.min} to ${use.amount.max})?`,
        fields: [{ type: 'select', name: 'n', label: 'Points', default: String(use.amount.min), options: Array.from({ length: use.amount.max - use.amount.min + 1 }, (_, i) => ({ label: String(use.amount.min + i), value: String(use.amount.min + i) })) }],
        actions: [{ label: 'Cancel', value: false }, { label: 'Use', value: true, tone: 'primary' }],
      });
      if (!r?.action) return;
      use = featureUseOf(feature, catalog, Math.floor(Number(r.values?.n) || 0));
    }
    const modifier = use?.modifier ? makeModifier(use.modifier) : null;
    const pay = spend ?? use?.spend ?? null;
    const amount = spend ? 1 : use?.spent ?? 1;
    if (pay && amount > 0 && leftOf(catalog, state, pay) < amount && !(await confirm({ title: 'Not enough left', message: 'There is not enough left to pay for this. Use it anyway?', confirmLabel: 'Use anyway' }))) return;
    record(featureLogEvent({ catalog, state, feature, cost, spend: pay, amount, modifier, save: use?.save ?? null, roll: use?.roll ?? null, apply: use?.apply ?? null, restore: use?.restore ?? null, restoreUpTo: use?.restoreUpTo ?? null, option: optionLabel }), cost);
  };

  /** O ajuste à mão de um recurso (o mestre tira, dá ou muda o máximo): o painel e o evento. */
  const adjustByHand = async (resource) => {
    const full = (catalog.resources ?? []).find((x) => x.key === resource.key) ?? resource;
    const max = full.max ?? 0;
    const r = await askResource({ title: resource.label ?? resource.name, left: remainingOf(state, resource.key, max), max, sheetMax: full.sheetMax ?? max, shape: resource.kind === 'slot' || resource.kind === 'pact' ? 'gem' : undefined });
    if (r) record(setResourceEvent({ catalog, key: resource.key, left: r.left, max: r.max, state }));
  };

  /** Lança uma magia: escolhe a forma, grava e abre a rolagem dela. */
  /** Escolhe a arma de uma magia ou feature de arma (botões, só as que a regra aceita); null cancela. */
  const pickWeapon = async (title, list) => {
    if (!list.length) {
      await alert({ title, message: 'No weapon you carry fits this. Check the weapon in your inventory (equipped, and nonmagical when the text asks).' });
      return null;
    }
    if (list.length === 1) return list[0];
    const key = await ask({ title, message: 'Which weapon?', actions: [...list.map((a) => ({ label: a.name, value: a.key })), { label: 'Cancel', value: null }] });
    return list.find((a) => a.key === key) ?? null;
  };

  /** As operações do estado de arma de uma regra: tira o anterior da mesma fonte e põe o novo. */
  const weaponStateOps = async (rule, { slot = 0, abilityKey = null, concentration = null, origin = null } = {}) => {
    let attack = null;
    if (rule.armorOption) {
      const which = await ask({ title: rule.name, message: 'A weapon or a suit of armor?', actions: [{ label: 'Weapon', value: 'weapon', tone: 'primary' }, { label: 'Armor', value: 'armor' }, { label: 'Cancel', value: null }] });
      if (!which) return null;
      if (which === 'armor') {
        const old = (state.modifiers ?? []).filter((m) => m.label === rule.name).map((m) => ({ op: 'modifier', remove: m.id }));
        return [...old, { op: 'modifier', add: makeModifier(armorBlessing(rule.name)) }];
      }
    }
    if (rule.kind !== 'create' && !rule.all) {
      attack = await pickWeapon(rule.name, eligibleWeapons(rule, catalog));
      if (!attack) return null;
    }
    let type = null;
    if (rule.choice) {
      type = await ask({ title: rule.name, message: rule.choice.message, actions: [...rule.choice.options, { label: 'Cancel', value: null }] });
      if (!type) return null;
    }
    if (rule.types) {
      type = await ask({ title: rule.name, message: 'Which damage type?', actions: [...rule.types.map((t) => ({ label: t.charAt(0).toUpperCase() + t.slice(1), value: t })), { label: 'Cancel', value: null }] });
      if (!type) return null;
    }
    const mod = makeModifier({ ...weaponModifier({ rule, attack, catalog, slot, type, abilityKey, origin }), ...(concentration ? { concentration } : {}) });
    const old = (state.modifiers ?? []).filter((m) => m.label === rule.name).map((m) => ({ op: 'modifier', remove: m.id }));
    return [...old, { op: 'modifier', add: withRounds(mod, state, rule.rounds) }];
  };

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
    const creatures = !summoning ? [] : /^find familiar$/i.test(spell.name) ? familiarForms(beasts, familiarSpecialForms(chosenOptions(character, db))) : summonCreaturesFor(beasts, spell);
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
      : summon && !summon.pick ? summonOps({ state, creature: summon.creature, spell, level: way.level, variant: summon.variant, count: summon.count, origin, catalog, classLevel, turn }) : [];
    if (cost.spend && apotheosisApplies(catalog, { spendKey: cost.spend.key })) {
      const v = await askApotheosis(cost.label ?? spell.name);
      if (!v) return;
      if (v === 'free') cost = { ...cost, spend: null };
    }
    if (way.key && (way.left ?? 0) < 1 && !(await confirm({ title: 'Nothing left', message: `No ${way.label.toLowerCase()} is left. Cast anyway?`, confirmLabel: 'Cast anyway' }))) return;
    const weaponRule = weaponRuleOf(spell.name);
    let weaponOps = [];
    let strikeWith = null;
    if (weaponRule?.kind === 'strike') {
      strikeWith = await pickWeapon(spell.name, eligibleWeapons(weaponRule, catalog));
      if (!strikeWith) return;
    } else if (weaponRule) {
      weaponOps = await weaponStateOps(weaponRule, { slot: way.level, abilityKey: origin.ability, concentration: spell.concentration ? spell.key : null, origin });
      if (!weaponOps) return;
    }
    const castEv = withOps(castEvent({ catalog, state, origin, spell, way, onSelf }), [...(cost.spend ? [{ op: 'spend', key: cost.spend.key, amount: cost.spend.amount }] : []), ...summonExtra]);
    const weaponPick = strikeWith?.name ?? (weaponOps.find((o) => o.add)?.add?.notes?.[0] ?? '').replace(`${spell.name}: `, '');
    record({ ...castEv, ops: [...castEv.ops, ...weaponOps], payload: { ...castEv.payload, ...(weaponPick && weaponPick !== spell.name ? { option: weaponPick } : {}) } }, costOfActivation(cost.cost));
    if (strikeWith) {
      const atk = strikeAttack(strikeWith, weaponRule, catalog, origin.ability);
      const kind = await askRollKind({ title: atk.name, attack: formatBonus(atk.toHit.total + fixedRollBonus(state, catalog, attackRollContext(atk, 'attack', catalog))), effect: damageText(withFixedDamage(atk, state, catalog)) });
      if (kind === 'attack') rollAttack(atk);
      else if (kind === 'effect') rollDamage(atk);
      return;
    }
    if (weaponRule) return;
    if (summon?.pick) {
      setFormPick({ summon: { creatures, spell, level: way.level, origin, classLevel, turn, count: summon.count } });
      setPicker('form');
      return;
    }
    if (summon) setTab('Summons');
    if (transformRule && transformSelf) {
      await bestiary.load();
      setFormPick({ rule: transformRule });
      setPicker('form');
      return;
    }
    if (spell.mechanics?.damage?.later && (summon?.light || spellModifier(spell, catalog) || isZoneSpell(spell, catalog))) return;
    const pieces = summon?.light ? summonExtra.find((o) => o.add?.light?.count)?.add : null;
    if (pieces) {
      await rollPieces(pieces, origin, spell);
      return;
    }
    const shots = projectileCount(spell, way.level, catalog.stats?.level ?? 1);
    if (shots && spell.mechanics?.damage?.dice) {
      await rollShots(origin, spell, way.level, shots);
      return;
    }
    if (spell.mechanics?.attack && spell.mechanics?.damage?.dice) {
      const atk = spellAttackOf(origin, spell, way.level);
      const kind = await askRollKind({ title: spell.name, attack: atk.attack?.bonus != null ? formatBonus(atk.attack.bonus + fixedRollBonus(state, catalog, attackRollContext(atk, 'attack', catalog))) : '', effect: damageText(withFixedDamage(atk, state, catalog)) });
      if (kind === 'attack') rollAttack(atk);
      else if (kind === 'effect') rollDamage(atk);
    } else if (spell.mechanics?.attack) rollAttack(spellAttackOf(origin, spell, way.level));
    else if (spell.mechanics?.damage?.dice) rollDamage(spellAttackOf(origin, spell, way.level));
    else if (spell.mechanics?.heal?.dice) rollSpellHeal(origin, spell, way.level);
  };

  /** Os projéteis da magia: um ataque por raio (o dano sai do card de cada um), ou o dano por alvo, quantos dardos em cada. */
  const rollShots = async (origin, spell, level, { count, noun }) => {
    const atk = spellAttackOf(origin, spell, level);
    if (atk.attack) {
      for (let i = 0; i < count; i += 1) await rollAttack({ ...atk, name: `${spell.name} (${noun} ${i + 1} of ${count})` });
      return;
    }
    let left = count;
    const castUsed = [];
    while (left > 0) {
      const r = left === 1 ? { action: true, values: { n: '1' } } : await ask({
        title: spell.name,
        message: `${left} ${noun}s left. How many hit this target?`,
        fields: [{ type: 'select', name: 'n', label: `${noun[0].toUpperCase()}${noun.slice(1)}s`, default: String(left), options: Array.from({ length: left }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })) }],
        actions: [{ label: 'Cancel', value: false }, { label: 'Roll', value: true, tone: 'primary' }],
      });
      const k = Number(r?.values?.n);
      if (!r?.action || !k) return;
      const applied = await rollDamage({ ...atk, name: `${spell.name} (${k} ${noun}${k > 1 ? 's' : ''})`, damage: { ...atk.damage, dice: timesFormula(atk.damage.dice, k), bonus: (atk.damage.bonus ?? 0) * k } }, { castUsed });
      castUsed.push(...(applied?.oncePerCast ?? []));
      left -= k;
    }
  };

  /** O "Use" da magia de área ativa: encerrar (a concentração ou a magia), lançar de novo ou rolar o dano de novo. */
  const useZone = async (origin, spell) => {
    const zone = activeZone(state, spell);
    if (!zone) return castSpell(origin, spell);
    const choice = await ask({
      title: spell.name,
      message: `${spell.name} is active (level ${zone.level}). What happens now?`,
      actions: [
        { label: 'Cancel', value: null },
        { label: zone.concentration ? 'End concentration' : 'End the spell', value: 'end', tone: 'danger' },
        { label: 'Cast again', value: 'recast' },
        { label: 'Damage again', value: 'damage', tone: 'primary' },
      ],
    });
    if (choice === 'end') record(endZoneEvent({ state, spell }));
    else if (choice === 'recast') castSpell(origin, spell);
    else if (choice === 'damage') {
      const atk = { ...spellAttackOf(origin, spell, zone.level), name: `${spell.name} (again)` };
      if (atk.attack) {
        const kind = await askRollKind({ title: atk.name, attack: formatBonus(atk.attack.bonus + fixedRollBonus(state, catalog, attackRollContext(atk, 'attack', catalog))), effect: damageText(withFixedDamage(atk, state, catalog)) });
        if (kind === 'attack') rollAttack(atk);
        else if (kind === 'effect') rollDamage(atk);
      } else rollDamage(atk);
    }
  };

  /** Rola a cura de uma magia; o diálogo pergunta se é no próprio personagem. */
  const rollSpellHeal = (origin, spell, level, quick = false) =>
    roll(
      (options) => spellHealEvent({ catalog, state, origin, spell, level, options }),
      { title: `${spell.name}: healing`, kind: 'damage', parts: healParts(origin, spell, level, catalog), rollData: catalog.rollData, healOption: true },
      quick,
    );

  /** Os botões do cartão de uma magia lançada: ataque, dano e cura no círculo dela. */
  const spellRoll = (spellKey, level, kind) => {
    const origin = catalog.spells.find((o) => o.spells.some((s) => s.key === spellKey));
    const spell = origin?.spells.find((s) => s.key === spellKey);
    if (!spell) {
      alert({ title: 'Spell not found', message: 'This spell is no longer on the character.' });
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
      alert({ title: 'Spell not found', message: 'This spell is no longer on the character.' });
      return;
    }
    const cost = costOfActivation(group.turn?.command);
    const pay = cost ? [economyOp(state, cost)].filter(Boolean) : [];
    if (kind === 'use') {
      const ev = withOps(featureLogEvent({ catalog, state, feature: { name: spell.name }, option: 'Again' }), pay);
      record({ ...ev, payload: { ...ev.payload, spellKey: spell.key } });
      return;
    }
    const rollPay = FREE_LIGHT_ROLLS.has(spell.name.toLowerCase()) ? [] : pay;
    if (group.light?.count && kind === 'damage') return rollPieces(group, origin, spell, rollPay);
    const repeat = group.light?.repeat;
    const atk = repeat
      ? { key: `${spell.key}#again`, kind: 'spell', name: `${spell.name} (again)`, attack: repeat.attack ? { bonus: origin.attackBonus ?? 0 } : null, damage: { dice: repeat.dice, bonus: 0, types: [repeat.type] }, versatile: null }
      : spellAttackOf(origin, spell, group.ctx?.spellLevel ?? spell.level);
    if (kind === 'attack') rollAttack(atk, false, false, null, rollPay);
    else if (kind === 'damage') rollDamage(atk, {}, false, false, null, rollPay);
    else rollSpellHeal(origin, spell, group.ctx?.spellLevel ?? spell.level);
  };

  /** Gasta um ou mais pedaços da magia (os meteoros do Melf's) e rola o dano de cada um; o último acaba a magia. */
  const rollPieces = async (group, origin, spell, pay = []) => {
    const count = group.light.count;
    if (count.left < 1) return;
    const most = Math.min(count.most ?? 1, count.left);
    const n = most > 1
      ? await ask({ title: spell.name, message: `${count.left} of ${count.max} ${count.noun}s left. How many do you send?`, actions: [{ label: 'Cancel', value: 0 }, { label: `One ${count.noun}`, value: 1 }, { label: `${most} ${count.noun}s`, value: most, tone: 'primary' }] })
      : 1;
    if (!n) return;
    const last = count.left - n <= 0;
    const spend = [{ op: 'summon', id: group.id, count: -n }, ...(last ? [{ op: 'summon', remove: group.id }, ...(group.concentration ? [{ op: 'concentration', value: null }] : [])] : [])];
    const atk = spellAttackOf(origin, spell, group.ctx?.spellLevel ?? spell.level);
    const castUsed = [...(group.castUsed ?? [])];
    for (let i = 0; i < n; i += 1) {
      const used = (options) => {
        const fresh = (options.applied?.oncePerCast ?? []).filter((id) => !castUsed.includes(id));
        return !last && fresh.length ? [{ op: 'summon', id: group.id, castUsed: fresh }] : [];
      };
      const applied = await rollDamage({ ...atk, name: n > 1 ? `${spell.name} (${count.noun} ${i + 1} of ${n})` : spell.name }, { castUsed }, false, false, null, (options) => [...(i === 0 ? [...pay, ...spend] : []), ...used(options)]);
      castUsed.push(...(applied?.oncePerCast ?? []));
    }
  };

  /** O que a instância leve rola: ataque, dano ou cura da magia. */
  const lightKinds = (group) => {
    const paid = group.turn?.command === 'bonus' || group.turn?.command === 'action';
    const repeat = group.light?.repeat;
    const spell = catalog.spells.flatMap((o) => o.spells).find((s) => s.key === group.spell?.key);
    const m = spell?.mechanics ?? {};
    const rolls = repeat ? [repeat.attack && 'attack', 'damage'] : [m.attack && 'attack', m.damage?.dice && 'damage', m.heal?.dice && 'heal'];
    const out = rolls.filter(Boolean);
    return paid && (group.light?.moves || !out.length) ? [...out, 'use'] : out;
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

  /** As vistas dos grupos de summon: a criatura resolvida e os PV de cada membro (com as invocações do familiar). */
  const summonViews = (state.summons ?? []).map((g) =>
    summonGroupView(g, bestiary.list.find((m) => m.name === g.ref?.name && m.source === g.ref?.source) ?? null, catalog.features ?? []));

  /** A linha dos summons no controle de turno: quem age e como. */
  const summonLine = (state.summons ?? []).map((g) => ({ label: g.label, note: turnText(g.turn) || 'acts as the text says' }));

  /** Dano ou cura num membro de um summon, pelo valor digitado. */
  const summonHp = async (group, member, kind) => {
    const vitals = { current: member.current ?? 0, max: member.max ?? member.current ?? 0, temp: member.temp ?? 0 };
    const r = kind === 'hurt' ? await askHurt({ title: `${group.label}: hurt`, vitals }) : await askHeal({ title: `${group.label}: heal`, vitals, maxNote: 'Like Aid: stays until you change it or the summon leaves.' });
    if (!r) return;
    record(summonVitalsEvent({ group, member, kind: kind === 'hurt' ? 'hurt' : r.kind, amount: r.amount, replace: r.replace, affectMax: r.affectMax }));
  };

  /** O ataque e o dano de uma ação de summon, sem os efeitos do jogador. */
  const summonRoll = (view, action, kind) => {
    const atk = summonAttack(view.group, action, view.stats);
    if (kind === 'attack') {
      roll((options) => rollAttackEvent({ catalog, attack: atk, options }), { title: `${atk.name}: attack`, kind: 'd20', parts: [{ label: 'Attack', formula: atk.attack?.bonus ?? 0 }], rollData: catalog.rollData }, false, []);
    } else {
      roll((options) => rollDamageEvent({ catalog, attack: atk, options }), { title: `${atk.name}: damage`, kind: 'damage', parts: damageParts(atk), rollData: catalog.rollData, canCrit: canCrit(atk) }, false, summonRiders(view, catalog, state, action));
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
      await alert({ title: 'No known forms', message: 'Choose your Wild Shape forms in Build mode, on the Class tab.' });
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
    const pick = formPick?.summon;
    setPicker(null);
    setFormPick(null);
    if (pick) {
      const ops = summonOps({ state, creature: m, spell: pick.spell, level: pick.level, count: pick.count, origin: pick.origin, catalog, classLevel: pick.classLevel, turn: pick.turn });
      record(makeEvent('summon', { label: `${m.name} summoned`, ops, payload: { summon: m.name } }));
      setTab('Summons');
      return;
    }
    if (!rule) return;
    const ops = transformOps({ state, rule, creature: m, tempHp: formTempHp(rule, { stats: formStats(m) }) });
    record(makeEvent('form', { label: `${rule.label}: ${m.name}`, ops, payload: { form: m.name } }));
  };

  /** Sai da forma (o Wild Shape gasta a Ação Bônus). */
  const revertForm = () => {
    if (!state.form) return;
    record(makeEvent('form', { label: `${state.form.label} ends`, ops: revertOps(state), payload: { reverted: true } }), state.form.kind === 'wildShape' ? 'bonus' : null);
  };

  /** O estado vivo que os cards do histórico leem: os summons em campo e o evento da forma atual. */
  const historyLive = {
    summons: new Set((state.summons ?? []).map((g) => g.id)),
    form: state.form,
    formEventId: state.form ? formEventId(play.doc) : null,
    onRevert: revertForm,
    onDismiss: (id) => {
      const group = (state.summons ?? []).find((g) => g.id === id);
      if (group) dismissSummon(group);
    },
    castTriggersOf: (event) => castTriggers(event, catalog),
    canRerollDice: (event) => rerollDiceOptions(event, catalog, state).length > 0,
    onRerollDice: rerollDiceFromHistory,
    onCastTrigger: (t) => record(t.recall ? spellRecallEvent({ trigger: t }) : t.regain ? slotRegainEvent({ catalog, state, trigger: t }) : featureLogEvent({ catalog, state, feature: { name: t.label.split(':')[0] }, roll: { label: t.label, formula: t.formula }, apply: t.apply })),
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
        note: attackNotes(attack, catalog),
      },
      quick,
      rollEffects(state, catalog, attackRollContext(attack, 'attack', catalog)),
      spend ? cost : null,
    );

  /** A munição gasta pelo ataque, no mesmo evento. */
  const withAmmo = (event, attack) => {
    if (trackAmmo === false) return event;
    const ammo = ammoOps({ character, derivedInventory: derived.inventory, attack });
    return { ...event, ops: [...event.ops, ...ammo.ops], payload: { ...event.payload, ammo: ammo.ammo, ammoLeft: ammo.left, ammoMissing: ammo.missing } };
  };

  const rollDamage = (attack, { critical = false, castUsed = [] } = {}, quick = false, spend = false, cost = null, extraOps = []) =>
    roll(
      (options) => {
        const event = withOps(rollDamageEvent({ catalog, attack, options }), typeof extraOps === 'function' ? extraOps(options) : extraOps);
        return spend ? withAmmo(event, attack) : event;
      },
      {
        title: `${attack.name}: damage`,
        kind: 'damage',
        parts: damageParts(attack),
        rollData: catalog.rollData,
        defaultCritical: critical && canCrit(attack),
        canCrit: canCrit(attack),
        versatileDice: attack.versatile ?? null,
        hands: attack.hands ?? null,
        defaultGrip: defaultGrip(attack, catalog),
        shield: catalog.shield ?? null,
        damageTypes: attack.damage?.typeOptions ?? null,
        note: [attack.save ? `The target makes a DC ${attack.save.dc} ${ABILITY_FULL[attack.save.ability] ?? ''} saving throw` : '', attackNotes(attack, catalog)].filter(Boolean).join('. '),
      },
      quick,
      castOnceEffects(rollEffects(state, catalog, attackRollContext(attack, 'damage', catalog)), castUsed),
      spend ? cost : null,
    );

  /**
   * Um ataque da aba Actions: pergunta se rola o d20 ou o dano (DDL-0156); o custo do
   * turno, o passo do Extra Attack e a munição vão em quem for rolado.
   */
  const attackOrDamage = async (attack, cost, extraOps = []) => {
    const kind = attack.damage
      ? await askRollKind({ title: attack.name, attack: attack.toHit ? formatBonus(attack.toHit.total + fixedRollBonus(state, catalog, attackRollContext(attack, 'attack', catalog))) : '', effect: damageText(withFixedDamage(attack, state, catalog)) })
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
  const damageFromHistory = (attackKey, { level = null, name = null, ...opts } = {}) => {
    const offhand = String(attackKey).endsWith('#offhand');
    const base = catalog.attacks.find((a) => a.key === (offhand ? String(attackKey).slice(0, -'#offhand'.length) : attackKey));
    const origin = base ? null : catalog.spells.find((o) => o.spells.some((s) => s.key === attackKey));
    const spell = origin?.spells.find((s) => s.key === attackKey);
    const fromSpell = spell ? { ...spellAttackOf(origin, spell, level ?? spell.level), ...(name ? { name } : {}) } : null;
    const attack = base && offhand ? offhandAttack(base, catalog) : base ?? fromSpell;
    if (!attack) {
      alert({ title: 'Attack not found', message: 'This attack is no longer on the character.' });
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
    else if (r.kind === 'attack' && item.name === 'Two-Weapon Fighting') attackOrDamage(offhandAttack(r.attack, catalog), String(r.attack.mastery ?? '').toLowerCase() === 'nick' ? 'attack' : cost ?? 'bonus', extra);
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
      alert({ title: `Could not ${verb} everything`, message: 'An item changed in Build mode since this action, so it was left as it is now.' });
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
  const testExtra = shownTestExtra(state, catalog);
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
          <RevertFormButton form={state.form} onClick={revertForm} />
        </section>
      )}

      <div className={sheetHeader.header}>
        <PlayTiles
          hp={hp}
          hitDice={hitDice}
          initiative={checks.initiative.bonus + fixedRollBonus(state, catalog, rollOf(catalog, { type: 'initiative' }))}
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

        <AbilityCards abilities={checks.abilities.map((a) => ({ ...a, save: a.save + (testExtra.saves[a.ability] ?? 0) }))} onCheck={checkAbility} onSave={saveAbility} dataTour={TUT.PLAY_ABILITIES} />
      </div>

      <div className={sheetPage.stack} data-flip="profs">
        <ProficienciesCard
          derived={derived}
          onSave={saveAbility}
          extra={testExtra}
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
              <PlayHistory doc={play.doc} onDamage={damageFromHistory} onConcentration={(dc) => rollConcentration(dc)} concentrating={!!state.concentration} onSpell={spellRoll} onFeatureEffect={featureEffectFromHistory} onReroll={rerollFromHistory} onRead={readFromHistory} canRead={canReadHistory} live={historyLive} />
            </>
          )}

          {activeTab === 'Actions' && <ActionsTab list={basicActions} state={state} onAct={takeAction} dataTour={TUT.PLAY_ROLLS} />}

          {activeTab === 'Features' && (
            <FeaturesTab catalog={catalog} state={state} onUse={applyFeature} onSpecial={special} onLog={logFeature} onSummon={summonFromFeature} onTransform={transformWildShape} onResource={adjustByHand} onPact={hasPactOfTheBlade(catalog) ? bondPactWeapon : null} onWeapon={useWeaponFeature} />
          )}

          {activeTab === 'Spells' && (
            <SpellsTab catalog={catalog} state={state} derived={derived} db={db} onCast={castSpell} onResource={adjustByHand} activeOf={(s) => isZoneSpell(s, catalog) && !!activeZone(state, s)} onUse={useZone} />
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
              onResource={adjustByHand}
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
            <PlayHistory doc={play.doc} onDamage={damageFromHistory} onConcentration={(dc) => rollConcentration(dc)} concentrating={!!state.concentration} onSpell={spellRoll} onFeatureEffect={featureEffectFromHistory} onReroll={rerollFromHistory} onRead={readFromHistory} canRead={canReadHistory} live={historyLive} />
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
      {picker === 'pact' && (
        <SelectorPanel
          entity={weaponEntity}
          db={db}
          currentId={null}
          heading="Pact of the Blade: conjure a weapon"
          hint="Simple or Martial Melee weapons; with Improved Pact Weapon, also bows and crossbows."
          exclude={(w) => !pactChoices(db, baseCatalog).conjure.some((c) => c.name === w.name)}
          onSelect={conjurePactWeapon}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === 'form' && (
        <SelectorPanel
          entity={formPick?.summon || formPick?.rule?.types?.join() === 'beast' ? beastFormEntity : creatureEntity}
          db={beastDb}
          currentId={null}
          heading={formPick?.summon ? `${formPick.summon.spell.name}: choose the creature` : `${formPick?.rule?.label ?? 'Form'}: choose the form`}
          hint={bestiary.loading ? 'Loading the creatures…' : formPick?.summon ? undefined : 'Forms the spell allows at your level.'}
          exclude={(m) => (formPick?.summon
            ? !formPick.summon.creatures.some((c) => c.name === m.name && c.source === m.source)
            : !formEligible(m, formPick?.rule, { level: baseCatalog.stats.level }))}
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
            <Tag tone="success">{['attack', 'damageRoll', 'use'].includes(toast.kind) ? 'Critical' : 'Natural 20'}</Tag>
          )}
          {toast.rolls?.isFumble && <Tag tone="danger">Natural 1</Tag>}
        </button>
      )}
    </>
  );
}
