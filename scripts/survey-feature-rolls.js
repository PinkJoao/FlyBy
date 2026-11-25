// =============================================================================
// survey-feature-rolls: as features ativas que rolam dado e o play mode não rola
// =============================================================================
// O QUE FAZ
//   Uso: npx vite-node scripts/survey-feature-rolls.js [--text] [--all]
//   Monta cada classe e subclasse no nível 20 e cada espécie (a matriz), deriva o
//   catálogo do play mode e lista as features ATIVAS (isActiveFeature) que não têm
//   activity nem entrada no registro curado FEATURE_ROLLS (engine/playFeatureRolls,
//   DDL-0205) e cujo texto ROLA dado (um "1d8", o "Bardic Inspiration die", o
//   "Superiority die"). É o gabarito das próximas famílias do registro. Com --text
//   imprime o texto de cada uma; com --all lista também as ativas que não rolam.
//
// FUNÇÕES
//   rollsDice(text): o texto rola dado?
//   visit(catalog): soma as features de um catálogo ao relatório.
//
// DECISÕES E ARMADILHAS
//   - Por PROSA, sem filtrar por fonte (§6.1): a feature legada alcançável pelo chassi
//     2024 entra.
//   - É um gabarito, não um gerador: cada entrada nova do registro é conferida à mão
//     contra o texto, que este relatório imprime com --text.
//   - O que tem activity já rola pelo "Use" (engine/playUse); o que está no registro já
//     rola pelo diálogo ou pelo "Use". Os dois somem do relatório.
// -----------------------------------------------------------------------------
import process from 'node:process';
import { loadDb } from './lib/loadDb.js';
import { classMatrix, speciesMatrix, defaultSpecies } from './lib/matrix.js';
import { autoBuild } from './lib/autoBuild.js';
import { hashSeed } from './lib/rng.js';
import { derivePlayCatalog } from '../src/engine/playCatalog.js';
import { isActiveFeature, plainText } from '../src/engine/playFeatures.js';
import { featureRollOf } from '../src/engine/playFeatureRolls.js';

const TEXT = process.argv.includes('--text');
const ALL = process.argv.includes('--all');
const DICE = /\b\d+d\d+\b|\b(?:bardic inspiration|superiority|psionic energy|martial arts|exertion) die\b/i;

/** O texto rola dado? */
const rollsDice = (text) => DICE.test(text);

const db = loadDb();
const species = defaultSpecies(db);
const seen = new Map();

/** Soma as features de um catálogo ao relatório. */
function visit(catalog, unit) {
  const actions = new Map((catalog.actions ?? []).map((a) => [a.key, a]));
  const pools = (catalog.resources ?? []).filter((r) => r.kind === 'pool');
  for (const f of catalog.featureList ?? []) {
    const key = `${f.name}|${f.source}`;
    if (seen.has(key)) continue;
    const action = actions.get(f.actionKey);
    const mine = pools.filter((p) => p.item === f.name);
    if (!isActiveFeature(f, action, mine)) continue;
    if ((action?.activities ?? []).length || featureRollOf(f.name)) continue;
    const text = plainText(f.entries);
    const dice = rollsDice(text);
    if (!dice && !ALL) continue;
    seen.set(key, { name: f.name, source: f.source, kind: f.kind, section: f.section, unit, dice, pools: mine.map((p) => p.key), text });
  }
}

for (const row of classMatrix(db)) {
  const built = autoBuild(db, { classId: row.classId, classSource: row.classSource, subclassId: row.subclassId, subclassSource: row.subclassSource, level: 20, ...species, seed: hashSeed(row.id, 1) });
  visit(derivePlayCatalog(built.character, db), row.id);
}
for (const row of speciesMatrix(db)) {
  const built = autoBuild(db, { classId: 'fighter', classSource: 'XPHB', level: 5, speciesId: row.speciesId, speciesSource: row.speciesSource, lineage: row.lineage, seed: hashSeed(row.id, 1) });
  visit(derivePlayCatalog(built.character, db), row.id);
}

const list = [...seen.values()].sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name));
for (const f of list) {
  console.log(`${f.dice ? '*' : ' '} ${f.name} [${f.source}] (${f.section})${f.pools.length ? ` pools=${f.pools.join(',')}` : ''}`);
  if (TEXT) console.log(`    ${f.text.slice(0, 700)}\n`);
}
console.log(`\nativas sem activity nem registro${ALL ? '' : ' que rolam dado'}: ${list.length}`);
