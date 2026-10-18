// =============================================================================
// characterStore: o estado dos personagens (Zustand)
// =============================================================================
// O QUE FAZ
//   A fonte da verdade em memória para a UI, sincronizada com o IndexedDB via
//   characterRepo. O roster (Home) e o builder leem daqui.
//
// FUNÇÕES
//   useCharacterStore: o store. Ações:
//     load(): carrega a lista do IndexedDB (idempotente).
//     create(opts), save(character), remove(id), duplicate(id): o CRUD.
//     importJson(raw, db5e, out): importa um ator Foundry (foundryImport), com os
//       avisos da conversão em `out.warnings`.
//     getById(id): um personagem da lista.
// -----------------------------------------------------------------------------

import { create } from 'zustand';
import { createCharacter } from '../schema/character';
import * as repo from '../data/characterRepo';

const useCharacterStore = create((set, get) => ({
  /** @type {import('../schema/character').Character[]} */
  characters: [],
  loaded: false,

  /** Carrega a lista do IndexedDB (idempotente). */
  load: async () => {
    const characters = await repo.listCharacters();
    set({ characters, loaded: true });
  },

  /**
   * Cria, persiste e retorna um personagem novo.
   * @param {Parameters<typeof createCharacter>[0]} [opts]
   */
  create: async (opts) => {
    const character = createCharacter(opts);
    const saved = await repo.saveCharacter(character);
    set({ characters: [saved, ...get().characters] });
    return saved;
  },

  /**
   * Atualiza um personagem (o objeto completo, já modificado).
   * @param {import('../schema/character').Character} character
   */
  save: async (character) => {
    const saved = await repo.saveCharacter(character);
    set({
      characters: get().characters.map((c) => (c.id === saved.id ? saved : c)),
    });
    return saved;
  },

  /**
   * Remove um personagem.
   * @param {string} id
   */
  remove: async (id) => {
    await repo.removeCharacter(id);
    set({ characters: get().characters.filter((c) => c.id !== id) });
  },

  /**
   * Duplica um personagem.
   * @param {string} id
   */
  duplicate: async (id) => {
    const copy = await repo.duplicateCharacter(id);
    if (copy) set({ characters: [copy, ...get().characters] });
    return copy;
  },

  /**
   * Importa um ator Foundry; `db5e` reverte as chaves, `out` recebe os avisos.
   * @param {unknown} raw
   * @param {object} [db5e]
   * @param {{warnings?: string[]}} [out]
   */
  importJson: async (raw, db5e, out) => {
    const imported = await repo.importCharacter(raw, db5e, out);
    set({ characters: [imported, ...get().characters] });
    return imported;
  },

  /**
   * Um personagem pelo id.
   * @param {string} id
   */
  getById: (id) => get().characters.find((c) => c.id === id) ?? null,
}));

export default useCharacterStore;
