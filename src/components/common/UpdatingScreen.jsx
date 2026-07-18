// Tela exibida enquanto o compêndio é baixado (primeira vez ou cache expirado).
import styles from './UpdatingScreen.module.css';

export default function UpdatingScreen({ progress }) {
  const { done = 0, total = 0 } = progress ?? {};
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.spinner} aria-hidden="true" />
        <h1 className={styles.title}>Updating Compendiums…</h1>
        <p className={styles.subtitle}>
          Downloading the latest community data. This only happens once in a
          while - afterwards the app opens instantly and offline.
        </p>

        <div
          className={styles.bar}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className={styles.fill} style={{ width: `${pct}%` }} />
        </div>
        <p className={styles.count}>
          {total > 0 ? `${done} / ${total} files` : 'Connecting…'}
        </p>
      </div>
    </div>
  );
}
