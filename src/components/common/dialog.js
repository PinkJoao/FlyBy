// =============================================================================
// dialog: a API imperativa dos diálogos in-app (alert, confirm, ask)
// =============================================================================
// O QUE FAZ
//   Troca direta dos window.confirm, alert e prompt, renderizada dentro do app e
//   devolvendo Promise (DDL-0007). Uso:
//     import { confirm, alert, ask } from '../common/dialog';
//     if (!(await confirm('Remove este item?'))) return;
//     await alert({ title: 'Falhou', message: 'Não deu certo.' });
//     const { action, values } = await ask({
//       title: 'Escolha o dano',
//       fields: [{ type: 'select', name: 'dmg', label: 'Tipo',
//                  options: [{ label: 'Fogo', value: 'fire' }] }],
//       actions: [{ label: 'Cancelar', value: false },
//                 { label: 'Confirmar', value: true, tone: 'primary' }],
//     });
//   A config: title, message (string com quebras ou ReactNode), actions, fields,
//   dismissable, showClose, dismissValue e as props de ESTILO (accent, bg, border,
//   radius, maxWidth, titleColor, textColor, fontFamily, style).
//
// FUNÇÕES
//   open(config), norm(o): abrir (uma string é atalho para { message }).
//   alert(opts): aviso com OK.
//   confirm(opts): Cancelar ou Confirmar (confirmLabel, cancelLabel, danger).
//   ask(opts): opções e campos; resolve { action, values }.
//   menu({ content, ...opts }): um submenu numa janelinha (o corpo é um
//     MenuList), com X e sem ações; o conteúdo se fecha por useDialogClose.
//
// DECISÕES E ARMADILHAS
//   - O componente se chama DialogHost.jsx, não Dialog.jsx, DE PROPÓSITO: num
//     filesystem que ignora caixa, Dialog.jsx e dialog.js colidiriam, e um import
//     sem extensão pegaria o arquivo errado ("Element type is invalid").
// -----------------------------------------------------------------------------

import useDialogStore from '../../store/dialogStore';

const open = (config) => useDialogStore.getState().open(config);

const norm = (o) => (typeof o === 'string' ? { message: o } : o || {});

/**
 * Aviso simples, fechável por X, clique fora ou Esc.
 * @returns {Promise<void>}
 */
export function alert(opts) {
  return open({
    variant: 'alert',
    dismissable: true,
    showClose: true,
    dismissValue: undefined,
    actions: [{ label: 'OK', value: true, tone: 'primary', autoFocus: true }],
    ...norm(opts),
  }).then(() => undefined);
}

/**
 * Confirmação; fechar por fora cancela (false).
 * @returns {Promise<boolean>}
 */
export function confirm(opts) {
  const {
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    actions,
    ...rest
  } = norm(opts);
  return open({
    variant: 'confirm',
    dismissable: true,
    showClose: false,
    dismissValue: false,
    actions: actions ?? [
      { label: cancelLabel, value: false },
      { label: confirmLabel, value: true, tone: danger ? 'danger' : 'primary', autoFocus: true },
    ],
    ...rest,
  }).then(Boolean);
}

/**
 * Pergunta com opções e campos; resolve { action, values }.
 * @returns {Promise<{action:any, values:object}|any>}
 */
export function ask(opts) {
  return open({
    variant: 'question',
    dismissable: true,
    dismissValue: null,
    ...norm(opts),
  });
}

/**
 * Submenu numa janelinha: `content` é o corpo (em geral um MenuList), com X.
 * @returns {Promise<void>}
 */
export function menu({ content, ...opts }) {
  return open({
    variant: 'menu',
    dismissable: true,
    showClose: true,
    dismissValue: undefined,
    message: content,
    ...opts,
  }).then(() => undefined);
}

const dialog = { alert, confirm, ask, menu };
export default dialog;
