// =============================================================================
// SourceTag: a abreviação de fonte, com o nome completo no hover e no clique
// =============================================================================
// O QUE FAZ
//   Mostra a abreviação como o dado a escreve, com o nome por extenso no title e
//   um clique que abre o popup da fonte (DDL-0065). Onde a fonte aparece como texto
//   (fora de um botão de seleção), este é o átomo que a torna consultável.
//
// FUNÇÕES
//   SourceTag(props): a tag.
// -----------------------------------------------------------------------------

import { sourceName } from '../../engine/sourceNames';
import { showSourcePopup } from './sourcePopup';
import styles from './SourceTag.module.css';

/**
 * A abreviação de fonte, consultável.
 * @param {object} props
 * @param {string} props.source
 * @param {string} [props.className]
 */
export default function SourceTag({ source, className }) {
  if (!source) return null;
  const full = sourceName(source);
  return (
    <button
      type="button"
      className={className ? `${styles.tag} ${className}` : styles.tag}
      title={full}
      onClick={(e) => {
        e.stopPropagation();
        showSourcePopup(source);
      }}
    >
      {source}
    </button>
  );
}
