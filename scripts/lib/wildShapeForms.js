// =============================================================================
// wildShapeForms: as formas conhecidas do Wild Shape num druida montado por script
// =============================================================================
// O QUE FAZ
//   Dá a um personagem do `autoBuild` as formas conhecidas do Wild Shape, como o jogador faria na
//   aba da classe: tantas quanto a tabela "Beast Shapes" deixa no nível, entre as feras que a regra
//   aceita (ND, voo, sem enxame; o Circle Forms do Moon), sorteadas com a semente do personagem.
//
// FUNÇÕES
//   withWildShapeForms(db, c, monsters, rng): grava `c.wildShapeForms`; devolve quantas.
//   srdBeasts(): as criaturas do SRD embutido (o bestiário que os modelos abrem no app).
//   localBestiary(): as criaturas da cópia local do 5e.tools, só a reedição mais nova, com o `_copy`.
//
// DECISÕES E ARMADILHAS
//   - A conta é a do app (`wildShapeOf`, `formEligible`, `transformRuleOf` em engine/playForms.js),
//     a mesma do seletor de formas (components/builder/WildShapeForms.jsx): nada de regra própria.
//   - Usado pelos personagens modelo (scripts/play-models.js, as feras do SRD embutido: é o bestiário
//     que o app abre com a fonte do SRD) e pelos arquétipos (scripts/archetypes.js, a cópia local:
//     é a fonte com que a U4 os abre). Um nome fora do bestiário da fonte não acharia a forma na tela.
//   - O sorteio só escolhe ENTRE as que servem; a ordem de partida é pelo nome, para a semente dar
//     sempre as mesmas formas.
// -----------------------------------------------------------------------------

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { wildShapeOf, formEligible, transformRuleOf } from '../../src/engine/playForms.js';
import { latestOnly } from '../../src/selector/reprints.js';
import { resolveCopies } from '../../src/selector/copy.js';
import { dataDir } from './loadDb.js';

/** Grava as formas conhecidas do Wild Shape (a classe druida); devolve quantas. */
export function withWildShapeForms(db, c, monsters, rng) {
  const cls = (c.classes ?? []).find((x) => x.classId === 'druid');
  const limits = cls ? wildShapeOf(db, cls) : null;
  if (!limits?.known) return 0;
  const rule = transformRuleOf('Wild Shape');
  const pool = (monsters ?? []).filter((m) => formEligible(m, rule, limits)).sort((a, b) => a.name.localeCompare(b.name));
  const chosen = [];
  while (chosen.length < limits.known && pool.length) chosen.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  c.wildShapeForms = chosen.map((m) => ({ name: m.name, source: m.source }));
  return chosen.length;
}

/** As criaturas do SRD embutido. */
export function srdBeasts() {
  const bundle = JSON.parse(readFileSync(new URL('../../src/data/srdBundle.json', import.meta.url), 'utf8'));
  return bundle.bestiary?.monster ?? [];
}

/** As criaturas da cópia local do 5e.tools (a reedição mais nova, com o `_copy`). */
export function localBestiary() {
  const dir = join(dataDir(), 'bestiary');
  const files = readdirSync(dir).filter((f) => f.startsWith('bestiary-') && f.endsWith('.json'));
  return latestOnly(resolveCopies(files.flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')).monster ?? [])));
}
