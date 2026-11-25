// =============================================================================
// PartsRow: de que um número é feito, em caixas
// =============================================================================
// O QUE FAZ
//   As parcelas lado a lado e o resultado em destaque ("8 Base, +4 Proficiency, +4
//   Intelligence, 16 Save DC"), nas janelas da faixa do inventário e do grimório.
//
// FUNÇÕES
//   PartsRow({ parts, result }): `parts` são `{ key, value, label, title }`.
// -----------------------------------------------------------------------------

import styles from './StripWindows.module.css';

/** As parcelas de um número e o resultado. */
export default function PartsRow({ parts, result }) {
  return (
    <div className={styles.parts}>
      {parts.map((p) => (
        <span key={p.key} className={styles.part} title={p.title}>
          <b className={styles.partValue}>{p.value}</b>
          <span className={styles.partLabel}>{p.label}</span>
        </span>
      ))}
      <span className={`${styles.part} ${styles.partResult}`}>
        <b className={styles.partValue}>{result.value}</b>
        <span className={styles.partLabel}>{result.label}</span>
      </span>
    </div>
  );
}
