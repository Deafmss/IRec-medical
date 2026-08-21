import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // `sourcemap: true` publicava os .map (4,2 MB) junto com o bundle: o
    // codigo-fonte inteiro, com comentarios e nomes originais, ficava acessivel
    // no servidor publico. Foi ligado para o Sentry, mas sem restricao.
    //
    // 'hidden' gera o mapa e NAO adiciona o comentario //# sourceMappingURL no
    // bundle, entao o navegador nao o busca. O upload para o Sentry continua
    // possivel (sentry-cli sourcemaps upload ./dist), e o arquivo deve ser
    // removido do artefato de deploy depois do upload.
    sourcemap: 'hidden',
  },
})
