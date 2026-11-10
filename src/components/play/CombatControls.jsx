// =============================================================================
// CombatControls: os comandos do combate, por cima da tela
// =============================================================================
// O QUE FAZ
//   Os controles do modo de combate (DDL-0161), que ficam visíveis enquanto o
//   jogador navega pelas abas e pela página:
//   - SlotButton: Action, Bonus Action e Reaction, botão e indicador ao mesmo tempo;
//     o toque abre o que aquele gasto paga (SlotPanel), e sem nada disponível o
//     botão fica desligado.
//   - CombatFloat: no celular, fixos na tela: os três gastos empilhados à esquerda;
//     Next turn, End combat e a rodada à direita.
//   - CombatDock: no desktop, os MESMOS dois painéis, deitados na base da coluna do
//     histórico (os três gastos; Next turn e End combat); a rodada vai no título do
//     histórico (RoundBadge).
//
// FUNÇÕES
//   SlotButton(props), RoundBadge(props), CombatFloat(props), CombatDock(props).
//   TurnButtons(props): Next turn e End combat, nos dois lugares.
//   SummonsLine(props): "Then: ..." com os summons ativos e a regra de turno de cada um.
//   SLOTS: os três gastos, com o rótulo e o ícone; `available` diz quais ainda dão.
//
// DECISÕES E ARMADILHAS
//   - Símbolos em vez de texto (experimento do dono, 2026-11-08): círculo para a
//     ação, triângulo para a bônus, raio para a reação, "pular" para a próxima vez,
//     bandeira para encerrar. O nome vai no aria-label e no title; se ficar pouco
//     claro, troca-se por texto.
//   - As cores dos três gastos vêm dos tokens --econ-* (azul, verde, amarelo,
//     DDL-0163), as mesmas das etiquetas de custo das abas; o gasto usado fica
//     apagado e desligado.
//   - O CombatFloat vai por PORTAL para o body: dentro da página, um ancestral com
//     transform (o FLIP da troca de modo, o deslize das abas) prenderia o fixed.
//   - Sem o tracker de iniciativa: o card de iniciativa já mostra.
// -----------------------------------------------------------------------------

import { createPortal } from 'react-dom';
import Icon from '../common/Icon';
import styles from './CombatControls.module.css';

const SLOTS = [
  { slot: 'action', label: 'Action', icon: 'econAction' },
  { slot: 'bonus', label: 'Bonus Action', icon: 'econBonus' },
  { slot: 'reaction', label: 'Reaction', icon: 'econReaction' },
];

/** Um gasto do turno: botão e indicador. */
export function SlotButton({ slot, label, icon, available, onPick, size = 'md' }) {
  return (
    <button
      type="button"
      className={[styles.btn, styles[slot], size === 'sm' ? styles.sm : null].filter(Boolean).join(' ')}
      onClick={() => onPick(slot)}
      disabled={!available}
      aria-label={available ? `${label}: available` : `${label}: used`}
      title={available ? `${label} (available)` : `${label} (used this turn)`}
    >
      <Icon name={icon} />
    </button>
  );
}

/** A rodada atual. */
export function RoundBadge({ round, compact = false }) {
  return (
    <span className={compact ? `${styles.round} ${styles.roundCompact}` : styles.round} title={`Round ${round}`} aria-label={`Round ${round}`}>
      <span className={styles.roundLabel}>{compact ? 'Rnd' : 'Round'}</span>
      <span className={styles.roundValue}>{round}</span>
    </span>
  );
}

/** Os comandos de turno: próxima vez e encerrar. */
function TurnButtons({ onNextTurn, onEndCombat, size }) {
  const cls = size === 'sm' ? `${styles.btn} ${styles.cmd} ${styles.sm}` : `${styles.btn} ${styles.cmd}`;
  return (
    <>
      <button type="button" className={cls} onClick={onNextTurn} aria-label="Next turn" title="Next turn">
        <Icon name="nextTurn" />
      </button>
      <button type="button" className={`${cls} ${styles.end}`} onClick={onEndCombat} aria-label="End combat" title="End combat">
        <Icon name="endCombat" />
      </button>
    </>
  );
}

/**
 * No celular: os gastos à esquerda e os comandos e a rodada à direita, fixos na tela.
 * @param {{ round: number, available: object, onPick: Function, onNextTurn: Function, onEndCombat: Function, dataTour?: string }} props
 */
export function CombatFloat({ round, available, onPick, onNextTurn, onEndCombat, dataTour, summons = [] }) {
  return createPortal(
    <>
      <div className={`${styles.pod} ${styles.float} ${styles.left} motion-page`} data-tour={dataTour}>
        {SLOTS.map((s) => (
          <SlotButton key={s.slot} {...s} available={!!available[s.slot]} onPick={onPick} />
        ))}
      </div>
      <div className={`${styles.pod} ${styles.float} ${styles.right} motion-page`}>
        <RoundBadge round={round} compact />
        <TurnButtons onNextTurn={onNextTurn} onEndCombat={onEndCombat} />
      </div>
      {summons.length > 0 && <SummonsLine summons={summons} className={`${styles.float} ${styles.summonsFloat} motion-page`} />}
    </>,
    document.body,
  );
}

/**
 * No desktop: a barra na base da coluna do histórico.
 * @param {{ available: object, onPick: Function, onNextTurn: Function, onEndCombat: Function, dataTour?: string }} props
 */
export function CombatDock({ available, onPick, onNextTurn, onEndCombat, dataTour, summons = [] }) {
  return (
    <div className={styles.dock} data-tour={dataTour}>
      <span className={styles.pod}>
        {SLOTS.map((s) => (
          <SlotButton key={s.slot} {...s} available={!!available[s.slot]} onPick={onPick} />
        ))}
      </span>
      <span className={styles.pod}>
        <TurnButtons onNextTurn={onNextTurn} onEndCombat={onEndCombat} />
      </span>
      {summons.length > 0 && <SummonsLine summons={summons} />}
    </div>
  );
}

/** A linha dos summons no controle de turno (U6, DDL-0193): quem age depois de você. */
function SummonsLine({ summons, className = '' }) {
  return (
    <span className={`${styles.summons} ${className}`} title={summons.map((s) => `${s.label}: ${s.note}`).join('\n')}>
      Then: {summons.map((s) => s.label).join(', ')}
    </span>
  );
}
