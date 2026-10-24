// =============================================================================
// usePlayDoc: o documento de jogo de um personagem, vivo na tela
// =============================================================================
// O QUE FAZ
//   Carrega da tabela `play` (data/playRepo) o log de eventos do personagem e
//   expõe o estado no cursor (engine/playState) com as três ações do play mode:
//   gravar um evento, desfazer e refazer. Cada mudança grava no banco, que
//   compacta pela janela do histórico das configurações (settingsStore).
//
// FUNÇÕES
//   usePlayDoc(characterId): { doc, state, record(event), undo(), redo(),
//     canUndo, canRedo }. undo e redo devolvem { event, conflicts }, ou null
//     quando não há o que fazer.
//
// DECISÕES E ARMADILHAS
//   - O documento mais recente mora num ref além do estado: dois toques rápidos
//     (rolar e desfazer) partem do documento do toque anterior, nunca de um
//     render antigo. As gravações entram numa FILA, na ordem das ações.
//   - A compactação acontece ao gravar e devolve outro documento; ele só substitui
//     o da tela se nenhuma ação nova chegou enquanto gravava.
//   - Operações de PERSONAGEM (inventário, moedas) vão para o personagem pelo
//     characterStore ao gravar, desfazer e refazer (applyCharacterOps); as que
//     conflitam voltam em `conflicts` para a tela avisar, e o cursor anda mesmo
//     assim (DDL-0108, pergunta 3).
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react';
import useSettingsStore from '../store/settingsStore';
import useCharacterStore from '../store/characterStore';
import { getPlay, savePlay } from '../data/playRepo';
import {
  currentPlayState, recordEvent, undoEvent, redoEvent, canUndo, canRedo, characterOps, applyCharacterOps,
} from '../engine/playState';

/**
 * O documento de jogo de um personagem, com gravar, desfazer e refazer.
 * @param {string} characterId
 */
export default function usePlayDoc(characterId) {
  const limits = useSettingsStore((s) => s.playHistory);
  const saveCharacter = useCharacterStore((s) => s.save);
  const [doc, setDoc] = useState(null);
  const docRef = useRef(null);
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    let live = true;
    getPlay(characterId).then((d) => {
      if (!live) return;
      docRef.current = d;
      setDoc(d);
    });
    return () => {
      live = false;
    };
  }, [characterId]);

  const commit = (next) => {
    docRef.current = next;
    setDoc(next);
    queue.current = queue.current
      .then(() => savePlay(next, { limits }))
      .then(({ doc: saved, folded }) => {
        if (folded && docRef.current === next) {
          docRef.current = saved;
          setDoc(saved);
        }
      })
      .catch(() => {});
  };

  const applyToCharacter = (ops, direction) => {
    if (!ops.length) return [];
    const character = useCharacterStore.getState().getById(characterId);
    if (!character) return ops;
    const { character: next, conflicts } = applyCharacterOps(character, ops, direction);
    if (conflicts.length < ops.length) saveCharacter(next);
    return conflicts;
  };

  const record = (event) => {
    const cur = docRef.current;
    if (!cur) return [];
    const conflicts = applyToCharacter(characterOps(event), 'forward');
    commit(recordEvent(cur, event).doc);
    return conflicts;
  };

  const move = (step, direction) => {
    const cur = docRef.current;
    const r = cur ? step(cur) : null;
    if (!r) return null;
    const conflicts = applyToCharacter(characterOps(r.event), direction);
    commit(r.doc);
    return { event: r.event, conflicts };
  };

  const state = useMemo(() => (doc ? currentPlayState(doc) : null), [doc]);

  return {
    doc,
    state,
    record,
    undo: () => move(undoEvent, 'backward'),
    redo: () => move(redoEvent, 'forward'),
    canUndo: !!doc && canUndo(doc),
    canRedo: !!doc && canRedo(doc),
  };
}
