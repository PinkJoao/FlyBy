// =============================================================================
// FeaturesTab: os recursos e as ações de feature do play mode
// =============================================================================
// O QUE FAZ
//   A aba "Features" da tela do play mode: os pools de feature (Rage, Channel
//   Divinity, Superiority Dice) com o que sobra, a recuperação e o ajuste à mão; e
//   as ações das features agrupadas pelo custo (ação, ação bônus, reação, outro),
//   cada activity com o seu botão. As ações básicas do XPHB ficam no fim, em
//   botões curtos que só registram no histórico.
//
// FUNÇÕES
//   groupOf(activation): o grupo de um custo.
//   Pips(props): o contador em bolinhas (até 12) ou em número.
//   FeaturesTab(props): a aba.
//
// DECISÕES E ARMADILHAS
//   - A ação com RECUPERAÇÃO ESPECIAL (Arcane Recovery, Natural Recovery, Font of
//     Magic, engine/playUse) troca o botão genérico pelo dela: a escolha dos slots
//     não cabe numa activity.
//   - GROUPS dá a ordem dos grupos de custo; o que não é ação, bônus ou reação
//     (especial, 1 minuto, descanso curto) cai em "Other".
//   - O ajuste à mão (- e +) é um evento como outro qualquer: aparece no histórico
//     e se desfaz.
// -----------------------------------------------------------------------------

import { remainingOf } from '../../engine/playState';
import { recoveryText } from '../../engine/playCatalog';
import { specialRecovery } from '../../engine/playUse';
import styles from './PlayTabs.module.css';

const GROUPS = [
  { id: 'action', label: 'Actions' },
  { id: 'bonus', label: 'Bonus actions' },
  { id: 'reaction', label: 'Reactions' },
  { id: 'other', label: 'Other' },
];

/** O grupo de um custo de activity. */
const groupOf = (activation) => (['action', 'bonus', 'reaction'].includes(activation?.type) ? activation.type : 'other');

/** O contador em bolinhas (até 12) ou em número. */
export function Pips({ left, max }) {
  if (max > 12) return <span className={styles.count}>{left}/{max}</span>;
  return (
    <span className={styles.pips} aria-label={`${left} of ${max} left`}>
      {Array.from({ length: max }, (_, i) => <span key={i} className={i < left ? `${styles.pip} ${styles.pipOn}` : styles.pip} />)}
    </span>
  );
}

/**
 * A aba de features.
 * @param {{ catalog: object, state: object, onUse: Function, onSpecial: Function, onAdjust: Function }} props
 */
export default function FeaturesTab({ catalog, state, onUse, onSpecial, onAdjust }) {
  const pools = (catalog.resources ?? []).filter((r) => r.kind === 'pool');
  const features = catalog.actions.filter((a) => a.group !== 'basic');
  const basics = catalog.actions.filter((a) => a.group === 'basic');
  const poolOf = (key) => pools.find((p) => p.key === key);

  return (
    <section className={styles.panel}>
      {pools.length > 0 && (
        <>
          <h2 className={styles.heading}>Resources</h2>
          <ul className={styles.list}>
            {pools.map((p) => {
              const left = remainingOf(state, p.key, p.max);
              return (
                <li key={p.key} className={styles.row}>
                  <span className={styles.rowMain}>
                    <span className={styles.name}>{p.name}</span>
                    <span className={styles.sub}>{recoveryText(p.recovery) || 'No automatic recovery'}</span>
                  </span>
                  <Pips left={left} max={p.max} />
                  <span className={styles.adjust}>
                    <button type="button" className={styles.smallBtn} onClick={() => onAdjust(p.key, 1)} disabled={left <= 0} aria-label={`Spend one ${p.name}`}>-</button>
                    <button type="button" className={styles.smallBtn} onClick={() => onAdjust(p.key, -1)} disabled={left >= p.max} aria-label={`Regain one ${p.name}`}>+</button>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {GROUPS.map((g) => {
        const items = features.flatMap((a) => a.activities.filter((x) => groupOf(x.activation) === g.id).map((x) => ({ action: a, activity: x })));
        if (!items.length) return null;
        return (
          <div key={g.id} className={styles.group}>
            <h2 className={styles.heading}>{g.label}</h2>
            <ul className={styles.list}>
              {items.map(({ action, activity }) => {
                const special = specialRecovery(action, catalog);
                const pool = action.pool ? poolOf(action.pool) : null;
                const costKey = activity.consumes?.find((c) => c.key)?.key;
                const cost = costKey ? poolOf(costKey) ?? (catalog.resources ?? []).find((r) => r.key === costKey) : null;
                return (
                  <li key={`${action.key}|${activity.id}`} className={styles.row}>
                    <span className={styles.rowMain}>
                      <span className={styles.name}>{activity.name && activity.name !== action.name ? `${action.name}: ${activity.name}` : action.name}</span>
                      <span className={styles.sub}>
                        {[
                          g.id === 'other' && activity.activation?.type ? activity.activation.type : null,
                          activity.activation?.condition || null,
                          cost ? `${remainingOf(state, cost.key, cost.max)}/${cost.max} ${cost.name}` : null,
                          activity.save?.dc ? `DC ${activity.save.dc} ${(activity.save.abilities ?? []).join('/')}` : null,
                        ].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {pool && !costKey && <Pips left={remainingOf(state, pool.key, pool.max)} max={pool.max} />}
                    <button
                      type="button"
                      className={styles.useBtn}
                      onClick={() => (special ? onSpecial(action, special) : onUse(action, activity))}
                    >
                      {special ? 'Choose' : 'Use'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {basics.length > 0 && (
        <>
          <h2 className={styles.heading}>Basic actions</h2>
          <div className={styles.chips}>
            {basics.map((a) => (
              <button key={a.key} type="button" className={styles.chip} onClick={() => onUse(a, a.activities[0])} title="Log it in the history">
                {a.name}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
