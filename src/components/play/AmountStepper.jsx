// =============================================================================
// AmountStepper: o número grande dos painéis do play mode, com menos e mais ao lado
// =============================================================================
// O QUE FAZ
//   O campo de quantidade dos painéis Heal, Hurt, Hit dice, Move e Dash: o número
//   no meio, um botão de menos e um de mais de um passo (`unit`: 1 ponto de vida,
//   5 pés) dos lados, e embaixo os saltos (`jumps`, como 5 e 10 para cada lado,
//   os de menos à esquerda). O número continua
//   digitável; os botões evitam o teclado no celular e no desktop.
//
// FUNÇÕES
//   AmountStepper(props): o campo com os botões.
//
// DECISÕES E ARMADILHAS
//   - O valor é TEXTO (o que o campo mostra) e quem usa converte: o campo vazio
//     mostra o "0" de placeholder, e um botão parte de 0.
//   - `min` corta o que os botões dão (0 no HP e nos pés); null deixa ir abaixo
//     de zero (os dados de vida devolvem os gastos com número negativo). O botão
//     que só daria o próprio mínimo fica desabilitado.
//   - O foco automático só vale com mouse: num toque (pointer: coarse) ele abriria
//     o teclado do celular por cima dos botões, que são o jeito de usar ali. Vem
//     depois da montagem (setTimeout), pelo mesmo motivo do RollPanel: o
//     DialogHost foca o próprio cartão no efeito dele.
//   - O campo NÃO leva `min` nem `step`: a validação nativa barraria o envio em
//     silêncio (um 7 com passo 5, um -3 com mínimo 0; §6.1). Quem usa corta.
//   - Sem toque longo para repetir (§6.4): os saltos cobrem o número grande.
// -----------------------------------------------------------------------------

import { useEffect, useRef } from 'react';
import styles from './AmountStepper.module.css';

/**
 * O número com menos e mais de um passo e os saltos embaixo.
 * @param {{ value: string, onChange: (v: string) => void, unit?: number, jumps?: number[], min?: number|null, label?: string, autoFocus?: boolean }} props
 */
export default function AmountStepper({ value, onChange, unit = 1, jumps = [], min = 0, label = 'Amount', autoFocus = true }) {
  const inputRef = useRef(null);
  const n = Math.trunc(Number(value) || 0);

  useEffect(() => {
    if (!autoFocus || window.matchMedia?.('(pointer: coarse)').matches) return undefined;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [autoFocus]);

  const step = (delta) => onChange(String(min == null ? n + delta : Math.max(min, n + delta)));
  const blocked = (delta) => delta < 0 && min != null && n <= min;
  const deltas = [...jumps].sort((a, b) => b - a).map((j) => -j).concat([...jumps].sort((a, b) => a - b));

  return (
    <div className={styles.stepper}>
      <div className={styles.main}>
        <button type="button" className={styles.side} onClick={() => step(-unit)} disabled={blocked(-unit)} aria-label={`${unit} less`}>-</button>
        <input
          ref={inputRef}
          className={styles.amount}
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          aria-label={label}
        />
        <button type="button" className={styles.side} onClick={() => step(unit)} aria-label={`${unit} more`}>+</button>
      </div>
      {deltas.length > 0 && (
        <div className={styles.jumps} style={{ '--jumps': deltas.length }}>
          {deltas.map((d, i) => (
            <button
              key={d}
              type="button"
              className={[styles.jump, d < 0 && styles.minus, d < 0 && deltas[i + 1] > 0 && styles.split].filter(Boolean).join(' ')}
              onClick={() => step(d)}
              disabled={blocked(d)}
            >
              {d > 0 ? `+${d}` : d}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
