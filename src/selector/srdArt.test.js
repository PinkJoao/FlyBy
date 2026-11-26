// =============================================================================
// srdArt.test: a arte de reserva do SRD (selector/srdArt.js)
// =============================================================================
// O QUE FAZ
//   Confere o mapa `src/data/srdArt.json` contra o pacote e os arquivos: todo retrato
//   existe, toda chave é uma espécie, classe ou subclasse do pacote SRD, a arte oficial
//   nunca é trocada, e as entities devolvem a reserva sobre o pacote embutido.
//
// FUNÇÕES
//   srdKeys(): as chaves de todos os alvos do pacote SRD.
//
// DECISÕES E ARMADILHAS
//   - Lê o pacote cru (`srdBundle.json`): é o que o app tem na primeira visita.
// -----------------------------------------------------------------------------

import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import bundle from '../data/srdBundle.json';
import data from '../data/srdArt.json';
import { withSrdArt, speciesArtKey, classArtKey, subclassArtKey } from './srdArt';
import raceEntity from './entities/race';
import classEntity from './entities/class';
import { makeSubclassEntity } from './entities/subclass';

/** As chaves de todos os alvos do pacote SRD. */
function srdKeys() {
  const keys = bundle.races.race.map(speciesArtKey);
  for (const k of Object.keys(bundle).filter((x) => x.startsWith('class-'))) {
    keys.push(...(bundle[k].class ?? []).map(classArtKey), ...(bundle[k].subclass ?? []).map(subclassArtKey));
  }
  return new Set(keys);
}

describe('srdArt', () => {
  it('every key is an SRD target and every portrait file exists', () => {
    const keys = srdKeys();
    for (const [key, ids] of Object.entries(data.art)) {
      expect(keys.has(key), key).toBe(true);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) expect(fs.existsSync(`public/portraits-licensed/${id}.webp`), id).toBe(true);
    }
  });

  it('never replaces official art', () => {
    const own = { images: [{ type: 'image', href: { type: 'internal', path: 'races/x.webp' } }] };
    expect(withSrdArt('class:Wizard|XPHB', own)).toBe(own);
    expect(withSrdArt('class:Nobody|XPHB', null)).toBe(null);
  });

  it('the entities fall back to it on the bundled SRD', () => {
    const wizard = bundle['class-wizard'].class[0];
    expect(classEntity.fluff(wizard, bundle).images[0].href.url).toBe(`/portraits-licensed/${data.art['class:Wizard|XPHB'][0]}.webp`);
    const elf = bundle.races.race.find((r) => r.name === 'Elf');
    expect(raceEntity.fluff(elf, bundle).images[0].credit).toBe(data.credit.by);
    const gnome = bundle.races.race.find((r) => r.name === 'Gnome');
    expect(raceEntity.fluff(gnome, bundle)?.images?.length ?? 0).toBe(0);
    const thief = bundle['class-rogue'].subclass[0];
    const images = makeSubclassEntity('rogue').fluff(thief, bundle).images;
    expect(images.length).toBe(data.art['subclass:Rogue|Thief|XPHB'].length);
  });
});
