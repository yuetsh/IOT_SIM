// 运行时图片：运行器发来的图片数据由 RunSession 保存成 blob 网址，控件属性里只带图片编号。
// 运行区 provide，ControlView inject；设计器预览没有运行时图片，取到空表。
import type { CSSProperties, InjectionKey } from 'vue'
import { gallery } from '../designer/resources'

export const RUN_IMAGES: InjectionKey<ReadonlyMap<string, string>> = Symbol('runImages')

/** 控件 Image 属性的值（见 runtime/Sim.WinForms/Host/PropValue.cs） */
export interface ImageValue {
  key: string
  width: number
  height: number
  /** 设计器预览里的项目资源：直接给出素材网址（运行时用 key） */
  url?: string
}

/**
 * 图片的网址。素材库里的图片（按编号或素材网址认出来）另有两倍尺寸的版本，
 * 高分辨率屏幕（系统缩放 150%、200%）上用它，不然浏览器放大原图会发虚；程序读到的宽高不变。
 */
export function imageSources(value: unknown, images: ReadonlyMap<string, string>): { src: string; hidpi?: string } | undefined {
  const image = value as ImageValue | null | undefined
  if (!image) return undefined
  const item = gallery.value.find((g) => (image.key && g.key === image.key) || (image.url && image.url === `/resources/${g.file}`))
  if (item?.hidpi) return { src: `/resources/${item.file}`, hidpi: `/resources/${item.hidpi}` }
  const src = image.url ?? images.get(image.key)
  return src ? { src } : undefined
}

/** <img> 的 srcset：有两倍图时浏览器按屏幕分辨率选 */
export const srcset = (sources: { src: string; hidpi?: string } | undefined) => (sources?.hidpi ? `${sources.src} 1x, ${sources.hidpi} 2x` : undefined)

/** 背景图片的 CSS：BackgroundImageLayout 为 Tile（默认，平铺）、None（左上角一张）、Center、Stretch、Zoom */
export function backgroundCss(value: unknown, layout: unknown, images: ReadonlyMap<string, string>): CSSProperties {
  const sources = imageSources(value, images)
  if (!sources) return {}
  // image-set 里的两倍图按 2x 显示，平铺、居中、左上角时仍是原尺寸
  const base: CSSProperties = {
    backgroundImage: sources.hidpi ? `image-set(url("${sources.src}") 1x, url("${sources.hidpi}") 2x)` : `url("${sources.src}")`,
  }
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
