// 导出：服务器照教材工程（真机版设备类库）编译，下载到机房电脑上用。
// EXE：一个 exe，双击就能控制真的实训台；VS 工程：教材那样的 VS 2012 工程（zip），用 VS 打开接着改。
import type { Diagnostic, SourceFile } from '@iot/shared'
import { apiResponse, ApiError } from '../api'
import { projectNamespace } from '../designer/templates'

export type ExportKind = 'exe' | 'project'

const EXT: Record<ExportKind, string> = { exe: 'exe', project: 'zip' }

/** 下载成功返回 null；代码有错误返回报错（照真机版类库编译，和 VS 里一样）；其他问题抛出 ApiError */
export async function downloadExport(kind: ExportKind, files: SourceFile[]): Promise<Diagnostic[] | null> {
  let response: Response
  try {
    response = await apiResponse('POST', `/api/export-${kind}`, { files, name: projectNamespace(files) })
  } catch (error) {
    if (error instanceof ApiError && error.status === 422 && Array.isArray(error.data.diagnostics)) return error.data.diagnostics as Diagnostic[]
    throw error
  }
  const name = fileName(response.headers.get('Content-Disposition')) ?? `${projectNamespace(files)}.${EXT[kind]}`
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return null
}

/** Content-Disposition 里的中文文件名（filename*=UTF-8''…） */
function fileName(header: string | null) {
  const m = header && /filename\*=UTF-8''([^;]+)/i.exec(header)
  return m ? decodeURIComponent(m[1]) : null
}
