// =============================================================================
// useDataEngine: o portão de dados (The Gatekeeper)
// =============================================================================
// O QUE FAZ
//   Orquestra o carregamento do compêndio a partir da FONTE configurada
//   (data/dataSource.js, DDL-0091). Antes de tudo, decideBoot (setupLink.js)
//   cruza a fonte gravada com o link de configuração da URL: sem fonte, CHOOSE
//   com a primeira visita (R1); link de fonte nova, CHOOSE com a confirmação;
//   link da MESMA fonte, segue calado (R2). Com a fonte decidida:
//     SRD: o pacote embutido (src/data/srdBundle.json), por import dinâmico; sem
//       rede e sem cache. READY.
//     URL: cache-first, como sempre foi:
//       1. CHECKING: lê o IndexedDB.
//       2. Cache da MESMA fonte, fresco (menos de 30 dias) e completo: usa direto,
//          zero rede. READY.
//       3. Vazio, expirado, incompleto ou de OUTRA fonte: UPDATING, e sincroniza.
//          O sync é o econômico (syncCompendium: só os arquivos que mudaram, 0 se
//          data/ não mudou, download completo se a API do GitHub falhar).
//          Sucesso: grava dados, SHAs, commit, a fonte e o que ela não tem. READY.
//          Falha com cache: segue com o cache expirado (`stale`). READY.
//          Falha sem cache: ERROR, a única tela de erro do app.
//   Incompleto acontece quando o app passa a pedir arquivos novos (fluff-class-*).
//
// FUNÇÕES
//   requestPersist(): pede ao navegador para não despejar o IndexedDB.
//   loadSrdBundle(): o pacote SRD embutido, carregado sob demanda.
//   useDataEngine(): { status, db, progress, stale, error, source, missing,
//     pending, forceCacheUpdate, changeSource, dismissLink, retry }. Por dentro:
//     refreshAndCache(existing, src, opts): sincroniza e grava; o cache existente
//       só serve de reserva na falha quando é da mesma fonte (`trusted`).
//     boot(): o fluxo pela fonte; também é o `retry` depois de um erro fatal.
//     forceCacheUpdate(): o override manual (ALT+click ou toque longo na versão,
//       no VersionTag): limpa o cache e re-baixa tudo, ignorando os 30 dias, e
//       re-registra os SHAs. No SRD só recarrega o pacote.
//     changeSource(next): grava a fonte nova e recarrega por ela.
//     dismissLink(): recusa o link de configuração e segue com a fonte atual.
//
// DECISÕES E ARMADILHAS
//   - O link é consumido UMA vez por carga da página (linkRef): resolvido ou
//     recusado, um boot seguinte (troca de fonte) não pergunta de novo.
//   - Cache sem fonte gravada é de antes da Fase 2. Sem endereço no código (Fase
//     5), ele é reconhecido pelo CONTEÚDO: vira candidato do sync (`trusted:
//     false`), e o diff por SHA de blob do git só reaproveita arquivo idêntico ao
//     da fonte nova; mesmo commit de data/ é a mesma história, e o fast-path vale.
//     Se a fonte nova falhar, o candidato NÃO serve de reserva: um endereço errado
//     abriria com os dados antigos em vez da tela de erro (o defeito que a Fase 2
//     pegou no navegador).
//   - O modo SRD não toca no cache: voltar para a mesma URL reaproveita o que já
//     estava baixado (o sync por SHA confere).
//   - requestPersist (PACKAGING-STUDY.md §10): sem ele o navegador pode despejar
//     o IndexedDB, e os PERSONAGENS moram lá. É um pedido; o navegador decide.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { readCache, writeCache, clearCache, isFresh, isComplete } from '../data/cache';
import { syncCompendium } from '../data/fetcher';
import { readSource, writeSource, sameSource } from '../data/dataSource';
import { takeSetupLink, decideBoot } from '../data/setupLink';

// ATENÇÃO: lido na carga do módulo, antes do React; um inicializador de estado rodaria duas vezes no StrictMode.
const SETUP_LINK = takeSetupLink();

/** @typedef {'checking' | 'updating' | 'choose' | 'ready' | 'error'} EngineStatus */

/** Pede ao navegador para não despejar o IndexedDB. */
function requestPersist() {
  try {
    navigator?.storage?.persist?.().catch(() => {});
  } catch {
    /* navegador sem a API: nada a pedir */
  }
}

/** O pacote SRD embutido, carregado sob demanda. */
async function loadSrdBundle() {
  const mod = await import('../data/srdBundle.json');
  return mod.default;
}

export default function useDataEngine() {
  const [status, setStatus] = useState(/** @type {EngineStatus} */ ('checking'));
  const [db, setDb] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [stale, setStale] = useState(false);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);
  const [missing, setMissing] = useState([]);
  const [pending, setPending] = useState(null);

  // ATENÇÃO: esta trava impede o duplo disparo do boot (o StrictMode monta duas vezes).
  const runningRef = useRef(false);
  const linkRef = useRef(SETUP_LINK);

  /**
   * Sincroniza só o que mudou e grava; na falha usa o cache existente ou vira erro.
   * @param {{ db: object|null, shas: object|null, dataCommit: string|null, missing?: string[] }|null} existing
   * @param {{ kind: 'url', base: string }} src
   */
  const refreshAndCache = useCallback(async (existing, src, { trusted = true } = {}) => {
    setStatus('updating');
    setProgress({ done: 0, total: 0 });
    try {
      const { db: fresh, shas, dataCommit, missing: absent } = await syncCompendium({
        existingDb: existing?.db ?? null,
        existingShas: existing?.shas ?? null,
        existingCommit: existing?.dataCommit ?? null,
        existingMissing: existing?.missing ?? [],
        base: src.base,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      await writeCache(fresh, { shas, dataCommit, source: src, missing: absent });
      setDb(fresh);
      setMissing(absent ?? []);
      setStale(false);
      setStatus('ready');
    } catch (err) {
      if (trusted && existing?.db) {
        console.warn('[useDataEngine] sync falhou, usando cache expirado.', err);
        setDb(existing.db);
        setMissing(existing.missing ?? []);
        setStale(true);
        setStatus('ready');
      } else {
        console.error('[useDataEngine] sync falhou e não há cache.', err);
        setError(err);
        setStatus('error');
      }
    }
  }, []);

  /** O fluxo pela fonte configurada. */
  const boot = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setStatus('checking');
    setError(null);
    requestPersist();
    try {
      const stored = await readSource();
      setSource(stored);
      const decision = decideBoot({ stored, link: linkRef.current });
      if (decision.action !== 'boot') {
        setPending({ ...decision, current: stored });
        setStatus('choose');
        return;
      }
      linkRef.current = null;
      setPending(null);
      const src = decision.source;
      if (src.kind === 'srd') {
        try {
          setDb(await loadSrdBundle());
          setMissing([]);
          setStale(false);
          setStatus('ready');
        } catch (err) {
          setError(err);
          setStatus('error');
        }
        return;
      }
      const cached = await readCache();
      const sameOrigin = !!cached.source && sameSource(cached.source, src);
      if (sameOrigin && cached.db && isFresh(cached.savedAt) && isComplete(cached.db, cached.missing)) {
        setDb(cached.db);
        setMissing(cached.missing ?? []);
        setStale(false);
        setStatus('ready');
      } else if (sameOrigin) {
        await refreshAndCache(cached, src);
      } else {
        const legacy = !cached.source && cached.db ? cached : null;
        await refreshAndCache(legacy, src, { trusted: false });
      }
    } finally {
      runningRef.current = false;
    }
  }, [refreshAndCache]);

  /** Limpa o cache e re-baixa tudo, ignorando a validade. */
  const forceCacheUpdate = useCallback(async () => {
    if (runningRef.current) return;
    const src = await readSource();
    if (!src || src.kind === 'srd') {
      await boot();
      return;
    }
    runningRef.current = true;
    try {
      await clearCache();
      setError(null);
      await refreshAndCache(null, src);
    } finally {
      runningRef.current = false;
    }
  }, [boot, refreshAndCache]);

  /** Grava a fonte nova e recarrega por ela; o link pendente se resolve aqui. */
  const changeSource = useCallback(async (next) => {
    linkRef.current = null;
    await writeSource(next);
    await boot();
  }, [boot]);

  /** Recusa o link de configuração e segue com a fonte atual. */
  const dismissLink = useCallback(async () => {
    linkRef.current = null;
    await boot();
  }, [boot]);

  useEffect(() => {
    boot();
  }, [boot]);

  return {
    status,
    db,
    progress,
    stale,
    error,
    source,
    missing,
    pending,
    forceCacheUpdate,
    changeSource,
    dismissLink,
    retry: boot,
  };
}
