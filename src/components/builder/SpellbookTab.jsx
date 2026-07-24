// =============================================================================
// SpellbookTab - magias do personagem (Fases B2.3 + B2.4)
// =============================================================================
// Deliberadamente espelha o InventoryTab, e a ORDEM da página segue a mesma
// filosofia do resto do app: cards de estado no topo → sub-abas de ORIGEM
// (classe conjuradora / racial / talento - R1/R2) → busca (+ "Prepare spell")
// → CATEGORIAS por círculo (R3/R4) → Group/Sort (R5). Cada linha abre o overlay
// de detalhes (DetailView + "Using a Higher-Level Spell Slot").
//
// Cards de estado: slots de magia / slots de pacto para origens de classe e,
// para origens SEM slots (raça, talento) ou com magias inatas, um card de USOS
// por dia/descanso (genérico: qualquer magia concedida com `castType`). Mais o
// DC/ataque da origem e os contadores de cantrips/preparadas (R7/R8).
//
// Magias CONCEDIDAS (subclasse/linhagem/talento) vêm marcadas "Always Prepared",
// não são removíveis e NÃO contam nos limites (R12).
//
// Preparar (R9–R11): o botão abre o SelectorPanel direto (padrão do EquipmentShop)
// com os filtros de **Class** E **Level** já marcados na classe da origem e nos
// círculos onde ainda cabe magia - filtros comuns, que o usuário pode desmarcar
// (mestre liberou outra lista, outro círculo…), como já fazemos com itens/feats.
// O `exclude` só esconde o que JÁ está preparado; tudo que foge do padrão
// (fora da lista da classe, acima dos círculos, ou além do limite) pede
// confirmação ao adicionar (R10). O botão desabilita quando não há mais onde
// encaixar magia alguma (R11).
//
// WARLOCK: a Pact Magic trava no 5º círculo, e do nível 11 em diante o Mystic
// Arcanum dá uma magia de 6º–9º círculo, 1×/descanso longo cada. Essas magias não
// contam contra as preparadas e só podem ocupar um arcanum livre do seu círculo.
// -----------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import DetailView from '../common/DetailView';
import SelectorPanel from '../../selector/SelectorPanel';
import { confirm } from '../common/dialog';
import { imgUrl } from '../common/media';
import spellEntity, { makeSpellEntity } from '../../selector/entities/spell';
import { castTypeLabel } from '../../engine/grantedSpells';
import { preparedElsewhere } from '../../engine/spellcasting';
import {
  classSpellList,
  schoolName,
  spellLevelLabel,
  castingTimeLabel,
  castingTimeRank,
  rangeLabel,
  rangeRank,
  saveOrAttack,
  isRitual,
  isConcentration,
} from '../../engine/spells';
import styles from './SpellbookTab.module.css';

/** Ícone da sub-aba por tipo de origem. */
const ORIGIN_ICONS = { class: '📖', race: '🧬', feat: '⭐' };

/** Glyph de fallback do thumbnail, por escola. */
const SCHOOL_GLYPHS = {
  A: '🛡️', C: '🌀', D: '🔎', E: '💫', V: '🔥', I: '🎭', N: '💀', T: '🔄', P: '🧠',
};

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'level', label: 'Level' },
  { value: 'time', label: 'Casting Time' },
  { value: 'range', label: 'Range' },
];

const GROUP_BY_OPTIONS = [
  { value: 'level', label: 'Level' },
  { value: 'school', label: 'School' },
  { value: 'saveAttack', label: 'Save / Attack' },
  { value: 'time', label: 'Casting Time' },
  { value: 'none', label: 'None' },
];

const ABILITY_LABEL = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

const ORDINAL_SHORT = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

function signed(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Todas as magias da origem, com a flag `granted` (sempre preparadas). As de
 * arcanum ficam FORA dos contadores, mas são listadas como qualquer outra. */
function spellsOf(origin) {
  return [
    ...origin.cantrips.map((s) => ({ ...s, granted: false })),
    ...origin.prepared.map((s) => ({ ...s, granted: false })),
    ...(origin.arcanumSpells ?? []).map((s) => ({ ...s, granted: false })),
    ...origin.alwaysPrepared,
  ].filter((s) => s.raw);
}

/** Chave da SEÇÃO de uma magia no agrupamento ativo. */
function sectionOf(entry, groupBy) {
  const raw = entry.raw;
  switch (groupBy) {
    case 'level':
      return spellLevelLabel(raw.level);
    case 'school':
      return schoolName(raw.school);
    case 'time':
      return castingTimeLabel(raw) || 'Other';
    case 'saveAttack': {
      const sa = saveOrAttack(raw);
      if (sa.kind === 'attack') return `${sa.detail} Attack`;
      if (sa.kind === 'save') return `${sa.detail} Save`;
      return 'No Roll';
    }
    default:
      return null;
  }
}

/** Rank da seção (ordem das seções entre si). */
function sectionRank(entry, groupBy) {
  const raw = entry.raw;
  if (groupBy === 'level') return raw.level;
  if (groupBy === 'time') return castingTimeRank(raw);
  return 0; // school / saveAttack: alfabético pelo próprio rótulo
}

// Agrupamentos SEM ordem natural (nível/tempo têm rank) → seções alfabéticas.
const ALPHA_SECTIONS = new Set(['school', 'saveAttack']);

/** Agrupa uma lista JÁ ordenada. As seções saem na ordem do `sectionRank`
 * (nível, tempo de conjuração) ou em ordem alfabética (escola, save/ataque). */
function groupRows(list, groupBy) {
  if (groupBy === 'none') return [[null, list]];
  const order = [];
  const map = new Map();
  for (const entry of list) {
    const key = sectionOf(entry, groupBy) || 'Other';
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key).push(entry);
  }
  if (ALPHA_SECTIONS.has(groupBy)) order.sort((a, b) => a.localeCompare(b));
  return order.map((key) => [key, map.get(key)]);
}

export default function SpellbookTab({ character, db, derived, onChangeSpells }) {
  const origins = derived.spellcasting?.origins ?? [];
  const [originKey, setOriginKey] = useState(null);
  const [category, setCategory] = useState('all'); // 'all' | número do círculo
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [groupBy, setGroupBy] = useState('level');
  const [infoKey, setInfoKey] = useState(null);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [prepareOpen, setPrepareOpen] = useState(false);
  // Magia que está sendo TROCADA (botão "Change"): o seletor abre no lugar dela e
  // a substituição é ATÔMICA (remove + prepara num só update). Cancelar o painel
  // mantém a original - por isso não removemos antes de escolher a substituta.
  const [replacing, setReplacing] = useState(null);

  // A origem escolhida pode sumir (troca de classe/espécie) → cai na primeira.
  const origin = origins.find((o) => o.key === originKey) ?? origins[0];

  // Ambos varrem o mapa reverso inteiro - memoiza (hooks antes de qualquer
  // return; sem origem, `spellListClass` é undefined).
  const listClass = origin?.spellListClass ?? null;
  // TC-0043: a lista da classe + o que a subclasse/prosa ALARGA (Expanded Spell
  // List dos patronos, Divine Soul, Magical Secrets @10). Tudo isso conta como
  // "on-list": nem aviso de fora-da-lista, nem sumir do filtro de Classe.
  const expandedSpells = origin?.expandedSpells ?? null;
  const listNames = useMemo(() => {
    const base = listClass ? classSpellList(db, listClass) : new Set();
    if (!expandedSpells?.size) return base;
    return new Set([...base, ...expandedSpells]);
  }, [db, listClass, expandedSpells]);
  // TC-0031: magias já conhecidas nas OUTRAS origens - viram badge + filtro
  // "Already Prepared" (pré-marcado como exclude, desmarcável) e confirmação.
  const elsewhere = useMemo(() => preparedElsewhere(derived.spellcasting?.origins, origin?.key), [derived, origin]);
  const pickerEntity = useMemo(
    () =>
      makeSpellEntity(db, {
        preparedElsewhere: elsewhere,
        // As alargadas passam a valer pelo filtro de Classe da origem (é o que o
        // RAW diz: "count as Warlock/Bard spells for you"), com badge da fonte.
        addedToList: origin?.expandedFrom ?? null,
        addedListClass: listClass,
      }),
    [db, elsewhere, origin, listClass],
  );

  if (origins.length === 0) {
    return (
      <div className={styles.tab}>
        <p className={styles.empty}>
          This character has no spellcasting. Pick a caster class, a lineage or a feat that grants spells.
        </p>
      </div>
    );
  }

  const selectOrigin = (key) => {
    setOriginKey(key);
    setCategory('all');
    setGroupBy('level');
    setInfoKey(null);
  };

  const selectCategory = (cat) => {
    setCategory(cat);
    // "All" agrupa por nível (R4); dentro de um círculo, agrupar por nível seria
    // uma seção só - cai pra "sem agrupamento".
    setGroupBy(cat === 'all' ? 'level' : 'none');
  };

  const all = spellsOf(origin);
  const infoEntry = infoKey ? all.find((s) => s.raw.name === infoKey) : null;

  // Círculos presentes nesta origem → chips de categoria (R3).
  const levels = [...new Set(all.map((s) => s.raw.level))].sort((a, b) => a - b);

  let visible = category === 'all' ? all : all.filter((s) => s.raw.level === category);
  const q = query.trim().toLowerCase();
  if (q) visible = visible.filter((s) => s.raw.name.toLowerCase().includes(q));

  const sorted = [...visible].sort((a, b) => {
    const s = sectionRank(a, groupBy) - sectionRank(b, groupBy);
    if (s !== 0) return s;
    if (sortBy === 'level') {
      const l = a.raw.level - b.raw.level;
      if (l !== 0) return l;
    } else if (sortBy === 'time') {
      const t = castingTimeRank(a.raw) - castingTimeRank(b.raw);
      if (t !== 0) return t;
    } else if (sortBy === 'range') {
      const r = rangeRank(a.raw) - rangeRank(b.raw);
      if (r !== 0) return r;
    }
    return a.raw.name.localeCompare(b.raw.name);
  });

  const rows = groupRows(sorted, groupBy);

  const sectionKey = (label) => `${origin.key}|${category}|${groupBy}|${label}`;
  const toggleSection = (label) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      const key = sectionKey(label);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Contadores (R8/R12): só o que o JOGADOR escolheu conta contra os limites.
  const cantripCount = origin.cantrips.length;
  const preparedCount = origin.prepared.length;
  const cantripsFull = cantripCount >= origin.cantripLimit;
  const preparedFull = preparedCount >= origin.prepareLimit;
  // Arcanum (Warlock): círculos destravados que ainda não têm magia escolhida.
  const arcana = origin.arcana ?? [];
  const freeArcanumLevels = new Set(arcana.filter((a) => !a.spell).map((a) => a.level));
  // Só origens de CLASSE preparam; racial/talento é tudo concedido.
  const canPrepare = origin.kind === 'class' && (origin.cantripLimit > 0 || origin.prepareLimit > 0);
  // R11: desabilita quando não há mais ONDE encaixar magia nenhuma - cantrips,
  // preparadas e arcanum todos cheios.
  const prepareDisabled = cantripsFull && preparedFull && freeArcanumLevels.size === 0;

  // Numa TROCA o balde da magia trocada conta como livre (ela vai sair no mesmo
  // update), senão o seletor abriria filtrado como se não houvesse espaço e o
  // addSpell avisaria "sem espaço" à toa. Sem troca, tudo igual aos originais.
  const replRaw = replacing?.raw ?? null;
  const replIsCantrip = replRaw?.level === 0;
  const replIsArcanum = !!replRaw && replRaw.level > origin.maxPrepareLevel;
  const replIsPrepared = !!replRaw && !replIsCantrip && !replIsArcanum;
  const freeCantripsFull = cantripCount - (replIsCantrip ? 1 : 0) >= origin.cantripLimit;
  const freePreparedFull = preparedCount - (replIsPrepared ? 1 : 0) >= origin.prepareLimit;
  const freeArcanumForPick = replIsArcanum ? new Set([...freeArcanumLevels, replRaw.level]) : freeArcanumLevels;

  const uses = origin.uses ?? [];

  // UM card de recursos: slots (ou pacto) + arcanum + usos por dia/descanso.
  // Antes eram até três cards; juntos ocupam uma linha só.
  const resourceChips = Object.entries(origin.slots ?? {}).map(([lvl, n]) => ({
    key: `slot-${lvl}`,
    label: ORDINAL_SHORT[Number(lvl)] ?? `${lvl}th`,
    value: `×${n}`,
  }));
  if (origin.pactSlots) {
    resourceChips.push({
      key: 'pact',
      label: `Pact (${ORDINAL_SHORT[origin.pactSlots.level] ?? origin.pactSlots.level})`,
      value: `×${origin.pactSlots.slots}`,
      tone: 'pact',
    });
  }
  for (const a of arcana) {
    resourceChips.push({
      key: `arc-${a.level}`,
      label: ORDINAL_SHORT[a.level],
      value: '1/Long Rest',
      tone: a.spell ? 'arcanum' : 'empty',
      title: a.spell ? `Mystic Arcanum: ${a.spell.raw.name}` : 'Mystic Arcanum: no spell chosen yet',
    });
  }
  for (const u of uses) {
    resourceChips.push({
      key: `use-${u.name}`,
      label: u.name,
      value: u.label,
      // "3/Day" vindo de um modificador: o tooltip diz DE ONDE veio o número.
      // "No Spell Slot": o dado não registra a frequência (ver DDL-0011).
      title: u.note
        ? `${u.name}: ${u.label} (${u.note})`
        : u.label === 'No Spell Slot'
          ? `${u.name}: cast without expending a spell slot. See the feature text for how often.`
          : undefined,
    });
  }
  const resourceLabel = Object.keys(origin.slots ?? {}).length || origin.pactSlots ? 'Spell Slots' : 'Uses';

  // UM card de números: DC, ataque e os contadores.
  const stats = [];
  if (origin.ability) {
    stats.push({ key: 'dc', value: origin.saveDc, label: 'Save DC' });
    stats.push({ key: 'atk', value: signed(origin.attackBonus), label: 'Attack' });
  }
  // Limite 0 com picks órfãos (a classe deixou de conjurar, p.ex. trocando de
  // Eldritch Knight para outra subclasse) ainda mostra o contador - em vermelho,
  // como qualquer over-limit (a liberdade DDL-0026 sinalizada, nunca escondida).
  if (origin.cantripLimit > 0 || cantripCount > 0) {
    stats.push({
      key: 'cantrips',
      value: `${cantripCount}/${origin.cantripLimit}`,
      label: 'Cantrips',
      over: cantripCount > origin.cantripLimit,
    });
  }
  if (origin.prepareLimit > 0 || preparedCount > 0) {
    stats.push({
      key: 'prepared',
      value: `${preparedCount}/${origin.prepareLimit}`,
      label: 'Prepared',
      over: preparedCount > origin.prepareLimit,
    });
  }
  if (arcana.length > 0) {
    stats.push({
      key: 'arcana',
      value: `${arcana.length - freeArcanumLevels.size}/${arcana.length}`,
      label: 'Arcanum',
    });
  }

  // --- Preparar / remover (só origens de classe) -----------------------------
  const classEntry = origin.uid ? character.classes.find((c) => c.uid === origin.uid) : null;
  // Nomes já nesta origem (preparadas + concedidas) - não se prepara duas vezes.
  const ownedNames = new Set(all.map((s) => s.raw.name.toLowerCase()));
  const inClassList = (raw) => listNames.has(raw.name.toLowerCase());

  const setSpells = (spells) => onChangeSpells?.(origin.uid, spells);

  const addSpell = async (raw) => {
    if (!classEntry) return;
    // O seletor não ESCONDE mais o que foge do padrão (só filtros desmarcáveis)
    // - então tudo que foge é confirmado aqui, num único diálogo (R10):
    // fora da lista da classe, sem espaço no balde, ou acima dos círculos.
    const warnings = [];
    if (!inClassList(raw)) {
      warnings.push(`${raw.name} is not on the ${origin.spellListClass} spell list.`);
    }
    // TC-0031: já tem a magia por outra origem - legal (multiclasse pode querer
    // nas duas, por atributo), mas avisa de onde ela já vem.
    const from = elsewhere.get(raw.name.toLowerCase());
    if (from) {
      warnings.push(`You already have ${raw.name} from ${from}.`);
    }
    if (raw.level === 0) {
      if (freeCantripsFull) warnings.push(`You have no free cantrip slots (${cantripCount}/${origin.cantripLimit}).`);
    } else if (raw.level > origin.maxPrepareLevel) {
      if (!freeArcanumForPick.has(raw.level)) {
        warnings.push(`You have no spell slots (or free Mystic Arcanum) of the ${spellLevelLabel(raw.level).toLowerCase()}.`);
      }
    } else if (freePreparedFull) {
      warnings.push(`You have no free prepared-spell slots (${preparedCount}/${origin.prepareLimit}).`);
    }
    if (warnings.length > 0) {
      const ok = await confirm({
        title: replacing ? 'Prepare this spell instead?' : 'Prepare this spell?',
        message: `${warnings.join(' ')} Prepare it anyway?`,
        confirmLabel: 'Prepare anyway',
      });
      if (!ok) return;
    }
    // Numa troca, sai a antiga e entra a nova no MESMO update (atômico): se o
    // jogador fechar o painel sem escolher, ele não perde a magia original.
    const base = (classEntry.spells ?? []).filter(
      (s) => !replacing || String(s.id ?? s.name).toLowerCase() !== replacing.raw.name.toLowerCase(),
    );
    setSpells([...base, { id: raw.name, source: raw.source }]);
    closePicker();
  };

  /** Fecha o seletor e encerra qualquer troca em andamento. */
  const closePicker = () => {
    setPrepareOpen(false);
    setReplacing(null);
  };

  /** "Change": abre o seletor para escolher a substituta desta magia. */
  const startReplace = (entry) => {
    if (!classEntry || entry.granted) return;
    setReplacing(entry);
    setInfoKey(null);
    setPrepareOpen(true);
  };

  const removeSpell = (entry) => {
    if (!classEntry || entry.granted) return;
    const name = entry.raw.name.toLowerCase();
    setSpells((classEntry.spells ?? []).filter((s) => String(s.id ?? s.name).toLowerCase() !== name));
    setInfoKey(null);
  };

  // O seletor só esconde o que JÁ está nesta origem (dedup). O recorte por
  // círculo virou FILTRO pré-marcado (abaixo) - desmarcável, para o jogador com
  // permissão do mestre; o que não cabe pede confirmação no addSpell.
  const excludeFromPicker = (raw) => ownedNames.has(raw.name.toLowerCase());

  // Círculos pré-marcados no filtro de Level: os baldes onde AINDA cabe magia
  // (a mesma visão que o exclude antigo impunha, agora como filtro comum).
  const pickerLevels = [];
  if (origin.cantripLimit > 0 && !freeCantripsFull) pickerLevels.push('Cantrip');
  if (origin.prepareLimit > 0 && !freePreparedFull) {
    for (let l = 1; l <= origin.maxPrepareLevel; l++) pickerLevels.push(String(l));
  }
  for (const l of freeArcanumForPick) pickerLevels.push(String(l));
  const pickerFilterState = {
    class: { [origin.spellListClass]: 'include' },
    level: Object.fromEntries(pickerLevels.map((v) => [v, 'include'])),
    // TC-0031: esconde por padrão o que já vem de outra origem (desmarcável).
    ...(elsewhere.size > 0 ? { owned: { yes: 'exclude' } } : {}),
  };

  return (
    <div className={styles.tab}>
      {/* Dois cards, um por linha de informação: RECURSOS (slots/pacto/arcanum/
          usos) e NÚMEROS (DC, ataque, contadores). Ambos crescem p/ preencher a
          largura no desktop; no mobile cada um é uma faixa compacta. */}
      <div className={styles.header}>
        {resourceChips.length > 0 && (
          <div className={styles.card}>
            <span className={styles.cardLabel}>{resourceLabel}</span>
            <div className={styles.slots}>
              {resourceChips.map((c) => (
                <span
                  key={c.key}
                  className={c.tone ? `${styles.slot} ${styles[`slot${cap(c.tone)}`]}` : styles.slot}
                  title={c.title}
                >
                  <span className={styles.slotLevel}>{c.label}</span>
                  <span className={styles.slotCount}>{c.value}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {stats.length > 0 && (
          <div className={styles.card}>
            <span className={styles.cardLabel}>{ABILITY_LABEL[origin.ability] ?? 'Spells'}</span>
            <div className={styles.stats}>
              {stats.map((s, i) => (
                <span key={s.key} className={styles.statCell}>
                  {i > 0 && <span className={styles.statDivider} role="presentation" />}
                  <span className={styles.stat}>
                    <span className={s.over ? `${styles.statValue} ${styles.statOver}` : styles.statValue}>
                      {s.value}
                    </span>
                    <span className={styles.statLabel}>{s.label}</span>
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sub-abas por ORIGEM (R1), abaixo dos cards: classes + racial + talentos. */}
      <nav className={styles.subTabs}>
        {origins.map((o) => (
          <button
            key={o.key}
            type="button"
            className={o.key === origin.key ? `${styles.subTab} ${styles.subTabActive}` : styles.subTab}
            onClick={() => selectOrigin(o.key)}
          >
            <span className={styles.subTabIcon} aria-hidden="true">{ORIGIN_ICONS[o.kind]}</span>
            {o.label}
          </button>
        ))}
      </nav>

      {/* Busca + "Prepare spell" numa linha (mesmo padrão de busca + Shop). */}
      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <input
            type="search"
            className={styles.search}
            placeholder="Search spells…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {canPrepare && (
          <button
            type="button"
            className={styles.prepareBtn}
            onClick={() => setPrepareOpen(true)}
            disabled={prepareDisabled}
            title={prepareDisabled ? 'Remove a spell to prepare another one.' : undefined}
          >
            + Prepare spell
          </button>
        )}
      </div>

      {/* Categorias por círculo (R3) + "All" (R4), logo abaixo da busca. */}
      <nav className={styles.categories}>
        <button
          type="button"
          className={category === 'all' ? `${styles.category} ${styles.categoryActive}` : styles.category}
          onClick={() => selectCategory('all')}
        >
          All
        </button>
        {levels.map((lvl) => (
          <button
            key={lvl}
            type="button"
            className={category === lvl ? `${styles.category} ${styles.categoryActive}` : styles.category}
            onClick={() => selectCategory(lvl)}
          >
            {spellLevelLabel(lvl)}
          </button>
        ))}
      </nav>

      <div className={styles.filters}>
        <label className={styles.select}>
          <span className={styles.selectLabel}>Group</span>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            {GROUP_BY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className={styles.select}>
          <span className={styles.selectLabel}>Sort</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      {all.length === 0 ? (
        <p className={styles.empty}>No spells yet.</p>
      ) : sorted.length === 0 ? (
        <p className={styles.empty}>No spells match your search.</p>
      ) : (
        rows.map(([label, list]) => {
          const isCollapsed = label != null && collapsed.has(sectionKey(label));
          return (
            <section key={label ?? 'flat'} className={styles.panel}>
              {label && (
                <button
                  type="button"
                  className={styles.panelHead}
                  onClick={() => toggleSection(label)}
                  aria-expanded={!isCollapsed}
                >
                  <span className={styles.panelTitle}>{label}</span>
                  <span className={styles.panelCount}>{list.length}</span>
                  <span
                    className={isCollapsed ? `${styles.panelChevron} ${styles.panelChevronClosed}` : styles.panelChevron}
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </button>
              )}
              {!isCollapsed && (
                <ul className={styles.list}>
                  {list.map((entry) => (
                    <SpellRow
                      key={`${origin.key}|${entry.raw.name}|${entry.castMode ?? 'pick'}`}
                      entry={entry}
                      arcanum={!entry.granted && (origin.arcanumLevels ?? []).includes(entry.raw.level)}
                      thumb={imgUrl(spellEntity.fluff(entry.raw, db)?.images?.[0]?.href)}
                      onInfo={() => setInfoKey(entry.raw.name)}
                      onReplace={classEntry && !entry.granted ? () => startReplace(entry) : null}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}

      {infoEntry && (
        <div className={styles.infoOverlay} onClick={() => setInfoKey(null)}>
          <div className={styles.infoPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.infoHead}>
              <button type="button" className={styles.infoClose} onClick={() => setInfoKey(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className={styles.infoScroll}>
              <DetailView entity={spellEntity} raw={infoEntry.raw} db={db} capImage />
            </div>
            {infoEntry.granted ? (
              <div className={styles.infoFooter}>
                <span className={styles.grantedChip}>Always Prepared</span>
                <span className={styles.infoNote}>
                  Granted by {origin.label}. It does not count against your prepared spells.
                </span>
              </div>
            ) : (
              classEntry && (
                <div className={styles.infoFooter}>
                  <span className={styles.infoNote}>Prepared for {origin.label}.</span>
                  {/* Change: troca por outra magia direto (o seletor abre no
                      lugar desta); Remove só libera o espaço. */}
                  <button type="button" className={styles.changeBtn} onClick={() => startReplace(infoEntry)}>
                    Change
                  </button>
                  <button type="button" className={styles.removeBtn} onClick={() => removeSpell(infoEntry)}>
                    Remove
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Preparar (R9): SelectorPanel direto, com os filtros de Class e Level já
          marcados na classe da origem e nos círculos com espaço - desmarcáveis,
          e outras classes/círculos disponíveis mediante confirmação (R10). */}
      {prepareOpen && (
        <SelectorPanel
          entity={pickerEntity}
          db={db}
          currentId={null}
          exclude={excludeFromPicker}
          initialFilterState={pickerFilterState}
          heading={replacing ? `Replace ${replacing.raw.name}` : undefined}
          hint={replacing ? 'The spell you pick takes its place. Close to keep the current one.' : undefined}
          onSelect={addSpell}
          onClose={closePicker}
        />
      )}
    </div>
  );
}

/** Thumbnail da magia: arte do fluff quando existe, senão o glyph da escola. */
function SpellThumb({ src, school, alt }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return <img className={styles.thumb} src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} />;
  }
  return (
    <span className={styles.thumbGlyph} aria-hidden="true">
      {SCHOOL_GLYPHS[school] ?? '✨'}
    </span>
  );
}

function SpellRow({ entry, arcanum, thumb, onInfo, onReplace }) {
  const raw = entry.raw;
  const meta = [schoolName(raw.school), castingTimeLabel(raw), rangeLabel(raw)].filter(Boolean);
  const cast = castTypeLabel(entry);
  const highlight = entry.granted || arcanum;
  return (
    <li className={highlight ? `${styles.row} ${styles.rowGranted}` : styles.row}>
      <button type="button" className={styles.rowHit} onClick={onInfo} title={`About ${raw.name}`}>
        <SpellThumb src={thumb} school={raw.school} alt="" />
        <span className={styles.rowText}>
          <span className={styles.rowName}>{raw.name}</span>
          <span className={styles.rowSub}>
            <span className={styles.rowMetaLine}>
              {meta.map((part, i) => (
                <span key={part}>
                  {i > 0 && <span className={styles.metaDot} aria-hidden="true"> • </span>}
                  {part}
                </span>
              ))}
            </span>
            {entry.granted && <span className={styles.chipAccent}>Always Prepared</span>}
            {arcanum && <span className={styles.chipAccent}>Mystic Arcanum</span>}
            {arcanum && <span className={styles.chip}>1/Long Rest</span>}
            {cast && <span className={styles.chip}>{cast}</span>}
            {/* Sem chip "Ritual" duplicado quando o castType do grant já o diz
                (Wild Heart Animal Speaker: conjuração ritual-only, DDL-0011). */}
            {isRitual(raw) && cast !== 'Ritual' && <span className={styles.chip}>Ritual</span>}
            {isConcentration(raw) && <span className={styles.chip}>Concentration</span>}
          </span>
        </span>
      </button>
      <div className={styles.rowSide}>
        <span className={styles.rowLevel}>{ORDINAL_SHORT[raw.level] ?? raw.level}</span>
        {/* Trocar a magia sem abrir a ficha - o espaço à direita do card estava
            livre (as concedidas não trocam, então não ganham o botão). */}
        {onReplace && (
          <button
            type="button"
            className={styles.swapBtn}
            onClick={onReplace}
            title={`Replace ${raw.name}`}
            aria-label={`Replace ${raw.name}`}
          >
            ⇄
          </button>
        )}
      </div>
    </li>
  );
}
