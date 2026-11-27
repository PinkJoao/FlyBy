// =============================================================================
// ui-u3-sample: a amostra da régua com as escolhas de classe apagadas (U3, docs/UI-TEST-PLAN.md)
// =============================================================================
// O QUE FAZ
//   Sorteia combinações como a amostra da régua do lançamento (`scripts/release-bar.js`: a mesma
//   semente e a mesma ordem de sorteio de classe x subclasse, espécie e nível), fica com as de
//   nível 3 ou mais com subclasse, monta cada uma pelo `autoBuild` sobre a cópia local do
//   5e.tools (`loadDb`), com o kit inicial (`withStartingKit`, o dos modelos), e APAGA o que o
//   guia de nível preenche: a subclasse, as escolhas da classe e as magias. A espécie, a origem,
//   o kit e as proficiências da classe ficam prontos. O `testing/ui/u3-sample.spec.js` abre a ficha e deixa o
//   guia de nível (o botão do guia) preencher tudo na tela, escolhendo a subclasse sorteada.
//   Grava `test-results/ui-data/u3-sample.json`.
//
//   npx vite-node scripts/ui-u3-sample.js [--count=<n>]
//
// FUNÇÕES
//   stripped(db, character, label): o personagem sem a subclasse, as escolhas (fora as de
//     proficiência) e as magias da classe.
//
// DECISÕES E ARMADILHAS
//   - O sorteio repete o da régua (três números por combinação, na mesma ordem) e só filtra
//     depois: as combinações são as da régua, não outras.
//   - Nível 3 ou mais e com subclasse: abaixo disso o guia de nível só tem as escolhas de classe
//     do nível 1, que a U3 do guia de criação já cobre.
//   - As escolhas de PROFICIÊNCIA da classe (`isProficiencyChoice`) e o kit ficam: são passos do
//     guia de CRIAÇÃO, e com eles por fazer o botão do guia abre a criação, não o guia de nível.
//   - Uma combinação que o `autoBuild` não fecha fica fora (a régua já a acusa) e é contada.
//   - O id leva o índice no sorteio: duas combinações iguais não colidem no IndexedDB.
//   - Roda no `globalSetup` (testing/ui/global-setup.js), junto do esperado da U2.
// -----------------------------------------------------------------------------

import fs from 'node:fs';
import process from 'node:process';
import { loadDb, snapshotVersion } from './lib/loadDb.js';
import { classMatrix, speciesMatrix } from './lib/matrix.js';
import { autoBuild } from './lib/autoBuild.js';
import { hashSeed, mulberry32 } from './lib/rng.js';
import { withStartingKit } from './lib/startingKit.js';
import { makeSubclassEntity } from '../src/selector/entities/subclass.js';
import { buildClassChoices, isProficiencyChoice } from '../src/components/builder/classChoices.js';

const OUT = new URL('../test-results/ui-data/u3-sample.json', import.meta.url);
const COUNT = Number(process.argv.find((a) => a.startsWith('--count='))?.split('=')[1] ?? 16);

/** O personagem sem a subclasse, as escolhas (fora as de proficiência) e as magias da classe. */
function stripped(db, character, label) {
  const c = structuredClone(character);
  const keep = c.classes.map((cls) => new Set(buildClassChoices(db, cls, c).filter(isProficiencyChoice).map((ch) => ch.id)));
  c.meta = { ...c.meta, name: label, guided: true };
  c.identity = { ...c.identity, name: label };
  c.classes.forEach((cls, i) => {
    cls.subclassId = null;
    cls.subclassSource = null;
    cls.choices = Object.fromEntries(Object.entries(cls.choices ?? {}).filter(([id]) => keep[i].has(id)));
    cls.spells = [];
  });
  return c;
}

const db = await loadDb();
const rng = mulberry32(20261118);
const classList = classMatrix(db);
const speciesList = speciesMatrix(db);
const rows = [];
let skipped = 0;
for (let i = 0; i < 300 && rows.length < COUNT; i++) {
  const c = classList[Math.floor(rng() * classList.length)];
  const s = speciesList[Math.floor(rng() * speciesList.length)];
  const level = 1 + Math.floor(rng() * 20);
  if (level < 3 || !c.subclassId) continue;
  const id = `${c.id} + ${s.id} @${level}`;
  const built = autoBuild(db, { ...c, level, speciesId: s.speciesId, speciesSource: s.speciesSource, lineage: s.lineage, seed: hashSeed(id, 1) });
  if (!built.ok) {
    skipped += 1;
    continue;
  }
  const sub = makeSubclassEntity(c.classId).list(db).find((x) => x.shortName === c.subclassId && x.source === c.subclassSource);
  const label = `U3 ${c.className} ${level} ${String(i).padStart(3, '0')}`;
  const kitProblems = [];
  withStartingKit(db, built.character, mulberry32(hashSeed(id, 9)), kitProblems);
  const character = stripped(db, built.character, label);
  character.id = `u3-sample-${i}`;
  rows.push({ id, label, level, className: c.className, subclass: { id: c.subclassId, name: sub?.name ?? c.subclassId, source: c.subclassSource }, character });
}
fs.mkdirSync(new URL('.', OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ version: snapshotVersion(), rows }, null, 1));
console.log(`[U3] ${rows.length} combinações da régua sem as escolhas de classe (${skipped} fora: o autoBuild não fecha) em test-results/ui-data/u3-sample.json`);
