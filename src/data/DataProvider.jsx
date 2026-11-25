// =============================================================================
// DataProvider: o provider do compêndio (o contexto vive em dataContext.js)
// =============================================================================
// FUNÇÕES
//   DataProvider({ value, children }): expõe { db, stale, forceCacheUpdate,
//     source, missing, changeSource }.
// -----------------------------------------------------------------------------

import { DataContext } from './dataContext';

export default function DataProvider({ value, children }) {
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
