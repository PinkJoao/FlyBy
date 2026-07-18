// =============================================================================
// useDataEngine - "The Gatekeeper"
// =============================================================================
// Orquestra o carregamento do compêndio 5etools com a estratégia cache-first:
//
//   1. CHECKING  → lê o IndexedDB.
//   2a. Cache fresco (<30d) e COMPLETO (todos os arquivos do manifest)
//        → usa direto, ZERO rede.                                    → READY
//   2b. Vazio, expirado ou incompleto → "Updating...", sincroniza.   → UPDATING
//        O sync é ECONÔMICO (syncCompendium): consulta a API do GitHub os SHAs
//        e baixa via raw só os arquivos que mudaram (0 quando data/ não mudou);
//        cai no download completo se a API não puder ser usada.
//        - sucesso               → grava (dados + SHAs + commit).     → READY
//        - falha + havia cache   → graceful fallback (usa expirado).  → READY
//        - falha + sem cache     → erro fatal (única tela de erro).   → ERROR
//
// Expõe forceCacheUpdate() para o override manual (ALT+click na versão).
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { readCache, writeCache, clearCache, isFresh, isComplete } from '../data/cache';
import { syncCompendium } from '../data/fetcher';

/**
 * @typedef {'checking' | 'updating' | 'ready' | 'error'} EngineStatus
 */

export default function useDataEngine() {
  const [status, setStatus] = useState(/** @type {EngineStatus} */ ('checking'));
  const [db, setDb] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [stale, setStale] = useState(false); // true = rodando com cache expirado
  const [error, setError] = useState(null);

  // Evita corridas/duplo-disparo (StrictMode monta duas vezes em dev).
  const runningRef = useRef(false);

  /**
   * Sincroniza (só o que mudou) e grava no cache. Em caso de falha, faz fallback
   * para o cache existente se houver, senão entra em estado de erro fatal.
   * @param {{ db: object|null, shas: object|null, dataCommit: string|null }|null} existing
   */
  const refreshAndCache = useCallback(async (existing) => {
    setStatus('updating');
    setProgress({ done: 0, total: 0 });
    try {
      const { db: fresh, shas, dataCommit } = await syncCompendium({
        existingDb: existing?.db ?? null,
        existingShas: existing?.shas ?? null,
        existingCommit: existing?.dataCommit ?? null,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      await writeCache(fresh, { shas, dataCommit });
      setDb(fresh);
      setStale(false);
      setStatus('ready');
    } catch (err) {
      if (existing?.db) {
        // Graceful fallback: offline com cache expirado → roda mesmo assim.
        console.warn('[useDataEngine] sync falhou, usando cache expirado.', err);
        setDb(existing.db);
        setStale(true);
        setStatus('ready');
      } else {
        // Sem rede e sem cache: não há o que fazer.
        console.error('[useDataEngine] sync falhou e não há cache.', err);
        setError(err);
        setStatus('error');
      }
    }
  }, []);

  /** Fluxo de boot cache-first. */
  const boot = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setStatus('checking');
    try {
      const cached = await readCache();
      if (cached.db && isFresh(cached.savedAt) && isComplete(cached.db)) {
        // Caminho feliz: cache válido e completo, abre instantâneo (ZERO rede).
        setDb(cached.db);
        setStale(false);
        setStatus('ready');
      } else {
        // Vazio, expirado ou INCOMPLETO (o app passou a pedir arquivos novos -
        // ex.: fluff-class-*): sincroniza só o que mudou, com fallback.
        await refreshAndCache(cached);
      }
    } finally {
      runningRef.current = false;
    }
  }, [refreshAndCache]);

  /**
   * Override manual: limpa o cache e re-baixa ignorando a regra dos 30 dias.
   * Disparado pelo VersionTag (ALT+click / long-press). Com o cache limpo o sync
   * não tem SHAs prévios → baixa tudo (e re-registra os SHAs para o futuro).
   */
  const forceCacheUpdate = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      await clearCache();
      setError(null);
      await refreshAndCache(null); // sem cache prévio → download completo
    } finally {
      runningRef.current = false;
    }
  }, [refreshAndCache]);

  useEffect(() => {
    boot();
  }, [boot]);

  return {
    status, // 'checking' | 'updating' | 'ready' | 'error'
    db, // compêndio carregado (ou null)
    progress, // { done, total } durante o download
    stale, // true se rodando com cache expirado (offline)
    error, // Error em caso de falha fatal
    forceCacheUpdate, // () => Promise<void>
    retry: boot, // re-tentar após erro fatal
  };
}
