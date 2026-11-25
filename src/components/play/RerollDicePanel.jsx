// =============================================================================
// RerollDicePanel: escolher quais dados do dano ou da cura rolar de novo
// =============================================================================
// O QUE FAZ
//   O painel do "Reroll dice" do card do histórico (DDL-0215): cada dado do evento é um
//   Chip com o tipo e o valor; o jogador marca os que a regra deixa rolar de novo, até o
//   limite dela (Piercer 1, Empowered Spell o modificador de CAR), e fecha com a lista dos
//   ids marcados. Quem o abre é o playDialogs.jsx (askRerollDice); o evento é
//   rerollDiceEvent (engine/playRerolls).
//
// FUNÇÕES
//   RerollDicePanel(props): o painel.
//
// DECISÕES E ARMADILHAS
//   - `ones` (Flames of Phlegethos) já começa com os dados que saíram 1 marcados.
//   - Passar do limite não se deixa marcar: o limite é a regra, inequívoca (§6.4); o
//     limite infinito (Empowered Healing, "Another rule") não aparece no texto.
// -----------------------------------------------------------------------------

import PanelFoot from '../common/PanelFoot';
import { useState } from 'react';
import { useDialogClose } from '../common/dialogContext';
import Chip from '../common/Chip';
import Button from '../common/Button';
import panel from './PlayPanels.module.css';

/**
 * O painel de escolher os dados.
 * @param {{ dice: { id: string, faces: number, value: number }[], max: number, ones?: boolean, note?: string }} props
 */
export default function RerollDicePanel({ dice, max, ones = false, note = '' }) {
  const close = useDialogClose();
  const [picked, setPicked] = useState(() => (ones ? dice.filter((d) => d.value === 1).map((d) => d.id) : []));
  const limited = Number.isFinite(max);
  const toggle = (id) => {
    if (picked.includes(id)) setPicked(picked.filter((x) => x !== id));
    else if (!limited || picked.length < max) setPicked([...picked, id]);
  };

  return (
    <form
      className={panel.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (picked.length) close(picked);
      }}
    >
      <p className={panel.note}>{limited ? `Pick up to ${max} ${max === 1 ? 'die' : 'dice'} to roll again.` : 'Pick the dice to roll again.'}</p>
      <div className={panel.chips}>
        {dice.map((d) => (
          <Chip key={d.id} active={picked.includes(d.id)} onClick={() => toggle(d.id)}>
            d{d.faces}: {d.value}
          </Chip>
        ))}
      </div>
      {note && <p className={panel.note}>{note}</p>}
      <PanelFoot>
        <Button type="submit" variant="primary" disabled={!picked.length}>Reroll {picked.length || ''}</Button>
      </PanelFoot>
    </form>
  );
}
