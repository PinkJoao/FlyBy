// =============================================================================
// srdArt: a arte de reserva das espécies, classes e subclasses do SRD
// =============================================================================
// O QUE FAZ
//   Quem só tem o SRD embutido não tem arte nenhuma no fluff. `withSrdArt` completa o
//   fluff de uma espécie, classe ou subclasse do SRD com os retratos do Wesnoth (GPL) que
//   o app já embute (`public/portraits-licensed`), na ordem de `src/data/srdArt.json`: a
//   primeira é a do cartão, as outras vão para a galeria.
//
// FUNÇÕES
//   withSrdArt(key, fluff): o fluff com as imagens de reserva quando ele não tem nenhuma.
//   speciesArtKey(race) / classArtKey(c) / subclassArtKey(s): a chave do alvo no mapa.
//
// DECISÕES E ARMADILHAS
//   - Só RESERVA: um fluff com imagem própria (a arte oficial do 5e.tools) nunca é trocado.
//   - O mapa saiu do cruzamento do dono (`npm run art:picker`, `testing/srd-art/picks.json`);
//     a ordem e a imagem principal de cada alvo foram decididas no DDL-0335. Alvo sem
//     retrato (Gnome, Goliath, Tiefling, Half-Elf, Half-Orc, College of Lore, Warrior of the
//     Open Hand, Evoker) fica com o ícone.
//   - A chave casa nome E fonte, como o pacote: uma espécie de outro livro com o mesmo nome
//     não herda a arte.
//   - `width` e `height` vão na imagem, e `cutout`: o retrato tem fundo transparente, e o
//     carrossel o mostra inteiro sobre um fundo próprio, em vez de cortar para preencher.
// -----------------------------------------------------------------------------

import data from '../data/srdArt.json';

const credit = data.credit.by;

/** A chave do alvo no mapa: espécie, classe ou subclasse. */
export const speciesArtKey = (race) => `species:${race.name}|${race.source}`;
export const classArtKey = (c) => `class:${c.name}|${c.source}`;
export const subclassArtKey = (s) => `subclass:${s.className}|${s.name}|${s.source}`;

/** O fluff com as imagens de reserva quando ele não tem nenhuma. */
export function withSrdArt(key, fluff) {
  if (fluff?.images?.some((i) => i?.href)) return fluff;
  const ids = data.art[key];
  if (!ids?.length) return fluff;
  const images = ids.map((id) => ({
    type: 'image',
    href: { type: 'external', url: `/portraits-licensed/${id}.webp` },
    credit,
    width: 360,
    height: 360,
    cutout: true,
  }));
  return { ...(fluff ?? {}), images };
}
