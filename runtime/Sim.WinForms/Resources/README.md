# 项目资源素材库

学生在"项目资源"里添加的图片和声音（`Properties.Resources.xxx`），名字和教材一致，全部由平台自绘或合成（不使用教材配套资料里的素材）。

- `gallery/`：发布给运行器和网页的文件，`index.json` 是清单（名字、文件、中文说明、类型）。
- `*.svg`：图片的源文件，改了以后用 `rsvg-convert xxx.svg -o gallery/xxx.png` 重新生成。
- `gallery/ring.mp3`：用 ffmpeg 合成的门铃声（叮—咚），命令见提交记录。
