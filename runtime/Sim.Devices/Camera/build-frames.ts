// 生成网络摄像机的画面帧：把 scene.svg 渲染成全景图（有人翻墙 / 没有人两种），按云台位置切成 640×480 的 JPEG。
// 帧文件提交在仓库里，改了 scene.svg 后重新运行：bun runtime/Sim.Devices/Camera/build-frames.ts
// 需要 rsvg-convert（librsvg）和 magick（ImageMagick）。
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** 与 IPCameraHelper.cs 中的常量一致 */
const VIEW = { width: 640, height: 480 }
const STEPS = { x: 7, y: 3 }
const STRIDE = { x: 200, y: 160 }

const dir = import.meta.dir
const framesDir = join(dir, 'frames')
const work = join(tmpdir(), `camera-frames-${process.pid}`)

async function run(cmd: string[]) {
  const proc = Bun.spawn(cmd, { stderr: 'inherit' })
  if ((await proc.exited) !== 0) throw new Error(`${cmd[0]} 失败`)
}

const scene = await Bun.file(join(dir, 'scene.svg')).text()
const intruder = scene
  .replace('id="intruder" display="none"', 'id="intruder"')
  .replace('<path id="beam" ', '<path id="beam" display="none" ')
  .replace('id="beam-broken" display="none"', 'id="beam-broken"')
if (intruder === scene) throw new Error('scene.svg 里找不到 #intruder')

await rm(framesDir, { recursive: true, force: true })
await mkdir(framesDir, { recursive: true })
await mkdir(work, { recursive: true })
try {
  for (const [flag, svg] of [
    [0, scene],
    [1, intruder],
  ] as const) {
    const svgPath = join(work, `scene-${flag}.svg`)
    const pngPath = join(work, `scene-${flag}.png`)
    await Bun.write(svgPath, svg)
    await run(['rsvg-convert', svgPath, '-o', pngPath])
    for (let x = 0; x < STEPS.x; x++) {
      for (let y = 0; y < STEPS.y; y++) {
        const crop = `${VIEW.width}x${VIEW.height}+${x * STRIDE.x}+${y * STRIDE.y}`
        await run(['magick', pngPath, '-crop', crop, '+repage', '-strip', '-quality', '80', join(framesDir, `${x}-${y}-${flag}.jpg`)])
      }
    }
  }
} finally {
  await rm(work, { recursive: true, force: true })
}
console.log(`已生成 ${STEPS.x * STEPS.y * 2} 帧：${framesDir}`)
