// =============================================================================
// useBestiary: o bestiário na tela, carregado só quando preciso
// =============================================================================
// O QUE FAZ
//   Dá à tela as criaturas da fonte ativa (data/bestiary.js): carrega sozinho
//   quando `needed` liga (há summon ativo), e `load()` carrega na hora e devolve a
//   lista (ao conjurar uma magia que invoca). A lista sai com o `_copy` resolvido.
//
// FUNÇÕES
//   useBestiary(needed): { list, loading, error, load }.
//
// DECISÕES E ARMADILHAS
//   - A lista é guardada por FONTE (a chave é a fonte serializada): trocar a fonte
//     de dados descarta a anterior em vez de mostrar criaturas da fonte velha.
//   - `load()` reaproveita a promessa em andamento: dois toques não baixam duas vezes.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { useData } from '../data/dataContext';
import { loadBestiary } from '../data/bestiary';
import { resolveCopies } from '../selector/copy';

/** O bestiário da fonte ativa: { list, loading, error, load }. */
export default function useBestiary(needed) {
  const { db, source } = useData();
  const key = JSON.stringify(source ?? null);
  const [got, setGot] = useState({ key: null, list: null, error: null });
  const pending = useRef(null);

  const load = useCallback(() => {
    if (got.key === key && got.list) return Promise.resolve(got.list);
    if (pending.current?.key === key) return pending.current.promise;
    const promise = loadBestiary({ db, source })
      .then((raw) => {
        const list = resolveCopies(raw);
        setGot({ key, list, error: null });
        return list;
      })
      .catch((error) => {
        setGot({ key, list: null, error });
        return [];
      })
      .finally(() => {
        if (pending.current?.promise === promise) pending.current = null;
      });
    pending.current = { key, promise };
    return promise;
  }, [db, source, key, got]);

  useEffect(() => {
    if (needed && got.key !== key) load();
  }, [needed, key, got.key, load]);

  const current = got.key === key ? got : { list: null, error: null };
  return { list: current.list ?? [], loading: !!needed && !current.list && !current.error, error: current.error, load };
}
