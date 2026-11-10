import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// 배포마다 바뀌는 빌드 번호. Vercel에서는 커밋 해시, 아니면 빌드 시각
const BUILD_ID = (process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? '') + '-' + Date.now().toString(36)

/** dist/version.json에 빌드 번호를 써서, 열려 있는 앱이 새 배포를 알아챌 수 있게 한다 */
function versionFile(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), versionFile()],
  define: {
    __APP_BUILD__: JSON.stringify(command === 'build' ? BUILD_ID : 'dev'),
  },
}))
