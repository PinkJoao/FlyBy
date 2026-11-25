// =============================================================================
// installHint.test: a detecção do Samsung Internet e o link para o Chrome
// =============================================================================
// O QUE FAZ
//   Garante que só o Samsung Internet é detectado (não o Chrome de um aparelho
//   Samsung) e que o link para o Chrome leva caminho e query junto.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { isSamsungInternet, chromeIntentUrl } from './installHint';

const SAMSUNG =
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36';
const CHROME_ON_SAMSUNG =
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';

describe('isSamsungInternet', () => {
  it('detects the Samsung Internet user agent', () => {
    expect(isSamsungInternet(SAMSUNG)).toBe(true);
  });

  it('does not flag Chrome on a Samsung phone', () => {
    expect(isSamsungInternet(CHROME_ON_SAMSUNG)).toBe(false);
  });

  it('tolerates a missing user agent', () => {
    expect(isSamsungInternet(undefined)).toBe(false);
  });
});

describe('chromeIntentUrl', () => {
  it('keeps the path and the query of the current page', () => {
    const url = new URL('https://flyby-hub.web.app/build/abc?fonte=x');
    expect(chromeIntentUrl(url)).toBe(
      'intent://flyby-hub.web.app/build/abc?fonte=x#Intent;scheme=https;package=com.android.chrome;end',
    );
  });
});
