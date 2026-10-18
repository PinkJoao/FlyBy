// =============================================================================
// ClearableSelect: o select nativo com um botão para limpar
// =============================================================================
// O QUE FAZ
//   Mostra o x só quando há valor; clicar zera (onChange('')). É o padrão de
//   "limpar campo" de todos os dropdowns do builder.
//
// FUNÇÕES
//   ClearableSelect(props): o campo.
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
