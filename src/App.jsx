// =============================================================================
// App: a raiz do app: portão de dados, rotas e camadas globais
// =============================================================================
// O QUE FAZ
//   Só libera o app depois que o compêndio da fonte configurada está pronto
//   (useDataEngine): enquanto checa ou atualiza mostra o UpdatingScreen; sem
//   fonte, ou com um link de configuração de fonte nova, o SourceScreen; e num
//   erro o ErrorScreen, que oferece voltar ao SRD embutido.
//   Pronto, expõe o db pelo DataProvider e monta as rotas (Home, Builder, Wizard)
//   mais as camadas globais (glossário, diálogos, imagem, tutorial).
//
// FUNÇÕES
//   App(): o componente raiz.
// -----------------------------------------------------------------------------

import { Routes, Route, Navigate } from 'react-router-dom';
import useDataEngine from './hooks/useDataEngine';
import DataProvider from './data/DataProvider';
import UpdatingScreen from './components/common/UpdatingScreen';
import ErrorScreen from './components/common/ErrorScreen';
import SourceScreen from './components/common/SourceScreen';
import DialogHost from './components/common/DialogHost';
import GlossaryOverlay from './components/common/GlossaryOverlay';
import ImageViewer from './components/common/ImageViewer';
import TutorialOverlay from './components/common/TutorialOverlay';
import Home from './pages/Home';
import Builder from './pages/Builder';
import WizardPage from './pages/WizardPage';
import styles from './App.module.css';

export default function App() {
  const { status, db, progress, stale, retry, forceCacheUpdate, source, missing, pending, changeSource, dismissLink } = useDataEngine();

  if (status === 'checking' || status === 'updating') {
    return <UpdatingScreen progress={progress} />;
  }
  if (status === 'choose') {
    return <SourceScreen pending={pending} onChoose={changeSource} onDismiss={dismissLink} />;
  }
  if (status === 'error') {
    return <ErrorScreen onRetry={retry} source={source} onUseSrd={() => changeSource({ kind: 'srd' })} />;
  }

  return (
    <DataProvider value={{ db, stale, forceCacheUpdate, source, missing, changeSource }}>
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
      <TutorialOverlay />
    </DataProvider>
  );
}
