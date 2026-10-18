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
//   loadDb(): o compêndio inteiro no formato do db do app (chave -> JSON).
//
// DECISÕES E ARMADILHAS
//   - Arquivo ausente do snapshot é tolerado: a chave fica de fora e o engine
//     degrada com elegância.
// -----------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildManifest } from '../../src/data/config';

/** Raiz do projeto (scripts/lib/ fica dois níveis abaixo). */
const ROOT = join(import.meta.dirname, '..', '..');

/** A pasta `data` do snapshot local do 5etools, ou null. */
export function dataDir() {
  const p = join(ROOT, 'DnD Source Material', '5etools Source Code', 'data');
  return existsSync(p) ? p : null;
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
  return db;
}
