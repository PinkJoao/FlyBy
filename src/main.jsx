// =============================================================================
// main: o ponto de entrada, que monta o App com o router
// =============================================================================
// O QUE FAZ
//   Carrega as fontes e o CSS global, aplica o tema gravado (o script inline do
//   index.html já pôs o `data-theme`; aqui entra a cor da barra do sistema) e
//   passa a acompanhar o modo do aparelho para a escolha 'system' (src/theme.js).
//   Liga a roda do mouse nas faixas que rolam de lado (src/wheelScroll.js).
//   Registra o service worker e o aviso de versão nova (src/appUpdate.js, o
//   UpdateToast montado ao lado do App, DDL-0208).
//
// DECISÕES E ARMADILHAS
//   - As fontes do tema papel (Cinzel e Alegreya, OFL-1.1, via @fontsource) são
//     importadas para todos, mas o navegador só baixa uma fonte quando algum
//     texto a usa: quem não usa o tema papel não paga nada além do precache da
//     PWA (vite.config.js, só o subconjunto latino).
// -----------------------------------------------------------------------------

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/cinzel/wght.css'
import '@fontsource-variable/alegreya/wght.css'
import '@fontsource-variable/alegreya/wght-italic.css'
import './index.css'
import './motion.css'
import './decor.css'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import UpdateToast from './components/common/UpdateToast'
import useSettingsStore from './store/settingsStore'
import { applyTheme, watchSystemTheme } from './theme'
import { installWheelToHorizontal } from './wheelScroll'
import { installAppUpdates } from './appUpdate'

applyTheme(useSettingsStore.getState().theme)
watchSystemTheme(() => useSettingsStore.getState().theme)
installWheelToHorizontal()
installAppUpdates(registerSW)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
    <UpdateToast />
  </StrictMode>,
)
