// =============================================================================
// featureText: o diálogo com o texto de uma feature do jogo
// =============================================================================
// O QUE FAZ
//   Abre a descrição de uma feature (o texto do dado) num diálogo; a aba Features e o histórico usam o
//   mesmo (DDL-0243: ler no card do histórico o que a feature faz). Na moldura única dos previews
//   (variant 'preview', DDL-0295): de onde vem a feature (a classe, a subclasse) no kicker.
//
// FUNÇÕES
//   showFeatureText(feature, onLog, actions): o diálogo; com `onLog`, o botão "Log to history"; com `actions`
//     ({ label, value, tone, run }), os botões de uso da linha da aba (Use, Summon, Bond...; DDL-0251), cada um
//     roda o seu `run` ao fechar.
// -----------------------------------------------------------------------------
import useDialogStore from '../../store/dialogStore';
import EntryContent from '../common/EntryContent';

/** O diálogo com o texto da feature; com `onLog`, o "Log to history"; com `actions`, os botões de uso. */
export function showFeatureText(feature, onLog = null, actions = []) {
  return useDialogStore.getState().open({
    variant: 'preview',
    kicker: feature.section ?? 'Feature',
    source: feature.source,
    title: feature.name,
    message: feature.entries?.length ? <EntryContent entries={feature.entries} /> : <p>No description.</p>,
    dismissable: true,
    showClose: true,
    actions: [
      ...(onLog ? [{ label: 'Log to history', value: 'log', tone: actions.length ? undefined : 'primary' }] : []),
      ...actions.map((a, i) => ({ label: a.label, value: `act:${i}`, tone: a.tone ?? (i === actions.length - 1 ? 'primary' : undefined) })),
    ],
    maxWidth: 560,
  }).then((v) => {
    if (v === 'log') onLog(feature);
    else if (typeof v === 'string' && v.startsWith('act:')) actions[Number(v.slice(4))]?.run?.();
  });
}
