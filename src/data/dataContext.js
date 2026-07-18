// Contexto + hook de acesso ao compêndio carregado (db).
// Mantido sem JSX para não conflitar com a regra react-refresh
// (o componente <DataProvider> fica em DataProvider.jsx).
import { createContext, useContext } from 'react';

export const DataContext = createContext(null);

/** @returns {{ db: object, stale: boolean, forceCacheUpdate: () => Promise<void> }} */
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData precisa estar dentro de <DataProvider>');
  return ctx;
}
