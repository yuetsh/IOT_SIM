#!/bin/sh
# 把 svg/ 下的素材渲染成 gallery/ 下的 PNG（尺寸取 SVG 自己的 width / height）。需要 rsvg-convert 和思源黑体等中文字体。
cd "$(dirname "$0")"
for f in svg/*.svg; do
  rsvg-convert "$f" -o "gallery/$(basename "$f" .svg).png"
done
