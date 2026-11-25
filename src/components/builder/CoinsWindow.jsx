// =============================================================================
// CoinsWindow: a janela das moedas do personagem
// =============================================================================
// O QUE FAZ
//   Aberta pelo Gold da faixa do inventário (DDL-0321): o total em ouro e três modos.
//   Coins mostra cada moeda com menos e mais (e o número digitável); Receive / Spend
//   soma ou tira uma quantia de uma moeda, trocando as outras quando falta daquela; e
//   Convert troca uma moeda por outra, ou a bolsa toda no menor número de moedas.
//
// FUNÇÕES
//   CoinsWindow(props): a janela. `currency`, `onChange(currency)` e `onClose`.
//
// DECISÕES E ARMADILHAS
//   - É conteúdo VIVO (PreviewLayer): cada toque grava na ficha, e a janela mostra o que
//     ficou gravado. Não há "salvar".
//   - As contas são do engine/currency.js; aqui só se escolhe o que pedir.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { DENOMINATIONS, convertCoins, fewestCoins, spendCoins, toCopper, toGp } from '../../engine/currency';
import PreviewLayer from '../common/PreviewLayer';
import SegmentedControl from '../common/SegmentedControl';
import ChoiceChips from '../common/ChoiceChips';
import Stepper from '../common/Stepper';
import Button from '../common/Button';
import AmountStepper from '../play/AmountStepper';
import Coin from './Coin';
import { COIN_NAME } from './coins';
import styles from './StripWindows.module.css';

const MODES = [['coins', 'Coins'], ['pay', 'Receive / Spend'], ['convert', 'Convert']];
const RATE = { pp: '10 gp each', gp: 'The base coin', ep: '2 to 1 gp', sp: '10 to 1 gp', cp: '100 to 1 gp' };
const CHIPS = DENOMINATIONS.map((d) => ({ value: d, label: d.toUpperCase() }));
const JUMPS = [5, 10];

/** A janela das moedas. */
export default function CoinsWindow({ currency, onChange, onClose }) {
  const [mode, setMode] = useState('coins');
  const [denom, setDenom] = useState('gp');
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState('sp');
  const [to, setTo] = useState('gp');
  const [count, setCount] = useState('');

  const purse = { ...Object.fromEntries(DENOMINATIONS.map((d) => [d, 0])), ...currency };
  const n = Math.max(0, Math.trunc(Number(amount) || 0));
  const spent = n > 0 ? spendCoins(purse, denom, n) : null;
  const swap = convertCoins(purse, from, to, Number(count) || 0);
  const few = fewestCoins(purse);
  const tidy = DENOMINATIONS.every((d) => few[d] === purse[d]);

  const payNote = n === 0
    ? `You have ${purse[denom].toLocaleString()} ${denom}.`
    : !spent
      ? 'Not enough to spend that much.'
      : purse[denom] >= n
        ? `Spending leaves ${(purse[denom] - n).toLocaleString()} ${denom}.`
        : `Not enough ${denom}: spending changes your other coins.`;
  const convertNote = from === to
    ? 'Pick two different coins.'
    : swap.got
      ? `${swap.used.toLocaleString()} ${from} becomes ${swap.got.toLocaleString()} ${to}.`
      : `You have ${purse[from].toLocaleString()} ${from}${swap.step > 1 ? `; it takes ${swap.step.toLocaleString()} for 1 ${to}` : ''}.`;

  const footer = {
    pay: (
      <>
        <Button disabled={!spent} onClick={() => { onChange(spent); setAmount(''); }}>Spend</Button>
        <Button variant="primary" disabled={n === 0} onClick={() => { onChange({ ...purse, [denom]: purse[denom] + n }); setAmount(''); }}>Receive</Button>
      </>
    ),
    convert: (
      <>
        <Button disabled={tidy} onClick={() => onChange(few)} title="The same total in as few coins as possible">Fewest coins</Button>
        <Button variant="primary" disabled={!swap.got} onClick={() => { onChange(swap.currency); setCount(''); }}>Convert</Button>
      </>
    ),
  }[mode];

  return (
    <PreviewLayer onClose={onClose} title="Coins" maxWidth={440} footer={footer}>
      <div className={styles.body}>
        <div className={styles.total}>
          <Coin denom="gp" size="lg" />
          <span>
            <span className={styles.totalValue}>{toGp(purse).toLocaleString(undefined, { maximumFractionDigits: 2 })} gp</span>
            <span className={styles.totalNote}>{toCopper(purse) === purse.gp * 100 ? 'All in gold' : 'All your coins together'}</span>
          </span>
        </div>

        <SegmentedControl ariaLabel="What to do" value={mode} onChange={setMode} options={MODES} className={styles.modes} />

        {mode === 'coins' && (
          <ul className={styles.rows}>
            {DENOMINATIONS.map((d) => (
              <li key={d} className={styles.row}>
                <Coin denom={d} size="lg" />
                <span className={styles.rowText}>
                  <span className={styles.rowName}>{COIN_NAME[d]}</span>
                  <span className={styles.rowNote}>{RATE[d]}</span>
                </span>
                <Stepper
                  value={purse[d]}
                  min={0}
                  maxDigits={7}
                  size="md"
                  numberWidth="7ch"
                  onChange={(v) => onChange({ ...purse, [d]: v })}
                  ariaLabel={COIN_NAME[d]}
                />
              </li>
            ))}
          </ul>
        )}

        {mode === 'pay' && (
          <div className={styles.form}>
            <AmountStepper value={amount} onChange={setAmount} jumps={JUMPS} label="How many coins" />
            <ChoiceChips clearable={false} ariaLabel="Coin" options={CHIPS} value={denom} onChange={setDenom} className={styles.denoms} />
            <p className={styles.note}>{payNote}</p>
          </div>
        )}

        {mode === 'convert' && (
          <div className={styles.form}>
            <span className={styles.heading}>From</span>
            <ChoiceChips clearable={false} ariaLabel="Convert from" options={CHIPS} value={from} onChange={setFrom} className={styles.denoms} />
            <span className={styles.heading}>To</span>
            <ChoiceChips clearable={false} ariaLabel="Convert to" options={CHIPS} value={to} onChange={setTo} className={styles.denoms} />
            <AmountStepper value={count} onChange={setCount} unit={swap.step} max={purse[from]} label={`How many ${from}`} autoFocus={false} />
            <p className={styles.note}>{convertNote}</p>
          </div>
        )}
      </div>
    </PreviewLayer>
  );
}
