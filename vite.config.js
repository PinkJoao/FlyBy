import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  test: {
    // O snapshot in-repo do 5etools (DDL-0037) traz os testes jest DELES;
    // sem o exclude o vitest tenta coletá-los e a suíte quebra.
    exclude: [...configDefaults.exclude, 'DnD Source Material/**'],
  },
})
