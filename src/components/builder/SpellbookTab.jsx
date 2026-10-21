// =============================================================================
// SpellbookTab: a aba de magias do personagem (Fases B2.3 e B2.4)
// =============================================================================
// O QUE FAZ
//   Espelha o InventoryTab de propósito, e a ordem da página segue a do resto do
//   app: cards de estado no topo, sub-abas de ORIGEM (classe conjuradora, racial,
//   talento e o balde de carga), busca com "Prepare spell", chips de CATEGORIA por
//   círculo, Group/Sort, e a lista. Cada linha abre o DetailView da magia.
//
//   Dois cards, um por tipo de informação. RECURSOS: slots ou pacto, arcanum e os
//   usos por dia ou descanso (qualquer magia concedida com `castType`). NÚMEROS:
//   DC, ataque e os contadores de cantrips, preparadas e grimório. Crescem para
//   preencher a largura no desktop; no mobile cada um é uma faixa.
//
//   Preparar abre o SelectorPanel direto, com os filtros de Class e Level já
//   marcados na classe da origem e nos círculos onde ainda cabe magia. São filtros
//   comuns, desmarcáveis (o mestre liberou outra lista). O `exclude` só esconde o
//   que JÁ está nesta origem; o que foge do padrão pede confirmação ao adicionar.
//
// FUNÇÕES
//   signed(n), cap(s): formatação de número com sinal e de capitalização.
//   spellsOf(origin): todas as magias da origem, com a flag `granted`.
//   sectionOf(entry, groupBy), sectionRank(entry, groupBy): seção e ordem dela.
//   groupRows(list, groupBy): agrupa uma lista já ordenada em seções.
//   SpellbookTab(props): a aba. Dentro dela:
//     selectOrigin, selectCategory, toggleSection: navegação da página.
//     addSpell(raw): adiciona (ou troca) uma magia, com as confirmações.
//     togglePrepared(entry): prepara ou desprepara uma magia do repertório.
//     assignSpell(entry), discardSpell(entry): dão destino à carga.
//     startReplace(entry), closePicker(), removeSpell(entry): o fluxo de troca.
//     inClassList(raw), excludeFromPicker(raw): os recortes do seletor.
//   PreparedToggle(props): o radio de preparação (o mesmo átomo do EquipToggle).
//   SpellThumb(props): arte do fluff, senão o glyph da escola.
//   SpellRow(props): uma linha da lista.
//
// DECISÕES E ARMADILHAS
//   Origens e limites
//   - Magia CONCEDIDA (subclasse, linhagem, talento) é "Always Prepared": não sai
//     e não conta nos limites. Só o que o jogador escolheu conta.
//   - Só origem de CLASSE prepara; racial e talento são tudo concedido.
//   - Magia no repertório mas não preparada aparece com o toggle apagado (o
//     grimório do Mago). Só magia de CÍRCULO escolhida tem esse estado: cantrip
//     está sempre disponível, arcanum não gasta espaço, concedida é sempre
//     preparada.
//   - Over-limit nunca é escondido, só acende em vermelho (DDL-0026): também com
//     limite 0 e picks órfãos (a classe deixou de conjurar). O grimório é um PISO,
//     não um teto.
//   - Preparadas cheias não bloqueiam: a magia nova entra no repertório sem estar
//     preparada. Por isso nem o botão nem o aviso olham as preparadas; o botão só
//     desabilita quando não há ONDE encaixar (cantrips cheios e nada a crescer).
//   - WARLOCK: a Pact Magic trava no 5º círculo; do 11 em diante o Mystic Arcanum
//     dá uma magia de 6º a 9º, 1 por descanso longo cada. Elas não contam contra
//     as preparadas e só ocupam um arcanum livre do seu círculo.
//   - "3/Day" vindo de um modificador diz no tooltip de onde veio o número; "No
//     Spell Slot" é quando o dado não registra a frequência (DDL-0011).
//
//   Listas
//   - TC-0043: a lista da classe inclui o que a subclasse ou a prosa ALARGA
//     (Expanded Spell List, Divine Soul, Magical Secrets). Conta como on-list,
//     sem aviso e sem sumir do filtro de Class, com badge da fonte.
//   - TC-0031: magia já conhecida por OUTRA origem ganha badge, um filtro
//     "Already Prepared" pré-marcado e confirmação. É legal (um multiclasse pode
//     querer nas duas), só avisa de onde ela já vem.
//   - "All" agrupa por nível; dentro de um círculo isso seria uma seção só, então
//     cai para "sem agrupamento". Escola e save/ataque não têm ordem natural e
//     saem em ordem alfabética.
//
//   Troca e carga
//   - A troca ("Change") é ATÔMICA: remove e prepara no mesmo update. Cancelar o
//     painel mantém a original. Durante a troca, o balde da magia trocada conta
//     como livre, senão o seletor abriria como se não houvesse espaço.
//   - O balde de CARGA (`unassignedSpells`, DDL-0084): magias de um ator
//     importado que nenhuma classe da ficha conjura. É uma sub-aba própria, só
//     quando tem conteúdo, e continua sendo CARGA: sem DC, slots, limites ou
//     contadores ("Prepared 2/0" em vermelho mentiria sobre a ficha). Ela se
//     explica com uma nota; sem classe conjuradora, a nota diz isso em vez de um
//     botão morto (DDL-0077/0078).
//   - Só origem de CLASSE recebe magia da carga (é a única com decisões do
//     jogador). O diálogo oferece todas as classes e avisa com a lista DA CLASSE
//     ESCOLHIDA. Se a classe já tem a magia, avisa: senão o clique vira no-op
//     silencioso (a derivação dedupa). Descartar diz o que se perde: ela para de
//     voltar ao Foundry no re-export.
//   - Na linha, o botão de carga fica desabilitado, não escondido, quando não há
//     classe conjuradora; o title diz por quê (DDL-0077).
//
//   React
//   - `?? []` cria array novo a cada render; a lista de origens é memoizada para
//     os useMemo seguintes não recalcularem sempre. Os hooks vêm antes de
//     qualquer return.
//   - Sem chip "Ritual" duplicado quando o `castType` do grant já o diz (Wild
//     Heart Animal Speaker, DDL-0011).
// -----------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import DetailView from '../common/DetailView';
import SelectorPanel from '../../selector/SelectorPanel';
import { confirm, ask } from '../common/dialog';
import { imgUrl } from '../common/media';
import spellEntity, { makeSpellEntity } from '../../selector/entities/spell';
import { TUT } from '../../tutorial/anchors';
import { castTypeLabel } from '../../engine/grantedSpells';
import { preparedElsewhere } from '../../engine/spellcasting';
import {
  resolveSpellObj,
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
import { useBackLayer } from '../../hooks/useBack';

const ORIGIN_ICONS = { class: '📖', race: '🧬', feat: '⭐', unassigned: '📦' };

const CARGO_KEY = 'unassigned';

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

/** Todas as magias da origem, com a flag `granted` (sempre preparadas). */
function spellsOf(origin) {
  return [
    ...origin.cantrips.map((s) => ({ ...s, granted: false })),
    ...origin.prepared.map((s) => ({ ...s, granted: false })),
    ...(origin.unprepared ?? []).map((s) => ({ ...s, granted: false })),
    ...(origin.arcanumSpells ?? []).map((s) => ({ ...s, granted: false })),
    ...origin.alwaysPrepared,
  ].filter((s) => s.raw);
}

/** Chave da seção de uma magia no agrupamento ativo. */
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

/** Ordem da seção entre as outras. */
function sectionRank(entry, groupBy) {
  const raw = entry.raw;
  if (groupBy === 'level') return raw.level;
  if (groupBy === 'time') return castingTimeRank(raw);
  return 0;
}

const ALPHA_SECTIONS = new Set(['school', 'saveAttack']);

/** Agrupa uma lista já ordenada em seções. */
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

export default function SpellbookTab({
  character, db, derived, onChangeSpells, onAssignUnassigned, onDiscardUnassigned,
}) {
  const realOrigins = useMemo(() => derived.spellcasting?.origins ?? [], [derived]);
  const cargoOrigin = useMemo(() => {
    const refs = character.unassignedSpells ?? [];
    if (refs.length === 0) return null;
    // ATENÇÃO: a mesma magia pode estar duas vezes no balde; opere pelo cargoIndex.
    const resolved = refs
      .map((ref, i) => ({ ...ref, cargoIndex: i, raw: resolveSpellObj(db, ref.id ?? ref.name, ref.source) }))
      .filter((s) => s.raw);
    if (resolved.length === 0) return null;
    return {
      key: CARGO_KEY,
      kind: CARGO_KEY,
      label: 'Unassigned',
      uid: null,
      ability: null,
      cantrips: [],
      prepared: resolved,
      alwaysPrepared: [],
      cantripLimit: 0,
      prepareLimit: 0,
      maxPrepareLevel: 0,
    };
  }, [character.unassignedSpells, db]);

  const origins = useMemo(
    () => (cargoOrigin ? [...realOrigins, cargoOrigin] : realOrigins),
    [realOrigins, cargoOrigin],
  );
  const [originKey, setOriginKey] = useState(null);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [groupBy, setGroupBy] = useState('level');
  const [infoKey, setInfoKey] = useState(null);
  useBackLayer(infoKey != null, () => setInfoKey(null));
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [prepareOpen, setPrepareOpen] = useState(false);
  const [replacing, setReplacing] = useState(null);

  const origin = origins.find((o) => o.key === originKey) ?? origins[0];
  const isCargo = origin?.kind === CARGO_KEY;
  const assignTargets = useMemo(
    () => realOrigins.filter((o) => o.kind === 'class' && o.uid),
    [realOrigins],
  );

  const listClass = origin?.spellListClass ?? null;
  const expandedSpells = origin?.expandedSpells ?? null;
  const listNames = useMemo(() => {
    const base = listClass ? classSpellList(db, listClass) : new Set();
    if (!expandedSpells?.size) return base;
    return new Set([...base, ...expandedSpells]);
  }, [db, listClass, expandedSpells]);
  const elsewhere = useMemo(() => preparedElsewhere(derived.spellcasting?.origins, origin?.key), [derived, origin]);
  const pickerEntity = useMemo(
    () =>
      makeSpellEntity(db, {
        preparedElsewhere: elsewhere,
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
    setGroupBy(cat === 'all' ? 'level' : 'none');
  };

  const all = spellsOf(origin);
  const infoEntry = infoKey ? all.find((s) => s.raw.name === infoKey) : null;

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

  const cantripCount = origin.cantrips.length;
  const preparedCount = origin.prepared.length;
  const knownCount = preparedCount + (origin.unprepared?.length ?? 0);
  const cantripsFull = cantripCount >= origin.cantripLimit;
  const arcana = origin.arcana ?? [];
  const freeArcanumLevels = new Set(arcana.filter((a) => !a.spell).map((a) => a.level));
  const canPrepare = origin.kind === 'class' && (origin.cantripLimit > 0 || origin.prepareLimit > 0);
  const prepareDisabled = cantripsFull && origin.prepareLimit === 0 && freeArcanumLevels.size === 0;

  const replRaw = replacing?.raw ?? null;
  const replIsCantrip = replRaw?.level === 0;
  const replIsArcanum = !!replRaw && replRaw.level > origin.maxPrepareLevel;
  const replIsPrepared = !!replRaw && !replIsCantrip && !replIsArcanum;
  const freeCantripsFull = cantripCount - (replIsCantrip ? 1 : 0) >= origin.cantripLimit;
  const freePreparedFull = preparedCount - (replIsPrepared ? 1 : 0) >= origin.prepareLimit;
  const freeArcanumForPick = replIsArcanum ? new Set([...freeArcanumLevels, replRaw.level]) : freeArcanumLevels;

  const uses = origin.uses ?? [];

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
      title: u.note
        ? `${u.name}: ${u.label} (${u.note})`
        : u.label === 'No Spell Slot'
          ? `${u.name}: cast without expending a spell slot. See the feature text for how often.`
          : undefined,
    });
  }
  const resourceLabel = Object.keys(origin.slots ?? {}).length || origin.pactSlots ? 'Spell Slots' : 'Uses';

  const stats = [];
  if (!isCargo) {
    if (origin.ability) {
      stats.push({ key: 'dc', value: origin.saveDc, label: 'Save DC' });
      stats.push({ key: 'atk', value: signed(origin.attackBonus), label: 'Attack' });
    }
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
    if (origin.knownLimit != null) {
      stats.push({
        key: 'known',
        value: `${knownCount}/${origin.knownLimit}`,
        label: 'Known',
        over: knownCount > origin.knownLimit,
      });
    }
    if (arcana.length > 0) {
      stats.push({
        key: 'arcana',
        value: `${arcana.length - freeArcanumLevels.size}/${arcana.length}`,
        label: 'Arcanum',
      });
    }
  }

  const classEntry = origin.uid ? character.classes.find((c) => c.uid === origin.uid) : null;
  const ownedNames = new Set(all.map((s) => s.raw.name.toLowerCase()));
  const inClassList = (raw) => listNames.has(raw.name.toLowerCase());

  const setSpells = (spells) => onChangeSpells?.(origin.uid, spells);

  const addSpell = async (raw) => {
    if (!classEntry) return;
    const warnings = [];
    if (!inClassList(raw)) {
      warnings.push(`${raw.name} is not on the ${origin.spellListClass} spell list.`);
    }
    const from = elsewhere.get(raw.name.toLowerCase());
    if (from) {
      warnings.push(`You already have ${raw.name} from ${from}.`);
    }
    const asUnprepared = raw.level > 0 && raw.level <= origin.maxPrepareLevel && freePreparedFull;
    if (raw.level === 0) {
      if (freeCantripsFull) warnings.push(`You have no free cantrip slots (${cantripCount}/${origin.cantripLimit}).`);
    } else if (raw.level > origin.maxPrepareLevel) {
      if (!freeArcanumForPick.has(raw.level)) {
        warnings.push(`You have no spell slots (or free Mystic Arcanum) of the ${spellLevelLabel(raw.level).toLowerCase()}.`);
      }
    }
    if (warnings.length > 0) {
      const ok = await confirm({
        title: replacing ? 'Prepare this spell instead?' : 'Prepare this spell?',
        message: `${warnings.join(' ')} Prepare it anyway?`,
        confirmLabel: 'Prepare anyway',
      });
      if (!ok) return;
    }
    // ATENÇÃO: a troca é atômica; remover antes de escolher perde a magia ao cancelar.
    const base = (classEntry.spells ?? []).filter(
      (s) => !replacing || String(s.id ?? s.name).toLowerCase() !== replacing.raw.name.toLowerCase(),
    );
    const ref = { id: raw.name, source: raw.source };
    if (asUnprepared) ref.prepared = false;
    setSpells([...base, ref]);
    closePicker();
  };

  /** Alterna a preparação de uma magia do repertório. */
  const togglePrepared = (entry) => {
    if (!classEntry || entry.granted) return;
    const name = entry.raw.name.toLowerCase();
    setSpells((classEntry.spells ?? []).map((s) => (
      String(s.id ?? s.name).toLowerCase() === name
        ? { ...s, prepared: s.prepared === false }
        : s
    )));
  };

  /** Dá origem a uma magia da carga, avisando sem esconder opções. */
  const assignSpell = async (entry) => {
    if (assignTargets.length === 0) return;
    let uid = assignTargets[0].uid;
    if (assignTargets.length > 1) {
      const { action, values } = await ask({
        title: `Assign ${entry.raw.name}`,
        message: 'Which class casts it? It becomes a normal choice of that class, counting against its limits.',
        fields: [{
          type: 'select',
          name: 'uid',
          label: 'Origin',
          options: assignTargets.map((o) => ({ label: o.label, value: o.uid })),
          default: uid,
        }],
        actions: [
          { label: 'Cancel', value: false },
          { label: 'Assign', value: true, tone: 'primary', autoFocus: true },
        ],
      });
      if (!action) return;
      uid = values.uid;
    }
    const target = assignTargets.find((o) => o.uid === uid);
    const name = entry.raw.name.toLowerCase();
    const warnings = [];
    const owned = spellsOf(target).find((s) => s.raw?.name.toLowerCase() === name);
    if (owned) {
      warnings.push(
        owned.granted
          ? `${target.label} already grants ${entry.raw.name}, so assigning it here changes nothing.`
          : `${entry.raw.name} is already among ${target.label}'s spells.`,
      );
    }
    const targetList = classSpellList(db, target.spellListClass);
    const onList = targetList.has(name) || (target.expandedSpells?.has?.(name) ?? false);
    if (!onList) {
      warnings.push(`${entry.raw.name} is not on the ${target.spellListClass} spell list.`);
    }
    if (warnings.length > 0) {
      const ok = await confirm({
        title: 'Assign this spell?',
        message: `${warnings.join(' ')} Assign it anyway?`,
        confirmLabel: 'Assign anyway',
      });
      if (!ok) return;
    }
    onAssignUnassigned?.(uid, entry.cargoIndex);
    setInfoKey(null);
  };

  /** Descarta uma magia da carga, com confirmação. */
  const discardSpell = async (entry) => {
    const ok = await confirm({
      title: `Discard ${entry.raw.name}?`,
      message: 'It will no longer be exported back to Foundry. This cannot be undone.',
      confirmLabel: 'Discard',
      tone: 'danger',
    });
    if (!ok) return;
    onDiscardUnassigned?.(entry.cargoIndex);
    setInfoKey(null);
  };

  /** Fecha o seletor e encerra a troca em andamento. */
  const closePicker = () => {
    setPrepareOpen(false);
    setReplacing(null);
  };

  /** Abre o seletor para escolher a substituta desta magia. */
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

  const excludeFromPicker = (raw) => ownedNames.has(raw.name.toLowerCase());

  const pickerLevels = [];
  if (origin.cantripLimit > 0 && !freeCantripsFull) pickerLevels.push('Cantrip');
  if (origin.prepareLimit > 0) {
    for (let l = 1; l <= origin.maxPrepareLevel; l++) pickerLevels.push(String(l));
  }
  for (const l of freeArcanumForPick) pickerLevels.push(String(l));
  const pickerFilterState = {
    class: { [origin.spellListClass]: 'include' },
    level: Object.fromEntries(pickerLevels.map((v) => [v, 'include'])),
    ...(elsewhere.size > 0 ? { owned: { yes: 'exclude' } } : {}),
  };

  return (
    <div className={styles.tab}>
      <div className={styles.header} data-tour={TUT.TAB_SPELL_CARDS}>
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

      <nav className={styles.subTabs} data-tour={TUT.TAB_SPELL_ORIGINS}>
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

      {isCargo && (
        <p className={styles.cargoNote}>
          These spells came with an imported actor and no class on this sheet can cast them. They are
          kept and exported back to Foundry, but they have no origin, so they count against no limit.
          {assignTargets.length > 0
            ? ' Assign one to a spellcasting class to make it a normal spell of that class.'
            : ' Add a spellcasting class to be able to assign them.'}
        </p>
      )}

      <div className={styles.controls} data-tour={TUT.TAB_SPELL_CONTROLS}>
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
                <ul className={`${styles.list} motion-expand`}>
                  {list.map((entry, i) => {
                    const isArc = !entry.granted && (origin.arcanumLevels ?? []).includes(entry.raw.level);
                    const canPrepareThis = !!classEntry && !entry.granted && !isArc && entry.raw.level > 0;
                    return (
                      <SpellRow
                        // ATENÇÃO: a key leva o índice porque a mesma magia pode repetir.
                        key={`${origin.key}|${entry.cargoIndex ?? i}|${entry.raw.name}|${entry.castMode ?? 'pick'}`}
                        entry={entry}
                        arcanum={isArc}
                        thumb={imgUrl(spellEntity.fluff(entry.raw, db)?.images?.[0]?.href)}
                        onInfo={() => setInfoKey(entry.raw.name)}
                        onReplace={classEntry && !entry.granted ? () => startReplace(entry) : null}
                        onTogglePrepared={canPrepareThis ? () => togglePrepared(entry) : null}
                        onAssign={isCargo ? () => assignSpell(entry) : null}
                        assignDisabled={isCargo && assignTargets.length === 0}
                      />
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })
      )}

      {infoEntry && (
        <div className={`${styles.infoOverlay} motion-page`} onClick={() => setInfoKey(null)}>
          <div className={`${styles.infoPanel} motion-pop`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.infoHead}>
              <button type="button" className={styles.infoClose} onClick={() => setInfoKey(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className={styles.infoScroll}>
              <DetailView entity={spellEntity} raw={infoEntry.raw} db={db} capImage />
            </div>
            {isCargo ? (
              <div className={styles.infoFooter}>
                <span className={styles.infoNote}>
                  {assignTargets.length > 0
                    ? 'No origin yet. Assign it to a class to start using it.'
                    : 'No origin, and no spellcasting class to assign it to.'}
                </span>
                <button
                  type="button"
                  className={styles.changeBtn}
                  onClick={() => assignSpell(infoEntry)}
                  disabled={assignTargets.length === 0}
                  title={assignTargets.length === 0 ? 'This sheet has no spellcasting class.' : undefined}
                >
                  Assign…
                </button>
                <button type="button" className={styles.removeBtn} onClick={() => discardSpell(infoEntry)}>
                  Discard
                </button>
              </div>
            ) : infoEntry.granted ? (
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

/** Toggle de preparação: só o radio, como o EquipToggle. */
function PreparedToggle({ prepared, onClick, name }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={prepared}
      aria-label={prepared ? `Unprepare ${name}` : `Prepare ${name}`}
      className={prepared ? `${styles.prepRadio} ${styles.prepRadioOn}` : styles.prepRadio}
      onClick={onClick}
      title={prepared ? `Prepared - tap to unprepare ${name}` : `Not prepared - tap to prepare ${name}`}
    >
      <span className={styles.prepDot} aria-hidden="true" />
    </button>
  );
}

/** Thumbnail da magia: arte do fluff ou o glyph da escola. */
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

function SpellRow({ entry, arcanum, thumb, onInfo, onReplace, onTogglePrepared, onAssign, assignDisabled }) {
  const raw = entry.raw;
  const meta = [schoolName(raw.school), castingTimeLabel(raw), rangeLabel(raw)].filter(Boolean);
  const cast = castTypeLabel(entry);
  const highlight = entry.granted || arcanum;
  const unprepared = !!onTogglePrepared && entry.prepared === false;
  const rowClass = [styles.row, highlight && styles.rowGranted, unprepared && styles.rowUnprepared]
    .filter(Boolean)
    .join(' ');
  return (
    <li className={rowClass}>
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
            {isRitual(raw) && cast !== 'Ritual' && <span className={styles.chip}>Ritual</span>}
            {isConcentration(raw) && <span className={styles.chip}>Concentration</span>}
          </span>
        </span>
      </button>
      <div className={styles.rowSide}>
        <span className={styles.rowLevel}>{ORDINAL_SHORT[raw.level] ?? raw.level}</span>
        {onTogglePrepared && (
          <PreparedToggle prepared={!unprepared} name={raw.name} onClick={onTogglePrepared} />
        )}
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
        {onAssign && (
          <button
            type="button"
            className={styles.assignBtn}
            onClick={onAssign}
            disabled={assignDisabled}
            title={assignDisabled ? 'This sheet has no spellcasting class.' : `Assign ${raw.name} to a class`}
            aria-label={`Assign ${raw.name} to a class`}
          >
            +
          </button>
        )}
      </div>
    </li>
  );
}
