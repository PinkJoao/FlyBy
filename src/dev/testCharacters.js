// =============================================================================
// testCharacters: carregar e tirar os personagens modelo da Fase P no aparelho
// =============================================================================
// O QUE FAZ
//   O "Load test characters" de Settings > Experimental (P1 do
//   docs/PLAY-MODE-CERT-PLAN.md, DDL-0218): grava no IndexedDB os personagens modelo que
//   scripts/play-models.js gerou (src/dev/playModels.json), para o dono jogá-los no
//   celular, e os tira de novo.
//
// FUNÇÕES
//   modelCharacters(): os personagens do arquivo gerado (carregado só quando pedido).
//   loadTestCharacters(): grava todos; devolve quantos.
//   removeTestCharacters(): tira os que existem no aparelho; devolve quantos.
//
// DECISÕES E ARMADILHAS
//   - O arquivo entra por `import()` dinâmico: vira um pedaço à parte do bundle, baixado
//     só no clique, e o app comum não paga os 200 KB.
//   - Os ids são estáveis (`model-<id>-<nível>`): carregar de novo substitui a ficha (e o
//     estado de jogo dela fica), nunca duplica. Tirar apaga só esses ids.
//   - Só conteúdo do SRD (o script sorteia entre o que tem a marca srd52 ou srd), então os
//     personagens funcionam com a fonte embutida, sem nada configurado.
// -----------------------------------------------------------------------------

import useCharacterStore from '../store/characterStore';
import * as repo from '../data/characterRepo';

/** Os personagens do arquivo gerado. */
async function modelCharacters() {
  const mod = await import('./playModels.json');
  return mod.default ?? [];
}

/** Grava todos os personagens modelo; devolve quantos. */
export async function loadTestCharacters() {
  const list = await modelCharacters();
  for (const c of list) await repo.saveCharacter(structuredClone(c));
  await useCharacterStore.getState().load();
  return list.length;
}

/** Tira os personagens modelo que existem no aparelho; devolve quantos. */
export async function removeTestCharacters() {
  const ids = new Set((await modelCharacters()).map((c) => c.id));
  const present = useCharacterStore.getState().characters.filter((c) => ids.has(c.id));
  for (const c of present) await repo.removeCharacter(c.id);
  await useCharacterStore.getState().load();
  return present.length;
}
