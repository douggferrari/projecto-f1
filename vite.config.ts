import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA: instalável no iPhone via "Adicionar à Tela de Início", com
    // funcionamento offline (o jogo é 100% client-side) e atualização
    // automática do service worker a cada deploy.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Projecto F1 — Simulador de Chefe de Equipe',
        short_name: 'Projecto F1',
        description:
          'Assuma uma equipe pequena de Fórmula 1, gerencie orçamento, contratos e desenvolvimento — e chegue ao topo.',
        lang: 'pt-BR',
        theme_color: '#11141b',
        background_color: '#11141b',
        display: 'standalone',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
