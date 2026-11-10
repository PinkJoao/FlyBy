// =============================================================================
// survey-creatures: o núcleo da criatura (engine/creature.js) sobre o bestiário
// =============================================================================
// O QUE FAZ
//   Passa pelo creatureStats todo bloco de summon (`summonedBySpell`,
//   `summonedByClass`) e toda fera do bestiário local, com um contexto de invocador
//   (círculo, nível de classe, modificadores, PB, ataque e CD de magia, cada
//   variante), e conta o que o núcleo não resolve: CA ou PV sem número, ataque sem
//   bônus, dano com trecho não lido, salvaguarda sem CD. Precisa dar zero problema
//   sem explicação (DDL-0191), como o survey-play-catalog.
//   `npx vite-node scripts/survey-creatures.js` (`--list` mostra cada problema).
//
// FUNÇÕES
//   problemsOf(stats, label): os problemas de uma criatura resolvida.
//   main(): a CLI.
//
// DECISÕES E ARMADILHAS
//   - Lê o bestiário do material local (não está no manifesto do app), e os objetos
//     criados por feature do `objects.json` (objectSummons, o Eldritch Cannon, DDL-0194).
//   - Cada variante do molde (Air, Land, Water; Demon, Devil, Yugoloth) roda à
//     parte: um PV só resolvido para uma das formas esconderia as outras.
//   - Fórmula de dano válida = só dados, números, + e -.
// -----------------------------------------------------------------------------

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { creatureStats, objectSummons } from '../src/engine/creature';
import { latestOnly } from '../src/selector/reprints';
import { resolveCopies } from '../src/selector/copy';

const DIR = join(import.meta.dirname, '..', 'DnD Source Material', '5etools Source Code', 'data', 'bestiary');
const FORMULA_OK = /^[0-9d+\- ]+$/;

/** Os problemas de uma criatura resolvida. */
function problemsOf(s, label) {
  const out = [];
  if (s.ac.value == null) out.push(`${label}: CA "${s.ac.text}"`);
  if (s.hp.value == null) out.push(`${label}: PV "${s.hp.text}"`);
  for (const a of [...s.actions, ...s.bonus, ...s.reactions]) {
    if (a.attack && a.attack.bonus == null) out.push(`${label} > ${a.name}: ataque sem bônus`);
    for (const d of a.damage) if (!FORMULA_OK.test(d.formula)) out.push(`${label} > ${a.name}: dano "${d.formula}"`);
    if (a.attack && a.damage.some((d) => !d.type)) out.push(`${label} > ${a.name}: dano sem tipo`);
    if (a.save && a.save.dc == null) out.push(`${label} > ${a.name}: salvaguarda sem CD`);
  }
  return out;
}

function main() {
  const all = resolveCopies(readdirSync(DIR).filter((f) => f.startsWith('bestiary-')).flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')).monster ?? []));
  const objects = objectSummons(JSON.parse(readFileSync(join(DIR, '..', 'objects.json'), 'utf8')).object);
  const summons = [...all.filter((m) => m.summonedBySpell || m.summonedByClass), ...objects];
  const beasts = latestOnly(all.filter((m) => !m.summonedBySpell && !m.summonedByClass && (m.type?.type ?? m.type) === 'beast'));
  const ctx = { classLevel: 5, mods: { str: 1, dex: 2, con: 2, int: 3, wis: 3, cha: 1 }, pb: 3, spellAttack: 7, spellDc: 15, spellMod: 4 };
  const problems = [];
  for (const m of summons) {
    const base = { ...ctx, spellLevel: m.summonedBySpellLevel ?? 4 };
    const first = creatureStats(m, base);
    for (const variant of first.variants.length ? first.variants : [null]) {
      problems.push(...problemsOf(creatureStats(m, { ...base, variant }), `${m.name}|${m.source}${variant ? ` (${variant})` : ''}`));
    }
  }
  for (const m of beasts) problems.push(...problemsOf(creatureStats(m, {}), `${m.name}|${m.source}`));
  console.log(`summons ${summons.length} · beasts ${beasts.length} · problemas sem explicação: ${problems.length}`);
  if (process.argv.includes('--list') || problems.length < 40) for (const p of problems) console.log(`  ${p}`);
}

main();
