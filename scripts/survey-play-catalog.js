// =============================================================================
// survey-play-catalog: o catálogo do play mode sobre a matriz inteira
// =============================================================================
// O QUE FAZ
//   Uso: npx vite-node scripts/survey-play-catalog.js [--class=X] [--species=Y] [--list]
//   Monta cada unidade da matriz da Fase T (classe x subclasse, espécie x
//   linhagem) pelo autoBuild, deriva o catálogo de jogo (engine/playCatalog) e
//   junta os `problems`: pool sem máximo, ataque sem fórmula, consumo que não
//   aponta para um pool, fórmula que não resolve, CD sem origem. Deve dar 0
//   (docs/PLAY-MODE-PLAN.md, C1). As classes são conferidas nos níveis 1, 3, 5,
//   11, 17 e 20; as espécies, no 5.
//   Também conta o lado que TEM de aparecer (§6.1, a sonda não pode estar cega):
//   pools, ações de feature com consumo e ataques por unidade.
//   Com --list, imprime cada problema com a unidade; sem ele, agrupa pela
//   mensagem.
//
// FUNÇÕES
//   atLevel(db, character, level): o personagem com a classe no nível dado.
//   survey(db, unit, character, out): deriva o catálogo e anota.
//
// DECISÕES E ARMADILHAS
//   - O nível se troca como o sweep troca (cleanupClassEntry), para não derivar
//     features acima do nível com as escolhas de nível 20.
//   - Agrupar pela MENSAGEM mostra a família (§6.1): um alvo de consumo do overlay
//     que não resolve aparece uma vez com todas as unidades que o têm.
//   - KNOWN_GAPS nomeia, com o TC aberto, o que já foi medido e espera conserto
//     (como o EXPECTED do comparador, §6.2): predicado ESTREITO, pelo nome da
//     feature e pela mensagem, para não engolir uma lacuna nova. Conta à parte; o
//     número que tem de dar 0 é o dos problemas sem explicação. Hoje a lista está
//     VAZIA: os TC-0093 a TC-0095 fecharam em 2026-10-24 (CHANGELOG §169).
// -----------------------------------------------------------------------------

import process from 'node:process';
import { loadDb } from './lib/loadDb';
import { classMatrix, speciesMatrix, defaultSpecies } from './lib/matrix';
import { autoBuild } from './lib/autoBuild';
import { hashSeed } from './lib/rng';
import { resolveClassObj, resolveSubclassObj } from '../src/engine/resolve';
import { cleanupClassEntry } from '../src/engine/classFeatureChoices';
import { derivePlayCatalog } from '../src/engine/playCatalog';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const LEVELS = [1, 3, 5, 11, 17, 20];

// ATENÇÃO: cada lacuna tem um TC aberto; fechar o TC é tirar a linha daqui e o survey seguir em 0.
const KNOWN_GAPS = [];

/** O personagem com a classe no nível dado. */
function atLevel(db, character, level) {
  const cc = structuredClone(character);
  const e = { ...cc.classes[0], level };
  const classObj = resolveClassObj(db, e.classId, e.source);
  const subclassObj = e.subclassId ? resolveSubclassObj(db, e.classId, e.subclassId, e.subclassSource) : null;
  cc.classes[0] = cleanupClassEntry(e, { classObj, subclassObj, subclassLevel: cc.rulesConfig.subclassLevel });
  return cc;
}

/** Deriva o catálogo e anota problemas e contagens. */
function survey(db, unit, character, out) {
  let catalog;
  try {
    catalog = derivePlayCatalog(character, db);
  } catch (e) {
    out.problems.push({ unit, where: 'catalog', message: `crash: ${e.message}` });
    return;
  }
  out.units += 1;
  out.pools += catalog.resources.filter((r) => r.kind === 'pool').length;
  out.consuming += catalog.actions.filter((a) => a.activities.some((x) => x.consumes.length)).length;
  out.attacks += catalog.attacks.length;
  for (const p of catalog.problems) out.problems.push({ unit, ...p });
}

const db = loadDb();
const out = { units: 0, pools: 0, consuming: 0, attacks: 0, problems: [] };
const species = defaultSpecies(db);

for (const row of classMatrix(db)) {
  if (args.species || (args.class && row.classId !== args.class)) continue;
  const built = autoBuild(db, {
    classId: row.classId, classSource: row.classSource, subclassId: row.subclassId,
    subclassSource: row.subclassSource, level: 20, ...species, seed: hashSeed(row.id, 1),
  });
  for (const level of LEVELS) survey(db, `${row.id}@${level}`, atLevel(db, built.character, level), out);
}
for (const row of speciesMatrix(db)) {
  if (args.class || (args.species && row.speciesId !== args.species)) continue;
  const built = autoBuild(db, {
    classId: 'fighter', classSource: 'XPHB', level: 5, speciesId: row.speciesId,
    speciesSource: row.speciesSource, lineage: row.lineage, seed: hashSeed(row.id, 1),
  });
  survey(db, row.id, built.character, out);
}

const known = new Map(KNOWN_GAPS.map((g) => [g.tc, 0]));
const open = out.problems.filter((p) => {
  const gap = KNOWN_GAPS.find((g) => g.test(p));
  if (gap) known.set(gap.tc, known.get(gap.tc) + 1);
  return !gap;
});

console.log(`unidades: ${out.units} | pools: ${out.pools} | ações com consumo: ${out.consuming} | ataques: ${out.attacks}`);
console.log(`lacunas nomeadas: ${[...known].map(([tc, n]) => `${tc} ${n}`).join(' | ')}`);
console.log(`problemas sem explicação: ${open.length}`);
if (args.list) {
  for (const p of open) console.log(`  ${p.unit} | ${p.where} | ${p.message}`);
} else {
  const groups = new Map();
  for (const p of open) {
    const k = `${p.where} | ${p.message}`;
    if (!groups.has(k)) groups.set(k, new Set());
    groups.get(k).add(p.unit.split('@')[0]);
  }
  for (const [k, units] of [...groups].sort((a, b) => b[1].size - a[1].size)) {
    console.log(`  [${units.size}] ${k}  (${[...units].slice(0, 3).join(', ')}${units.size > 3 ? ', ...' : ''})`);
  }
}
