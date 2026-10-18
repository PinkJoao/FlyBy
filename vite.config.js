// =============================================================================
// vite.config: configuração do Vite e do Vitest
// =============================================================================
// O QUE FAZ
//   O plugin do React com o React Compiler (via babel), a PWA (vite-plugin-pwa,
//   Fase 6 do DDL-0091) e a configuração de teste do Vitest. Referência:
//   https://vite.dev/config/ e https://vite-pwa-org.netlify.app/
//
// DECISÕES E ARMADILHAS
//   - O Vitest exclui 'DnD Source Material/**': o snapshot do 5etools (DDL-0037)
//     traz os testes jest DELES, e coletá-los quebra a suíte.
//   - Com o React Compiler, o grafo de módulos sobrevive a um reload no HMR: um
//     aviso de ordem de hooks no dev pede uma ABA NOVA antes de virar bug (§6.1).
//   - PWA: o service worker só existe no BUILD (o dev segue sem ele). Ele
//     pré-cacheia o app inteiro, inclusive o pacote SRD e o PDF, para abrir sem
//     rede; o compêndio de uma fonte do usuário NÃO entra no cache dele (já mora
//     no IndexedDB, com o sync por SHA). Por isso o limite de tamanho sobe: o
//     chunk principal e o pacote SRD passam dos 2 MB padrão do Workbox.
//   - `autoUpdate`: um deploy novo assume na próxima abertura, sem perguntar. O
//     `navigateFallback` responde qualquer rota com o index.html, como o rewrite
//     do Firebase; a query (`?fonte=`) segue na URL e o app a lê igual.
//   - O manifesto não usa marca da Wizards no nome nem na descrição: é o texto
//     da tela de instalação (PACKAGING-STUDY.md §4).
//   - No iPhone, o app da Tela de Início tem armazenamento SEPARADO do Safari e
//     escapa da limpeza de 7 dias; é a correção que o README indica.
// -----------------------------------------------------------------------------

import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { VitePWA } from 'vite-plugin-pwa'

const BG = '#16171d'

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['logo.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'FlyBy',
        short_name: 'FlyBy',
        description: 'Character builder for the 5th edition fantasy roleplaying game (2024 rules).',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: BG,
        theme_color: BG,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    exclude: [...configDefaults.exclude, 'DnD Source Material/**'],
  },
})
