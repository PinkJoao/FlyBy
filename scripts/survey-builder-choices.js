// =============================================================================
// survey-builder-choices: o que a prosa manda escolher e o builder não guarda
// =============================================================================
// O QUE FAZ
//   Uso: npx vite-node scripts/survey-builder-choices.js [--text] [--kind=class|subclass|species|feat]
//   A metade "builder" da Fase P (docs/PLAY-MODE-CERT-PLAN.md §3a, DDL-0211). Monta a
//   matriz (classes no 20, espécies no 5, talentos num hospedeiro) pelo autoBuild, que
//   preenche TODA escolha que o builder oferece, e lista as features cuja prosa pede uma
//   escolha DURADOURA sem nenhuma escolha guardada que corresponda a ela:
//   - escolha nomeada ("choose one of the following", "choose a ... option"): alguma
//     chave do saco de escolhas tem de citar o nome da feature;
//   - escolha de um tipo (perícia, ferramenta, idioma, resistência, magia, atributo):
//     a unidade tem de ter alguma escolha daquele tipo.
//   É um gabarito para conferir à mão, como o survey-feature-uses: cada candidata vira
//   escolha nova no builder, ou um motivo escrito em `NOT_A_CHOICE`.
//
// FUNÇÕES
//   cueOf(text): a pista de escolha duradoura do texto: { kind } ou null.
//   bagEntries(character): cada escolha guardada como { where, key, kind }.
//   visit(character, unit, only): soma as candidatas de um personagem.
//   featBuild(row): o hospedeiro de um talento (o mesmo do survey-play-coverage).
//
// DECISÕES E ARMADILHAS
//   - "Of your choice" sozinho NÃO é pista: quase sempre é escolha na hora ("a creature
//     of your choice"). Só conta perto de proficiency, language, skill, tool, resistance,
//     damage type ou cantrip.
//   - O saco de escolhas é a prova do builder porque o autoBuild preenche tudo o que as
//     telas oferecem (choicesComplete, a mesma régua do guia).
//   - O Spellcasting e o Pact Magic guardam as magias em `classes[].spells`, não no saco;
//     "Fighting Style" de subclasse guarda em `feat@fs` (`ALIASES`); "skills or tools"
//     é uma escolha `mixed`.
//   - `NOT_A_CHOICE` nomeia, com o motivo, a candidata que foi lida e não é escolha
//     guardada (a escolha é a cada uso, ou outra feature a guarda). Predicado estreito,
//     pelo nome (§6.2).
// -----------------------------------------------------------------------------
import process from 'node:process';
import { loadDb } from './lib/loadDb.js';
import { classMatrix, speciesMatrix, defaultSpecies, featMatrix } from './lib/matrix.js';
import { autoBuild } from './lib/autoBuild.js';
import { hashSeed } from './lib/rng.js';
import { derivePlayCatalog } from '../src/engine/playCatalog.js';
import { plainText } from '../src/engine/playFeatures.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));

const PER_REST = 'a escolha vale até o próximo descanso: é de jogo, não de ficha';
const PER_USE = 'a escolha é a cada uso';
const NOT_A_CHOICE = {
  trance: PER_REST,
  'astral trance': PER_REST,
  'severed from dreams': PER_REST,
  'bestial soul': PER_REST,
  'steps of the fey': PER_USE,
  'master transmuter': PER_USE,
  'master brewer': PER_USE,
  'elemental burst': PER_USE,
  'aspect of the wyrm': PER_USE,
  'breath of the dragon': PER_USE,
  'drake companion': 'o tipo de dano se escolhe ao invocar o drake',
  'aura of elemental shielding': 'o tipo muda no começo de cada turno',
};
const ALIASES = { 'fighting style': 'feat@fs' };

const KIND_CUES = [
  ['skill', /\b(?:proficiency|proficient) (?:in|with) (?:one|two|three|four|a|an)\b[^.]{0,60}\bskills?\b[^.]{0,40}\bof your choice|\bskills? of your choice/],
  ['tool', /\btools? of your choice|\bproficiency with (?:one|two|a) [^.]{0,40}\btools?\b[^.]{0,30}\bof your choice/],
  ['language', /\blanguages? of your choice|\blearn (?:one|two|three) (?:additional |extra )?languages?/],
  ['resist', /\bresistance to [^.]{0,60}\bdamage type (?:of your choice|you choose)|\bchoose (?:a|one) damage type\b/],
  ['spell', /\b(?:learn|know) (?:one|two|three|an?) (?:\w+ )?(?:cantrips?|spells?)\b[^.]{0,40}\bof your choice|\bcantrip of your choice/],
  ['ability', /\bincrease (?:one|an) ability score of your choice/],
];
const NAMED_CUE = /\bchoose (?:one|two|three|an?) (?:of the following|\w+ (?:option|benefit|form|type|kind|element|aspect|enhancement))s?\b|\bwhen you (?:take|gain|choose) this (?:feat|feature|trait)[^.]{0,20}\bchoose\b/;

/** A pista de escolha duradoura do texto: { kind } ou null. */
function cueOf(text) {
  const t = text.toLowerCase();
  for (const [kind, re] of KIND_CUES) if (re.test(t)) return { kind };
  return NAMED_CUE.test(t) ? { kind: 'named' } : null;
}

/** Cada escolha guardada: { where, key, kind }. */
function bagEntries(c) {
  const out = [];
  const walk = (bag, where) => {
    for (const [key, v] of Object.entries(bag ?? {})) {
      out.push({ where, key: key.toLowerCase(), kind: v?.kind, picks: (v?.picks ?? []).map((p) => String(p).toLowerCase()) });
      for (const sub of Object.values(v?.sub ?? {})) walk(sub, where);
    }
  };
  for (const cls of c.classes ?? []) walk(cls.choices, 'class');
  walk(c.species?.choices, 'species');
  walk(c.origin?.choices, 'origin');
  walk(c.origin?.originFeat?.choices, 'feat');
  return out;
}

const db = loadDb();
const species = defaultSpecies(db);
const seen = new Map();

/** Soma as candidatas de um personagem. */
function visit(character, unit, only = null) {
  const catalog = derivePlayCatalog(character, db);
  const entries = bagEntries(character);
  const wantWhere = { class: ['class'], subclass: ['class'], species: ['species'], feat: ['feat', 'class'] };
  for (const f of catalog.featureList ?? []) {
    if (only && !(f.kind === 'feat' && f.name === only)) continue;
    const key = `${f.name}|${f.source}|${f.section}`;
    if (seen.has(key) || NOT_A_CHOICE[f.name.toLowerCase()]) continue;
    const text = plainText(f.entries);
    const cue = cueOf(text);
    if (!cue) continue;
    const name = f.name.toLowerCase();
    const named = entries.some((e) => e.key.includes(name) || (ALIASES[name] && e.key.includes(ALIASES[name])) || e.picks.some((p) => p.startsWith(`${name}|`)));
    const typed = cue.kind !== 'named' && entries.some((e) => (wantWhere[f.kind] ?? []).includes(e.where) && (e.kind === cue.kind || (cue.kind === 'spell' && /spell/.test(e.kind ?? '')) || ((cue.kind === 'skill' || cue.kind === 'tool') && e.kind === 'mixed')));
    const spells = cue.kind === 'spell' && /^(?:spellcasting|pact magic)$/.test(name) && (character.classes ?? []).some((c) => Object.keys(c.spells ?? {}).length || (c.spells?.length ?? 0));
    if (named || typed || spells) continue;
    seen.set(key, { name: f.name, source: f.source, kind: f.kind, section: f.section, unit, cue: cue.kind, text });
  }
}

/** O hospedeiro de um talento. */
function featBuild(row) {
  const feat = (db.feats?.feat ?? []).find((x) => x.name === row.name && x.source === row.source);
  const origin = row.category === 'O' || row.category === 'D';
  const caster = /spell/i.test(JSON.stringify(feat?.prerequisite ?? ''));
  const slot = { G: ['feat@4', 4], FS: ['feat@1', 1], 'FS:P': ['feat@2', 2], 'FS:R': ['feat@2', 2], EB: ['feat@19', 19] }[row.category] ?? ['feat@4', 4];
  const classId = row.category === 'FS:P' ? 'paladin' : row.category === 'FS:R' ? 'ranger' : caster ? 'wizard' : 'fighter';
  return autoBuild(db, {
    classId, classSource: 'XPHB', level: origin ? 1 : slot[1], ...species, seed: 7,
    ...(origin ? { originFeat: { id: row.name, source: row.source } } : {}),
    preset: (c) => { if (!origin) c.classes[0].choices[slot[0]] = { kind: 'feat', picks: [`${row.name}|${row.source}`], sub: {} }; },
  });
}

if (!args.kind || args.kind === 'class' || args.kind === 'subclass') {
  for (const row of classMatrix(db)) {
    visit(autoBuild(db, { classId: row.classId, classSource: row.classSource, subclassId: row.subclassId, subclassSource: row.subclassSource, level: 20, ...species, seed: hashSeed(row.id, 1) }).character, row.id);
  }
}
if (!args.kind || args.kind === 'species') {
  for (const row of speciesMatrix(db)) {
    visit(autoBuild(db, { classId: 'fighter', classSource: 'XPHB', level: 5, speciesId: row.speciesId, speciesSource: row.speciesSource, lineage: row.lineage, seed: hashSeed(row.id, 1) }).character, row.id);
  }
}
if (!args.kind || args.kind === 'feat') {
  for (const row of featMatrix(db)) {
    try { visit(featBuild(row).character, row.id, row.name); } catch { /* o sweep da T3 prova o talento */ }
  }
}

const list = [...seen.values()].filter((f) => !args.kind || f.kind === args.kind)
  .sort((a, b) => a.kind.localeCompare(b.kind) || a.section.localeCompare(b.section) || a.name.localeCompare(b.name));
const byKind = {};
for (const f of list) {
  const row = (byKind[f.kind] ??= {});
  row[f.cue] = (row[f.cue] ?? 0) + 1;
}
console.table(byKind);
for (const f of list) {
  console.log(`${f.kind.padEnd(8)} ${f.cue.padEnd(8)} ${f.name} [${f.source}] (${f.section})`);
  if (args.text) console.log(`    ${f.text.slice(0, 600)}\n`);
}
console.log(`\ncandidatas: ${list.length}`);
