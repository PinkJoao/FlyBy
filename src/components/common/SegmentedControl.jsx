// =============================================================================
// SegmentedControl: interruptor segmentado com realce deslizante
// =============================================================================
// O QUE FAZ
//   Controle segmentado padrão do app (usado em ModeSwitch, PdfExportPanel,
//   PortraitSuggestionsModal, RollPanel e nos painéis do play mode). Renderiza
//   uma trilha (.seg) com os botões de opção e uma peça única de realce (.thumb)
//   que desliza (e ajusta a largura quando os botões têm tamanhos distintos) de
//   uma opção para outra.
//
// FUNÇÕES
//   normalizeOption(opt): converte tupla [value, label, disabled] ou objeto
//     { value, label, disabled } para formato único.
//   SegmentedControl(props): o componente do interruptor segmentado.
//
// DECISÕES E ARMADILHAS
//   - Quando `equal` ou `block` está ativo, a trilha usa CSS Grid de colunas
//     iguais e o `.thumb` calcula largura e deslocamento só por CSS (`--seg-count`
//     e `--seg-index`), nascendo no lugar sem depender de medição.
//   - No modo de largura variável (padrão `inline-flex`, como nas opções do PDF),
//     `useLayoutEffect` e `ResizeObserver` medem `offsetLeft` e `offsetWidth` do
//     botão ativo e gravam `--thumb-x` e `--thumb-w` direto no DOM (sem setState
//     em efeito), habilitando a transição (`data-ready="true"`) após o primeiro
//     quadro para que o realce já nasça posicionado ao abrir o diálogo e deslize
//     nas trocas seguintes.
//   - Quando nenhuma opção está ativa (`activeIndex === -1`, como nos filtros
//     opcionais de gênero e idade), o `.thumb` fica com `opacity: 0` e acende ao
//     selecionar.
// -----------------------------------------------------------------------------

import { useLayoutEffect, useRef } from 'react';
import styles from './SegmentedControl.module.css';

/**
 * Converte uma opção em tupla `[value, label, disabled]` ou objeto para `{ value, label, disabled }`.
 * @param {Array|object} opt
 * @returns {{ value: any, label: any, disabled: boolean }}
 */
function normalizeOption(opt) {
  if (Array.isArray(opt)) {
    return { value: opt[0], label: opt[1], disabled: Boolean(opt[2]) };
  }
  return {
    value: opt.value,
    label: opt.label,
    disabled: Boolean(opt.disabled),
  };
}

/**
 * Interruptor segmentado unificado com cursor deslizante.
 * @param {{
 *   value: any,
 *   options: Array<[any, any, boolean?] | { value: any, label: any, disabled?: boolean }>,
 *   onChange: (value: any) => void,
 *   size?: 'sm' | 'md' | 'lg',
 *   equal?: boolean,
 *   block?: boolean,
 *   role?: 'group' | 'radiogroup',
 *   ariaLabel?: string,
 *   className?: string,
 * }} props
 */
export default function SegmentedControl({
  value,
  options,
  onChange,
  size = 'md',
  equal = false,
  block = false,
  role = 'group',
  ariaLabel,
  className,
}) {
  const trackRef = useRef(null);
  const norm = options.map(normalizeOption);
  const activeIndex = norm.findIndex((o) => o.value === value);
  const hasActive = activeIndex >= 0;
  const isGrid = equal || block;

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el || isGrid) return undefined;

    const syncThumb = () => {
      const activeBtn = el.querySelector('[data-seg-active="true"]');
      if (activeBtn) {
        el.style.setProperty('--thumb-x', `${activeBtn.offsetLeft - 2}px`);
        el.style.setProperty('--thumb-w', `${activeBtn.offsetWidth}px`);
      }
    };

    syncThumb();

    let rafId = null;
    if (el.dataset.ready !== 'true') {
      rafId = requestAnimationFrame(() => {
        el.dataset.ready = 'true';
      });
    }

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(syncThumb);
      ro.observe(el);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
    };
  }, [isGrid, activeIndex, norm.length]);

  const sizeClass =
    size === 'sm' ? styles.sm : size === 'lg' ? styles.lg : styles.md;
  const layoutClass = block
    ? styles.block
    : equal
      ? styles.equal
      : styles.auto;

  const rootClass = [styles.seg, sizeClass, layoutClass, className]
    .filter(Boolean)
    .join(' ');

  const isRadio = role === 'radiogroup';

  return (
    <div
      ref={trackRef}
      className={rootClass}
      role={role}
      aria-label={ariaLabel}
      data-active={hasActive ? 'true' : 'false'}
      data-ready={isGrid ? 'true' : undefined}
      style={{
        '--seg-count': norm.length,
        '--seg-index': Math.max(0, activeIndex),
      }}
    >
      <span className={styles.thumb} aria-hidden="true" />
      {norm.map((opt) => {
        const isOn = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role={isRadio ? 'radio' : undefined}
            aria-checked={isRadio ? isOn : undefined}
            aria-pressed={!isRadio ? isOn : undefined}
            data-seg-active={isOn ? 'true' : undefined}
            className={isOn ? styles.on : undefined}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
