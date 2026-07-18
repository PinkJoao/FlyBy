// =============================================================================
// loadDb - compêndio 5etools lido do snapshot local (fora do browser)
// =============================================================================
// Mesmo manifest que o app baixa do mirror (buildManifest), lido direto da
// pasta-irmã `../DnD Source Material/5etools Source Code/data`. Extraído do
// render-pdf-preview para ser compartilhado com o sweep (TESTING-PLAN.md §3).
// Arquivos ausentes do snapshot são tolerados (o engine degrada com elegância).
// -----------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildManifest } from '../../src/data/config';

/** Raiz do projeto (scripts/lib/ → dois níveis acima). */
const ROOT = join(import.meta.dirname, '..', '..');

/** Pasta `data` do snapshot local do 5etools (sibling do projeto), ou null. */
export function dataDir() {
  const p = join(ROOT, '..', 'DnD Source Material', '5etools Source Code', 'data');
  return existsSync(p) ? p : null;
}

/** Carrega o compêndio inteiro no formato do db do app (chave → JSON). */
export function loadDb() {
  const dir = dataDir();
  if (!dir) throw new Error('Pasta local do 5etools não encontrada (../DnD Source Material).');
  const db = {};
  for (const { key, path } of buildManifest()) {
    try {
      db[key] = JSON.parse(readFileSync(join(dir, path), 'utf8'));
    } catch {
      /* arquivo fora do snapshot local - o engine tolera a chave ausente */
    }
  }
  return db;
}
