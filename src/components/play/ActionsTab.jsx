// =============================================================================
// ActionsTab: as ações básicas do jogo, cada uma com os custos do personagem
// =============================================================================
// O QUE FAZ
//   A aba "Actions" do play mode (docs/PLAY-MODE-V2-PLAN.md, §3 a §5): só as ações
//   básicas do livro de 2024 que o personagem tem o que fazer com elas
//   (engine/playBasicActions), cada uma num card com os custos possíveis em pílulas
//   (Action, e Bonus Action quando uma feature dá). Em combate, a pílula de um custo
//   já gasto no turno fica apagada, e o card inteiro esmaece quando nenhum custo
//   sobra. Tocar abre o painel de "como usar" (ActionPanel), sempre (DDL-0158): ali o
//   jogador escolhe, lê a regra ou cancela. As ações menos comuns ficam no grupo "Other".
//
// FUNÇÕES
//   ActionCard(props): o card de uma ação.
//   ActionsTab(props): a aba.
//
// DECISÕES E ARMADILHAS
//   - Card apagado continua tocável: gastar de novo é possível, o painel avisa
//     (liberdade com aviso, §6.4 do manual).
//   - Pílula de custo que vem de feature leva o nome dela no title (o toque longo
//     não existe no app; o nome também aparece no painel).
//   - O Ready com gatilho guardado mostra o gatilho no card até o próximo turno; o
//     Attack com Extra Attack em curso mostra "1 of 2 attacks".
//   - O grupo Other nasce ABERTO (pedido do dono, 2026-11-06); o cabeçalho ainda o
//     recolhe.
//   - A etiqueta de custo é a Tag no tom do gasto (DDL-0199, cores do DDL-0163): azul
//     a ação, verde a bônus, amarelo a reação; o gasto já usado no turno, esmaecido.
//   - As ações de feature (Rage, Second Wind) não entram aqui: ficam na aba Features
//     (resposta P3 do dono).
// -----------------------------------------------------------------------------

import { useState } from 'react';
import Collapse from '../common/Collapse';
import Icon from '../common/Icon';
import styles from './ActionsTab.module.css';
import Tag from '../common/Tag';

/** O card de uma ação: o nome, os custos e o que sobra no turno. */
function ActionCard({ item, readied, inCombat, onAct }) {
  const seen = new Set();
  const costs = item.costs.filter((c) => {
    const k = `${c.cost}|${c.available}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return (
    <button type="button" className={inCombat && !item.available ? `${styles.card} ${styles.spent}` : styles.card} onClick={() => onAct(item)}>
      <span className={styles.name}>{item.name}</span>
      <span className={styles.costs}>
        {costs.map((c) => (
          <Tag key={`${c.cost}|${c.available}`} tone={c.cost} dim={inCombat && !c.available} title={c.source ? `${c.label}, from ${c.source}` : c.label}>
            {c.label}
          </Tag>
        ))}
      </span>
      {readied && <span className={styles.readied}>Readied: {readied}</span>}
      {item.attacks && <span className={styles.readied}>{item.attacks.done} of {item.attacks.max} attacks</span>}
    </button>
  );
}

/**
 * A aba de ações.
 * @param {{ list: object[], state: object, onAct: (item: object) => void, dataTour?: string }} props
 */
export default function ActionsTab({ list, state, onAct, dataTour }) {
  const [otherOpen, setOtherOpen] = useState(true);
  const inCombat = !!state.combat;
  const readied = state.combat?.used?.readied ?? null;
  const main = list.filter((a) => a.group === 'main');
  const other = list.filter((a) => a.group === 'other');
  const card = (a) => <ActionCard key={a.key} item={a} inCombat={inCombat} readied={a.name === 'Ready' ? readied : null} onAct={onAct} />;
  return (
    <section className={styles.tab} data-tour={dataTour}>
      {inCombat && <p className={styles.hint}>Faded costs are already used this turn.</p>}
      <div className={styles.grid}>{main.map(card)}</div>
      {other.length > 0 && (
        <>
          <button type="button" className={styles.otherHead} onClick={() => setOtherOpen((v) => !v)} aria-expanded={otherOpen}>
            <span>Other</span>
            <span className={otherOpen ? `${styles.chev} ${styles.chevOpen}` : styles.chev}>
              <Icon name="chevron" />
            </span>
          </button>
          <Collapse open={otherOpen}>
            <div className={styles.grid}>{other.map(card)}</div>
          </Collapse>
        </>
      )}
    </section>
  );
}
