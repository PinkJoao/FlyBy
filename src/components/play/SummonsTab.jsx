// =============================================================================
// SummonsTab: a aba de summons do play mode
// =============================================================================
// O QUE FAZ
//   Só aparece com summon ativo (S1 do dono, DDL-0192). Um painel por grupo
//   (S3: iguais agrupados): o nome com a quantidade, CA, deslocamento, a ligação com
//   a concentração e "Dismiss"; uma linha por membro com o PV e os botões de dano e
//   cura; uma linha por ação, com o ataque e o dano (rolados pelo diálogo do play
//   mode) ou a salvaguarda com a CD. O texto da ação abre no toque, como uma feature.
//   A instância leve (S4, DDL-0194: Spiritual Weapon, Bigby's Hand) mostra a CA e os PV
//   quando a prosa dá, a regra de comando e a linha que repete a magia sem espaço.
//
// FUNÇÕES
//   speedLine(speed, variant): o deslocamento em uma linha, só o da forma.
//   details(view): deslocamento, concentração e turno, a linha abaixo do título.
//   ActionRow(props): uma ação do summon.
//   SummonsTab(props): a aba.
//
// DECISÕES E ARMADILHAS
//   - Usa os painéis e linhas da aba Features e do grimório (SpellbookTab.module.css),
//     o mesmo desenho (§6.4: o que parece a ficha usa o CSS da ficha).
//   - PV sem número (molde em prosa que o núcleo não leu) mostra o texto e "?": a
//     vista nunca inventa (DDL-0191).
//   - Os botões só chamam o que a tela passa; nada aqui grava evento.
//   - O título leva só o nome, a CA e Dismiss: o resto numa linha própria, porque a
//     375px a pílula com tudo quebrava em três linhas e cortava o Dismiss (DDL-0196).
// -----------------------------------------------------------------------------

import Button from '../common/Button';
import Tag from '../common/Tag';
import { turnText } from '../../engine/playSummons';
import EntryContent from '../common/EntryContent';
import useDialogStore from '../../store/dialogStore';
import styles from '../builder/SpellbookTab.module.css';

const LIGHT_LABEL = { attack: 'Attack', damage: 'Damage', heal: 'Heal' };

/** O deslocamento em uma linha ("30 ft., fly 60 ft."), só o da forma escolhida. */
function speedLine(speed, variant) {
  return Object.entries(speed ?? {})
    .filter(([k, v]) => k !== 'canHover' && k !== 'choose' && v)
    .filter(([, v]) => {
      const only = typeof v === 'object' ? String(v.condition ?? '').match(/[(]([^)]*) only[)]/i)?.[1] : null;
      return !only || !variant || only.toLowerCase().includes(String(variant).toLowerCase());
    })
    .map(([k, v]) => {
      const n = typeof v === 'object' ? v.number : v;
      const cond = typeof v === 'object' && v.condition && !/only[)]/i.test(v.condition) ? ` ${v.condition}` : '';
      return `${k === 'walk' ? '' : `${k} `}${n} ft.${cond}`;
    })
    .join(', ');
}

/** O deslocamento, a concentração e a regra de turno, numa linha abaixo do título. */
function details({ group, stats }) {
  return [
    stats?.speed ? speedLine(stats.speed, group.ctx?.variant) : null,
    group.concentration ? 'Concentration' : null,
    turnText(group.turn) || null,
  ].filter(Boolean);
}

/** Uma ação do summon: o texto no toque, o ataque e o dano. */
function ActionRow({ view, action, onAttack, onDamage }) {
  const openText = () => useDialogStore.getState().open({
    variant: 'alert',
    title: action.name,
    message: (
      <div style={{ whiteSpace: 'normal', textAlign: 'left' }}>
        <EntryContent entries={action.text} />
      </div>
    ),
    dismissable: true,
    showClose: true,
    actions: [],
    maxWidth: 560,
  });
  const atk = action.attack;
  const dmg = action.damage.map((d) => `${d.formula}${d.type ? ` ${d.type}` : ''}`).join(' + ');
  return (
    <li className={styles.row}>
      <button type="button" className={styles.rowHit} onClick={openText} title={`About ${action.name}`}>
        <span className={styles.rowText}>
          <span className={styles.rowName}>{action.name}</span>
          <span className={styles.rowSub}>
            {atk && <Tag>{atk.bonus == null ? 'attack ?' : `${atk.bonus >= 0 ? '+' : ''}${atk.bonus} to hit`}</Tag>}
            {action.save && <Tag>{`DC ${action.save.dc ?? '?'} ${String(action.save.ability).toUpperCase()}`}</Tag>}
            {dmg && <span className={styles.rowMetaLine}>{dmg}</span>}
          </span>
        </span>
      </button>
      <div className={styles.rowSide}>
        {atk && <Button size="sm" variant="primary" onClick={() => onAttack(view, action)}>Attack</Button>}
        {action.damage.length > 0 && <Button size="sm" onClick={() => onDamage(view, action)}>Damage</Button>}
      </div>
    </li>
  );
}

/**
 * A aba de summons.
 * @param {{ views: object[], loading?: boolean, onHp: Function, onAttack: Function, onDamage: Function, onDismiss: Function, onLight?: Function, lightKinds?: Function }} props
 */
export default function SummonsTab({ views, loading = false, onHp, onAttack, onDamage, onDismiss, onLight, lightKinds = () => [], dataTour }) {
  if (loading) return <p className={styles.empty}>Loading the creatures…</p>;
  if (!views.length) return <p className={styles.empty}>No summons right now.</p>;
  return (
    <div className={styles.tab} data-tour={dataTour}>
      {views.map((view) => {
        const { group, stats, members } = view;
        const many = members.length > 1;
        const actions = stats ? [...stats.actions, ...stats.bonus, ...stats.reactions] : [];
        return (
          <section key={group.id} className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>{group.label}{many ? ` ×${members.length}` : ''}</span>
              <span className={styles.panelCount}>
                {view.light ? (view.light.ac != null ? `AC ${view.light.ac}` : 'Spell effect') : stats ? `AC ${stats.ac.value ?? '?'}` : 'Not in the bestiary'}
              </span>
              <Button size="sm" variant="link" onClick={() => onDismiss(group)}>Dismiss</Button>
            </div>
            <ul className={styles.list}>
              {details(view).length > 0 && (
                <li className={styles.row}>
                  <span className={styles.rowText}>
                    <span className={styles.rowMetaLine}>{details(view).join(' · ')}</span>
                  </span>
                </li>
              )}
              {members.map((m) => (
                <li key={m.index} className={styles.row}>
                  <span className={styles.rowText}>
                    <span className={styles.rowName}>{many ? `#${m.index + 1} ` : ''}{m.current ?? '?'} / {m.max ?? '?'} HP</span>
                    {m.max == null && stats?.hp?.text && <span className={styles.rowMetaLine}>{stats.hp.text}</span>}
                  </span>
                  <div className={styles.rowSide}>
                    <Button size="sm" variant="danger" onClick={() => onHp(group, m.index, 'hurt')}>Hurt</Button>
                    <Button size="sm" onClick={() => onHp(group, m.index, 'heal')}>Heal</Button>
                  </div>
                </li>
              ))}
              {actions.map((a) => (
                <ActionRow key={a.name} view={view} action={a} onAttack={onAttack} onDamage={onDamage} />
              ))}
              {view.light && lightKinds(group).length > 0 && (
                <li className={styles.row}>
                  <span className={styles.rowText}>
                    <span className={styles.rowName}>{group.spell?.name}</span>
                    <span className={styles.rowMetaLine}>The spell again, no slot</span>
                  </span>
                  <div className={styles.rowSide}>
                    {lightKinds(group).map((k) => (
                      <Button key={k} size="sm" variant={k === 'attack' ? 'primary' : 'default'} onClick={() => onLight?.(group, k)}>
                        {LIGHT_LABEL[k]}
                      </Button>
                    ))}
                  </div>
                </li>
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
