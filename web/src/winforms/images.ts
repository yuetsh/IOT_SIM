// 运行时图片：运行器发来的图片数据由 RunSession 保存成 blob 网址，控件属性里只带图片编号。
// 运行区 provide，ControlView inject；设计器预览没有运行时图片，取到空表。
import type { CSSProperties, InjectionKey } from 'vue'

export const RUN_IMAGES: InjectionKey<ReadonlyMap<string, string>> = Symbol('runImages')

/** 控件 Image 属性的值（见 runtime/Sim.WinForms/Host/PropValue.cs） */
export interface ImageValue {
  key: string
  width: number
  height: number
  /** 设计器预览里的项目资源：直接给出素材网址（运行时用 key） */
  url?: string
}

/** 背景图片的 CSS：BackgroundImageLayout 为 Tile（默认，平铺）、None（左上角一张）、Center、Stretch、Zoom */
export function backgroundCss(value: unknown, layout: unknown, images: ReadonlyMap<string, string>): CSSProperties {
  const image = value as ImageValue | null | undefined
  const url = image ? image.url ?? images.get(image.key) : undefined
  if (!url) return {}
  const base = { backgroundImage: `url("${url}")` }
  switch (layout) {
    case 'None':
      return { ...base, backgroundRepeat: 'no-repeat', backgroundPosition: '0 0' }
    case 'Center':
      return { ...base, backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }
    case 'Stretch':
      return { ...base, backgroundRepeat: 'no-repeat', backgroundSize: '100% 100%' }
    case 'Zoom':
      return { ...base, backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundSize: 'contain' }
    default:
      return { ...base, backgroundRepeat: 'repeat', backgroundPosition: '0 0' }
  }
}
