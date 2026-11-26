// =============================================================================
// ui-check-guide: o personagem que o guia de criação montou NA TELA, conferido no motor (U3)
// =============================================================================
// O QUE FAZ
//   Lê um personagem gravado pelo `testing/ui/u3.spec.js` (o que o guia de criação deixou no
//   IndexedDB, depois do Finish) e confere pelo motor: a derivação não quebra e não dá número
//   inválido, nenhuma pendência obrigatória sobra (`guidancePendencies`, a régua do botão do
//   guia e do `autoBuild`), nenhum passo do guia ficou incompleto (`buildCreateSteps`), e o
//   saco de escolhas tem a MESMA forma do que o `autoBuild` monta para a mesma classe, espécie
//   e linhagem (as mesmas escolhas, do mesmo tipo, com o mesmo número de picks), e as magias de
//   classe no limite exato que a ficha deriva. Escreve o resultado em JSON na saída.
//
//   npx vite-node scripts/ui-check-guide.js <arquivo.json> [--full]
//
// FUNÇÕES
//   shapeOf(bag, prefix, out): a forma de um saco de escolhas ({ chave: "kind xN" }), com as
//     sub-escolhas por pick.
//   characterShape(c): a forma de todas as escolhas do personagem.
//   spellLimits(derived): as origens de magia de classe com truques ou preparadas fora do limite.
//   badNumbers(derived): os números da ficha que não são números finitos.
//   check(character, db): os problemas.
//
// DECISÕES E ARMADILHAS
//   - A forma, não os valores: o guia escolhe a primeira opção e o `autoBuild` sorteia; o que
//     tem de bater é QUAIS escolhas existem e quantos picks cada uma pede. Uma escolha que a
//     tela não mostra (ou mostra a mais) aparece aqui como diferença de forma.
//   - O `autoBuild` recebe o talento de origem que a tela escolheu: as sub-escolhas dependem
//     dele.
//   - As magias contam pelo LIMITE derivado, não contra o `autoBuild`: o número depende de uma
//     escolha (a Primal Order Magician dá um truque a mais, e o `autoBuild` pode sortear Warden).
//   - `--full` usa a cópia local do 5e.tools (`loadDb`), a mesma que o teste serve ao app
//     (`serveLocalData`); sem ela, o pacote SRD embutido, como a primeira visita do app.
// -----------------------------------------------------------------------------

import fs from 'node:fs';
import process from 'node:process';
import bundle from '../src/data/srdBundle.json' with { type: 'json' };
import { prepareDb } from '../src/engine/prepareDb.js';
import { deriveFromDb } from '../src/engine/resolve.js';
import { guidancePendencies } from '../src/components/wizard/guidancePendencies.js';
import { createGuideContext } from '../src/components/wizard/createGuideContext.js';
import { buildCreateSteps } from '../src/engine/wizardSteps.js';
import { autoBuild } from './lib/autoBuild.js';
import { loadDb } from './lib/loadDb.js';

/** A forma de um saco de escolhas, com as sub-escolhas por pick. */
function shapeOf(bag, prefix, out) {
  for (const [key, entry] of Object.entries(bag ?? {})) {
    if (!entry || typeof entry !== 'object') continue;
    out[`${prefix}${key}`] = `${entry.kind ?? '?'} x${(entry.picks ?? []).length}`;
    for (const [pick, sub] of Object.entries(entry.sub ?? {})) shapeOf(sub, `${prefix}${key}>${pick}>`, out);
  }
  return out;
}

/** A forma de todas as escolhas do personagem. */
function characterShape(c) {
  const out = {};
  shapeOf(c.species?.choices, 'species.', out);
  shapeOf(c.origin?.choices, 'origin.', out);
  shapeOf(c.origin?.originFeat?.choices, 'originFeat.', out);
  (c.classes ?? []).forEach((cls, i) => shapeOf(cls.choices, `class${i}.`, out));
  return out;
}

/** As origens de magia de classe fora do limite (a menos ou a mais). */
function spellLimits(derived) {
  const out = [];
  for (const o of (derived.spellcasting?.origins ?? []).filter((x) => x.kind === 'class')) {
    const cantrips = o.cantrips?.length ?? 0;
    const prepared = o.prepared?.length ?? 0;
    if (o.cantripLimit != null && cantrips !== o.cantripLimit) out.push(`${o.label ?? o.key}: ${cantrips} truques, o limite é ${o.cantripLimit}`);
    if (o.prepareLimit != null && prepared !== o.prepareLimit) out.push(`${o.label ?? o.key}: ${prepared} magias preparadas, o limite é ${o.prepareLimit}`);
  }
  return out;
}

/** Os números da ficha que não são números finitos. */
function badNumbers(derived) {
  const bad = [];
  const num = (name, v) => {
    if (v != null && !Number.isFinite(Number(v))) bad.push(`${name}: ${v}`);
  };
  for (const [a, v] of Object.entries(derived.abilityScores ?? derived.scores ?? {})) num(`score ${a}`, v?.total ?? v);
  num('hp', derived.hp?.max ?? derived.hpMax);
  num('ac', derived.ac?.value ?? derived.ac);
  num('proficiency', derived.proficiencyBonus);
  return bad;
}

/** Os problemas do personagem montado pela tela. */
function check(character, db) {
  const problems = [];
  let derived;
  try {
    derived = deriveFromDb(character, db);
  } catch (e) {
    return { problems: [`a derivação quebra: ${e.message}`] };
  }
  problems.push(...badNumbers(derived).map((b) => `número inválido na ficha: ${b}`));
  problems.push(...spellLimits(derived));
  const pend = guidancePendencies(db, character, derived);
  if (pend.total) problems.push(`pendências que o guia deixou: ${pend.basic} de criação, ${pend.fixup} de classe`);
  const ctx = createGuideContext(db, character);
  for (const step of buildCreateSteps(character, derived, ctx)) {
    if (step.status?.(character, derived) === 'incomplete') problems.push(`passo incompleto: ${step.id}`);
  }
  const cls = character.classes[0];
  const auto = autoBuild(db, {
    id: `u3-${cls.classId}`,
    classId: cls.classId,
    classSource: cls.source,
    subclassId: cls.subclassId ?? null,
    subclassSource: cls.subclassSource ?? null,
    speciesId: character.species?.id,
    speciesSource: character.species?.source,
    lineage: character.species?.lineage ?? null,
    level: cls.level,
    originFeat: character.origin?.originFeat ? { id: character.origin.originFeat.id, source: character.origin.originFeat.source } : undefined,
  });
  if (!auto.ok) problems.push(`o autoBuild da mesma combinação não converge (${auto.pendencies.total})`);
  const ui = characterShape(character);
  const want = characterShape(auto.character);
  for (const key of new Set([...Object.keys(ui), ...Object.keys(want)])) {
    if (ui[key] !== want[key]) problems.push(`forma de ${key}: tela ${ui[key] ?? '(ausente)'}, motor ${want[key] ?? '(ausente)'}`);
  }
  return { problems, shape: ui };
}

const [file] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const full = process.argv.includes('--full');
const db = full ? await loadDb() : prepareDb(bundle);
const character = JSON.parse(fs.readFileSync(file, 'utf8'));
process.stdout.write(`${JSON.stringify(check(character, db))}\n`);
