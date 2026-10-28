import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'

/**
 * 打包后的代码块之间按需加载写的是 import("./X.js")，应该相对于代码块自己（/assets/）解析。
 * Chrome 94 在 Promise 回调里调用 import() 时（Vite 的预加载就是这样）有时会相对于网页地址解析，
 * 去请求 /X.js、拿到首页 HTML，页面一片空白，时好时坏。改成 /assets/X.js 这样的绝对路径就不受影响。
 */
function absoluteDynamicImports(): Plugin {
  let prefix = '/assets/'
  return {
    name: 'absolute-dynamic-imports',
    apply: 'build',
    configResolved(config) {
      prefix = `${config.base}${config.build.assetsDir}/`
    },
    // 文件名的 hash 在 generateBundle 之前就算好了，这里让改过的代码块换个文件名，浏览器不会用缓存里没改过的旧文件
    augmentChunkHash(chunk) {
      if (chunk.dynamicImports.length > 0) return 'absolute-dynamic-imports'
    },
    // 等 Vite 按 import("./X.js") 找出每个代码块要预加载的 CSS 和依赖之后再改
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        for (const chunk of Object.values(bundle)) {
          if (chunk.type === 'chunk') chunk.code = chunk.code.replace(/\bimport\((["'])\.\//g, `import($1${prefix}`)
        }
      },
    },
  }
}

export default defineConfig({
  plugins: [vue(), absoluteDynamicImports()],
  // 机房电脑的浏览器是 Chrome 94：语法和 CSS 按它转换，缺的功能在 src/polyfills.ts 里补
  build: { target: ['chrome94', 'edge94'] },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/resources': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
})
