// =============================================================================
// survey-legacy-adaptation: o legado que o app oferece, adaptado às regras de 2024
// =============================================================================
// O QUE FAZ
//   Uso: npx vite-node scripts/survey-legacy-adaptation.js [--list] [--cue=ki|channel|pact|known]
//   O gabarito do E3 do DDL-0224. Monta no nível 20 cada subclasse LEGADA que o seletor
//   oferece (`edition: classic`, sem reprint) e lista as features cujo texto cita um recurso
//   ou uma feature de 2014 que mudou em 2024, com o estado de cada uma:
//   - adaptada: gasta o recurso de 2024 (uma entrada do FEATURE_ROLLS que gasta, ou uma
//     activity do catálogo que consome o pool);
//   - explicada: o motivo escrito em `EXPLAINED`;
//   - em aberto: o resto, o trabalho que falta.
//
// FUNÇÕES
//   cuesOf(text): as pistas de 2014 do texto.
//   adapted(cue, feature, catalog): a feature já gasta o recurso de 2024?
//
// DECISÕES E ARMADILHAS
//   - Pistas (`CUES`): ki (o Focus do Monk's Focus), Channel Divinity (o pool da classe, com
//     a contagem de 2024), Pact of the Blade (a invocação de 2024), "spells known" ou
//     "cantrips known" (as tabelas de 2014; em 2024 a classe prepara).
//   - Só conta a subclasse que o jogador pode escolher: a reeditada não existe no app.
//   - `EXPLAINED` é por nome de feature e pista, com o motivo, como no survey-play-coverage.
// -----------------------------------------------------------------------------
import process from 'node:process';
import { loadDb } from './lib/loadDb.js';
import { classMatrix, defaultSpecies } from './lib/matrix.js';
import { autoBuild } from './lib/autoBuild.js';
import { hashSeed } from './lib/rng.js';
import { derivePlayCatalog } from '../src/engine/playCatalog.js';
import { plainText } from '../src/engine/playFeatures.js';
import { featureRollOf } from '../src/engine/playFeatureRolls.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));

const CUES = [
  ['ki', /\bki points?\b|\bspend(?:ing)? \d+ ki\b|\bexpend(?:ing)? \d+ (?:to \d+ )?ki\b/i, 'pool:monks-focus', "Monk's Focus"],
  ['channel', /\bchannel divinity\b/i, 'pool:channel-divinity', 'Channel Divinity'],
  ['pact', /\bpact of the blade\b/i, null, null],
  ['known', /\bspells known\b|\bcantrips known\b/i, null, null],
];

const FLAVOUR = 'the text names the old resource only as flavour or a header; nothing is spent';
const ALT_COST = 'an alternative cost when the own pool is empty: the counter is adjusted by hand (DDL-0202)';
const UMBRELLA = 'the umbrella of the Channel Divinity options: the options themselves spend the class pool';
const PACT = 'the Pact of the Blade invocation of 2024 satisfies it (checkPact reads the chosen options)';
const KNOWN = 'the 2024 sorcerer prepares from its list; the extra list is the spell-list widening';
const EXPLAINED = {
  ki: {
    'way of the astral self': FLAVOUR, 'way of the long death': FLAVOUR, 'way of the kensei': FLAVOUR, 'way of the sun soul': FLAVOUR, 'way of the ascendant dragon': FLAVOUR,
    'breath of the dragon': ALT_COST, 'aspect of the wyrm': ALT_COST, 'ascendant aspect': ALT_COST,
  },
  channel: {
    'inescapable destruction': 'names the Channel Divinity options only to say their necrotic damage ignores resistance; nothing is spent',
    'control undead': "an option of the Oathbreaker's umbrella Channel Divinity, whose activities spend the class pool",
  },
  pact: { 'hex warrior': PACT, 'improved pact weapon': PACT },
  known: { 'divine magic': KNOWN },
};

/** As pistas de 2014 do texto. */
function cuesOf(text) {
  return CUES.filter(([, re]) => re.test(text));
}

/** A feature já gasta o recurso de 2024? */
function adapted([, , poolKey, item], feature, catalog) {
  if (!poolKey) return false;
  if (feature.spendItem === item) return true;
  const e = featureRollOf(feature.name);
  if (e && [e.spend, ...(e.also ?? []).map((a) => a.spend)].some((sp) => sp?.item === item)) return true;
  const action = (catalog.actions ?? []).find((a) => a.key === feature.actionKey);
  return (action?.activities ?? []).some((x) => (x.consumes ?? []).some((c) => String(c.key ?? '').startsWith(poolKey)));
}

const db = loadDb();
const species = defaultSpecies(db);
const legacyRows = classMatrix(db).filter((r) => r.subclassId
  && (db[`class-${r.classId}`]?.subclass ?? []).find((s) => s.shortName === r.subclassId && s.source === r.subclassSource)?.edition === 'classic');

const rows = [];
for (const row of legacyRows) {
  const built = autoBuild(db, { ...row, level: 20, ...species, seed: hashSeed(row.id, 1) });
  const catalog = derivePlayCatalog(built.character, db);
  for (const f of catalog.featureList ?? []) {
    if (f.kind !== 'subclass') continue;
    const text = `${f.name}. ${plainText(f.entries ?? [])}`;
    for (const c of cuesOf(text)) {
      if (args.cue && c[0] !== args.cue) continue;
      const why = EXPLAINED[c[0]]?.[f.name.toLowerCase()] ?? (c[0] === 'channel' && /^channel divinity$/i.test(f.name) ? UMBRELLA : null);
      const state = adapted(c, f, catalog) ? 'adapted' : why ? 'explained' : 'open';
      rows.push({ unit: `${row.classId}/${row.subclassId}`, feature: f.name, cue: c[0], state, why });
    }
  }
}

const table = {};
for (const r of rows) {
  table[r.cue] ??= { adapted: 0, explained: 0, open: 0 };
  table[r.cue][r.state] += 1;
}
console.log(`${legacyRows.length} subclasses legadas oferecidas, ${rows.length} pistas de 2014 em features`);
console.table(table);
for (const r of rows.filter((x) => x.state === 'open' || args.list)) console.log(`  ${r.state.padEnd(9)} ${r.cue.padEnd(7)} ${r.unit}: ${r.feature}${r.why && args.list ? ` (${r.why})` : ''}`);
