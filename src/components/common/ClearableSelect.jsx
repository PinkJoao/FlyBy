// =============================================================================
// ClearableSelect - <select> nativo com um botão × para limpar o campo
// =============================================================================
// Wrapper fino: mostra o × só quando há valor; clicar zera (onChange('')).
// Padrão de "limpar campo" usado em todos os dropdowns do builder.
// -----------------------------------------------------------------------------

import styles from './ClearableSelect.module.css';

export default function ClearableSelect({ value, onChange, children, placeholder = 'Choose…' }) {
  return (
    <div className={styles.wrap}>
      <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {children}
      </select>
      {value && (
        <button type="button" className={styles.clearX} onClick={() => onChange('')} aria-label="Clear">
          ×
        </button>
      )}
    </div>
  );
}
