// =============================================================================
// FeaturesTab: as features do play mode, agrupadas por tipo
// =============================================================================
// O QUE FAZ
//   A aba "Features" do play mode (docs/PLAY-MODE-V2-PLAN.md §6, resposta P3,
//   DDL-0151), no desenho das abas Spells e Inventory: as sub-abas por tipo (Class,
//   Subclass, Species, Feats), a busca com o alternador Active | Passive e as seções
//   recolhíveis (a classe, a
//   subclasse, as invocações, a espécie, o talento de origem, os talentos). Cada
//   feature mostra o nível, os custos das suas activities e o pool com o que sobra;
//   o botão USA a feature (e pergunta qual activity quando há mais de uma). Tocar no
//   nome abre o texto dela.
//
// FUNÇÕES
//   costLabel(activation): o rótulo curto de um custo de activity.
//   Pips(props): o contador em bolinhas ou gemas (até 12) ou em número.
//   showFeatureText(feature, onLog): o texto da feature num diálogo, com "Log to
//     history".
//   FeatureRow(props): uma linha.
//   FeaturesTab(props): a aba.
//
// DECISÕES E ARMADILHAS
//   - A feature que invoca um companheiro (Steel Defender, Primal Companion, Summon
//     Wildfire Spirit; CLASS_SUMMONS em engine/playSummons.js) ganha "Summon" (DDL-0193).
//   - O Wild Shape ganha "Transform": as formas conhecidas da ficha (DDL-0195).
//   - O custo e a recuperação são a Tag (DDL-0199), o custo no tom do gasto, o mesmo
//     da aba Actions e dos botões de combate.
//   - USAR é o botão (DDL-0146); o pool sem activity (o uso que só a prosa declara)
//     ganha "Use", que gasta um. Tocar nas bolinhas abre o ajuste à mão (tirar ou pôr,
//     o que o mestre tira ou dá, DDL-0202, `onResource`): o "sem ajuste" do DDL-0151
//     caiu. O engano se desfaz no histórico.
//   - A ação com RECUPERAÇÃO ESPECIAL (Arcane Recovery, Natural Recovery, Font of
//     Magic, engine/playUse) troca o botão pelo "Choose": a escolha dos slots não
//     cabe numa activity.
//   - O custo do turno vem das activities E do texto (`turnCostsOf`, DDL-0203): a
//     feature que só a prosa diz que gasta uma ação, bônus ou reação ganha a etiqueta
//     e um "Use" que a leva ao histórico (`onLog`), marcando o gasto do turno. O mesmo
//     "Use" vale para a de gatilho sem custo (Frenzy, Divine Strike, DDL-0204). O
//     detalhe de TODA feature tem "Log to history" (a do dado rolado na mesa, a que o
//     app não automatiza). O "Use" do pool sem activity vai pelo mesmo caminho e
//     gasta um.
//   - A feature do registro curado (engine/playFeatureRolls, DDL-0205) é ativa: a de
//     extra na rolagem ganha a Tag "In damage rolls" ou "In d20 rolls" (o extra aparece
//     no diálogo da rolagem, para ligar); a de efeito ou de gasto (Reckless Attack,
//     Stunning Strike) usa pelo "Use".
//   - As ações básicas do XPHB não aparecem aqui: moram na aba Actions (DDL-0147).
//   - Um pool que nenhuma feature da lista reclama (não deveria haver) aparece numa
//     seção "Resources" no topo, para nunca sumir em silêncio.
//   - O alternador Active | Passive fica na linha da busca e começa em Active
//     (DDL-0204): ativa é o que `isActiveFeature` diz (activity, pool, custo do turno,
//     gatilho da prosa) mais o que tem Summon ou Transform. A busca sem resultado no
//     lado escolhido diz quantas batem no outro e troca com um toque. Os pools órfãos só
//     aparecem em Active; as sub-abas por tipo valem para os dois lados.
//   - A sub-aba, o alternador e as seções recolhidas são só desta tela.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { FEATURE_KINDS, featureCosts, isActiveFeature } from '../../engine/playFeatures';
import { remainingOf } from '../../engine/playState';
import { recoveryText } from '../../engine/playCatalog';
import { specialRecovery } from '../../engine/playUse';
import { ask } from '../common/dialog';
import useDialogStore from '../../store/dialogStore';
import EntryContent from '../common/EntryContent';
import Collapse from '../common/Collapse';
import Icon from '../common/Icon';
import Button from '../common/Button';
import Tag from '../common/Tag';
import SegmentedControl from '../common/SegmentedControl';
import { isSummonFeature } from '../../engine/playSummons';
import { featureRollOf } from '../../engine/playFeatureRolls';
import { transformRuleOf } from '../../engine/playForms';
import styles from '../builder/SpellbookTab.module.css';
import play from './PlayTabs.module.css';

const COST_LABELS = { action: 'Action', bonus: 'Bonus Action', reaction: 'Reaction', minute: 'Minute', hour: 'Hour', special: 'Special', legendary: 'Legendary' };

/** O rótulo curto de um custo de activity ("Bonus Action", "1 Minute"). */
function costLabel(activation) {
  const base = COST_LABELS[activation?.type] ?? activation?.type ?? '';
  if (['minute', 'hour'].includes(activation?.type)) return `${activation.value ?? 1} ${base}${(activation.value ?? 1) > 1 ? 's' : ''}`;
  return base;
}

/** O contador em bolinhas (até 12) ou em número; `shape="gem"` desenha gemas (os espaços de magia). */
export function Pips({ left, max, shape }) {
  if (max > 12) return <span className={play.count}>{left}/{max}</span>;
  const base = shape === 'gem' ? `${play.pip} ${play.gem}` : play.pip;
  return (
    <span className={play.pips} aria-label={`${left} of ${max} left`}>
      {Array.from({ length: max }, (_, i) => <span key={i} className={i < left ? `${base} ${play.pipOn}` : base} />)}
    </span>
  );
}

/** O texto da feature num diálogo, com o renderizador da ficha e o "Log to history". */
function showFeatureText(feature, onLog) {
  return useDialogStore.getState().open({
    variant: 'alert',
    title: feature.name,
    message: (
      <div style={{ whiteSpace: 'normal', textAlign: 'left' }}>
        {feature.entries.length ? <EntryContent entries={feature.entries} /> : <p>No description.</p>}
      </div>
    ),
    dismissable: true,
    showClose: true,
    actions: onLog ? [{ label: 'Log to history', value: 'log', tone: 'primary' }] : [],
    maxWidth: 560,
  }).then((v) => {
    if (v === 'log') onLog(feature);
  });
}

/** Uma feature: nome, nível e custos; o pool e o botão de usar ao lado. */
function FeatureRow({ feature, action, pools, catalog, state, onUse, onSpecial, onLog, onSummon, onTransform, onResource }) {
  const activities = action?.activities ?? [];
  const special = action ? specialRecovery(action, catalog) : null;
  const turn = featureCosts(feature, action);
  const costs = [
    ...new Map([
      ...turn.map((type) => [costLabel({ type }), type]),
      ...activities.filter((a) => costLabel(a.activation)).map((a) => [costLabel(a.activation), a.activation.type]),
    ]).entries(),
  ];
  const recovery = pools.map((p) => recoveryText(p.recovery)).find(Boolean);
  const use = async () => {
    if (special) return onSpecial(action, special);
    if (activities.length === 1) return onUse(action, activities[0]);
    const id = await ask({
      title: feature.name,
      message: 'Which use?',
      actions: activities.map((a) => ({ label: `${a.name || feature.name} (${costLabel(a.activation)})`, value: a.id })),
    });
    const activity = activities.find((a) => a.id === id);
    if (activity) onUse(action, activity);
  };
  const lone = !activities.length && pools.length === 1 ? pools[0] : null;
  const loneLeft = lone ? remainingOf(state, lone.key, lone.max) : 0;
  const textOnly = !activities.length && !pools.length && (turn.length > 0 || !!feature.trigger || (!!feature.roll && feature.roll !== 'passive')) && !special;
  const rider = feature.roll === 'rider' ? featureRollOf(feature.name) : null;
  return (
    <li className={styles.row}>
      <button type="button" className={styles.rowHit} onClick={() => showFeatureText(feature, onLog)} title={`About ${feature.name}`}>
        <span className={styles.rowText}>
          <span className={styles.rowName}>{feature.name}</span>
          <span className={styles.rowSub}>
            {feature.level > 0 && <span className={styles.rowMetaLine}>Level {feature.level}</span>}
            {costs.map(([label, type]) => (
              <Tag key={label} tone={type ?? undefined}>{label}</Tag>
            ))}
            {recovery && <Tag>{recovery}</Tag>}
            {rider && <Tag tone="info">{rider.on.includes('damage') ? 'In damage rolls' : 'In d20 rolls'}</Tag>}
          </span>
        </span>
      </button>
      <div className={styles.rowSide}>
        {pools.map((p) => (
          <button key={p.key} type="button" className={play.adjust} onClick={() => onResource?.(p)} disabled={!onResource} title={`${p.name}: change by hand`}>
            <Pips left={remainingOf(state, p.key, p.max)} max={p.max} />
          </button>
        ))}
        {activities.length > 0 && (
          <Button size="sm" variant="primary" onClick={use} title={`Use ${feature.name}`}>
            {special ? 'Choose' : 'Use'}
          </Button>
        )}
        {onTransform && transformRuleOf(feature.name)?.kind === 'wildShape' && (
          <Button size="sm" variant="primary" onClick={() => onTransform(feature)} title="Assume one of your known forms">
            Transform
          </Button>
        )}
        {onSummon && isSummonFeature(feature.name) && (
          <Button size="sm" variant="primary" onClick={() => onSummon(feature)} title={`Summon with ${feature.name}`}>
            Summon
          </Button>
        )}
        {lone && (
          <Button size="sm" variant="primary" onClick={() => onLog?.(feature, lone.key)} disabled={loneLeft <= 0 || !onLog} title={`Spend one ${lone.name}`}>
            Use
          </Button>
        )}
        {textOnly && onLog && (
          <Button size="sm" variant="primary" onClick={() => onLog(feature)} title={`Log ${feature.name} to the history`}>
            Use
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * A aba de features do jogo.
 * @param {{ catalog: object, state: object, onUse: Function, onSpecial: Function, onLog?: Function, onResource?: Function }} props
 */
export default function FeaturesTab({ catalog, state, onUse, onSpecial, onLog, onSummon, onTransform, onResource }) {
  const [kind, setKind] = useState('all');
  const [mode, setMode] = useState('active');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(() => new Set());
  const features = catalog.featureList ?? [];
  const pools = (catalog.resources ?? []).filter((r) => r.kind === 'pool');
  const actions = new Map((catalog.actions ?? []).map((a) => [a.key, a]));
  const claimed = new Set(features.map((f) => f.name));
  const orphans = pools.filter((p) => !claimed.has(p.item));
  const kinds = FEATURE_KINDS.filter((k) => features.some((f) => f.kind === k.id));
  const needle = query.trim().toLowerCase();
  const activeOf = (f) =>
    isActiveFeature(f, actions.get(f.actionKey), pools.filter((p) => p.item === f.name)) || isSummonFeature(f.name) || transformRuleOf(f.name)?.kind === 'wildShape';
  const matches = features.filter((f) => (kind === 'all' || f.kind === kind) && (!needle || f.name.toLowerCase().includes(needle)));
  const shown = matches.filter((f) => activeOf(f) === (mode === 'active'));
  const other = matches.length - shown.length;
  const otherMode = mode === 'active' ? 'passive' : 'active';
  const sections = [...new Set(shown.map((f) => f.section))].map((s) => [s, shown.filter((f) => f.section === s)]);
  const toggle = (label) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  const rowProps = { catalog, state, onUse, onSpecial, onLog, onSummon, onTransform, onResource };

  if (!features.length && !orphans.length) return <p className={styles.empty}>This character has no features.</p>;

  return (
    <div className={styles.tab}>
      {kinds.length > 1 && (
        <nav className={styles.subTabs} data-wheel-x="">
          <button type="button" className={kind === 'all' ? `${styles.subTab} ${styles.subTabActive}` : styles.subTab} onClick={() => setKind('all')}>
            All
          </button>
          {kinds.map((k) => (
            <button key={k.id} type="button" className={kind === k.id ? `${styles.subTab} ${styles.subTabActive}` : styles.subTab} onClick={() => setKind(k.id)}>
              {k.label}
            </button>
          ))}
        </nav>
      )}

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <input type="search" className={styles.search} placeholder="Search features…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <SegmentedControl
          ariaLabel="Active or passive features"
          value={mode}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'passive', label: 'Passive' },
          ]}
          onChange={setMode}
        />
      </div>

      {orphans.length > 0 && mode === 'active' && kind === 'all' && !needle && (
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>Resources</span>
          </div>
          <ul className={styles.list}>
            {orphans.map((p) => (
              <FeatureRow key={p.key} feature={{ name: p.name, level: null, entries: [] }} action={null} pools={[p]} {...rowProps} />
            ))}
          </ul>
        </section>
      )}

      {shown.length === 0 && (
        <p className={styles.empty}>
          {needle ? `No ${mode} features match your search.` : `No ${mode} features here.`}
          {other > 0 && (
            <>
              {' '}
              <Button variant="link" onClick={() => setMode(otherMode)}>
                Show {other} {otherMode}
              </Button>
            </>
          )}
        </p>
      )}

      {sections.map(([label, list]) => {
        const isCollapsed = collapsed.has(label);
        return (
          <section key={label} className={styles.panel}>
            <button type="button" className={styles.panelHead} onClick={() => toggle(label)} aria-expanded={!isCollapsed}>
              <span className={styles.panelTitle}>{label}</span>
              <span className={styles.panelCount}>{list.length}</span>
              <span className={isCollapsed ? `${styles.panelChevron} ${styles.panelChevronClosed}` : styles.panelChevron} aria-hidden="true">
                <Icon name="chevron" />
              </span>
            </button>
            <Collapse open={!isCollapsed}>
              <ul className={styles.list}>
                {list.map((f) => (
                  <FeatureRow key={f.key} feature={f} action={actions.get(f.actionKey)} pools={pools.filter((p) => p.item === f.name)} {...rowProps} />
                ))}
              </ul>
            </Collapse>
          </section>
        );
      })}
    </div>
  );
}
