// =============================================================================
// ResourcePanel: mudar à mão o que resta de um recurso do play mode, ou o máximo
// =============================================================================
// O QUE FAZ
//   O painel que abre ao tocar no contador de um recurso (as bolinhas de uma
//   feature, as gemas de um círculo de magia, as cargas de um item): o alternador
//   Current | Max em cima, o número no meio com menos e mais (AmountStepper) e a
//   prévia em bolinhas. Em Current o número é o que RESTA; em Max, o máximo. Fecha
//   com { left, max } (o fim que o jogador pôs) ou null. Quem o abre é o
//   playDialogs.jsx (askResource); o evento é setResourceEvent (playUse).
//
// FUNÇÕES
//   ResourcePanel(props): o painel.
//
// DECISÕES E ARMADILHAS
//   - É para o que o MESTRE tira, dá ou muda fora de um descanso (DDL-0202, e o
//     formato simples do DDL-0209, que trocou o Remove | Add): o "só usar" do jogo
//     segue para o resto; o ajuste vira um evento "by hand" que o histórico desfaz.
//   - Começa em Current. O que resta vai de 0 ao máximo; o máximo vai de 0 para
//     cima (o mestre dá um uso a mais do que a feature tem). O modelo guarda o
//     GASTO, então mudar o máximo leva o que resta junto (2 de 3 vira 3 de 4), e a
//     prévia mostra isso antes do Apply.
//   - O máximo da ficha (`sheetMax`) aparece quando o atual é outro, para o jogador
//     saber voltar.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { useDialogClose } from '../common/dialogContext';
import SegmentedControl from '../common/SegmentedControl';
import AmountStepper from './AmountStepper';
import Button from '../common/Button';
import { Pips } from './FeaturesTab';
import panel from './PlayPanels.module.css';
import styles from './HpPanels.module.css';

/**
 * O painel de ajuste à mão.
 * @param {{ left: number, max: number, sheetMax?: number, shape?: string }} props
 */
export default function ResourcePanel({ left, max, sheetMax = max, shape }) {
  const close = useDialogClose();
  const [mode, setMode] = useState('current');
  const [draftMax, setDraftMax] = useState(max);
  const [draftSpent, setDraftSpent] = useState(Math.max(0, max - left));
  const draftLeft = Math.max(0, draftMax - draftSpent);
  const changed = draftMax !== max || draftLeft !== left;
  const toNumber = (v) => Math.max(0, Math.trunc(Number(v) || 0));
  const onAmount = (v) => {
    if (v === '') return mode === 'current' ? setDraftSpent(draftMax) : setDraftMax(0);
    if (mode === 'current') setDraftSpent(draftMax - Math.min(draftMax, toNumber(v)));
    else setDraftMax(toNumber(v));
  };

  return (
    <form
      className={panel.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (changed) close({ left: draftLeft, max: draftMax });
      }}
    >
      <SegmentedControl
        block
        ariaLabel="Change the current value or the maximum"
        value={mode}
        options={[
          { value: 'current', label: 'Current' },
          { value: 'max', label: 'Max' },
        ]}
        onChange={setMode}
      />
      <AmountStepper
        key={mode}
        value={String(mode === 'current' ? draftLeft : draftMax)}
        onChange={onAmount}
        min={0}
        max={mode === 'current' ? draftMax : null}
        label={mode === 'current' ? 'Current' : 'Maximum'}
        autoFocus={false}
      />
      <p className={styles.now}>
        <Pips left={draftLeft} max={draftMax} shape={shape} /> {draftLeft} of {draftMax} left
        {changed ? ` (was ${left} of ${max})` : ''}
      </p>
      {sheetMax !== draftMax && <p className={panel.note}>The sheet's maximum is {sheetMax}.</p>}
      <p className={panel.note}>For what the DM takes away, grants or changes outside a rest. You can undo it in the history.</p>
      <div className={panel.actions}>
        <Button type="submit" variant="primary" disabled={!changed}>Apply</Button>
      </div>
    </form>
  );
}
