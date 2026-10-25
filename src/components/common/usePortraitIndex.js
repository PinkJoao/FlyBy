// =============================================================================
// usePortraitIndex: o catálogo de retratos sugeridos, carregado sob demanda
// =============================================================================
// O QUE FAZ
//   Importa `src/data/portraitsIndex.json` (2 MB) só quando uma tela de sugestões
//   abre, guarda a promise para as outras telas (a faixa do escolhedor e o modal
//   da galeria usam a mesma) e expõe o estado de carga com um "tentar de novo".
//
// FUNÇÕES
//   loadPortraitIndex(): importa e mantém em cache o índice; esquece a promise
//     rejeitada.
//   usePortraitIndex(): { data, loading, failed, retry } para um componente.
//
// DECISÕES E ARMADILHAS
//   - Import dinâmico: o índice não pesa no pacote inicial do app.
//   - Falha no import (offline, deploy novo com o chunk trocado) não fica em cache:
//     a próxima chamada tenta de novo, e `retry` a dispara (DDL-0127).
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';

let cachedIndexPromise = null;
let cachedIndex = null;

/** Carrega e mantém em cache o índice estático de retratos. */
export function loadPortraitIndex() {
  if (!cachedIndexPromise) {
    cachedIndexPromise = import('../../data/portraitsIndex.json')
      .then((m) => {
        cachedIndex = m.default ?? m;
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
