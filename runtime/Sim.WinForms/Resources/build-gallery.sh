#!/bin/sh
# 把 svg/ 下的素材渲染成 gallery/ 下的 PNG：name.png 是原尺寸（学生程序读到的图片，宽高和教材一致），
# name.2x.png 是两倍尺寸（只给高分辨率屏幕的浏览器显示用）。然后把每张图的编号（原尺寸 PNG 的 SHA-1，
# 和运行器给图片的编号相同）和两倍图的文件名写进 gallery/index.json。需要 rsvg-convert 和思源黑体等中文字体。
cd "$(dirname "$0")"
for f in svg/*.svg; do
  name=$(basename "$f" .svg)
  rsvg-convert "$f" -o "gallery/$name.png"
  rsvg-convert -z 2 "$f" -o "gallery/$name.2x.png"
done
python3 - <<'PY'
import hashlib, json, os
items = json.load(open("gallery/index.json", encoding="utf-8"))
for item in items:
    if item["kind"] != "image":
        continue
    item["key"] = hashlib.sha1(open(f"gallery/{item['file']}", "rb").read()).hexdigest()
    hidpi = item["file"].replace(".png", ".2x.png")
    if os.path.exists(f"gallery/{hidpi}"):
        item["hidpi"] = hidpi
lines = ",\n".join("  " + json.dumps(i, ensure_ascii=False) for i in items)
open("gallery/index.json", "w", encoding="utf-8").write(f"[\n{lines}\n]\n")
PY
