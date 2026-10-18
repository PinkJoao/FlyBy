// =============================================================================
// survey-granted-spells: o levantamento das CONCESSÕES DE MAGIA com uso próprio
// =============================================================================
// O QUE FAZ
//   Uso: npx vite-node scripts/survey-granted-spells.js
//   Uma magia CONCEDIDA por feature pode trazer um pool de usos próprio ("once per
//   Long Rest", "a number of times equal to your Wisdom modifier"). Duas dessas não
//   são a mesma linha na ficha mesmo com o mesmo nome: o Ranger com Hunter's Mark
//   concedido E escolhido, o Archfey que ganha Misty Step por DUAS features.
//   Qualquer operação que DEDUPE magias por nome usa esta lista como gabarito
//   (TC-0089): dedupar picks entre si é seguro, colapsar uma concessão com uso
//   próprio não é. Cobre as duas origens de concessão: o `additionalSpells`
//   ESTRUTURADO (o dado declara a frequência) e a PROSA ("without expending a spell
//   slot", "once ... until you finish a Long Rest"), onde a frequência só existe no
//   texto (DDL-0011/DDL-0086).
//   A saída une as linhas idênticas (o mesmo grant visto por dois caminhos do dado)
//   e, na parte 2, mostra o risco concreto: o MESMO nome vindo de FONTES DIFERENTES
//   na mesma classe com pelo menos uma de uso próprio, onde dedupar por nome
//   perderia um pool.
//
// FUNÇÕES
//   flatten(additionalSpells): {bucket, level, spell} achatado, nas três formas do
//     5etools (lista simples, aninhamento por frequência e a entrada de ESCOLHA,
//     que vira o rótulo "<choose ...>").
//   clean(s): o nome comparável (sem a fonte nem o sufixo #c, minúsculo).
//
// DECISÕES E ARMADILHAS
//   - No flatten, uma chave NUMÉRICA é o NÍVEL enquanto não há um; depois de uma
//     frequência, ela é a CONTAGEM de usos.
// -----------------------------------------------------------------------------

import { loadDb } from './lib/loadDb.js';
import { INNATE_USES } from '../src/engine/grantedSpellUses.js';

const CLASSES = ['artificer', 'barbarian', 'bard', 'cleric', 'druid', 'fighter',
  'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard'];

const NUMERIC = /^[0-9]+$/;

/** Um `additionalSpells` achatado em {bucket, level, spell}. */
function flatten(additionalSpells) {
  const out = [];
  const push = (bucket, level, freq, sp) => {
    if (sp && typeof sp === 'object') {
      out.push({ bucket, level, freq, spell: `<choose ${sp.choose ?? JSON.stringify(sp)}>` });
      return;
    }
    out.push({ bucket, level, freq, spell: sp });
  };
  const walk = (bucket, level, freq, val) => {
    if (val == null) return;
    if (Array.isArray(val)) {
      for (const sp of val) push(bucket, level, freq, sp);
      return;
    }
    if (typeof val !== 'object') return;
    for (const [k, inner] of Object.entries(val)) {
      const isNum = NUMERIC.test(k);
      const nextLevel = level == null && isNum ? Number(k) : level;
      let nextFreq = freq;
      if (!isNum) nextFreq = freq ? `${freq}:${k}` : k;
      else if (freq) nextFreq = `${freq}:${k}`;
      walk(bucket, nextLevel, nextFreq, inner);
    }
  };
  for (const group of additionalSpells ?? []) {
    for (const [bucket, byLevel] of Object.entries(group)) {
      if (bucket === 'ability' || bucket === 'name') continue;
      walk(bucket, null, null, byLevel);
    }
  }
  return out;
}

const clean = (s) => String(s).split('|')[0].replace(/#c$/, '').toLowerCase();

const db = await loadDb();
const rows = [];

for (const cls of CLASSES) {
  const file = db[`class-${cls}`];
  if (!file) continue;

  const owners = [
    ...(file.class ?? []).map((o) => ({ o, kind: 'class', label: o.name })),
    ...(file.subclass ?? []).map((o) => ({ o, kind: 'subclass', label: o.name })),
  ];
  for (const { o, kind, label } of owners) {
    for (const g of flatten(o.additionalSpells)) {
      rows.push({
        cls, kind, owner: label, level: g.level, spell: clean(g.spell),
        bucket: g.bucket, freq: g.freq, via: 'additionalSpells',
      });
    }
  }

  for (const key of ['classFeature', 'subclassFeature']) {
    for (const f of file[key] ?? []) {
      const t = JSON.stringify(f.entries ?? []);
      if (!/\{@spell /.test(t)) continue;
      const free = /without expending a spell slot|without expending any spell slots/i.test(t);
      if (!free) continue;
      const spells = [...new Set([...t.matchAll(/\{@spell ([^}|]+)/g)].map((m) => m[1].toLowerCase()))];
      const once = /again until you finish a \{@variantrule (Long|Short) Rest/i.test(t);
      for (const sp of spells) {
        rows.push({
          cls, kind: key === 'classFeature' ? 'class' : 'subclass',
          owner: f.subclassShortName ? `${f.subclassShortName} / ${f.name}` : f.name,
          level: f.level, spell: sp, bucket: 'prose', freq: once ? 'once-per-rest' : 'free',
          via: 'prosa',
        });
      }
    }
  }
}

const seenRow = new Set();
const uniq = rows.filter((r) => {
  const k = `${r.cls}|${r.owner}|${r.level}|${r.spell}|${r.bucket}|${r.freq}`;
  if (seenRow.has(k)) return false;
  seenRow.add(k);
  return true;
});
const withUses = uniq.filter((r) => r.freq || r.bucket === 'prose');

console.log('=== 1. CONCESSOES COM USO PROPRIO (o gabarito da dedup) ===\n');
console.log('Uma magia daqui pode aparecer DUAS vezes numa ficha legitimamente:');
console.log('concedida (com o pool) e escolhida, ou concedida por duas features.\n');
let cur = '';
for (const r of withUses.sort((a, b) => a.cls.localeCompare(b.cls) || a.owner.localeCompare(b.owner) || a.level - b.level)) {
  if (r.cls !== cur) { console.log(`\n--- ${r.cls.toUpperCase()} ---`); cur = r.cls; }
  const src = r.via === 'prosa' ? 'PROSA' : r.bucket;
  console.log(`  @${String(r.level).padStart(2)}  ${r.spell.padEnd(26)} ${src.padEnd(9)} ${(r.freq ?? '').padEnd(14)} ${r.owner}`);
}

console.log('\n\n=== 2. MESMA MAGIA por DUAS fontes na mesma classe (risco de dedup) ===\n');
const byClassSpell = new Map();
for (const r of uniq) {
  const k = `${r.cls}|${r.spell}`;
  if (!byClassSpell.has(k)) byClassSpell.set(k, []);
  byClassSpell.get(k).push(r);
}
let collisions = 0;
for (const [k, list] of [...byClassSpell].sort()) {
  const owners = new Set(list.map((r) => r.owner));
  if (owners.size < 2) continue;
  if (!list.some((r) => r.freq || r.bucket === 'prose')) continue;
  collisions++;
  const [cls, spell] = k.split('|');
  console.log(`  ${cls.padEnd(9)} ${spell}`);
  for (const r of list) {
    console.log(`      ${r.owner} @${r.level}  [${r.via === 'prosa' ? 'PROSA' : r.bucket}${r.freq ? ` ${r.freq}` : ''}]`);
  }
}
console.log(`\n  ${collisions} colisao(oes).`);

console.log('\n\n=== 3. O que o INNATE_USES ja cura (frequencia so na prosa) ===\n');
for (const [entity, table] of Object.entries(INNATE_USES)) {
  console.log(`  ${entity}: ${Object.entries(table).map(([s, v]) => `${s} (${v.castType}${v.count ? ` x${v.count}` : ''})`).join(', ')}`);
}

console.log(`\n\nTotal: ${uniq.length} concessoes, ${withUses.length} com uso/frequencia propria.`);
