import { Routes, Route, Navigate } from 'react-router-dom';
import useDataEngine from './hooks/useDataEngine';
import DataProvider from './data/DataProvider';
import UpdatingScreen from './components/common/UpdatingScreen';
import ErrorScreen from './components/common/ErrorScreen';
import DialogHost from './components/common/DialogHost';
import GlossaryOverlay from './components/common/GlossaryOverlay';
import ImageViewer from './components/common/ImageViewer';
import Home from './pages/Home';
import Builder from './pages/Builder';
import WizardPage from './pages/WizardPage';
import styles from './App.module.css';

export default function App() {
  const { status, db, progress, stale, retry, forceCacheUpdate } = useDataEngine();

  // Gatekeeper: só liberamos o app depois que os dados estão prontos.
  if (status === 'checking' || status === 'updating') {
    return <UpdatingScreen progress={progress} />;
  }
  if (status === 'error') {
    return <ErrorScreen onRetry={retry} />;
  }

  return (
    <DataProvider value={{ db, stale, forceCacheUpdate }}>
      <div className={styles.app}>
        <main className={styles.main}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/build/:id" element={<Builder />} />
            <Route path="/build/:id/wizard" element={<WizardPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <GlossaryOverlay />
      <DialogHost />
      <ImageViewer />
    </DataProvider>
  );
}
