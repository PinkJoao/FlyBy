// =============================================================================
// playDialogs: abre os painéis de diálogo do play mode (HP, descanso, uso, magia)
// =============================================================================
// O QUE FAZ
//   Os atalhos que a tela do play mode chama: o HpPanel (dano, cura,
//   temporário), o ShortRestPanel (dados de vida), o UsePanel (usar uma
//   feature), o CastPanel (lançar uma magia) e os RecoveryPanels (recuperar
//   slots, Font of Magic), cada um dentro de um diálogo do app.
//   Cada um resolve com o que o painel devolveu, ou null se cancelado. Arquivo à
//   parte por causa do react-refresh (um arquivo de componentes não exporta
//   funções); o rolar tem o seu, o rollDialog.jsx.
//
// FUNÇÕES
//   openPanel(title, content, maxWidth): abre um painel num diálogo.
//   askHp(props): o HpPanel.
//   askShortRest(props): o ShortRestPanel.
//   askUse(props), askCast(props): usar uma feature, lançar uma magia.
//   askSlotRecovery(props), askFontOfMagic(props): as recuperações especiais.
//   askModifier(props): o modificador manual (ModifierPanel).
//   askCurrency(props): gastar ou ganhar moedas (CurrencyPanel).
// -----------------------------------------------------------------------------

import useDialogStore from '../../store/dialogStore';
import HpPanel from './HpPanel';
import ShortRestPanel from './ShortRestPanel';
import UsePanel from './UsePanel';
import CastPanel from './CastPanel';
import { SlotRecoveryPanel, FontOfMagicPanel } from './RecoveryPanels';
import ModifierPanel from './ModifierPanel';
import CurrencyPanel from './CurrencyPanel';

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
 * O diálogo de dano, cura e HP temporário.
 * @returns {Promise<{ action: 'damage'|'heal'|'temp', amount: number, type: string, critical: boolean, replace: boolean }|null>}
 */
export function askHp(props) {
  return openPanel('Hit points', <HpPanel {...props} />, 420);
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
  return openPanel('Add an effect', <ModifierPanel {...props} />, 440);
}

/** O diálogo do dinheiro; resolve com { delta, label }. */
export function askCurrency(props) {
  return openPanel('Money', <CurrencyPanel {...props} />, 420);
}
