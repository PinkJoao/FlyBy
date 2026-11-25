// =============================================================================
// usePortraitIndex: o catálogo de retratos sugeridos, carregado sob demanda
// =============================================================================
// O QUE FAZ
//   Monta o catálogo (loadPortraitCatalog: release v3 de fora do app, cache do
//   aparelho, fatia licenciada embutida) só quando uma tela de sugestões abre,
//   guarda a promise para as outras telas (a faixa do escolhedor e o modal da
//   galeria usam a mesma) e expõe o estado de carga com um "tentar de novo".
//
// FUNÇÕES
//   loadPortraitIndex(): carrega e mantém em cache o catálogo; esquece a promise
//     rejeitada ou vazia.
//   usePortraitIndex(): { data, loading, failed, retry } para um componente.
//
// DECISÕES E ARMADILHAS
//   - Carga sob demanda: o catálogo não pesa no pacote inicial do app.
//   - loadPortraitCatalog não rejeita (DDL-0137); um catálogo VAZIO conta como falha
//     e não fica em cache: a próxima chamada tenta de novo, e `retry` a dispara.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { loadPortraitCatalog } from '../../data/portraitCatalog';

let cachedIndexPromise = null;
let cachedIndex = null;

/** Carrega e mantém em cache o catálogo de retratos. */
export function loadPortraitIndex() {
  if (!cachedIndexPromise) {
    cachedIndexPromise = loadPortraitCatalog()
      .then((catalog) => {
        if (!catalog?.items?.length) throw new Error('catálogo de retratos vazio');
        cachedIndex = catalog;
        return cachedIndex;
      })
      .catch((err) => {
        cachedIndexPromise = null;
        throw err;
      });
  }
  return cachedIndexPromise;
}

/**
 * O catálogo de retratos com o estado da carga.
 * @returns {{ data: object|null, loading: boolean, failed: boolean, retry: () => void }}
 */
export function usePortraitIndex() {
  const [data, setData] = useState(cachedIndex);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (data) return undefined;
    let alive = true;
    loadPortraitIndex()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [data, attempt]);

  const retry = () => {
    setFailed(false);
    setAttempt((n) => n + 1);
  };

  return { data, loading: !data && !failed, failed, retry };
}
