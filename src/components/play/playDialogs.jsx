// =============================================================================
// playDialogs: abre os painéis de diálogo do play mode (HP, descanso, uso, magia)
// =============================================================================
// O QUE FAZ
//   Os atalhos que a tela do play mode chama: os HpPanels (cura, dano, dados
//   de vida), o ShortRestPanel (dados de vida), o UsePanel (usar uma
//   feature), o CastPanel (lançar uma magia) e os RecoveryPanels (recuperar
//   slots, Font of Magic), cada um dentro de um diálogo do app.
//   Cada um resolve com o que o painel devolveu, ou null se cancelado. Arquivo à
//   parte por causa do react-refresh (um arquivo de componentes não exporta
//   funções); o rolar tem o seu, o rollDialog.jsx.
//
// FUNÇÕES
//   openPanel(title, content, maxWidth): abre um painel num diálogo.
//   askHeal(props), askHurt(props), askHitDice(props): os painéis do card de HP
//     (`title` opcional: o summon usa os dois com o nome dele, DDL-0201).
//   askShortRest(props): o ShortRestPanel.
//   askUse(props), askCast(props): usar uma feature, lançar uma magia.
//   askSlotRecovery(props), askFontOfMagic(props): as recuperações especiais.
//   askModifier(props): o modificador manual (ModifierPanel).
//   askSkillCheck(props): a perícia do Check de um atributo (SkillCheckPanel).
//   askMove(props): quantos pés andar ou correr no turno (MovePanel).
//   askAction(props): como usar uma ação básica da aba Actions (ActionPanel).
//   askSlot(props): o que a ação, a bônus ou a reação paga (SlotPanel, DDL-0161).
//   askCost(props): com que gasto do turno lançar (CostPanel, DDL-0165).
//   askResource(props): tirar ou pôr à mão um recurso (ResourcePanel, DDL-0202).
// -----------------------------------------------------------------------------

import useDialogStore from '../../store/dialogStore';
import ResourcePanel from './ResourcePanel';
import { HealPanel, HurtPanel, HitDicePanel } from './HpPanels';
import ShortRestPanel from './ShortRestPanel';
import UsePanel from './UsePanel';
import CastPanel from './CastPanel';
import { SlotRecoveryPanel, FontOfMagicPanel } from './RecoveryPanels';
import ModifierPanel from './ModifierPanel';
import SkillCheckPanel from './SkillCheckPanel';
import MovePanel from './MovePanel';
import ActionPanel from './ActionPanel';
import SlotPanel from './SlotPanel';
import CostPanel from './CostPanel';
import { ABILITY_FULL } from '../builder/labels';

/** Abre um painel num diálogo; resolve com o que o painel fechar, ou null. */
function openPanel(title, content, maxWidth) {
  return useDialogStore.getState().open({
    variant: 'menu',
    title,
    message: content,
    dismissable: true,
    showClose: true,
    dismissValue: null,
    maxWidth,
  });
}

/**
 * O diálogo de cura: HP, temporário ou máximo.
 * @returns {Promise<{ kind: 'heal'|'temp'|'max', amount: number, replace: boolean }|null>}
 */
export function askHeal({ title = 'Heal', ...props }) {
  return openPanel(title, <HealPanel {...props} />, 420);
}

/**
 * O diálogo de dano sofrido.
 * @returns {Promise<{ amount: number, affectMax: boolean }|null>}
 */
export function askHurt({ title = 'Hurt', ...props }) {
  return openPanel(title, <HurtPanel {...props} />, 420);
}

/**
 * O diálogo dos dados de vida.
 * @returns {Promise<{ count: number }|null>}
 */
export function askHitDice(props) {
  return openPanel('Hit dice', <HitDicePanel {...props} />, 420);
}

/**
 * O diálogo do descanso curto.
 * @returns {Promise<{ spends: object[] }|null>}
 */
export function askShortRest(props) {
  return openPanel('Short rest', <ShortRestPanel {...props} />, 460);
}

/** O diálogo de usar uma feature; resolve com as opções do engine/playUse. */
export function askUse({ title, ...props }) {
  return openPanel(title, <UsePanel {...props} />, 440);
}

/** O diálogo de lançar uma magia; resolve com { way }. */
export function askCast(props) {
  return openPanel(props.spell.name, <CastPanel {...props} />, 440);
}

/** O diálogo do Arcane Recovery e do Natural Recovery; resolve com { picks }. */
export function askSlotRecovery({ title, ...props }) {
  return openPanel(title, <SlotRecoveryPanel {...props} />, 420);
}

/** O diálogo do Font of Magic; resolve com { mode, level }. */
export function askFontOfMagic(props) {
  return openPanel('Font of Magic', <FontOfMagicPanel {...props} />, 420);
}

/** O diálogo do modificador manual; resolve com o modificador pronto. */
export function askModifier(props) {
  return openPanel(props.initialLabel ? props.initialLabel : 'Custom effect', <ModifierPanel {...props} />, 440);
}

/** O painel de andar (ou correr, com `dash`); resolve com { feet }. */
export function askMove(props) {
  return openPanel(props.dash ? 'Dash' : 'Move', <MovePanel {...props} />, 400);
}

/** O seletor de perícia do Check; resolve com { test, name }. */
export function askSkillCheck(props) {
  return openPanel(`${ABILITY_FULL[props.ability] ?? props.ability} check`, <SkillCheckPanel {...props} />, 460);
}

/**
 * Como usar uma ação básica (o custo e o meio).
 * @returns {Promise<{ cost: object, kind: string }|null>}
 */
export function askAction(props) {
  return openPanel(props.item.name, <ActionPanel {...props} />, 460);
}

/** O que um gasto do turno paga; o título é o gasto. */
export function askSlot({ slotLabel, ...props }) {
  return openPanel(slotLabel, <SlotPanel slotLabel={slotLabel} {...props} />, 440);
}

/** Com que gasto do turno fazer algo; o título é o que se faz. */
export function askCost({ title, ...props }) {
  return openPanel(title, <CostPanel {...props} />, 440);
}

/**
 * Tirar ou pôr à mão um recurso; o título é o nome dele.
 * @returns {Promise<{ delta: number }|null>}
 */
export function askResource({ title, ...props }) {
  return openPanel(title, <ResourcePanel {...props} />, 420);
}
