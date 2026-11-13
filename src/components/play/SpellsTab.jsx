// =============================================================================
// SpellsTab: as magias do play mode, no desenho da aba da ficha
// =============================================================================
// O QUE FAZ
//   A aba "Spells" do play mode (docs/PLAY-MODE-V2-PLAN.md §6, DDL-0148): o mesmo
//   desenho da aba Spellbook da ficha (o CSS dela, a linha SpellRow, as sub-abas por
//   origem, a busca, os círculos e as seções recolhíveis), mas só para USAR: cada
//   magia preparada tem o "Cast", e o cabeçalho de cada círculo mostra os espaços que
//   servem para ele (o do círculo e o pacto, slotPoolsFor) com o que sobra. Tocar na
//   linha abre o detalhe da magia. "Show unprepared spells" traz o resto do
//   grimório, só para consulta.
//
// FUNÇÕES
//   rawIndex(origin): as magias cruas da origem derivada, pelo nome.
//   PoolChip(props): um espaço no cabeçalho do círculo, em gemas (o que sobra e o máximo).
//   SpellsTab(props): a aba.
//
// DECISÕES E ARMADILHAS
//   - Sem preparar, sem trocar, sem quantidade (definição do dono, DDL-0146): isso é
//     da ficha. O gasto é o "Cast"; o ajuste à mão é só o do mestre (abaixo).
//   - A magia vem do catálogo de jogo (o que lança e o que gasta) e a parte "de
//     livro" (arte, escola, tempo, alcance) da origem derivada, pelo nome: a linha é
//     a SpellRow da ficha, que lê o `raw`.
//   - Cada magia leva as etiquetas dos gastos com que pode ser lançada, na cor do
//     gasto (spellCosts, a Tag no tom do gasto, DDL-0165, DDL-0199): o tempo dela e os das features
//     (Quickened Spell, Mantle of Majesty...). A mesma magia pode ter duas.
//   - Os espaços são MARCADORES (gemas, as `Pips` da aba Features com `shape="gem"`,
//     DDL-0201): a gema cheia é o que sobra; o pacto leva o rótulo e o tom accent.
//   - Tocar nas gemas abre o ajuste à mão (DDL-0202, `onResource`). Por isso o cabeçalho
//     do círculo é um div que recolhe ao toque, com o título como botão (teclado e
//     `aria-expanded`): um botão dentro de outro não vale. A gema para a propagação.
//   - Mystic Arcanum e magia concedida com usos mostram os usos que sobram na linha;
//     o arcanum não é espaço e não aparece no cabeçalho.
//   - A origem e o círculo escolhidos e as seções recolhidas são só desta tela.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { slotPoolsFor } from '../../engine/playCast';
import { spellCosts } from '../../engine/playBasicActions';
import { remainingOf } from '../../engine/playState';
import { spellLevelLabel } from '../../engine/spells';
import spellEntity from '../../selector/entities/spell';
import { imgUrl } from '../common/media';
import { showDetailPopup } from '../common/detailPopup';
import Collapse from '../common/Collapse';
import Icon from '../common/Icon';
import { SpellRow } from '../builder/SpellbookTab';
import styles from '../builder/SpellbookTab.module.css';
import Toggle from '../common/Toggle';
import play from './PlayTabs.module.css';
import { Pips } from './FeaturesTab';

/** As magias cruas da origem derivada, pelo nome (com granted e castType). */
function rawIndex(origin) {
  const out = new Map();
  for (const s of [...(origin?.cantrips ?? []), ...(origin?.prepared ?? []), ...(origin?.unprepared ?? []), ...(origin?.arcanumSpells ?? [])]) if (s.raw) out.set(s.raw.name, { ...s, granted: false });
  for (const s of origin?.alwaysPrepared ?? []) if (s.raw) out.set(s.raw.name, s);
  return out;
}

/** Um espaço no cabeçalho do círculo: as gemas do que sobra; o pacto com o rótulo e o tom dele. */
function PoolChip({ pool, onResource }) {
  const pact = pool.kind === 'pact';
  const cls = [styles.slot, play.slotBtn, pact && styles.slotPact, pool.left > 0 ? null : styles.slotEmpty].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={cls}
      disabled={!onResource}
      onClick={(e) => {
        e.stopPropagation();
        onResource?.(pool);
      }}
      title={`${pool.label}: ${pool.left} of ${pool.max} left. Tap to change by hand`}
    >
      {pact && <span className={styles.slotLevel}>Pact {pool.level}</span>}
      <Pips left={pool.left} max={pool.max} shape="gem" />
    </button>
  );
}

/**
 * A aba de magias do jogo.
 * @param {{ catalog: object, state: object, derived: object, db: object, onCast: Function }} props
 */
export default function SpellsTab({ catalog, state, derived, db, onCast, onResource }) {
  const origins = (catalog.spells ?? []).filter((o) => o.spells.length);
  const [originKey, setOriginKey] = useState(origins[0]?.key ?? null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const origin = origins.find((o) => o.key === originKey) ?? origins[0];
  const raws = rawIndex((derived?.spellcasting?.origins ?? []).find((o) => o.key === origin?.key));

  if (!origin) return <p className={styles.empty}>This character has no spells.</p>;

  const needle = query.trim().toLowerCase();
  const visible = origin.spells
    .filter((s) => (showAll || s.prepared !== false) && raws.has(s.name))
    .filter((s) => !needle || s.name.toLowerCase().includes(needle))
    .filter((s) => category === 'all' || s.level === category)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  const levels = [...new Set(origin.spells.filter((s) => showAll || s.prepared !== false).map((s) => s.level))].sort((a, b) => a - b);
  const sections = levels.filter((lv) => category === 'all' || lv === category).map((lv) => [lv, visible.filter((s) => s.level === lv)]).filter(([, list]) => list.length);
  const toggle = (lv) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(lv)) next.delete(lv);
      else next.add(lv);
      return next;
    });
  const stats = [
    origin.saveDc != null ? { key: 'dc', label: 'Save DC', value: origin.saveDc } : null,
    origin.attackBonus != null ? { key: 'atk', label: 'Attack', value: `${origin.attackBonus >= 0 ? '+' : ''}${origin.attackBonus}` } : null,
  ].filter(Boolean);

  return (
    <div className={styles.tab}>
      {stats.length > 0 && (
        <div className={styles.header}>
          <div className={styles.card}>
            <span className={styles.cardLabel}>{origin.label}</span>
            <div className={styles.stats}>
              {stats.map((s, i) => (
                <span key={s.key} className={styles.statCell}>
                  {i > 0 && <span className={styles.statDivider} role="presentation" />}
                  <span className={styles.stat}>
                    <span className={styles.statValue}>{s.value}</span>
                    <span className={styles.statLabel}>{s.label}</span>
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {origins.length > 1 && (
        <nav className={styles.subTabs} data-wheel-x="">
          {origins.map((o) => (
            <button key={o.key} type="button" className={o.key === origin.key ? `${styles.subTab} ${styles.subTabActive}` : styles.subTab} onClick={() => setOriginKey(o.key)}>
              {o.label}
            </button>
          ))}
        </nav>
      )}

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <input type="search" className={styles.search} placeholder="Search spells…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <nav className={styles.categories} data-wheel-x="">
        <button type="button" className={category === 'all' ? `${styles.category} ${styles.categoryActive}` : styles.category} onClick={() => setCategory('all')}>
          All
        </button>
        {levels.map((lv) => (
          <button key={lv} type="button" className={category === lv ? `${styles.category} ${styles.categoryActive}` : styles.category} onClick={() => setCategory(lv)}>
            {spellLevelLabel(lv)}
          </button>
        ))}
      </nav>

      {sections.length === 0 && <p className={styles.empty}>{needle ? 'No spells match your search.' : 'No prepared spells here.'}</p>}

      {sections.map(([lv, list]) => {
        const pools = slotPoolsFor(catalog, state, lv);
        const isCollapsed = collapsed.has(lv);
        return (
          <section key={lv} className={styles.panel}>
            <div className={styles.panelHead} onClick={() => toggle(lv)}>
              <button type="button" className={play.headToggle} aria-expanded={!isCollapsed}>
                <span className={styles.panelTitle}>{spellLevelLabel(lv)}</span>
              </button>
              {pools.length > 0 && (
                <span className={styles.slots}>
                  {pools.map((p) => (
                    <PoolChip key={p.key} pool={p} onResource={onResource} />
                  ))}
                </span>
              )}
              <span className={styles.panelCount}>{list.length}</span>
              <span className={isCollapsed ? `${styles.panelChevron} ${styles.panelChevronClosed}` : styles.panelChevron} aria-hidden="true">
                <Icon name="chevron" />
              </span>
            </div>
            <Collapse open={!isCollapsed}>
              <ul className={styles.list}>
                {list.map((s) => {
                  const entry = { ...raws.get(s.name), prepared: s.prepared };
                  const uses = s.uses ? (catalog.resources ?? []).find((r) => r.key === s.uses) : null;
                  return (
                    <SpellRow
                      key={s.key}
                      entry={entry}
                      arcanum={!!s.arcanum}
                      thumb={imgUrl(spellEntity.fluff(entry.raw, db)?.images?.[0]?.href)}
                      onInfo={() => showDetailPopup({ entity: spellEntity, raw: entry.raw, db })}
                      onCast={() => onCast(origin, s)}
                      castDisabled={s.prepared === false}
                      usesLeft={uses ? `${remainingOf(state, uses.key, uses.max)}/${uses.max}` : null}
                      costTags={spellCosts(s, catalog).map((c) => ({
                        key: `${c.cost}|${c.source ?? ''}`,
                        label: c.label,
                        tone: c.cost,
                        title: c.source ? `${c.label} with ${c.source}${c.spend ? ` (${c.spend.amount} ${c.spend.name})` : ''}` : `Cast as ${c.label}`,
                      }))}
                    />
                  );
                })}
              </ul>
            </Collapse>
          </section>
        );
      })}

      <Toggle className={play.toggle} checked={showAll} onChange={setShowAll} label="Show unprepared spells" />
    </div>
  );
}
