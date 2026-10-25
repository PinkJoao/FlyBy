// =============================================================================
// PortraitTagPicker: o seletor visual de tags da galeria de retratos sugeridos
// =============================================================================
// O QUE FAZ
//   Abre por cima da galeria (PortraitSuggestionsModal) ao tocar em "+ Tag".
//   Mostra as tags do catálogo por categoria (espécies, linhagens, classes,
//   subclasses, armadura, armas e focos): as visuais como cartões com um retrato
//   representante e a contagem; subclasses (agrupadas pela classe) e armas como
//   chips. Tocar liga ou desliga a tag na hora, e a galeria atrás já reflete.
//
// FUNÇÕES
//   PortraitTagPicker(props): o painel. requestClose anima a saída; goCategory
//     troca de categoria lembrando a direção (deslize e toque nas categorias).
//   matchesQuery(entry, q): a tag casa a busca (rótulo, id ou espécie/classe mãe).
//   TagTile(props): o cartão com retrato de uma tag visual.
//   ChipList(props): os chips das tags sem imagem.
//
// DECISÕES E ARMADILHAS
//   - Busca SEM foco automático: no celular o teclado cobriria os cartões, que são
//     o jeito principal de escolher (§6.4).
//   - A categoria filtra; com texto na busca, a categoria é ignorada e procura em
//     tudo, senão "elf" com "Classes" marcada não acharia nada.
//   - Os representantes vêm em 236px (`portraitTagGroups`), com `object-position`
//     no topo: o rosto fica no cartão pequeno.
//   - Gênero e idade NÃO aparecem: têm os interruptores próprios na galeria.
//   - Segue os padrões do app (DDL-0128): o voltar do celular e o Escape fecham
//     (useBackLayer), a saída anima como a dos diálogos (EXIT_MS, sem animação com
//     "reduzir movimento"), e arrastar a lista para o lado troca de categoria como
//     as abas da ficha (useSwipeNav), com a lista nova entrando do lado certo.
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react';
import { tagLabelOf } from '../../engine/portraitSuggestions';
import { useBackLayer } from '../../hooks/useBack';
import { useSwipeNav } from '../../hooks/useSwipeNav';
import { directionOf, reducedMotion, slideClass } from '../../motion';
import Icon from './Icon';
import styles from './PortraitTagPicker.module.css';

const EXIT_MS = 120;

/**
 * A tag casa a busca pelo rótulo, pelo id ou pela espécie/classe mãe.
 * @param {{ tag: string, label: string, parent: string|null }} entry
 * @param {string} q a busca em minúsculas
 */
function matchesQuery(entry, q) {
  if (!q) return true;
  return (
    entry.label.toLowerCase().includes(q) ||
    entry.tag.includes(q) ||
    (entry.parent ? tagLabelOf(entry.parent).toLowerCase().includes(q) : false)
  );
}

/**
 * Seletor visual de tags por categoria.
 * @param {{ groups: Array<object>, activeTags: string[], onToggle: (tag: string) => void, onClose: () => void }} props
 */
export default function PortraitTagPicker({ groups, activeTags, onToggle, onClose }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [dir, setDir] = useState(null);
  const [closing, setClosing] = useState(false);
  const bodyRef = useRef(null);
  const active = useMemo(() => new Set(activeTags), [activeTags]);
  const q = query.trim().toLowerCase();
  const catIds = ['all', ...groups.map((g) => g.id)];
  const catIndex = catIds.indexOf(category);

  const requestClose = () => {
    if (closing) return;
    if (reducedMotion()) {
      onClose();
      return;
    }
    setClosing(true);
    setTimeout(onClose, EXIT_MS);
  };
  useBackLayer(true, requestClose);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const goCategory = (id) => {
    const to = catIds.indexOf(id);
    if (to < 0 || id === category) return;
    setDir(directionOf(catIndex, to));
    setCategory(id);
    bodyRef.current?.scrollTo({ top: 0 });
  };

  useSwipeNav(bodyRef, {
    onPrev: () => goCategory(catIds[catIndex - 1]),
    onNext: () => goCategory(catIds[catIndex + 1]),
    canPrev: !q && catIndex > 0,
    canNext: !q && catIndex < catIds.length - 1,
  });

  const shown = useMemo(
    () =>
      groups
        .filter((g) => q || category === 'all' || g.id === category)
        .map((g) => ({ ...g, tags: g.tags.filter((t) => matchesQuery(t, q)) }))
        .filter((g) => g.tags.length > 0),
    [groups, q, category],
  );

  return (
    <div
      className={closing ? `${styles.picker} ${styles.closing}` : `${styles.picker} motion-rise`}
      role="dialog"
      aria-label="Add tags"
    >
      <div className={styles.head}>
        <h3 className={styles.title}>Add tags</h3>
        <button type="button" className={styles.doneBtn} onClick={requestClose}>
          Done
        </button>
      </div>

      <label className={styles.search}>
        <Icon name="search" />
        <input
          type="search"
          value={query}
          placeholder="Search species, classes, gear…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && query) {
              e.stopPropagation();
              setQuery('');
            }
          }}
        />
      </label>

      <div className={styles.cats} role="tablist" aria-label="Tag category">
        {[{ id: 'all', label: 'All', icon: 'sparkles' }, ...groups].map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={category === g.id}
            className={category === g.id ? `${styles.cat} ${styles.catOn}` : styles.cat}
            onClick={() => goCategory(g.id)}
          >
            <Icon name={g.icon} />
            <span>{g.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.body} ref={bodyRef}>
        <div key={q ? 'search' : category} className={slideClass(q ? null : dir)}>
          {shown.length === 0 && <p className={styles.empty}>No tags match &quot;{query}&quot;.</p>}
          {shown.map((g) => (
            <section key={g.id} className={styles.section}>
              <h4 className={styles.sectionTitle}>
                <Icon name={g.icon} />
                {g.label}
              </h4>
              {g.visual ? (
                <div className={styles.tiles}>
                  {g.tags.map((t) => (
                    <TagTile key={t.tag} entry={t} on={active.has(t.tag)} onToggle={onToggle} />
                  ))}
                </div>
              ) : g.id === 'subclass' ? (
                Object.entries(
                  g.tags.reduce((acc, t) => {
                    (acc[t.parent ?? 'other'] ??= []).push(t);
                    return acc;
                  }, {}),
                )
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([cls, list]) => (
                    <div key={cls} className={styles.subGroup}>
                      <span className={styles.subTitle}>{tagLabelOf(cls)}</span>
                      <ChipList entries={list} active={active} onToggle={onToggle} />
                    </div>
                  ))
              ) : (
                <ChipList entries={g.tags} active={active} onToggle={onToggle} />
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/** O cartão de uma tag visual: retrato representante, nome e contagem. */
function TagTile({ entry, on, onToggle }) {
  const [broken, setBroken] = useState(false);
  return (
    <button
      type="button"
      className={on ? `${styles.tile} ${styles.tileOn}` : styles.tile}
      aria-pressed={on}
      onClick={() => onToggle(entry.tag)}
    >
      <span className={styles.tileImg}>
        {entry.thumb && !broken ? (
          <img src={entry.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        ) : (
          <Icon name="portrait" />
        )}
        {on && (
          <span className={styles.tileCheck}>
            <Icon name="check" />
          </span>
        )}
      </span>
      <span className={styles.tileLabel}>{entry.label}</span>
      <span className={styles.tileCount}>{entry.count.toLocaleString('en-US')}</span>
    </button>
  );
}

/** Os chips das tags sem imagem (subclasses, armas e focos). */
function ChipList({ entries, active, onToggle }) {
  return (
    <div className={styles.chips}>
      {entries.map((t) => {
        const on = active.has(t.tag);
        return (
          <button
            key={t.tag}
            type="button"
            className={on ? `${styles.chip} ${styles.chipOn}` : styles.chip}
            aria-pressed={on}
            onClick={() => onToggle(t.tag)}
          >
            {on && <Icon name="check" />}
            <span>{t.label}</span>
            <span className={styles.chipCount}>{t.count.toLocaleString('en-US')}</span>
          </button>
        );
      })}
    </div>
  );
}
