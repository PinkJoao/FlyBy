// =============================================================================
// check-species-keys - `npm run check:keys`
// =============================================================================
// Toda chave de registro CURADO que casa por `Nome|FONTE` de espécie é uma bomba
// de efeito retardado: se a espécie mudar de nome, a chave para de casar e a
// MECÂNICA fica órfã, em silêncio. Foi o que aconteceu ao dar linhagem ao Dwarf
// (DDL-0080): o `hpBonuses` guardava `Dwarf|XPHB`, a espécie resolvida passou a
// ser `Dwarf; Hill Lineage|PHB`, e **nenhum** Dwarf ganhava mais o +1 HP/nível.
//
// Ali o sweep pegou por sorte - havia cobertura para aquela chave. Esta sonda não
// depende de sorte: cruza cada registro com o catálogo RESOLVIDO (espécies + toda
// linhagem) e acusa chave que não casa NADA.
//
// Uma chave morta é sempre um sintoma: ou a espécie mudou de nome, ou a mecânica
// ficou órfã, ou a entrada foi escrita com a grafia errada. Nunca é inofensiva.
//
// Sai com código 1 quando acha alguma, para poder entrar num hook se algum dia
// valer a pena.
// -----------------------------------------------------------------------------

import process from 'node:process';
import { loadDb } from './lib/loadDb';
import { speciesCatalog, raceLineages } from '../src/engine/speciesData';
import { NATURAL_ARMOR } from '../src/engine/naturalArmor';
import { OTHER_LANGUAGE } from '../src/engine/speciesLanguages';
import { RACE_HP_PER_LEVEL } from '../src/engine/hpBonuses';
import { LEGACY_SUBRACES } from '../src/engine/legacySubraces';
import { SWAP_LINEAGES } from '../src/engine/legacySwapLineages';
import { MERGED_LINEAGES } from '../src/engine/mergedLineages';

const norm = (s) => String(s ?? '').trim().toLowerCase();

/**
 * Registros keyed por `Nome|FONTE` de espécie. `resolved` diz se a chave é a
 * espécie RESOLVIDA (linhagem inclusa) ou a BASE crua - a distinção importa: uma
 * chave de base não deve casar linhagem, e vice-versa.
 */
const REGISTRIES = [
  { name: 'naturalArmor.NATURAL_ARMOR', keys: Object.keys(NATURAL_ARMOR), resolved: true },
  { name: 'speciesLanguages.OTHER_LANGUAGE', keys: Object.keys(OTHER_LANGUAGE), resolved: true },
  { name: 'hpBonuses.RACE_HP_PER_LEVEL', keys: Object.keys(RACE_HP_PER_LEVEL), resolved: true },
  { name: 'legacySwapLineages.SWAP_LINEAGES', keys: Object.keys(SWAP_LINEAGES), resolved: false },
  // Estes dois são ARRAYS: a chave de espécie vive num campo da entrada.
  { name: 'mergedLineages.MERGED_LINEAGES (base)', keys: MERGED_LINEAGES.map((e) => e.base), resolved: false },
  { name: 'legacySubraces.LEGACY_SUBRACES (race)', keys: LEGACY_SUBRACES.map((e) => e.race), resolved: false },
];

function main() {
  console.log('Loading local compendium…');
  const db = loadDb();
  const bases = speciesCatalog(db);
  const baseKeys = new Set(bases.map((r) => norm(`${r.name}|${r.source}`)));
  const allKeys = new Set(baseKeys);
  for (const r of bases) {
    for (const v of raceLineages(db, r)) {
      allKeys.add(norm(`${v.name}|${v.source}`));
      // A forma `<nomeDaBase>|<fonteDaVARIANTE>` também é chave válida: é o
      // segundo passo de lookup do `naturalArmorFor` (e o jeito de uma sub-raça
      // fundida herdar a mecânica da base - o Goblin de Ixalan, TC-0053). Sem
      // isto no pool, a sonda acusava essa chave como morta - falso positivo do
      // INSTRUMENTO, que é o primeiro erro a descartar antes de mexer no código.
      if (v._baseName) allKeys.add(norm(`${v._baseName}|${v.source}`));
    }
  }
  console.log(`Catálogo: ${baseKeys.size} espécies base, ${allKeys.size} entradas com linhagem.\n`);

  let dead = 0;
  for (const reg of REGISTRIES) {
    const pool = reg.resolved ? allKeys : baseKeys;
    const misses = reg.keys.filter((k) => !pool.has(norm(k)));
    const label = reg.resolved ? 'resolvida' : 'base';
    console.log(`  ${misses.length === 0 ? '✓' : '✗'} ${reg.name.padEnd(38)} ${reg.keys.length} chaves (${label})`);
    for (const k of misses) console.log(`      MORTA: ${k}`);
    dead += misses.length;
  }

  console.log(`\n=== ${dead} chave(s) morta(s) ===`);
  if (dead) {
    console.log(
      'Uma chave que não casa nada é sintoma: a espécie mudou de nome (um `swap` de linhagem faz\n'
      + 'isso - ver DDL-0080), a mecânica ficou órfã, ou a grafia está errada. Conserte a chave, não\n'
      + 'a sonda.',
    );
    process.exitCode = 1;
  }
}

main();
