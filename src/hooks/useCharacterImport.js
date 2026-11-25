// =============================================================================
// useCharacterImport: o import de personagem, compartilhado pela Home e pelo Builder
// =============================================================================
// O QUE FAZ
//   O import é sempre um ator Foundry em JSON (DDL-0005): cria um personagem NOVO
//   e navega até ele. Ler o arquivo, converter, navegar e tratar o erro vivem aqui
//   para não duplicar entre os menus sanduíche da Home e da ficha.
//
//   Uso:
//     const { inputRef, onFileChange, pickFile } = useCharacterImport();
//     o item de menu chama pickFile, e a página monta
//     <input ref={inputRef} type="file" accept="application/json,.json" hidden
//            onChange={onFileChange} />
//
// FUNÇÕES
//   useCharacterImport(): { inputRef, onFileChange, pickFile }.
//
// DECISÕES E ARMADILHAS
//   - O input é zerado depois de cada leitura, para permitir reimportar o mesmo
//     arquivo.
//   - Os AVISOS da conversão (o que o ator trazia e o nosso modelo não guarda)
//     não interrompem o import, mas são mostrados: o jogador não pode descobrir
//     depois que um conteúdo sumiu (DDL-0080).
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
      e.target.value = '';
      if (!file) return;
      try {
        const raw = JSON.parse(await file.text());
        const out = {};
        const imported = await importJson(raw, db, out);
        if (out.warnings?.length) {
          await alert({ title: 'Imported with notes', message: out.warnings.join('\n\n') });
        }
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
