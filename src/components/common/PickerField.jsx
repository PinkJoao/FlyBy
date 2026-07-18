// =============================================================================
// PickerField - gatilho do seletor universal (SelectorPanel) com clear-x e info
// =============================================================================
// Campo de valor único respaldado pelo SelectorPanel: mostra o valor escolhido
// (nome + fonte discreta), abre o painel ao clicar e tem um × para limpar.
// Com `showInfo` (padrão LIGADO), um botão ⓘ abre a descrição do item já
// selecionado (DetailView em overlay) - útil p/ reler um talento, arma etc.
// Espécie/classe/subclasse desligam (a descrição já aparece na própria aba).
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import SelectorPanel from '../../selector/SelectorPanel';
import DetailView from './DetailView';
import styles from './PickerField.module.css';

/**
 * @param {object}   props
 * @param {object}   props.entity        config de entidade (selector/entities/*)
 * @param {object}   props.db            compêndio
 * @param {?{label:string, source?:string, id?:string}} props.current  seleção atual
 * @param {string}   props.placeholder
 * @param {(raw:object)=>void} props.onSelect
 * @param {()=>void} props.onClear
 * @param {(raw:object)=>boolean} [props.exclude]
 * @param {boolean}  [props.showInfo=true]  botão ⓘ com a descrição do selecionado
 * @param {boolean}  [props.autoOpen]    abre o painel ao montar (1×), se vazio
 * @param {()=>void} [props.onClose]     chamado ao FECHAR sem selecionar (cancelar)
 * @param {object}   [props.initialFilterState]  filtros pré-aplicados ao abrir o
 *   painel (repassado ao SelectorPanel - ex: pré-marcar "Prerequisites: Met").
 */
export default function PickerField({
  entity,
  db,
  current,
  placeholder,
  onSelect,
  onClear,
  exclude,
  showInfo = true,
  autoOpen = false,
  onClose,
  initialFilterState,
}) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState(false);

  // autoOpen: abre uma vez ao montar (usado p/ "adicionar multiclasse" → seletor).
  const didAuto = useRef(false);
  useEffect(() => {
    if (autoOpen && !current && !didAuto.current) {
      didAuto.current = true;
      setOpen(true);
    }
  }, [autoOpen, current]);

  const cancel = () => {
    setOpen(false);
    onClose?.();
  };

  // Resolve o objeto cru do item selecionado (só quando o info abre).
  const currentRaw =
    info && current?.id ? (entity.list(db) ?? []).find((r) => entity.idOf(r) === current.id) : null;

  return (
    <>
      <div className={styles.field}>
        <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
          {current ? (
            <>
              <span className={styles.name}>{current.label}</span>
              {current.source && <span className={styles.source}>{current.source}</span>}
            </>
          ) : (
            <span className={styles.ph}>{placeholder}</span>
          )}
        </button>
        {current && showInfo && (
          <button type="button" className={styles.infoBtn} onClick={() => setInfo(true)} aria-label={`About ${current.label}`}>
            i
          </button>
        )}
        {current && (
          <button type="button" className={styles.clearX} onClick={onClear} aria-label="Clear">
            ×
          </button>
        )}
      </div>

      {open && (
        <SelectorPanel
          entity={entity}
          db={db}
          currentId={current?.id ?? null}
          exclude={exclude}
          initialFilterState={initialFilterState}
          onSelect={(raw) => {
            onSelect(raw);
            setOpen(false);
          }}
          onClose={cancel}
        />
      )}

      {info && (
        <div className={styles.infoOverlay} onClick={() => setInfo(false)}>
          <div className={styles.infoPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.infoHead}>
              <button type="button" className={styles.infoClose} onClick={() => setInfo(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className={styles.infoScroll}>
              {currentRaw ? (
                <DetailView entity={entity} raw={currentRaw} db={db} />
              ) : (
                <p className={styles.infoMuted}>No description available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
