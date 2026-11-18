// =============================================================================
// featureText: o diálogo com o texto de uma feature do jogo
// =============================================================================
// O QUE FAZ
//   Abre a descrição de uma feature (o texto do dado) num diálogo; a aba Features e o histórico usam o
//   mesmo (DDL-0243: ler no card do histórico o que a feature faz).
//
// FUNÇÕES
//   showFeatureText(feature, onLog): o diálogo; com `onLog`, o botão "Log to history".
// -----------------------------------------------------------------------------
import useDialogStore from '../../store/dialogStore';
import EntryContent from '../common/EntryContent';

/** O diálogo com o texto da feature; com `onLog`, o "Log to history". */
export function showFeatureText(feature, onLog = null) {
  return useDialogStore.getState().open({
    variant: 'alert',
    title: feature.name,
    message: (
      <div style={{ whiteSpace: 'normal', textAlign: 'left' }}>
        {feature.entries?.length ? <EntryContent entries={feature.entries} /> : <p>No description.</p>}
      </div>
    ),
    dismissable: true,
    showClose: true,
    actions: onLog ? [{ label: 'Log to history', value: 'log', tone: 'primary' }] : [],
    maxWidth: 560,
  }).then((v) => {
    if (v === 'log') onLog(feature);
  });
}
