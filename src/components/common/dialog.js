// =============================================================================
// dialog - API imperativa dos diálogos in-app (alert / confirm / ask)
// =============================================================================
// Troca direta pelos window.confirm/alert/prompt do navegador, mas renderizado
// dentro do app e retornando Promise. Uso:
//
//   import { confirm, alert, ask } from '../common/dialog';
//   if (!(await confirm('Remove este item?'))) return;      // texto simples
//   await alert({ title: 'Falhou', message: 'Não deu certo.' });
//   const { action, values } = await ask({                  // pergunta rica
//     title: 'Escolha o dano',
//     fields: [{ type: 'select', name: 'dmg', label: 'Tipo',
//                options: [{ label: 'Fogo', value: 'fire' }, ...] }],
//     actions: [{ label: 'Cancelar', value: false },
//               { label: 'Confirmar', value: true, tone: 'primary' }],
//   });
//
// NB: o componente de UI vive em `DialogHost.jsx` (não `Dialog.jsx`) de
// propósito - num filesystem case-insensitive (Windows/macOS) `Dialog.jsx` e
// este `dialog.js` colidiriam, e um import sem extensão resolveria pro arquivo
// errado (o default daqui é um OBJETO, não um componente → "Element type is
// invalid"). Nomes distintos (DialogHost vs dialog) evitam a ambiguidade.
//
// Config aceita (ver DialogHost p/ o render): title, message (string com \n ou
// ReactNode), actions[{label,value,tone,autoFocus}], fields[{type,name,label,
// options,default}], dismissable, showClose, dismissValue, e props de ESTILO
// (accent, bg, border, radius, maxWidth, titleColor, textColor, fontFamily,
// style) - cada uma vira uma CSS custom property no card.
// -----------------------------------------------------------------------------

import useDialogStore from '../../store/dialogStore';

const open = (config) => useDialogStore.getState().open(config);

// Aceita string curta como atalho para { message }.
const norm = (o) => (typeof o === 'string' ? { message: o } : o || {});

/**
 * Aviso simples (uma mensagem + OK). Fechável por X / clique fora / Esc.
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
 * Confirmação (Cancelar / Confirmar). Clique fora, Esc ou X cancelam (false).
 * Conveniências: confirmLabel, cancelLabel, danger (pinta a ação principal de
 * vermelho). Para leiautes fora do padrão, passe `actions` direto.
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
 * Pergunta geral com opções e/ou campos (select/texto). Resolve com
 * `{ action, values }` (ou só `dismissValue` se fechada por fora).
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

const dialog = { alert, confirm, ask };
export default dialog;
