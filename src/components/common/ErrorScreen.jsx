// =============================================================================
// ErrorScreen: a única tela de erro fatal: a fonte não respondeu e não há cache
// =============================================================================
// O QUE FAZ
//   Aparece quando o compêndio não pôde ser baixado e não há nada salvo. Sem
//   rede, o caminho é tentar de novo; com a fonte do USUÁRIO errada ou fora do
//   ar (DDL-0091), a saída é voltar ao SRD embutido, que não depende de rede.
//
// FUNÇÕES
//   ErrorScreen({ onRetry, source, onUseSrd }): a tela.
// -----------------------------------------------------------------------------

import styles from './UpdatingScreen.module.css';
import { describeSource } from '../../data/dataSource';

export default function ErrorScreen({ onRetry, source, onUseSrd }) {
  const fromUrl = source?.kind === 'url';
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>No data yet</h1>
        <p className={styles.subtitle}>
          {fromUrl
            ? `Couldn't download the game data from ${describeSource(source)}, and there's no saved copy from this source yet. Check your connection or the address, or explore with the built-in SRD 5.2 content.`
            : "Couldn't load the game data. Try again."}
        </p>
        <button type="button" className={styles.retry} onClick={onRetry}>
          Try again
        </button>
        {fromUrl && onUseSrd ? (
          <button type="button" className={styles.retry} onClick={onUseSrd}>
            Use the built-in SRD 5.2
          </button>
        ) : null}
      </div>
    </div>
  );
}
