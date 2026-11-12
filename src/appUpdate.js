// =============================================================================
// appUpdate: a versão nova do app (service worker) chegando sem limpar dados
// =============================================================================
// O QUE FAZ
//   Registra o service worker da PWA pelo `virtual:pwa-register` e guarda um
//   estado mínimo (`ready`, `dismissed`) que o UpdateToast mostra: quando a
//   versão nova termina de baixar e assume, o aviso oferece Reload. Procura
//   versão nova ao voltar ao app e a cada 30 minutos, e recarrega UMA vez quando
//   um pedaço carregado sob demanda sumiu no deploy.
//
// FUNÇÕES
//   installAppUpdates(registerSW, win?): liga o registro, as checagens e a
//     recuperação de pedaço perdido; chamada uma vez pelo main.
//   subscribeUpdate(fn) / getUpdateState(): a loja do aviso, para o
//     `useSyncExternalStore` do UpdateToast.
//   applyUpdate(win?): recarrega a página, já servida pela versão nova.
//   dismissUpdate(): esconde o aviso até a próxima versão.
//   shouldCheck(last, now): a checagem respeita um intervalo mínimo.
//   chunkReloadAllowed(storage, now): a recarga por pedaço perdido não entra em
//     laço (uma por janela de CHUNK_RELOAD_GAP).
//   setState(patch): troca o estado e avisa quem assina.
//   sessionStore(win): o sessionStorage, ou null quando o navegador o bloqueia.
//   watchForUpdates(registration, win): o `update()` ao voltar ao app e no
//     intervalo.
//
// DECISÕES E ARMADILHAS
//   - Por que existe (2026-11-12, DDL-0208): o worker velho responde na hora com
//     o app do cache, a versão nova baixa em segundo plano (22 arquivos, 1,45 MB
//     comprimido) e nada recarregava a página quando ela assumia; o app instalado
//     retomado da memória nem procurava. O dono precisava limpar os dados do site.
//   - O modo continua `autoUpdate` (skipWaiting), com `onNeedReload` mostrando o
//     aviso em vez de recarregar sozinho. No modo `prompt` o worker novo ESPERA:
//     um reload comum não o ativa (a página velha segura o cliente) e só o botão
//     atualizaria. Assim, baixada a versão, o aviso OU um reload qualquer bastam.
//   - Recarregar sozinho foi descartado: no meio de um combate ou de um painel
//     aberto o reload jogaria fora o que está na tela.
//   - O navegador só confere o `sw.js` numa NAVEGAÇÃO; a troca de rota do SPA e
//     o app que volta do segundo plano não são uma. Por isso `update()` no
//     `visibilitychange` e no intervalo, com no mínimo CHECK_GAP entre duas.
//   - Pedaço perdido: depois que a versão nova assume, o precache velho é limpo;
//     a página velha que importa o PDF pede um arquivo que não existe mais, e o
//     rewrite do Firebase devolve o index.html (200, text/html, medido). O Vite
//     avisa por `vite:preloadError`; recarregar traz a versão nova inteira. A
//     marca no sessionStorage impede o laço se o arquivo faltar também nela.
//   - No dev o `virtual:pwa-register` é um registro vazio (sem service worker):
//     nada daqui roda ali.
// -----------------------------------------------------------------------------

export const CHECK_GAP = 60 * 1000;
export const CHECK_EVERY = 30 * 60 * 1000;
export const CHUNK_RELOAD_GAP = 10 * 1000;
const CHUNK_KEY = 'flyby:chunkReloadAt';

let state = { ready: false, dismissed: false };
const listeners = new Set();
let lastCheck = 0;

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

/** Assina as mudanças do estado do aviso. */
export function subscribeUpdate(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** O estado atual do aviso: `ready` (versão nova assumiu) e `dismissed`. */
export function getUpdateState() {
  return state;
}

/** Já passou o intervalo mínimo desde a última checagem. */
export function shouldCheck(last, now) {
  return now - last >= CHECK_GAP;
}

/** Pode recarregar por pedaço perdido (e marca a tentativa); falso dentro da janela. */
export function chunkReloadAllowed(storage, now) {
  let last;
  try {
    last = Number(storage?.getItem(CHUNK_KEY)) || 0;
  } catch {
    last = 0;
  }
  if (now - last < CHUNK_RELOAD_GAP) return false;
  try {
    storage?.setItem(CHUNK_KEY, String(now));
  } catch {
    return true;
  }
  return true;
}

function sessionStore(win) {
  try {
    return win.sessionStorage;
  } catch {
    return null;
  }
}

function watchForUpdates(registration, win) {
  const check = () => {
    const now = Date.now();
    if (!shouldCheck(lastCheck, now)) return;
    if (win.navigator.onLine === false) return;
    lastCheck = now;
    registration.update().catch(() => {});
  };
  win.document.addEventListener('visibilitychange', () => {
    if (win.document.visibilityState === 'visible') check();
  });
  win.setInterval(check, CHECK_EVERY);
}

/** Liga o service worker, o aviso de versão nova, as checagens e a recuperação de pedaço perdido. */
export function installAppUpdates(registerSW, win = window) {
  win.addEventListener('vite:preloadError', (event) => {
    if (!chunkReloadAllowed(sessionStore(win), Date.now())) return;
    event.preventDefault();
    win.location.reload();
  });
  lastCheck = Date.now();
  registerSW({
    immediate: true,
    onNeedReload: () => setState({ ready: true, dismissed: false }),
    onRegisteredSW: (_url, registration) => {
      if (registration) watchForUpdates(registration, win);
    },
  });
}

/** Recarrega a página; a versão nova já controla, então o reload a traz. */
export function applyUpdate(win = window) {
  win.location.reload();
}

/** Esconde o aviso até a próxima versão. */
export function dismissUpdate() {
  setState({ dismissed: true });
}
