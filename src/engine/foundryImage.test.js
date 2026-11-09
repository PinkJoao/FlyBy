// =============================================================================
// foundryImage.test: a imagem do app no formato do Foundry, ida e volta
// =============================================================================
// O QUE FAZ
//   Prova as regras medidas no Foundry 13.351: extensão no caminho ou no texto
//   passa, URL sem extensão ganha `#.jpg`, data-URL passa, o resto sai; e a volta
//   devolve a URL original.
//
// FUNÇÕES
//   (só testes)
//
// DECISÕES E ARMADILHAS
//   - Os casos são os mesmos que o Foundry aceitou ou reprovou ao vivo.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { toFoundryImage, fromFoundryImage } from './foundryImage';

describe('toFoundryImage', () => {
  it('mantém URL com extensão no caminho ou no fim do texto', () => {
    expect(toFoundryImage('https://i.pinimg.com/736x/aa/b.jpg')).toBe('https://i.pinimg.com/736x/aa/b.jpg');
    expect(toFoundryImage('https://x.com/A.JPG')).toBe('https://x.com/A.JPG');
    expect(toFoundryImage('https://cdn.x.com/a/b.webp?w=300')).toBe('https://cdn.x.com/a/b.webp?w=300');
    expect(toFoundryImage('https://wsrv.nl/?url=i.pinimg.com/x.jpg')).toBe('https://wsrv.nl/?url=i.pinimg.com/x.jpg');
  });
  it('dá o fragmento #.jpg a URL sem extensão', () => {
    expect(toFoundryImage('https://img.x.com/portrait?id=42')).toBe('https://img.x.com/portrait?id=42#.jpg');
    expect(toFoundryImage('https://img.x.com/portrait#top')).toBe('https://img.x.com/portrait#.jpg');
  });
  it('mantém data-URL de imagem e descarta o resto', () => {
    expect(toFoundryImage('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    expect(toFoundryImage('data:text/plain,oi')).toBeNull();
    expect(toFoundryImage('systems/dnd5e/tokens/x.webp')).toBeNull();
    expect(toFoundryImage('')).toBeNull();
    expect(toFoundryImage(null)).toBeNull();
  });
});

describe('fromFoundryImage', () => {
  it('tira o fragmento nosso e aceita só web e data-URL', () => {
    const url = 'https://img.x.com/portrait?id=42';
    expect(fromFoundryImage(toFoundryImage(url))).toBe(url);
    expect(fromFoundryImage('https://x.com/a.png')).toBe('https://x.com/a.png');
    expect(fromFoundryImage('worlds/w/a.png')).toBeNull();
  });
});
