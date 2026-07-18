// =============================================================================
// RoleplayField - um campo de roleplay como LISTA de entradas (+ randomizador)
// =============================================================================
// Compartilhado entre o wizard (PersonalityStoryStep) e o builder (BiographyTab).
// Cada traço/ideal/laço/defeito vira uma entrada própria: o jogador adiciona
// quantas quiser, randomiza cada uma (rola nas "Suggested Characteristics" de
// todos os backgrounds), edita e exclui separadamente. Armazenamento continua
// sendo a MESMA string de `identity[campo]` - as entradas são as linhas (`\n`),
// então nada muda no export/import do Foundry (mapeia 1:1 em `details`).
// -----------------------------------------------------------------------------

import { useLayoutEffect, useRef } from 'react';
import styles from './RoleplayField.module.css';

/** Textarea que cresce/encolhe para caber o texto (altura = conteúdo). Mede em
 * useLayoutEffect (antes da pintura, sem flash) a cada mudança de valor e em
 * resize da janela (a largura muda → o texto re-quebra). */
function AutoTextarea({ value, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      el.style.height = 'auto';
      // border-box: scrollHeight exclui a borda; soma-a p/ não sobrar 2px.
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
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.value          a string salva (entradas separadas por \n)
 * @param {string} props.placeholder
 * @param {() => (string|null)} props.onRandom  sorteia uma sugestão (ou null)
 * @param {(next: string) => void} props.onChange
 */
export default function RoleplayField({ label, value, placeholder, onRandom, onChange }) {
  // String → entradas. Sempre ao menos uma linha (para ter onde digitar/rolar).
  const entries = (value ?? '').split('\n');
  const commit = (arr) => onChange(arr.join('\n'));

  const setAt = (i, text) => commit(entries.map((e, j) => (j === i ? text : e)));
  const removeAt = (i) => {
    const next = entries.filter((_, j) => j !== i);
    commit(next.length ? next : ['']); // nunca zero linhas
  };
  // Adiciona uma entrada vazia logo ABAIXO da linha tocada.
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
            {/* Dado DENTRO da caixa (canto inferior direito). */}
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
          {/* À direita: excluir esta entrada · adicionar outra. */}
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
