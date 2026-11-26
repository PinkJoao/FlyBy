// =============================================================================
// PickerField: o gatilho do seletor universal
// =============================================================================
// O QUE FAZ
//   Campo de valor único sobre o SelectorPanel: mostra o escolhido (nome e fonte
//   discreta), abre o painel ao clicar e tem um x para limpar. O botão de info
//   (padrão LIGADO) abre a descrição do já selecionado no DetailView, na moldura comum
//   de preview (PreviewLayer, DDL-0296); espécie,
//   classe e subclasse o desligam (a aba já mostra a descrição).
//
// FUNÇÕES
//   PickerField(props): o campo. `autoOpen` abre uma vez ao montar ("adicionar
//     multiclasse"), `onClose` avisa o cancelamento, `initialFilterState` vai para
//     o painel. `locked` (o talento que um background pronto dá, DDL-0328) mostra o
//     escolhido sem abrir nem limpar, com o `lockedNote` no lugar da fonte; o info fica.
// -----------------------------------------------------------------------------

import Button from './Button';
import { useEffect, useRef, useState } from 'react';
import SelectorPanel from '../../selector/SelectorPanel';
import DetailView from './DetailView';
import styles from './PickerField.module.css';
import PreviewLayer from './PreviewLayer';
import Icon from './Icon';

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
 * @param {boolean} [props.locked]
 * @param {string} [props.lockedNote]
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
  locked = false,
  lockedNote,
}) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState(false);

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
        <button
          type="button"
          className={locked ? `${styles.trigger} ${styles.locked}` : styles.trigger}
          onClick={locked ? undefined : () => setOpen(true)}
          aria-disabled={locked || undefined}
        >
          {current ? (
            <>
              <span className={styles.name}>{current.label}</span>
              {locked && lockedNote ? (
                <span className={styles.source}>{lockedNote}</span>
              ) : (
                current.source && <span className={styles.source}>{current.source}</span>
              )}
            </>
          ) : (
            <span className={styles.ph}>{placeholder}</span>
          )}
        </button>
        {current && showInfo && (
          <Button icon className={styles.infoBtn} onClick={() => setInfo(true)} aria-label={`About ${current.label}`}>
            <Icon name="info" />
          </Button>
        )}
        {current && !locked && (
          <Button icon className={styles.clearX} onClick={onClear} aria-label="Clear" title="Clear">
            <Icon name="close" />
          </Button>
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
        <PreviewLayer
          onClose={() => setInfo(false)}
          source={currentRaw?.source ?? current?.source}
          title={currentRaw?.name ?? current?.label}
        >
          {currentRaw ? (
            <DetailView entity={entity} raw={currentRaw} db={db} hideHeader />
          ) : (
            <p className={styles.infoMuted}>No description available.</p>
          )}
        </PreviewLayer>
      )}
    </>
  );
}
