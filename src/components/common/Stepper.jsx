// =============================================================================
// Stepper - contador reutilizável: [− valor +] num único controle
// =============================================================================
// Substitui todos os pares de botões de step do app por UM componente coerente
// (baseado no mock: pílula com − e + em accent e o número no meio). Versátil por
// props: valor/step/min/max, casas decimais, dígitos máximos, número editável ou
// só leitura, e ESTILO totalmente controlável (fundo, borda, raio, padding, cores
// individuais de −/+/número, tamanho/peso da fonte, largura/altura). Os estilos
// viram CSS custom properties que o .module.css consome, então cada instância
// pode ser tematizada sem CSS novo.
//
// Comportamento do MIN: se `onMinReached` for dado, apertar − no mínimo dispara
// esse callback (ex: remover o item do inventário) em vez de travar; sem ele, o
// − fica desabilitado no mínimo. `max` desabilita o + no topo.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import styles from './Stepper.module.css';

// Props de estilo → CSS custom properties. `px: true` converte number → "Npx".
const STYLE_VARS = {
  bg: { var: '--stp-bg' },
  border: { var: '--stp-border' },
  radius: { var: '--stp-radius', px: true },
  padding: { var: '--stp-padding', px: true },
  gap: { var: '--stp-gap', px: true },
  numberColor: { var: '--stp-num-color' },
  plusColor: { var: '--stp-plus-color' },
  minusColor: { var: '--stp-minus-color' },
  fontSize: { var: '--stp-font-size', px: true },
  fontWeight: { var: '--stp-font-weight' },
  maxWidth: { var: '--stp-max-width', px: true },
  height: { var: '--stp-height', px: true },
  buttonSize: { var: '--stp-btn-size', px: true },
  numberWidth: { var: '--stp-num-width', px: true },
};

function buildStyle(props, extra) {
  const out = { ...extra };
  for (const [key, cfg] of Object.entries(STYLE_VARS)) {
    const v = props[key];
    if (v == null) continue;
    out[cfg.var] = cfg.px && typeof v === 'number' ? `${v}px` : String(v);
  }
  return out;
}

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const round = (n, decimals) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};
const fmt = (n, decimals) => (decimals > 0 ? Number(n).toFixed(decimals) : String(Math.round(n)));

export default function Stepper({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  decimals = 0,
  maxDigits,
  editable = true,
  onMinReached,
  disabled = false,
  ariaLabel = 'Value',
  orientation = 'horizontal', // 'vertical' empilha + / número / − (uso futuro)
  className,
  style,
  // --- estilo (viram CSS vars) ---
  bg, border, radius, padding, gap,
  numberColor, plusColor, minusColor,
  fontSize, fontWeight, maxWidth, height, buttonSize, numberWidth,
}) {
  // Texto local do input (digitação livre); ressincroniza quando `value` muda de
  // fora (ajuste durante o render - padrão do projeto, sem effect).
  const [text, setText] = useState(fmt(value, decimals));
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setText(fmt(value, decimals));
  }

  const commit = () => {
    const parsed = Number(String(text).replace(',', '.'));
    const n = Number.isFinite(parsed) ? clamp(round(parsed, decimals), min, max) : value;
    onChange(n);
    setText(fmt(n, decimals));
  };

  const decrement = () => {
    const next = round(value - step, decimals);
    if (next < min) {
      if (onMinReached) onMinReached();
      else if (value !== min) onChange(min);
    } else {
      onChange(next);
    }
  };
  const increment = () => {
    const next = clamp(round(value + step, decimals), min, max);
    if (next !== value) onChange(next);
  };

  const sanitize = (raw) => {
    let s = String(raw).replace(decimals > 0 ? /[^0-9.,]/g : /[^0-9]/g, '');
    if (maxDigits) {
      // Limita a quantidade de DÍGITOS (fora o separador decimal).
      const [intPart, decPart] = s.split(/[.,]/);
      const trimmed = intPart.slice(0, maxDigits);
      s = decPart != null ? `${trimmed}.${decPart}` : trimmed;
    }
    return s;
  };

  const minusDisabled = disabled || (value <= min && !onMinReached);
  const plusDisabled = disabled || value >= max;

  const styleObj = buildStyle(
    { bg, border, radius, padding, gap, numberColor, plusColor, minusColor, fontSize, fontWeight, maxWidth, height, buttonSize, numberWidth },
    style,
  );

  const rootClass = [styles.stepper, orientation === 'vertical' && styles.vertical, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} style={styleObj}>
      <button
        type="button"
        className={styles.minus}
        onClick={decrement}
        disabled={minusDisabled}
        aria-label={`Decrease ${ariaLabel}`}
      >
        −
      </button>
      {editable ? (
        <input
          type="text"
          inputMode={decimals > 0 ? 'decimal' : 'numeric'}
          className={styles.number}
          aria-label={ariaLabel}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(sanitize(e.target.value))}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      ) : (
        <span className={styles.number}>{fmt(value, decimals)}</span>
      )}
      <button
        type="button"
        className={styles.plus}
        onClick={increment}
        disabled={plusDisabled}
        aria-label={`Increase ${ariaLabel}`}
      >
        +
      </button>
    </div>
  );
}
