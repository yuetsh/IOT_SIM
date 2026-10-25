# 项目资源素材库

学生在"项目资源"里添加的图片和声音（`Properties.Resources.xxx`），名字和尺寸与教材一致，全部由平台自绘或合成（不使用教材配套资料里的素材）。

- `gallery/`：发布给运行器和网页的文件，`index.json` 是清单（名字、文件、中文说明、类型；图片还有编号 key 和两倍图 hidpi，由 `build-gallery.sh` 写入）。`name.png` 是原尺寸，学生程序读到的就是它；`name.2x.png` 只给高分辨率屏幕的浏览器显示用，宽高仍按原尺寸。
- `svg/`：图片的源文件；`project8.py` 生成项目 8 的那些 SVG。改了以后运行 `python3 project8.py && sh build-gallery.sh` 重新生成 PNG（需要 rsvg-convert 和思源黑体）。
- `gallery/ring.mp3`：用 ffmpeg 合成的门铃声（叮—咚），命令见提交记录。
