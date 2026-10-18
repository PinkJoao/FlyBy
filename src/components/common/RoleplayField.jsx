// =============================================================================
// RoleplayField: um campo de roleplay como lista de entradas, com randomizador
// =============================================================================
// O QUE FAZ
//   Compartilhado pelo wizard (PersonalityStoryStep) e pelo builder (BiographyTab).
//   Cada traço, ideal, laço ou defeito é uma entrada própria: adicionar, rolar nas
//   "Suggested Characteristics", editar e excluir. Continua salvo como a MESMA
//   string de `identity[campo]`, uma entrada por linha, então nada muda no export
//   (mapeia 1:1 em `details`).
//
// FUNÇÕES
//   AutoTextarea(props): textarea que acompanha a altura do texto (mede em
//     useLayoutEffect, sem flash, e no resize).
//   RoleplayField(props): o campo; sempre ao menos uma linha, e a nova entra logo
//     abaixo da tocada.
// -----------------------------------------------------------------------------

import { useLayoutEffect, useRef } from 'react';
import styles from './RoleplayField.module.css';

/** Textarea que cresce e encolhe com o texto. */
function AutoTextarea({ value, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      el.style.height = 'auto';
      const border = el.offsetHeight - el.clientHeight;
      el.style.height = `${el.scrollHeight + border}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [value]);
  return <textarea ref={ref} value={value} {...props} />;
}

/**
 * Um campo de roleplay como lista de entradas.
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.value
 * @param {string} props.placeholder
 * @param {() => (string|null)} props.onRandom
 * @param {(next: string) => void} props.onChange
 */
export default function RoleplayField({ label, value, placeholder, onRandom, onChange }) {
  const entries = (value ?? '').split('\n');
  const commit = (arr) => onChange(arr.join('\n'));

  const setAt = (i, text) => commit(entries.map((e, j) => (j === i ? text : e)));
  const removeAt = (i) => {
    const next = entries.filter((_, j) => j !== i);
    commit(next.length ? next : ['']);
  };
  const addAfter = (i) => commit([...entries.slice(0, i + 1), '', ...entries.slice(i + 1)]);
  const rerollAt = (i) => {
    const s = onRandom?.();
    if (s) setAt(i, s);
  };

  return (
    <div className={styles.rpField}>
      <span className={styles.fieldLabel}>{label}</span>
      {entries.map((text, i) => (
        <div className={styles.rpRow} key={i}>
          <div className={styles.rpInputWrap}>
            <AutoTextarea
              className={styles.rpInput}
              rows={1}
              value={text}
              placeholder={placeholder}
              onChange={(e) => setAt(i, e.target.value)}
            />
            <button
              type="button"
              className={styles.rpDie}
              onClick={() => rerollAt(i)}
              title="Roll a random suggestion"
              aria-label="Roll a random suggestion"
            >
              🎲
            </button>
          </div>
          <div className={styles.rpRowBtns}>
            <button type="button" className={styles.rpIconBtn} onClick={() => removeAt(i)} title="Remove" aria-label="Remove">
              ✕
            </button>
            <button
              type="button"
              className={`${styles.rpIconBtn} ${styles.rpAddBtn}`}
              onClick={() => addAfter(i)}
              title="Add another"
              aria-label="Add another"
            >
              +
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
