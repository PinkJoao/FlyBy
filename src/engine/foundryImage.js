// =============================================================================
// foundryImage: imagem do app (retrato, ícone de item) no formato que o Foundry aceita
// =============================================================================
// O QUE FAZ
//   O Foundry guarda `img` (ator, item, token) num campo de caminho de arquivo que
//   aceita URL web e data-URL, mas EXIGE uma extensão de imagem no texto. Este
//   módulo leva a imagem do app ao export sem quebrar o ator, e a traz de volta
//   igual no import.
//
// FUNÇÕES
//   toFoundryImage(src): a imagem pronta para o `img` do Foundry, ou null.
//   fromFoundryImage(src): a imagem do Foundry de volta para o app (só web ou
//     data-URL), ou null.
//
// DECISÕES E ARMADILHAS
//   - Medido no Foundry 13.351 (2026-11-09): URL sem extensão ("...portrait?id=42")
//     REPROVA o ator inteiro ("does not have a valid file extension"), e o import
//     falha todo por causa do retrato. A URL ganha o fragmento `#.jpg`: o navegador
//     não manda o fragmento ao servidor (a imagem é a mesma) e o Foundry aceita;
//     `.jpg` também diz ao token que é imagem, não vídeo.
//   - Passam como estão: data-URL de imagem e URL cuja extensão já está no fim do
//     caminho ou do texto (o Foundry aceitou ".jpg", ".JPG", ".webp?w=300" e o
//     "?url=.../x.jpg" do wsrv). A lista é a `IMAGE_FILE_EXTENSIONS` dele.
//   - O fragmento é NOSSO e sai no import: a volta devolve a URL que o jogador
//     colou, e o oráculo de ida e volta não vê diferença.
// -----------------------------------------------------------------------------

const EXT = '(?:apng|avif|bmp|gif|jpe?g|png|svg|tiff|webp)';
const HAS_EXT = new RegExp(`[.]${EXT}$`, 'i');
const HINT = '#.jpg';

/** A imagem pronta para o `img` do Foundry (web com extensão, ou data-URL), ou null. */
export function toFoundryImage(src) {
  if (typeof src !== 'string' || !src) return null;
  if (/^data:image[/]/i.test(src)) return src;
  if (!/^https?:/i.test(src)) return null;
  const bare = src.split('#')[0];
  let path = bare;
  try { path = new URL(bare).pathname; } catch { /* sem URL válida, o texto todo */ }
  return HAS_EXT.test(path) || HAS_EXT.test(bare) ? bare : `${bare}${HINT}`;
}

/** A imagem do Foundry de volta para o app (web ou data-URL, sem o nosso fragmento), ou null. */
export function fromFoundryImage(src) {
  if (typeof src !== 'string' || !/^(data:|https?:)/i.test(src)) return null;
  return src.endsWith(HINT) ? src.slice(0, -HINT.length) : src;
}
