// =============================================================================
// Fiendish Legacies LEGADAS do Tiefling (DDL-0061)
// =============================================================================
// O Tiefling 2014 tinha 12 sub-raças (as 8 casas infernais do MTF + as 4
// variantes do SCAG). O DDL-0059/0060 as trouxe de volta como ESPÉCIES à parte
// montadas no chassi 2014, porque penduradas no chassi 2024 elas SOMAVAM
// vantagens: ganhavam o "Otherworldly Presence" (Thaumaturgy de graça) e a
// resistência EM ABERTO (poison/necrotic/fire à escolha) por cima do pacote
// próprio de magias.
//
// Este módulo faz o contrário, e é o que o DDL-0061 decidiu: em vez de FUGIR do
// empilhamento, ele o NEUTRALIZA na fonte, e aí a sub-raça pode voltar a ser uma
// LINHAGEM da espécie 2024 - uma linha a mais na tabela de Fiendish Legacies:
//
//   · a resistência TRAVA em fogo (herança do "Hellish Resistance" 2014, que era
//     fogo fixo), em vez da escolha livre do chassi 2024;
//   · o atributo de conjuração deixa de ser Carisma FIXO e passa a ser o
//     Int/Wis/Cha à escolha do padrão 2024, em texto E mecânica;
//   · as magias são remapeadas para as versões XPHB (só o "Branding Smite" do
//     Zariel mudou de nome: virou "Shining Smite|XPHB");
//   · a legacy cujo cantrip de nível 1 ERA Thaumaturgy fica SEM cantrip próprio
//     (decisão do usuário) - ela já recebe Thaumaturgy pelo Otherworldly
//     Presence, e conceder o mesmo cantrip duas vezes é que seria o ganho de
//     graça. São 4: Baalzebul, Dispater, Zariel e Hellfire.
//
// Com isso a paridade com as legacies oficiais é exata:
//   oficial = resistência (à escolha) + cantrip + magia@3 + magia@5 + Thaumaturgy
//   legada  = resistência (travada em fogo) + cantrip? + magia@3 + magia@5 + idem
//
// DESCARTADAS, deliberadamente (mesmo critério do DDL-0059):
//  - Asmodeus|MTF            - a entrada não tem mecânica NENHUMA no dado; é o
//    tiefling PHB padrão, ou seja, a Infernal Legacy do XPHB.
//  - Variant; Infernal Legacy|SCAG - Thaumaturgy/Hellish Rebuke/Darkness,
//    idêntica à Fiendish Legacy (Infernal) do XPHB.
//
// NADA DE PROSA NOSSA (DDL-0003: enviamos código, nunca conteúdo). O texto do
// traço é MONTADO a partir do próprio dado: a versão oficial "Tiefling; Infernal
// Legacy" serve de TEMPLATE (a resistência dela já é fogo, como a nossa) e só as
// tags `{@spell}` são trocadas. Os traços extras (a "Appearance" das variantes
// SCAG, o benefício do "Winged") são puxados da sub-raça de origem. Se o texto
// de origem mudar upstream, o nosso muda junto.
// -----------------------------------------------------------------------------

import { parseSpellRef } from './grantedSpells';
import { resolveSpellObj } from './spells';

/** A espécie 2024 que recebe estas linhagens. */
const TARGET_RACE = 'Tiefling|XPHB';
/** Versão oficial usada como TEMPLATE de texto (a de resistência a fogo). */
const TEMPLATE_VERSION = 'Tiefling; Infernal Legacy';
/** Traço da base que a linhagem SUBSTITUI (o guarda-chuva com a tabela). */
export const LEGACY_TRAIT = 'Fiendish Legacy';
/** Resistência de TODA legacy legada (o "Hellish Resistance" 2014 era fogo). */
const LEGACY_RESIST = 'fire';
/** Atributo de conjuração do padrão 2024 (substitui o Carisma fixo de 2014). */
const CASTING_ABILITY = Object.freeze(['int', 'wis', 'cha']);

/**
 * As legacies legadas curadas. Cada entrada:
 *  - `legacy`   rótulo da linha na tabela e no nome da variante.
 *  - `from`     sub-raça de origem em `db.races.subrace` ("Nome|FONTE"). Também
 *               é a PROCEDÊNCIA exibida (o chip de fonte da linhagem).
 *  - `cantrip`  cantrip de nível 1, ou `null` quando o original era Thaumaturgy
 *               (já concedido pelo Otherworldly Presence - ver cabeçalho).
 *  - `level3` / `level5`  magias, com o sufixo `#2` do 5etools onde o texto 2014
 *               mandava conjurar no 2º círculo (mantido: era a compensação de
 *               2014 por listas mais fracas). `null` só no Winged, que não tem
 *               magia nenhuma.
 *  - `benefitFrom` (opcional) traço da sub-raça cujo TEXTO entra no lugar do
 *               parágrafo de magias (Winged: o voo).
 *  - `keepEntries` (opcional) traços da sub-raça anexados como traços próprios
 *               da linhagem - só aparecem ao selecioná-la (a "Appearance" das
 *               variantes SCAG).
 *  - `speed` (opcional) override de deslocamento (Winged).
 * @type {ReadonlyArray<object>}
 */
export const LEGACY_FIENDISH_LEGACIES = Object.freeze([
  // --- As oito casas infernais (Mordenkainen's Tome of Foes) ------------------
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
    // O dado 2014 recarregava o Floating Disk em descanso CURTO ou longo e
    // dispensava o componente material do Arcane Lock. O formato 2024 não tem
    // onde pendurar rider por magia: normalizado para o descanso longo padrão.
    level3: "tenser's floating disk|xphb", level5: 'arcane lock|xphb' },
  { legacy: 'Mephistopheles', from: 'Mephistopheles|MTF', cantrip: 'mage hand|xphb#c',
    level3: 'burning hands|xphb#2', level5: 'flame blade|xphb' },
  { legacy: 'Zariel', from: 'Zariel|MTF', cantrip: null,
    // "Branding Smite" não existe em 2024: foi reimpressa como "Shining Smite".
    level3: 'searing smite|xphb#2', level5: 'shining smite|xphb' },

  // --- As variantes da Costa da Espada (SCAG) ---------------------------------
  // Estas três trazem um traço de APARÊNCIA próprio, que segue junto e só
  // aparece ao selecionar a linhagem.
  { legacy: "Devil's Tongue", from: "Variant; Devil's Tongue|SCAG", cantrip: 'vicious mockery|xphb#c',
    level3: 'charm person|xphb#2', level5: 'enthrall|xphb', keepEntries: ['Appearance'] },
  { legacy: 'Hellfire', from: 'Variant; Hellfire|SCAG', cantrip: null,
    level3: 'burning hands|xphb#2', level5: 'darkness|xphb', keepEntries: ['Appearance'] },
  // Winged é a única sem magia: o benefício de nível 1 é o voo, e não há nada
  // em 3/5 (decisão do usuário - fiel ao SCAG).
  { legacy: 'Winged', from: 'Variant; Winged|SCAG', cantrip: null,
    level3: null, level5: null, benefitFrom: 'Winged', keepEntries: ['Appearance'],
    speed: { walk: 30, fly: 30 } },
]);

/** Quebra "Nome|FONTE" em `[nome, fonte]`. */
function split(id) {
  const i = id.lastIndexOf('|');
  return i < 0 ? [id, ''] : [id.slice(0, i), id.slice(i + 1)];
}

/** Nome da variante gerada, no padrão das oficiais ("Tiefling; Infernal Legacy"). */
export function legacyVersionName(legacy) {
  return `Tiefling; ${legacy} Legacy`;
}

const MINOR_WORDS = new Set(['of', 'the', 'a', 'an', 'and', 'or', 'to', 'in', 'on']);

/** Title case de emergência (só se a magia não estiver no compêndio carregado). */
function titleCase(name) {
  return String(name)
    .split(' ')
    .map((w, i) => (i > 0 && MINOR_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/**
 * Referência de magia do 5etools → tag `{@spell}` pronta, com o nome REAL do
 * compêndio (a referência é minúscula; "tenser's floating disk" precisa virar
 * "Tenser's Floating Disk").
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

/** Os parágrafos do traço da versão oficial usada como template. */
function templateParagraphs(race) {
  const version = (race?._versions ?? []).find((v) => v?.name === TEMPLATE_VERSION);
  const items = version?._mod?.entries?.items;
  const entry = Array.isArray(items) ? items[0] : items;
  const entries = entry?.entries;
  return Array.isArray(entries) && entries.length >= 3 ? entries.filter((e) => typeof e === 'string') : null;
}

/**
 * Parágrafo 1: resistência (+ cantrip). O template já diz "fogo" - só a frase do
 * cantrip muda. Sem cantrip, a frase inteira cai.
 */
function resistParagraph(template, cantripTag) {
  const hasSpellTag = /\{@spell[^}]*\}/.test(template);
  if (cantripTag) {
    return hasSpellTag
      ? template.replace(/\{@spell[^}]*\}/, cantripTag)
      : `${template} You also know the ${cantripTag} cantrip.`;
  }
  // Corta a última frase (a do cantrip). Sem tag reconhecível, devolve como está.
  return hasSpellTag ? template.replace(/\s*[^.]*\{@spell[^}]*\}[^.]*\.\s*$/, '') : template;
}

/** Parágrafo 2: troca as duas magias do template pelas da legacy. */
function spellsParagraph(template, level3, level5) {
  let i = 0;
  const tags = [level3.tag, level5.tag];
  let out = template.replace(/\{@spell[^}]*\}/g, () => tags[i++] ?? tags[tags.length - 1]);
  // O 5etools marca com `#2` a magia que o texto 2014 mandava conjurar num
  // círculo acima. O template oficial não tem essa frase - ela é acrescentada.
  const upcast = [level3, level5].filter((s) => s.castLevel > 1);
  for (const s of upcast) {
    out += ` When you cast ${s.tag} with this trait, you cast it as a level ${s.castLevel} spell.`;
  }
  return out;
}

/** Localiza a sub-raça de origem em `db.races.subrace`. */
function findSource(db, from) {
  const [name, source] = split(from);
  return (
    (db?.races?.subrace ?? []).find(
      (s) => s?.name === name && s.source === source && s.raceName === 'Tiefling' && s.raceSource === 'PHB',
    ) ?? null
  );
}

/** Traços da sub-raça de origem que seguem junto (sem o `data.overwrite` dela). */
function extraEntries(subrace, names) {
  if (!names?.length) return [];
  return (subrace?.entries ?? [])
    .filter((e) => names.includes(e?.name))
    .map(({ data, ...rest }) => rest); // eslint-disable-line no-unused-vars
}

/** O TEXTO de um traço da sub-raça (Winged: a frase do voo). */
function benefitText(subrace, name) {
  const entry = (subrace?.entries ?? []).find((e) => e?.name === name);
  return (entry?.entries ?? []).filter((e) => typeof e === 'string');
}

/**
 * Monta o descritor de versão (formato `_versions`) de uma legacy legada, mais a
 * LINHA dela na tabela de Fiendish Legacies - as duas coisas saem das MESMAS
 * peças, para a tabela não poder discordar do traço (foi o que fez a Winged
 * anunciar só a resistência, sem o voo, quando a linha era reprocessada do texto
 * já montado).
 * @returns {{version: object, row: string[]}|null} null se a sub-raça de origem
 *   não estiver no compêndio
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

  const paragraphs = [resist];
  if (level3 && level5) paragraphs.push(spellsParagraph(template[1], level3, level5));
  paragraphs.push(...benefit);
  paragraphs.push(template[2]); // a frase do atributo Int/Wis/Cha

  // Thaumaturgy vem SEMPRE (é o Otherworldly Presence da base, que as versões
  // oficiais também repetem aqui); o cantrip próprio entra ao lado, quando há.
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

  // A célula "Level 1" é tudo que a legacy dá nesse nível - resistência, cantrip
  // e o benefício irregular (o voo da Winged) - sem a abertura genérica ("You are
  // the recipient of a legacy…"), que é comum a todas e não pertence à tabela.
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
        ...(extras.length ? [{ mode: 'appendArr', items: extras }] : []),
      ],
    },
    _legacy: true, // acréscimo curado, não uma linhagem nativa da espécie
  };

  return { version, row: [spec.legacy, level1Cell, level3?.tag ?? '-', level5?.tag ?? '-'] };
}

const cache = new WeakMap(); // db → { versions, rows }

/** Versões + linhas de tabela, montadas juntas e memoizadas por db. */
function build(db, race) {
  if (!db || !race?.name || `${race.name}|${race.source}` !== TARGET_RACE) return { versions: [], rows: [] };
  const cached = cache.get(db);
  if (cached) return cached;
  const template = templateParagraphs(race);
  // Sem o template oficial no dado não há como montar o texto sem inventá-lo -
  // melhor não oferecer a linhagem do que oferecê-la muda.
  const built = template
    ? LEGACY_FIENDISH_LEGACIES.map((spec) => buildVersion(db, race, spec, template)).filter(Boolean)
    : [];
  const out = { versions: built.map((b) => b.version), rows: built.map((b) => b.row) };
  cache.set(db, out);
  return out;
}

/**
 * Os descritores de versão (formato `_versions`) das legacies legadas de uma
 * espécie. Só o Tiefling XPHB tem; qualquer outra devolve lista vazia.
 * @param {object|null} db
 * @param {object|null} race  espécie BASE (objeto cru)
 * @returns {object[]}
 */
export function legacyLegacyVersions(db, race) {
  return build(db, race).versions;
}

// --- Tabela exibida ----------------------------------------------------------
// A tabela "Fiendish Legacies" do traço da base é PROSA do dado, com as 3 linhas
// oficiais. As legadas são anexadas a ela para que o preview da espécie mostre
// todas as opções que o seletor de linhagem oferece.

/** Primeira linha (rótulo) de uma linha de tabela, para dedup. */
const rowLabel = (row) => String(Array.isArray(row) ? row[0] : row);

/**
 * Cópia dos `entries` da espécie com as linhas legadas anexadas à tabela de
 * Fiendish Legacies. Sem tabela (ou já anexada), devolve o array original.
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

// --- Migração das espécies legadas do DDL-0060 -------------------------------
// Entre 2026-07-22 e 2026-07-23 estas linhagens existiram como ESPÉCIES à parte
// ("Tiefling (Zariel)|MTF"). Uma ficha salva naquele formato perderia a espécie
// ao recarregar, porque o nome não existe mais em catálogo nenhum.

/** 'tiefling (zariel)|MTF' → { id, source, lineage } */
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
 * Converte uma espécie salva no formato antigo (espécie legada à parte) para o
 * novo (Tiefling XPHB + linhagem). Qualquer outra espécie passa intacta.
 * @param {object|null} species  `character.species`
 * @returns {object|null}
 */
export function migrateLegacyTiefling(species) {
  if (!species?.id) return species;
  const target = MIGRATION.get(`${String(species.id).toLowerCase()}|${species.source}`);
  if (!target) return species;
  // As sub-escolhas antigas (tamanho, magias) pertenciam à espécie antiga; o
  // Builder já zera o bag ao trocar de linhagem, então zeramos aqui também.
  return { ...species, ...target, choices: {} };
}
