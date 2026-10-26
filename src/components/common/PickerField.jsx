// =============================================================================
// PickerField: o gatilho do seletor universal
// =============================================================================
// O QUE FAZ
//   Campo de valor único sobre o SelectorPanel: mostra o escolhido (nome e fonte
//   discreta), abre o painel ao clicar e tem um x para limpar. O botão de info
//   (padrão LIGADO) abre a descrição do já selecionado no DetailView; espécie,
//   classe e subclasse o desligam (a aba já mostra a descrição).
//
// FUNÇÕES
//   PickerField(props): o campo. `autoOpen` abre uma vez ao montar ("adicionar
//     multiclasse"), `onClose` avisa o cancelamento, `initialFilterState` vai para
//     o painel.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import SelectorPanel from '../../selector/SelectorPanel';
import DetailView from './DetailView';
import styles from './PickerField.module.css';
import { useBackLayer } from '../../hooks/useBack';
import CloseButton from './CloseButton';

/**
 * O gatilho de um seletor, com limpar e info.
 * @param {object} props
 * @param {object} props.entity
 * @param {object} props.db
 * @param {?{label:string, source?:string, id?:string}} props.current
 * @param {string} props.placeholder
 * @param {(raw:object)=>void} props.onSelect
 * @param {()=>void} props.onClear
 * @param {(raw:object)=>boolean} [props.exclude]
 * @param {boolean} [props.showInfo=true]
 * @param {boolean} [props.autoOpen]
 * @param {()=>void} [props.onClose]
 * @param {object} [props.initialFilterState]
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
  useBackLayer(info, () => setInfo(false));

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
        <div className={`${styles.infoOverlay} motion-page`} onClick={() => setInfo(false)}>
          <div className={`${styles.infoPanel} motion-pop`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.infoHead}>
              <CloseButton onClick={() => setInfo(false)} />
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
