// =============================================================================
// survey-feature-uses: o levantamento dos POOLS DE USO que a prosa declara
// =============================================================================
// O QUE FAZ
//   Uso: npx vite-node scripts/survey-feature-uses.js [--all]
//   Lê a PROSA de cada traço de espécie, feature de classe e de subclasse (até o
//   nível 20) e talento que o jogador pode escolher, e acha as frases de uso
//   limitado ("Once you use this trait, you can't use it again until you finish a
//   Long Rest", "a number of times equal to your Proficiency Bonus ... regain all
//   expended uses"). Compara com o `system.uses` que o export emite (registro
//   curado, SRD, overlay, a prosa) e com o pool das activities (a forma do
//   SRD), e lista o que a prosa limita e o export deixa SEM pool.
//   Com --emit, imprime as linhas do PROSE_USES_* do foundryFeatureUses
//   (DDL-0106), para conferir à mão antes de colar. Com --all, lista também os
//   que já têm pool: o lado que a assinatura TEM de achar, para conferir que ela
//   não está cega.
//
// FUNÇÕES
//   sentences(text): as frases de um texto.
//   limitSentence(text): a frase de uso limitado, ou null.
//   countIn(s), guessMax(sentence, previous), guessRecovery(sentence): a leitura
//     do número (na frase do limite, ou na anterior) e do descanso.
//   check(unit, owner, item): uma linha do relatório.
//
// DECISÕES E ARMADILHAS
//   - A assinatura é por PROSA, não por tag (§6.1), e é ESTREITA: exige "can't
//     use it again until you finish" ou "regain (all) expended uses", e descarta
//     a frase que fala em CONJURAR (o limite de magia concedida é de outro
//     registro, grantedSpellUses).
//   - A feature que gasta o pool de OUTRA ("expend a use of your Channel
//     Divinity") não casa: ela não tem pool próprio.
//   - O resultado é um GABARITO para curar o foundryFeatureUses, não um gerador
//     automático: a leitura do número segue regras fixas (a frase do limite, ou
//     a anterior quando ela só fala em recuperar) e cada linha é conferida à mão.
//     O que não é pool próprio vai para o NOT_A_POOL e some do relatório.
// -----------------------------------------------------------------------------
import process from 'node:process';
import { loadDb } from './lib/loadDb.js';
import { classMatrix, speciesMatrix } from './lib/matrix.js';
import { resolveClassObj, resolveSubclassObj, resolveRaceObj } from '../src/engine/resolve.js';
import {
  resolveClassFeatures, resolveSubclassFeatures, buildFeatureItem, buildSpeciesTraitItems, buildFeatItem,
} from '../src/engine/foundryItems.js';
import { htmlToText } from '../src/engine/foundryImport.js';
import { latestOnly } from '../src/selector/reprints.js';
import { NOT_A_POOL } from '../src/engine/foundryFeatureUses.js';

const ALL = process.argv.includes('--all');
const EMIT = process.argv.includes('--emit');

/** As frases de um texto. */
const sentences = (text) => String(text).replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/);

const LIMIT = /(?:can(?:'|’)?t|cannot) (?:use|do|activate|invoke|transform|channel)\b[^.]*?\bagain until you finish a (?:Short or Long|Long|Short) Rest|regain (?:all )?(?:of )?(?:the )?expended uses/i;

/** A frase de uso limitado, ou null. */
function limitSentence(text) {
  const list = sentences(text);
  const i = list.findIndex((s) => LIMIT.test(s) && !/\bcast\b/i.test(s));
  return i < 0 ? null : { sentence: list[i], previous: list[i - 1] ?? '' };
}

const WORDS = { twice: '2', 'three times': '3', 'four times': '4', 'five times': '5' };

/** O número que UMA frase declara, ou null. */
function countIn(s) {
  if (!s) return null;
  if (/(?:number of times|times per day) equal to your Proficiency\b|Proficiency Bonus times/i.test(s)) return '@prof';
  const mod = s.match(/number of times equal to (?:your )?(\w+) modifier( \((?:a )?minimum of (?:once|1)\))?/i);
  if (mod) {
    const ab = mod[1].slice(0, 3).toLowerCase();
    return mod[2] ? `max(1, @abilities.${ab}.mod)` : `@abilities.${ab}.mod`;
  }
  const word = s.match(/\b(twice|three times|four times|five times)\b/i);
  return word ? WORDS[word[1].toLowerCase()] : null;
}

/** A leitura do máximo: a frase do limite, a anterior quando ela só fala em recuperar, ou 1. */
function guessMax(sentence, previous) {
  const own = countIn(sentence);
  if (own) return own;
  if (/regain (?:all )?(?:of )?(?:the )?expended uses/i.test(sentence)) return countIn(previous) ?? '?';
  return '1';
}

/** O descanso da recuperação. */
function guessRecovery(sentence) {
  if (/Short (?:Rest )?or Long Rest/i.test(sentence)) return 'sr';
  if (/Long Rest/i.test(sentence)) return 'lr';
  if (/Short Rest/i.test(sentence)) return 'sr';
  return '?';
}

const report = new Map();

/** Registra uma linha do relatório. */
function check(unit, owner, item, classId = null) {
  if (NOT_A_POOL.has(String(item?.name).toLowerCase())) return;
  const text = htmlToText(item?.system?.description?.value ?? '');
  const hit = limitSentence(text);
  if (!hit) return;
  const activityMax = Object.values(item.system.activities ?? {}).find((a) => a?.uses?.max)?.uses.max;
  const max = item.system.uses?.max || (activityMax ? `activity: ${activityMax}` : '');
  if (max && !ALL) return;
  const key = `${unit}|${item.name}|${max ?? ''}`;
  const row = report.get(key) ?? {
    unit, name: item.name, classId, max: max || '-', maxGuess: guessMax(hit.sentence, hit.previous), restGuess: guessRecovery(hit.sentence), guess: `${guessMax(hit.sentence, hit.previous)} / ${guessRecovery(hit.sentence)}`,
    sentence: hit.sentence.slice(0, 200), owners: new Set(),
  };
  row.owners.add(owner);
  report.set(key, row);
}

const db = loadDb();

for (const row of speciesMatrix(db)) {
  const raceObj = resolveRaceObj(db, row.speciesId, row.speciesSource, row.lineage);
  if (!raceObj) continue;
  for (const item of buildSpeciesTraitItems(raceObj, db)) check('species', row.id.slice(8), item);
}

const seenClass = new Set();
for (const row of classMatrix(db)) {
  const classObj = resolveClassObj(db, row.classId, row.classSource);
  if (!classObj) continue;
  const classId = classObj.name.toLowerCase();
  if (!seenClass.has(classId)) {
    seenClass.add(classId);
    for (const f of resolveClassFeatures(db, classId, classObj, 20)) check('class', classObj.name, buildFeatureItem({ ...f, classId }, db), classId);
  }
  const subObj = row.subclassId ? resolveSubclassObj(db, row.classId, row.subclassId, row.subclassSource) : null;
  if (!subObj) continue;
  for (const f of resolveSubclassFeatures(subObj, classId, db, { max: 20 })) {
    check('subclass', `${classObj.name}/${subObj.shortName}`, buildFeatureItem({ ...f, classId, subclass: { shortName: subObj.shortName, name: subObj.name } }, db), classId);
  }
}

for (const feat of latestOnly(db.feats?.feat ?? [])) {
  check('feat', `${feat.name}|${feat.source}`, buildFeatItem(feat, { level: 1, db }));
}

const rows = [...report.values()].sort((a, b) => a.unit.localeCompare(b.unit) || a.name.localeCompare(b.name));
if (EMIT) {
  const lines = { byClass: new Map(), flat: new Map() };
  for (const r of rows.filter((x) => x.max === '-')) {
    const flat = !r.classId;
    const key = flat ? r.name.toLowerCase() : `${r.classId}|${r.name.toLowerCase()}`;
    const value = `['${r.maxGuess}', '${r.restGuess}']`;
    const table = flat ? lines.flat : lines.byClass;
    if (table.has(key) && table.get(key) !== value) console.error(`CONFLITO ${key}: ${table.get(key)} x ${value}`);
    table.set(key, value);
  }
  const out = (m) => [...m].map(([k, v]) => `  ${JSON.stringify(k)}: ${v},`);
  console.log(['BY_CLASS', ...out(lines.byClass), 'FLAT', ...out(lines.flat)].join('\n'));
  process.exit(0);
}
for (const r of rows) {
  console.log(`${r.unit.padEnd(8)} ${r.name}  [export: ${r.max}]  [prosa: ${r.guess}]`);
  console.log(`         ${[...r.owners].slice(0, 4).join(', ')}${r.owners.size > 4 ? ` +${r.owners.size - 4}` : ''}`);
  console.log(`         "${r.sentence}"`);
}
const missing = rows.filter((r) => r.max === '-');
console.log(`\n=== ${missing.length} pool(s) na prosa sem uses no export${ALL ? `, ${rows.length - missing.length} com` : ''} ===`);
