// 运行时图片：运行器发来的图片数据由 RunSession 保存成 blob 网址，控件属性里只带图片编号。
// 运行区 provide，ControlView inject；设计器预览没有运行时图片，取到空表。
import type { InjectionKey } from 'vue'

export const RUN_IMAGES: InjectionKey<ReadonlyMap<string, string>> = Symbol('runImages')

/** 控件 Image 属性的值（见 runtime/Sim.WinForms/Host/PropValue.cs） */
export interface ImageValue {
  key: string
  width: number
  height: number
}
