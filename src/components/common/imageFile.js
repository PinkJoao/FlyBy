// =============================================================================
// imageFile - arquivo de imagem → data-URL p/ retrato do personagem
// =============================================================================
// O retrato é salvo DENTRO do personagem (IndexedDB) como data-URL, então
// funciona offline e viaja no export/import. Para não inchar o banco, imagens
// grandes são REDIMENSIONADAS (lado maior ≤ MAX_SIDE) via canvas → WebP.
// Arquivos já pequenos ficam como estão (preserva GIF animado, PNG etc.).
// A proporção NUNCA é alterada - o corte/ajuste é problema do CSS (contain).
// -----------------------------------------------------------------------------

const MAX_SIDE = 640; // px - sobra p/ exibição a ~180px mesmo em telas retina
const KEEP_BYTES = 400 * 1024; // até isso, guarda o arquivo original

/**
 * @param {File} file  imagem escolhida pelo usuário
 * @returns {Promise<string>} data-URL pronto p/ meta.portrait
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
        // WebP mantém transparência; navegadores sem suporte devolvem PNG.
        resolve(canvas.toDataURL('image/webp', 0.85));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
