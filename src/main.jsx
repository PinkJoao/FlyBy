// =============================================================================
// main: o ponto de entrada, que monta o App com o router
// =============================================================================
// O QUE FAZ
//   Carrega as fontes e o CSS global, aplica o tema gravado (o script inline do
//   index.html já pôs o `data-theme`; aqui entra a cor da barra do sistema) e
//   passa a acompanhar o modo do aparelho para a escolha 'system' (src/theme.js).
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
import App from './App.jsx'
import useSettingsStore from './store/settingsStore'
import { applyTheme, watchSystemTheme } from './theme'

applyTheme(useSettingsStore.getState().theme)
watchSystemTheme(() => useSettingsStore.getState().theme)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
