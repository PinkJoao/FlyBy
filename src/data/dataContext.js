// =============================================================================
// dataContext: o contexto e o hook de acesso ao compêndio carregado
// =============================================================================
// O QUE FAZ
//   Sem JSX de propósito, para não conflitar com a regra do react-refresh: o
//   componente <DataProvider> fica em DataProvider.jsx.
//
// FUNÇÕES
//   useData(): { db, stale, forceCacheUpdate, source, missing, changeSource }.
// -----------------------------------------------------------------------------

import { createContext, useContext } from 'react';

export const DataContext = createContext(null);

/** @returns {{ db: object, stale: boolean, forceCacheUpdate: () => Promise<void>, source: object|null, missing: string[], changeSource: (next: object) => Promise<void> }} */
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData precisa estar dentro de <DataProvider>');
  return ctx;
}
