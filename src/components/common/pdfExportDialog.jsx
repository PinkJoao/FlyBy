// =============================================================================
// pdfExportDialog: abre as opções da ficha PDF num diálogo
// =============================================================================
// O QUE FAZ
//   O atalho que a Home e o Builder chamam no "Export PDF": o painel de opções
//   (PdfExportPanel) dentro de um menu() do diálogo. Escolhidas as opções, mostra
//   um aviso de "gerando" enquanto a ficha é montada e o fecha no fim; uma falha
//   vira um alerta com o motivo. Arquivo à parte por causa do react-refresh (um
//   arquivo de componentes não exporta funções).
//
// FUNÇÕES
//   withBusy(run): roda a geração com o aviso aberto.
//   showPdfExport(onExport): abre o painel; onExport recebe as opções.
//
// DECISÕES E ARMADILHAS
//   - A geração ocupa a thread principal por alguns segundos numa ficha longa:
//     o aviso espera um quadro para pintar ANTES de o trabalho começar, senão
//     ele só apareceria no fim.
// -----------------------------------------------------------------------------

import { menu, alert } from './dialog';
import useDialogStore from '../../store/dialogStore';
import PdfExportPanel from './PdfExportPanel';

/** Roda a geração com o aviso de "gerando" aberto. */
async function withBusy(run) {
  const store = useDialogStore.getState();
  store.open({
    variant: 'alert',
    title: 'Creating your PDF',
    message: 'Laying out the pages. A long sheet takes a few seconds.',
    actions: [],
    dismissable: false,
    showClose: false,
  });
  const id = useDialogStore.getState().dialogs.at(-1)?.id;
  await new Promise((r) => setTimeout(r, 60));
  try {
    await run();
  } catch (e) {
    useDialogStore.getState().resolve(id);
    await alert({ title: 'The PDF could not be created', message: String(e?.message ?? e) });
    return;
  }
  useDialogStore.getState().resolve(id);
}

/** Abre o painel num diálogo; `onExport` recebe as opções escolhidas. */
export function showPdfExport(onExport) {
  return menu({
    title: 'Export PDF',
    maxWidth: 520,
    content: <PdfExportPanel onExport={(options) => withBusy(() => onExport(options))} />,
  });
}
