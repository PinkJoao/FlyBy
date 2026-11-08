// =============================================================================
// FeaturesTab: as features do play mode, agrupadas por tipo
// =============================================================================
// O QUE FAZ
//   A aba "Features" do play mode (docs/PLAY-MODE-V2-PLAN.md §6, resposta P3,
//   DDL-0151), no desenho das abas Spells e Inventory: as sub-abas por tipo (Class,
//   Subclass, Species, Feats), a busca e as seções recolhíveis (a classe, a
//   subclasse, as invocações, a espécie, o talento de origem, os talentos). Cada
//   feature mostra o nível, os custos das suas activities e o pool com o que sobra;
//   o botão USA a feature (e pergunta qual activity quando há mais de uma). Tocar no
//   nome abre o texto dela.
//
// FUNÇÕES
//   costLabel(activation): o rótulo curto de um custo de activity.
//   Pips(props): o contador em bolinhas (até 12) ou em número.
//   showFeatureText(feature): o texto da feature num diálogo.
//   FeatureRow(props): uma linha.
//   FeaturesTab(props): a aba.
//
// DECISÕES E ARMADILHAS
//   - A pílula de custo tem a cor do gasto (econ.module.css, DDL-0163), a mesma da
//     aba Actions e dos botões de combate.
//   - Só USAR (definição do dono, DDL-0146): sem o ajuste à mão (menos e mais) dos pools.
//     O pool sem activity (o uso que só a prosa declara) ganha "Use", que gasta um;
//     o engano se desfaz no histórico.
//   - A ação com RECUPERAÇÃO ESPECIAL (Arcane Recovery, Natural Recovery, Font of
//     Magic, engine/playUse) troca o botão pelo "Choose": a escolha dos slots não
//     cabe numa activity.
//   - As ações básicas do XPHB não aparecem aqui: moram na aba Actions (DDL-0147).
//   - Um pool que nenhuma feature da lista reclama (não deveria haver) aparece numa
//     seção "Resources" no topo, para nunca sumir em silêncio.
//   - A sub-aba e as seções recolhidas são só desta tela.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { FEATURE_KINDS } from '../../engine/playFeatures';
import { remainingOf } from '../../engine/playState';
import { recoveryText } from '../../engine/playCatalog';
import { specialRecovery } from '../../engine/playUse';
import { ask } from '../common/dialog';
import useDialogStore from '../../store/dialogStore';
import EntryContent from '../common/EntryContent';
import Collapse from '../common/Collapse';
import Icon from '../common/Icon';
import Button from '../common/Button';
import styles from '../builder/SpellbookTab.module.css';
import play from './PlayTabs.module.css';
import econ from './econ.module.css';

const COST_LABELS = { action: 'Action', bonus: 'Bonus Action', reaction: 'Reaction', minute: 'Minute', hour: 'Hour', special: 'Special', legendary: 'Legendary' };

/** O rótulo curto de um custo de activity ("Bonus Action", "1 Minute"). */
function costLabel(activation) {
  const base = COST_LABELS[activation?.type] ?? activation?.type ?? '';
  if (['minute', 'hour'].includes(activation?.type)) return `${activation.value ?? 1} ${base}${(activation.value ?? 1) > 1 ? 's' : ''}`;
  return base;
}

/** O contador em bolinhas (até 12) ou em número. */
export function Pips({ left, max }) {
  if (max > 12) return <span className={play.count}>{left}/{max}</span>;
  return (
    <span className={play.pips} aria-label={`${left} of ${max} left`}>
      {Array.from({ length: max }, (_, i) => <span key={i} className={i < left ? `${play.pip} ${play.pipOn}` : play.pip} />)}
    </span>
  );
}

/** O texto da feature num diálogo, com o renderizador da ficha. */
function showFeatureText(feature) {
  useDialogStore.getState().open({
    variant: 'alert',
    title: feature.name,
    message: (
      <div style={{ whiteSpace: 'normal', textAlign: 'left' }}>
        {feature.entries.length ? <EntryContent entries={feature.entries} /> : <p>No description.</p>}
      </div>
    ),
    dismissable: true,
    showClose: true,
    actions: [],
    maxWidth: 560,
  });
}

/** Uma feature: nome, nível e custos; o pool e o botão de usar ao lado. */
function FeatureRow({ feature, action, pools, catalog, state, onUse, onSpecial, onAdjust }) {
  const activities = action?.activities ?? [];
  const special = action ? specialRecovery(action, catalog) : null;
  const costs = [...new Map(activities.filter((a) => costLabel(a.activation)).map((a) => [costLabel(a.activation), a.activation.type])).entries()];
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
  return (
    <li className={styles.row}>
      <button type="button" className={styles.rowHit} onClick={() => showFeatureText(feature)} title={`About ${feature.name}`}>
        <span className={styles.rowText}>
          <span className={styles.rowName}>{feature.name}</span>
          <span className={styles.rowSub}>
            {feature.level > 0 && <span className={styles.rowMetaLine}>Level {feature.level}</span>}
            {costs.map(([label, type]) => (
              <span key={label} className={[styles.chip, econ.tag, econ[type]].filter(Boolean).join(' ')}>{label}</span>
            ))}
            {recovery && <span className={styles.chip}>{recovery}</span>}
          </span>
        </span>
      </button>
      <div className={styles.rowSide}>
        {pools.map((p) => (
          <span key={p.key} title={p.name}>
            <Pips left={remainingOf(state, p.key, p.max)} max={p.max} />
          </span>
        ))}
        {activities.length > 0 && (
          <Button size="sm" variant="primary" onClick={use} title={`Use ${feature.name}`}>
            {special ? 'Choose' : 'Use'}
          </Button>
        )}
        {lone && (
          <Button size="sm" variant="primary" onClick={() => onAdjust(lone.key, 1)} disabled={loneLeft <= 0} title={`Spend one ${lone.name}`}>
            Use
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * A aba de features do jogo.
 * @param {{ catalog: object, state: object, onUse: Function, onSpecial: Function, onAdjust: Function }} props
 */
export default function FeaturesTab({ catalog, state, onUse, onSpecial, onAdjust }) {
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(() => new Set());
  const features = catalog.featureList ?? [];
  const pools = (catalog.resources ?? []).filter((r) => r.kind === 'pool');
  const actions = new Map((catalog.actions ?? []).map((a) => [a.key, a]));
  const claimed = new Set(features.map((f) => f.name));
  const orphans = pools.filter((p) => !claimed.has(p.item));
  const kinds = FEATURE_KINDS.filter((k) => features.some((f) => f.kind === k.id));
  const needle = query.trim().toLowerCase();
  const shown = features.filter((f) => (kind === 'all' || f.kind === kind) && (!needle || f.name.toLowerCase().includes(needle)));
  const sections = [...new Set(shown.map((f) => f.section))].map((s) => [s, shown.filter((f) => f.section === s)]);
  const toggle = (label) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  const rowProps = { catalog, state, onUse, onSpecial, onAdjust };

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
      </div>

      {orphans.length > 0 && kind === 'all' && !needle && (
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

      {shown.length === 0 && <p className={styles.empty}>No features match your search.</p>}

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
