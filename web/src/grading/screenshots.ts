// 提交作业时给每个窗体截一张图：用设计器的预览树和运行时同一套 FormWindow 在屏幕外渲染，再转成 PNG。
// 截图随提交保存，老师在评阅页直接看界面，AI 评阅也据此评"窗体界面"。截图失败不影响提交。
import { createApp, h, nextTick } from 'vue'
import { domToPng } from 'modern-screenshot'
import type { Screenshot, SourceFile } from '@iot/shared'
import { parseDesigner } from '../designer/document'
import { previewTree } from '../designer/preview'
import FormWindow from '../winforms/FormWindow.vue'

const MAX_FORMS = 6
/** 和服务器的限制一致：base64 超过这个长度的截图不提交 */
const MAX_PNG_LENGTH = 700_000

export async function captureForms(files: SourceFile[]): Promise<Screenshot[]> {
  const designers = files.filter((f) => f.path.endsWith('.Designer.cs')).slice(0, MAX_FORMS)
  if (designers.length === 0) return []
  const host = document.createElement('div')
  host.style.cssText = 'position: fixed; left: -10000px; top: 0; width: 2000px; height: 2000px; pointer-events: none;'
  document.body.append(host)
  const shots: Screenshot[] = []
  try {
    for (const file of designers) {
      let form
      try {
        form = previewTree(parseDesigner(file.content))
      } catch {
        continue // Designer.cs 被改得解析不了：这个窗体不截图
      }
      const holder = document.createElement('div')
      host.append(holder)
      const app = createApp({ render: () => h(FormWindow, { form, modal: false, offset: 0, act: () => {} }) })
      app.mount(holder)
      await nextTick()
      const frame = holder.querySelector<HTMLElement>('.wf-window')
      try {
        if (frame) {
          const png = (await domToPng(frame, { scale: 1 })).replace(/^data:image\/png;base64,/, '')
          if (png.length <= MAX_PNG_LENGTH) shots.push({ form: file.path.replace(/\.Designer\.cs$/, ''), png })
        }
      } finally {
        app.unmount()
        holder.remove()
      }
    }
  } finally {
    host.remove()
  }
  return shots
}
