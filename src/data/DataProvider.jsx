import { DataContext } from './dataContext';

export default function DataProvider({ value, children }) {
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
