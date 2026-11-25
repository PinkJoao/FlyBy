// =============================================================================
// loadDb: o compêndio 5etools lido do snapshot local (fora do browser)
// =============================================================================
// O QUE FAZ
//   O mesmo manifest que o app baixa do mirror (buildManifest), lido direto do
//   snapshot in-repo `./DnD Source Material/5etools Source Code/data` (DDL-0037;
//   git-ignored, presente em toda máquina). Compartilhado pelo sweep e pelo
//   render-pdf-preview (TESTING-PLAN.md §3).
//
// FUNÇÕES
//   dataDir(): a pasta `data` do snapshot, ou null.
//   loadDb(): o compêndio inteiro no formato do db do app (chave -> JSON), pelo mesmo prepareDb do app (DDL-0267).
//   snapshotVersion(): a versão do snapshot local do 5etools (o `version` do package.json dele), ou null.
//   newer(a, b): a versão `a` é mais nova que `b`?
//   checkSnapshot(reportPath): avisa quando o relatório já gravado veio de um snapshot MAIS NOVO que o local.
//
// DECISÕES E ARMADILHAS
//   - Arquivo ausente do snapshot é tolerado: a chave fica de fora e o engine
//     degrada com elegância.
//   - O snapshot é git-ignored, então cada aparelho tem o seu (DDL-0273): este PC media com o 2.31.0 de julho e a
//     régua dava 90,5% onde o repositório dizia 100%. Todo relatório grava a linha "Espelho do 5etools: <versão>",
//     e `checkSnapshot` avisa antes de sobrescrever um relatório feito com um espelho mais novo.
// -----------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildManifest } from '../../src/data/config';
import { prepareDb } from '../../src/engine/prepareDb';

/** Raiz do projeto (scripts/lib/ fica dois níveis abaixo). */
const ROOT = join(import.meta.dirname, '..', '..');

/** A pasta `data` do snapshot local do 5etools, ou null. */
export function dataDir() {
  const p = join(ROOT, 'DnD Source Material', '5etools Source Code', 'data');
  return existsSync(p) ? p : null;
}

/** A versão do snapshot local do 5etools, ou null. */
export function snapshotVersion() {
  const p = join(ROOT, 'DnD Source Material', '5etools Source Code', 'package.json');
  try {
    return JSON.parse(readFileSync(p, 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

/** A versão `a` é mais nova que `b`? (números separados por ponto) */
export function newer(a, b) {
  const x = String(a ?? '0').split('.').map(Number);
  const y = String(b ?? '0').split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

/** Avisa quando o relatório já gravado veio de um snapshot mais novo que o local. Devolve a versão local. */
export function checkSnapshot(reportPath) {
  const mine = snapshotVersion();
  let theirs = null;
  try {
    theirs = readFileSync(reportPath, 'utf8').match(/Espelho do 5etools: ([0-9.]+)/)?.[1] ?? null;
  } catch {
    /* sem relatório anterior */
  }
  if (theirs && newer(theirs, mine)) {
    console.warn(`ATENÇÃO: ${reportPath} foi gerado com o 5etools ${theirs} e o snapshot local é ${mine ?? 'desconhecido'}: atualize o "DnD Source Material/5etools Source Code" antes de confiar nos números (DDL-0273).`);
  }
  return mine;
}

/** O compêndio inteiro no formato do db do app. */
export function loadDb() {
  const dir = dataDir();
  if (!dir) throw new Error('Pasta local do 5etools não encontrada (./DnD Source Material).');
  const db = {};
  for (const { key, path } of buildManifest()) {
    try {
      db[key] = JSON.parse(readFileSync(join(dir, path), 'utf8'));
    } catch {
      /* arquivo fora do snapshot local: o engine tolera a chave ausente */
    }
  }
  return prepareDb(db);
}
