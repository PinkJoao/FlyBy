// Única tela de erro fatal: sem rede E sem cache na primeira vez.
import styles from './UpdatingScreen.module.css';

export default function ErrorScreen({ onRetry }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>No data yet</h1>
        <p className={styles.subtitle}>
          Couldn't download the compendiums and there's nothing saved in your
          browser yet. Connect to the internet and try again - after the first
          load, the app works offline.
        </p>
        <button type="button" className={styles.retry} onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  );
}
