// =============================================================================
// imageFile: o arquivo de imagem como data-URL do retrato
// =============================================================================
// O QUE FAZ
//   O retrato é salvo DENTRO do personagem (IndexedDB) como data-URL: funciona
//   offline e viaja no export. Para não inchar o banco, imagens grandes são
//   REDIMENSIONADAS (lado maior até MAX_SIDE, folga para ~180px em tela retina) via
//   canvas para WebP, que mantém transparência (sem suporte, o navegador devolve
//   PNG). Arquivos pequenos ficam como estão (preserva GIF animado). A proporção
//   nunca muda; o ajuste é do CSS.
//
// FUNÇÕES
//   fileToPortrait(file): a data-URL pronta para meta.portrait.
// -----------------------------------------------------------------------------

const MAX_SIDE = 640;
const KEEP_BYTES = 400 * 1024;

/**
 * A imagem escolhida como data-URL para o retrato.
 * @param {File} file
 * @returns {Promise<string>}
 */
export function fileToPortrait(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo não é uma imagem legível.'));
      img.onload = () => {
        const side = Math.max(img.naturalWidth, img.naturalHeight);
        if (side <= MAX_SIDE && file.size <= KEEP_BYTES) {
          resolve(dataUrl);
          return;
        }
        const scale = Math.min(1, MAX_SIDE / side);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', 0.85));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
