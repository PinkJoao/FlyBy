// =============================================================================
// imageProxy.test: a URL do proxy de imagem com CORS
// =============================================================================
// O QUE FAZ
//   Cobre corsProxyUrl: só imagem http(s) ganha proxy, com a URL codificada.
//
// FUNÇÕES
//   (nenhuma: suíte Vitest).
//
// DECISÕES E ARMADILHAS
//   - loadCorsImage e fetchImageBlob dependem de rede e do DOM: conferidos no
//     navegador (PDF com o retrato do i.pinimg.com), não aqui.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { corsProxyUrl } from './imageProxy';

describe('corsProxyUrl', () => {
  it('passa imagem http(s) pelo wsrv.nl com a URL codificada', () => {
    expect(corsProxyUrl('https://i.pinimg.com/736x/ab/cd/ef/x.jpg')).toBe(
      'https://wsrv.nl/?url=https%3A%2F%2Fi.pinimg.com%2F736x%2Fab%2Fcd%2Fef%2Fx.jpg',
    );
  });

  it('não passa data:, blob: nem vazio pelo proxy', () => {
    expect(corsProxyUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(corsProxyUrl('blob:http://localhost/x')).toBeNull();
    expect(corsProxyUrl('')).toBeNull();
    expect(corsProxyUrl(null)).toBeNull();
  });
});
