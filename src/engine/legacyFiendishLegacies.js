// =============================================================================
// legacyFiendishLegacies: as Fiendish Legacies legadas do Tiefling, reescritas (DDL-0061)
// =============================================================================
// O QUE FAZ
//   O Tiefling 2014 tinha 12 sub-raças (as 8 casas infernais do MTF e as 4
//   variantes do SCAG). Penduradas no chassi 2024 elas SOMAVAM vantagens (o
//   Otherworldly Presence e a resistência em aberto por cima do pacote próprio).
//   Este módulo NEUTRALIZA o empilhamento na fonte, e a sub-raça volta como
//   LINHAGEM do Tiefling XPHB, mais uma linha na tabela de Fiendish Legacies:
//     a resistência TRAVA em fogo (o Hellish Resistance 2014);
//     o atributo de conjuração passa de Carisma fixo ao Int/Wis/Cha de 2024;
//     as magias vão para as versões XPHB (Branding Smite virou Shining Smite);
//     quem tinha Thaumaturgy como cantrip fica SEM cantrip (decisão do usuário):
//       já o recebe pelo Otherworldly Presence (Baalzebul, Dispater, Zariel,
//       Hellfire).
//   Paridade exata: oficial = resistência + cantrip + magia@3 + magia@5 +
//   Thaumaturgy; legada = resistência a fogo + cantrip? + magia@3 + magia@5 + idem.
//
// FUNÇÕES
//   split(id), legacyVersionName(legacy), titleCase(name): nomes.
//   spellTag(db, ref): uma ref de magia como tag {@spell} com o nome real.
//   templateParagraphs(race): os parágrafos do traço template.
//   resistParagraph(template, cantripTag), spellsParagraph(template, level3,
//     level5): os parágrafos 1 e 2 com as tags trocadas.
//   otherworldlyWithoutLegacyRef(race, abilityParagraph): a frase do atributo
//     movida para o Otherworldly Presence (só a Winged).
//   findSource(db, from), extraEntries(subrace, names), benefitText(subrace,
//     name): peças da sub-raça de origem.
//   buildVersion(db, race, spec, template): a versão e a linha da tabela.
//   build(db, race): tudo, memoizado por db.
//   legacyLegacyVersions(db, race): as versões (só o Tiefling XPHB tem).
//   rowLabel(row), withLegacyTable(db, race): a tabela com as linhas legadas.
//   migrateLegacyTiefling(species): a migração do formato antigo.
//
// DECISÕES E ARMADILHAS
//   - Descartadas de propósito: Asmodeus (sem mecânica no dado; é a Infernal XPHB)
//     e Variant; Infernal Legacy SCAG (idêntica à Infernal XPHB).
//   - NENHUMA prosa nossa (DDL-0003): o texto é montado do dado, com a versão
//     oficial Infernal Legacy como TEMPLATE (a resistência dela já é fogo), só
//     trocando as tags {@spell}. Os traços extras (a Appearance SCAG, o voo da
//     Winged) vêm da sub-raça. Sem o template no dado, a linhagem não é
//     oferecida: melhor não oferecer do que oferecer muda.
//   - O registro: `legacy` (rótulo), `from` (a sub-raça e a procedência),
//     `cantrip` (null quando era Thaumaturgy), `level3`/`level5` (com o `#2` do
//     5etools onde 2014 conjurava no 2º círculo, mantido como compensação),
//     `benefitFrom`, `keepEntries` e `speed` (Winged).
//   - O Floating Disk recarregava em descanso curto no dado 2014: normalizado para
//     o longo, porque 2024 não tem onde pendurar rider por magia.
//   - A Winged é a única sem magia (fiel ao SCAG): a frase do atributo MUDA para o
//     Otherworldly Presence, cujo Thaumaturgy precisa dele. Frase não reconhecida
//     no texto upstream deixa o traço intacto: degradar é melhor que inventar.
//   - Versão e linha de tabela saem das MESMAS peças: reprocessar o texto já
//     montado fazia a tabela da Winged esquecer o voo. A célula "Level 1" não leva
//     a abertura genérica.
//   - Migração: de 2026-07-22 a 2026-07-23 elas foram espécies à parte
//     ("Tiefling (Zariel)|MTF"); a ficha antiga vira Tiefling XPHB com linhagem,
//     com o bag zerado (como o Builder faz ao trocar de linhagem).
// -----------------------------------------------------------------------------

import { parseSpellRef } from './grantedSpells';
import { resolveSpellObj } from './spells';

const TARGET_RACE = 'Tiefling|XPHB';
const TEMPLATE_VERSION = 'Tiefling; Infernal Legacy';
export const LEGACY_TRAIT = 'Fiendish Legacy';
const OTHERWORLDLY_TRAIT = 'Otherworldly Presence';
const LEGACY_RESIST = 'fire';
const CASTING_ABILITY = Object.freeze(['int', 'wis', 'cha']);

/** @type {ReadonlyArray<object>} */
export const LEGACY_FIENDISH_LEGACIES = Object.freeze([
  { legacy: 'Baalzebul', from: 'Baalzebul|MTF', cantrip: null,
    level3: 'ray of sickness|xphb#2', level5: 'crown of madness|xphb' },
  { legacy: 'Dispater', from: 'Dispater|MTF', cantrip: null,
    level3: 'disguise self|xphb', level5: 'detect thoughts|xphb' },
  { legacy: 'Fierna', from: 'Fierna|MTF', cantrip: 'friends|xphb#c',
    level3: 'charm person|xphb#2', level5: 'suggestion|xphb' },
  { legacy: 'Glasya', from: 'Glasya|MTF', cantrip: 'minor illusion|xphb#c',
    level3: 'disguise self|xphb', level5: 'invisibility|xphb' },
  { legacy: 'Levistus', from: 'Levistus|MTF', cantrip: 'ray of frost|xphb#c',
    level3: 'armor of agathys|xphb#2', level5: 'darkness|xphb' },
  { legacy: 'Mammon', from: 'Mammon|MTF', cantrip: 'mage hand|xphb#c',
    level3: "tenser's floating disk|xphb", level5: 'arcane lock|xphb' },
  { legacy: 'Mephistopheles', from: 'Mephistopheles|MTF', cantrip: 'mage hand|xphb#c',
    level3: 'burning hands|xphb#2', level5: 'flame blade|xphb' },
  { legacy: 'Zariel', from: 'Zariel|MTF', cantrip: null,
    level3: 'searing smite|xphb#2', level5: 'shining smite|xphb' },

  { legacy: "Devil's Tongue", from: "Variant; Devil's Tongue|SCAG", cantrip: 'vicious mockery|xphb#c',
    level3: 'charm person|xphb#2', level5: 'enthrall|xphb', keepEntries: ['Appearance'] },
  { legacy: 'Hellfire', from: 'Variant; Hellfire|SCAG', cantrip: null,
    level3: 'burning hands|xphb#2', level5: 'darkness|xphb', keepEntries: ['Appearance'] },
  { legacy: 'Winged', from: 'Variant; Winged|SCAG', cantrip: null,
    level3: null, level5: null, benefitFrom: 'Winged', keepEntries: ['Appearance'],
    speed: { walk: 30, fly: 30 } },
]);

/** Quebra "Nome|FONTE" em [nome, fonte]. */
function split(id) {
  const i = id.lastIndexOf('|');
  return i < 0 ? [id, ''] : [id.slice(0, i), id.slice(i + 1)];
}

/** O nome da variante, no padrão das oficiais. */
export function legacyVersionName(legacy) {
  return `Tiefling; ${legacy} Legacy`;
}

const MINOR_WORDS = new Set(['of', 'the', 'a', 'an', 'and', 'or', 'to', 'in', 'on']);

/** Title case de emergência (magia fora do compêndio carregado). */
function titleCase(name) {
  return String(name)
    .split(' ')
    .map((w, i) => (i > 0 && MINOR_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/**
 * Uma ref de magia como tag {@spell} com o nome real.
 * @returns {{tag: string, castLevel: number|null}|null}
 */
function spellTag(db, ref) {
  const parsed = parseSpellRef(ref);
  if (!parsed) return null;
  const obj = resolveSpellObj(db, parsed.name, parsed.source);
  const name = obj?.name ?? titleCase(parsed.name);
  const source = (obj?.source ?? parsed.source ?? 'XPHB').toUpperCase();
  return { tag: `{@spell ${name}|${source}}`, castLevel: parsed.castLevel };
}

/** Os parágrafos do traço da versão template. */
function templateParagraphs(race) {
  const version = (race?._versions ?? []).find((v) => v?.name === TEMPLATE_VERSION);
  const items = version?._mod?.entries?.items;
  const entry = Array.isArray(items) ? items[0] : items;
  const entries = entry?.entries;
  return Array.isArray(entries) && entries.length >= 3 ? entries.filter((e) => typeof e === 'string') : null;
}

/** O parágrafo da resistência, com o cantrip trocado ou cortado. */
function resistParagraph(template, cantripTag) {
  const hasSpellTag = /\{@spell[^}]*\}/.test(template);
  if (cantripTag) {
    return hasSpellTag
      ? template.replace(/\{@spell[^}]*\}/, cantripTag)
      : `${template} You also know the ${cantripTag} cantrip.`;
  }
  return hasSpellTag ? template.replace(/\s*[^.]*\{@spell[^}]*\}[^.]*\.\s*$/, '') : template;
}

/**
 * O Otherworldly Presence com a frase do atributo, ou null.
 * @returns {object|null}
 */
function otherworldlyWithoutLegacyRef(race, abilityParagraph) {
  const entry = (race?.entries ?? []).find((e) => e?.name === OTHERWORLDLY_TRAIT);
  const text = (entry?.entries ?? []).find((e) => typeof e === 'string');
  if (!text || !abilityParagraph) return null;
  const trimmed = text.replace(/\s*[^.]*Fiendish Legacy[^.]*\.\s*$/i, '');
  if (trimmed === text) return null;
  return { ...entry, entries: [trimmed, abilityParagraph] };
}

/** O parágrafo das magias, com as da legacy. */
function spellsParagraph(template, level3, level5) {
  let i = 0;
  const tags = [level3.tag, level5.tag];
  let out = template.replace(/\{@spell[^}]*\}/g, () => tags[i++] ?? tags[tags.length - 1]);
  const upcast = [level3, level5].filter((s) => s.castLevel > 1);
  for (const s of upcast) {
    out += ` When you cast ${s.tag} with this trait, you cast it as a level ${s.castLevel} spell.`;
  }
  return out;
}

/** A sub-raça de origem em `db.races.subrace`. */
function findSource(db, from) {
  const [name, source] = split(from);
  return (
    (db?.races?.subrace ?? []).find(
      (s) => s?.name === name && s.source === source && s.raceName === 'Tiefling' && s.raceSource === 'PHB',
    ) ?? null
  );
}

/** Os traços da sub-raça que seguem junto. */
function extraEntries(subrace, names) {
  if (!names?.length) return [];
  return (subrace?.entries ?? [])
    .filter((e) => names.includes(e?.name))
    .map(({ data, ...rest }) => rest); // eslint-disable-line no-unused-vars
}

/** O texto de um traço da sub-raça. */
function benefitText(subrace, name) {
  const entry = (subrace?.entries ?? []).find((e) => e?.name === name);
  return (entry?.entries ?? []).filter((e) => typeof e === 'string');
}

/**
 * A versão de uma legacy legada e a linha dela na tabela, ou null.
 * @returns {{version: object, row: string[]}|null}
 */
function buildVersion(db, race, spec, template) {
  const subrace = findSource(db, spec.from);
  if (!subrace) return null;
  const [, source] = split(spec.from);

  const cantrip = spec.cantrip ? spellTag(db, spec.cantrip) : null;
  const level3 = spec.level3 ? spellTag(db, spec.level3) : null;
  const level5 = spec.level5 ? spellTag(db, spec.level5) : null;

  const resist = resistParagraph(template[0], cantrip?.tag ?? null);
  const benefit = spec.benefitFrom ? benefitText(subrace, spec.benefitFrom) : [];

  const grantsSpells = Boolean(spec.cantrip || spec.level3 || spec.level5);
  const otherworldly = grantsSpells ? null : otherworldlyWithoutLegacyRef(race, template[2]);

  const paragraphs = [resist];
  if (level3 && level5) paragraphs.push(spellsParagraph(template[1], level3, level5));
  paragraphs.push(...benefit);
  if (grantsSpells || !otherworldly) paragraphs.push(template[2]);

  const known = ['thaumaturgy|xphb#c', ...(spec.cantrip ? [spec.cantrip] : [])];
  const innate = {};
  if (spec.level3) innate[3] = { daily: { 1: [spec.level3] } };
  if (spec.level5) innate[5] = { daily: { 1: [spec.level5] } };

  const legacyEntry = {
    type: 'entries',
    name: `${LEGACY_TRAIT} (${spec.legacy})`,
    entries: paragraphs,
  };
  const extras = extraEntries(subrace, spec.keepEntries);

  const level1Cell = [resist.replace(/^[^.]*\.\s*/, ''), ...benefit].join(' ');

  const version = {
    name: legacyVersionName(spec.legacy),
    source,
    resist: [LEGACY_RESIST],
    ...(spec.speed ? { speed: spec.speed } : {}),
    additionalSpells: [
      {
        ability: { choose: [...CASTING_ABILITY] },
        known: { 1: known },
        ...(Object.keys(innate).length ? { innate } : {}),
      },
    ],
    _mod: {
      entries: [
        { mode: 'replaceArr', replace: LEGACY_TRAIT, items: legacyEntry },
        ...(otherworldly ? [{ mode: 'replaceArr', replace: OTHERWORLDLY_TRAIT, items: otherworldly }] : []),
        ...(extras.length ? [{ mode: 'appendArr', items: extras }] : []),
      ],
    },
    _legacy: true,
  };

  return { version, row: [spec.legacy, level1Cell, level3?.tag ?? '-', level5?.tag ?? '-'] };
}

const cache = new WeakMap();

/** Versões e linhas, memoizadas por db. */
function build(db, race) {
  if (!db || !race?.name || `${race.name}|${race.source}` !== TARGET_RACE) return { versions: [], rows: [] };
  const cached = cache.get(db);
  if (cached) return cached;
  const template = templateParagraphs(race);
  const built = template
    ? LEGACY_FIENDISH_LEGACIES.map((spec) => buildVersion(db, race, spec, template)).filter(Boolean)
    : [];
  const out = { versions: built.map((b) => b.version), rows: built.map((b) => b.row) };
  cache.set(db, out);
  return out;
}

/**
 * As versões das legacies legadas de uma espécie.
 * @param {object|null} db
 * @param {object|null} race
 * @returns {object[]}
 */
export function legacyLegacyVersions(db, race) {
  return build(db, race).versions;
}

/** O rótulo de uma linha de tabela. */
const rowLabel = (row) => String(Array.isArray(row) ? row[0] : row);

/**
 * Os entries com as linhas legadas anexadas à tabela.
 * @param {object|null} db
 * @param {object|null} race
 * @returns {Array|undefined}
 */
export function withLegacyTable(db, race) {
  const { rows } = build(db, race);
  if (!rows.length || !Array.isArray(race?.entries)) return race?.entries;
  let touched = false;
  const entries = race.entries.map((entry) => {
    if (entry?.name !== LEGACY_TRAIT || !Array.isArray(entry.entries)) return entry;
    const inner = entry.entries.map((sub) => {
      if (sub?.type !== 'table' || !Array.isArray(sub.rows)) return sub;
      const have = new Set(sub.rows.map(rowLabel));
      const add = rows.filter((r) => !have.has(rowLabel(r)));
      if (!add.length) return sub;
      touched = true;
      return { ...sub, rows: [...sub.rows, ...add] };
    });
    return touched ? { ...entry, entries: inner } : entry;
  });
  return touched ? entries : race.entries;
}

const MIGRATION = new Map(
  LEGACY_FIENDISH_LEGACIES.map((spec) => {
    const [name, source] = split(spec.from);
    return [
      `tiefling (${name.toLowerCase()})|${source}`,
      { id: 'tiefling', source: 'XPHB', lineage: legacyVersionName(spec.legacy) },
    ];
  }),
);

/**
 * Converte o formato antigo (espécie à parte) em Tiefling XPHB com linhagem.
 * @param {object|null} species
 * @returns {object|null}
 */
export function migrateLegacyTiefling(species) {
  if (!species?.id) return species;
  const target = MIGRATION.get(`${String(species.id).toLowerCase()}|${species.source}`);
  if (!target) return species;
  return { ...species, ...target, choices: {} };
}
