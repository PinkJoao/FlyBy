// =============================================================================
// imagePaste: a imagem que vem da área de transferência (Ctrl+V, teclado do celular)
// =============================================================================
// O QUE FAZ
//   O que os escolhedores de imagem (retrato, imagem de item) usam para aceitar uma
//   imagem COLADA: achar o arquivo de imagem num DataTransfer, ouvir o Ctrl+V na
//   página inteira enquanto o escolhedor está aberto, e transformar o <img> que um
//   teclado de celular insere num campo editável de volta em arquivo.
//
// FUNÇÕES
//   imageFromTransfer(dt): o primeiro arquivo de imagem de um DataTransfer, ou null.
//   useImagePaste(onImage, enabled): Ctrl+V com imagem, em qualquer lugar da página.
//   imageFromElement(img): o arquivo por trás de um <img> inserido (data: ou blob:).
//
// DECISÕES E ARMADILHAS
//   - Só a IMAGEM é tomada: colar texto (um nome, uma URL) segue o caminho normal,
//     então o ouvinte da página pode ficar ligado sem atrapalhar os campos.
//   - O evento já tratado (`defaultPrevented`) é ignorado: o campo de URL do
//     escolhedor (ImageUrlField) trata a própria colagem e o ouvinte não repete.
//   - `files` primeiro e `items` depois: o Chrome põe a imagem copiada nos dois, e
//     o Firefox às vezes só em `items`.
//   - Um <img> com endereço `content:` (Android) não se lê pela página: devolve
//     null, e o campo só se limpa.
// -----------------------------------------------------------------------------

import { useEffect, useRef } from 'react';

/** O primeiro arquivo de imagem de um DataTransfer (colagem, arrasto), ou null. */
export function imageFromTransfer(dt) {
  if (!dt) return null;
  for (const f of dt.files ?? []) if (f.type?.startsWith('image/')) return f;
  for (const it of dt.items ?? []) {
    if (it.kind === 'file' && it.type?.startsWith('image/')) {
      const f = it.getAsFile();
      if (f) return f;
    }
  }
  return null;
}

/** Ctrl+V com uma imagem, em qualquer lugar da página, enquanto `enabled`. */
export function useImagePaste(onImage, enabled = true) {
  const handler = useRef(onImage);
  useEffect(() => {
    handler.current = onImage;
  });
  useEffect(() => {
    if (!enabled) return undefined;
    const onPaste = (e) => {
      if (e.defaultPrevented) return;
      const file = imageFromTransfer(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      handler.current(file);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [enabled]);
}

/** O arquivo por trás de um <img> que um teclado inseriu num campo editável. */
export async function imageFromElement(img) {
  const src = img?.getAttribute('src') ?? '';
  if (!/^(data|blob):/.test(src)) return null;
  try {
    const blob = await (await fetch(src)).blob();
    return blob.type.startsWith('image/') ? new File([blob], 'pasted-image', { type: blob.type }) : null;
  } catch {
    return null;
  }
}
