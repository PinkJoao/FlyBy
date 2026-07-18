// =============================================================================
// useCharacterImport - import de personagem compartilhado (Home + Builder)
// =============================================================================
// Import é sempre um ator do Foundry VTT JSON (DDL-0005), cria um personagem NOVO
// e navega até ele. A lógica (ler arquivo → converter → navegar → erro) vive aqui
// para não duplicar entre os menus sanduíche da Home e da tela de personagem.
//
// Uso:
//   const { inputRef, onFileChange, pickFile } = useCharacterImport();
//   ...menu item → onClick: pickFile
//   <input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={onFileChange} />
// -----------------------------------------------------------------------------

import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useCharacterStore from '../store/characterStore';
import { useData } from '../data/dataContext';
import { alert } from '../components/common/dialog';

export default function useCharacterImport() {
  const navigate = useNavigate();
  const importJson = useCharacterStore((s) => s.importJson);
  const { db } = useData();
  const inputRef = useRef(null);

  const pickFile = useCallback(() => inputRef.current?.click(), []);

  const onFileChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = ''; // permite reimportar o mesmo arquivo
      if (!file) return;
      try {
        const raw = JSON.parse(await file.text());
        const imported = await importJson(raw, db);
        navigate(`/build/${imported.id}`);
      } catch (err) {
        console.error('Failed to import character', err);
        await alert({
          title: 'Import failed',
          message:
            'That file could not be imported. Make sure it is a Foundry VTT actor JSON (or one exported from this app).',
        });
      }
    },
    [importJson, db, navigate],
  );

  return { inputRef, onFileChange, pickFile };
}
