// =============================================================================
// characterStore - estado dos personagens (Zustand)
// =============================================================================
// Fonte da verdade em memória para a UI; sincroniza com o IndexedDB via
// characterRepo. O roster (Home) e o builder leem daqui.
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
   * Cria um personagem novo, persiste e retorna.
   * @param {Parameters<typeof createCharacter>[0]} [opts]
   */
  create: async (opts) => {
    const character = createCharacter(opts);
    const saved = await repo.saveCharacter(character);
    set({ characters: [saved, ...get().characters] });
    return saved;
  },

  /**
   * Atualiza um personagem (recebe o objeto completo já modificado).
   * @param {import('../schema/character').Character} character
   */
  save: async (character) => {
    const saved = await repo.saveCharacter(character);
    set({
      characters: get().characters.map((c) => (c.id === saved.id ? saved : c)),
    });
    return saved;
  },

  /** @param {string} id */
  remove: async (id) => {
    await repo.removeCharacter(id);
    set({ characters: get().characters.filter((c) => c.id !== id) });
  },

  /** @param {string} id */
  duplicate: async (id) => {
    const copy = await repo.duplicateCharacter(id);
    if (copy) set({ characters: [copy, ...get().characters] });
    return copy;
  },

  /**
   * @param {unknown} raw  JSON importado (ator do Foundry; ver foundryImport).
   * @param {object} [db5e]  compêndio 5etools (p/ reverter chaves na conversão).
   */
  importJson: async (raw, db5e) => {
    const imported = await repo.importCharacter(raw, db5e);
    set({ characters: [imported, ...get().characters] });
    return imported;
  },

  /** @param {string} id */
  getById: (id) => get().characters.find((c) => c.id === id) ?? null,
}));

export default useCharacterStore;
