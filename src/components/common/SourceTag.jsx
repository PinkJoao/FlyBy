// =============================================================================
// SourceTag - a abreviação de fonte, com nome completo no hover e no clique
// =============================================================================
// Mostra a abreviação ("PSK") como o dado a escreve, mas com o nome por extenso
// no `title` (tooltip nativo, no hover) e um clique que abre o popup da fonte
// (showSourcePopup). É o átomo reutilizável do "início da exibição das fontes":
// onde a fonte aparece como TEXTO (não dentro de um botão de seleção), este
// componente a torna consultável.
// -----------------------------------------------------------------------------

import { sourceName } from '../../engine/sourceNames';
import { showSourcePopup } from './sourcePopup';
import styles from './SourceTag.module.css';

/**
 * @param {object} props
 * @param {string} props.source     abreviação ("XPHB")
 * @param {string} [props.className] classe extra opcional
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
