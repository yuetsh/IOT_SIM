#!/usr/bin/env python3
"""
生成教材项目 8（智慧校园管理平台）用到的素材 SVG：名字和尺寸与教材配套资源一致，内容全部自绘（扁平插画）。
运行后用 build-gallery.sh 渲染成 PNG：python3 project8.py && sh build-gallery.sh
"""
from pathlib import Path

OUT = Path(__file__).parent / "svg"
OUT.mkdir(exist_ok=True)
FONT = "Source Han Sans CN, Noto Sans CJK SC, sans-serif"


def save(name, width, height, body):
    (OUT / f"{name}.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">\n{body}\n</svg>\n',
        encoding="utf-8",
    )


# ---------- 标题图：智慧校园 ----------
save("ico_title", 226, 54, f"""
  <g transform="translate(8,7)">
    <circle cx="20" cy="20" r="19" fill="#ffffff" opacity="0.95"/>
    <path d="M7 27 L20 10 L33 27 Z" fill="#3593ed"/>
    <rect x="13" y="22" width="14" height="9" fill="#3593ed"/>
    <rect x="18" y="25" width="4" height="6" fill="#ffffff"/>
  </g>
  <text x="56" y="37" font-family="{FONT}" font-size="27" font-weight="bold" fill="#ffffff" letter-spacing="3">智慧校园</text>
""")

# ---------- 校园建筑：主界面背景、路灯场景共用的元素 ----------
def building(x, y, w, h, color, window="#cfe3f5", rows=4, cols=6, roof="#b36b45"):
    parts = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{color}"/>',
             f'<rect x="{x-8}" y="{y-14}" width="{w+16}" height="16" fill="{roof}"/>']
    gap_x = w / cols
    gap_y = (h - 30) / rows
    for r in range(rows):
        for c in range(cols):
            parts.append(f'<rect x="{x + c*gap_x + gap_x*0.22:.1f}" y="{y + 18 + r*gap_y:.1f}" width="{gap_x*0.56:.1f}" height="{gap_y*0.55:.1f}" fill="{window}"/>')
    return "\n".join(parts)


def tree(x, y, s=1.0, color="#4f9a45"):
    return (f'<rect x="{x-6*s}" y="{y}" width="{12*s}" height="{60*s}" fill="#7a5230"/>'
            f'<circle cx="{x}" cy="{y-30*s}" r="{48*s}" fill="{color}"/><circle cx="{x-32*s}" cy="{y-5*s}" r="{34*s}" fill="{color}"/>'
            f'<circle cx="{x+32*s}" cy="{y-5*s}" r="{34*s}" fill="#468c3e"/>')


save("bg_home", 1440, 748, f"""
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5aa7ea"/><stop offset="1" stop-color="#cfe8fb"/></linearGradient>
    <linearGradient id="lawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8cc66d"/><stop offset="1" stop-color="#5f9e45"/></linearGradient>
  </defs>
  <rect width="1440" height="748" fill="url(#sky)"/>
  <circle cx="1260" cy="120" r="60" fill="#fff3b0" opacity="0.9"/>
  <g fill="#ffffff" opacity="0.85">
    <ellipse cx="260" cy="120" rx="90" ry="30"/><ellipse cx="320" cy="105" rx="60" ry="28"/>
    <ellipse cx="880" cy="90" rx="110" ry="32"/><ellipse cx="950" cy="80" rx="70" ry="28"/>
  </g>
  <g opacity="0.55" fill="#9fb8cf">
    <rect x="40" y="300" width="160" height="260"/><rect x="1230" y="280" width="180" height="280"/><rect x="230" y="340" width="120" height="220"/>
  </g>
  {building(380, 260, 680, 300, "#f2e3c9")}
  <rect x="660" y="190" width="120" height="70" fill="#f2e3c9"/><rect x="650" y="178" width="140" height="16" fill="#b36b45"/>
  <circle cx="720" cy="225" r="20" fill="#ffffff" stroke="#8a6a4a" stroke-width="4"/>
  <rect x="680" y="470" width="80" height="90" fill="#8a6a4a"/>
  {building(1080, 360, 220, 200, "#e8d6bd", rows=3, cols=4)}
  {building(150, 380, 210, 180, "#e8d6bd", rows=3, cols=4)}
  <rect x="0" y="560" width="1440" height="188" fill="url(#lawn)"/>
  <path d="M560 748 L680 560 L760 560 L880 748 Z" fill="#d9c9a8"/>
  {tree(120, 600, 1.1)}{tree(330, 620, 0.9)}{tree(1130, 610, 1.0)}{tree(1350, 600, 1.2)}
  <g fill="#3f8a3a"><ellipse cx="480" cy="572" rx="90" ry="22"/><ellipse cx="960" cy="572" rx="90" ry="22"/></g>
""")


def street(lit):
    sky = ('<stop offset="0" stop-color="#2b3d66"/><stop offset="1" stop-color="#e8a76b"/>' if lit
           else '<stop offset="0" stop-color="#6bb0ea"/><stop offset="1" stop-color="#d6ecfb"/>')
    window = "#ffd37a" if lit else "#cfe3f5"
    lamps = []
    for x in (180, 520, 860, 1200):
        lamps.append(f'<rect x="{x}" y="380" width="12" height="260" fill="#4b5563"/>'
                     f'<path d="M{x+6} 386 Q{x+6} 356 {x+46} 356 H{x+70}" stroke="#4b5563" stroke-width="10" fill="none"/>'
                     f'<rect x="{x+56}" y="348" width="44" height="16" rx="5" fill="#374151"/>')
        if lit:
            lamps.append(f'<path d="M{x+60} 364 L{x+20} 640 H{x+140} L{x+96} 364 Z" fill="#fff3b0" opacity="0.35"/>'
                         f'<ellipse cx="{x+78}" cy="366" rx="22" ry="7" fill="#fff8d0"/>')
        else:
            lamps.append(f'<ellipse cx="{x+78}" cy="366" rx="18" ry="5" fill="#9ca3af"/>')
    return f"""
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">{sky}</linearGradient></defs>
  <rect width="1440" height="716" fill="url(#sky)"/>
  {'<circle cx="1180" cy="110" r="36" fill="#fff6c8"/>' if lit else '<circle cx="1220" cy="110" r="50" fill="#fff3b0" opacity="0.9"/>'}
  {building(80, 220, 560, 330, "#e9d8bf", window=window, rows=5, cols=7)}
  {building(760, 260, 580, 290, "#dcc7a8", window=window, rows=4, cols=7)}
  <rect x="0" y="550" width="1440" height="40" fill="#7fb06a"/>
  <rect x="0" y="590" width="1440" height="126" fill="#5b6472"/>
  <g fill="#f8fafc">{''.join(f'<rect x="{x}" y="648" width="70" height="8"/>' for x in range(30, 1440, 140))}</g>
  {''.join(lamps)}
  {tree(700, 560, 0.8, "#3f7f45")}{tree(1390, 560, 0.9, "#3f7f45")}
"""


save("day_01", 1440, 716, street(lit=True))
save("day_02", 1440, 716, street(lit=False))

# ---------- 主界面的三个功能图标 ----------
def tile(name, color, icon, label):
    save(name, 180, 210, f"""
  <rect x="6" y="6" width="168" height="198" rx="18" fill="{color}"/>
  <rect x="6" y="6" width="168" height="198" rx="18" fill="#ffffff" opacity="0.08"/>
  <g transform="translate(90,82)" fill="#ffffff" stroke="#ffffff">{icon}</g>
  <text x="90" y="178" font-family="{FONT}" font-size="24" font-weight="bold" fill="#ffffff" text-anchor="middle">{label}</text>
""")


tile("icon_02", "#2e9e5b", """
    <rect x="-6" y="10" width="12" height="40" stroke="none"/>
    <circle cx="0" cy="-12" r="34" stroke="none"/><circle cx="-26" cy="8" r="22" stroke="none"/><circle cx="26" cy="8" r="22" stroke="none"/>
    <path d="M-4 -2 L0 -30 L4 -2" fill="#2e9e5b" stroke="none"/>""", "校园环境")
tile("icon_03", "#2f7fe0", """
    <path d="M0 -48 L40 -32 V2 C40 28 20 44 0 52 C-20 44 -40 28 -40 2 V-32 Z" stroke="none"/>
    <path d="M-16 0 L-4 12 L18 -14" fill="none" stroke="#2f7fe0" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>""", "校园安防")
tile("icon_04", "#e2803a", """
    <path d="M-10 -44 H-40 V44 H-10" fill="none" stroke-width="10" stroke-linejoin="round"/>
    <path d="M-12 0 H40 M22 -18 L40 0 L22 18" fill="none" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>""", "退  出")

# ---------- 面板背景（半透明深蓝） ----------
for name, width in (("bg_from1", 555), ("bg_from2", 425)):
    save(name, width, 670, f"""
  <rect x="8" y="8" width="{width-16}" height="654" rx="12" fill="#14304f" opacity="0.88"/>
  <rect x="8" y="8" width="{width-16}" height="654" rx="12" fill="none" stroke="#7fb3e6" stroke-width="2" opacity="0.6"/>
  <rect x="24" y="22" width="{width-48}" height="4" rx="2" fill="#4fa3ff" opacity="0.8"/>
""")

# ---------- 监控：无画面时的图标、方向盘底座、方向键 ----------
save("icon_monitor", 280, 280, """
  <g fill="none" stroke="#c9ced6" stroke-width="10" stroke-linejoin="round" stroke-linecap="round">
    <rect x="40" y="70" width="160" height="110" rx="14"/>
    <path d="M200 105 L245 80 V170 L200 145"/>
    <path d="M90 180 L80 225 M150 180 L160 225 M65 225 H175"/>
  </g>
  <circle cx="120" cy="125" r="26" fill="none" stroke="#c9ced6" stroke-width="10"/>
""")

save("panel_video_ctrl", 500, 500, """
  <defs><radialGradient id="pad" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="#f4f6f9"/><stop offset="1" stop-color="#c7cdd6"/></radialGradient></defs>
  <circle cx="250" cy="250" r="240" fill="url(#pad)" stroke="#aab3bf" stroke-width="6"/>
  <circle cx="250" cy="250" r="95" fill="#e9edf2" stroke="#aab3bf" stroke-width="4"/>
  <circle cx="250" cy="250" r="40" fill="#d4dae2"/>
""")

ROTATE = {"up": 0, "right": 90, "down": 180, "left": 270}
for direction, angle in ROTATE.items():
    for state, (fill, stroke) in {"normal": ("#ffffff", "#5b6472"), "press": ("#2f7fe0", "#ffffff")}.items():
        save(f"btn_arrow_{direction}_{state}", 28, 28, f"""
  <circle cx="14" cy="14" r="13" fill="{fill}" stroke="#aab3bf" stroke-width="1"/>
  <path d="M8 16.5 L14 10 L20 16.5" fill="none" stroke="{stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" transform="rotate({angle} 14 14)"/>
""")

for direction, angle in (("left", 270), ("right", 90)):
    save(f"arrow_{direction}_normal", 60, 60, f"""
  <circle cx="30" cy="30" r="27" fill="#000000" opacity="0.45"/>
  <path d="M19 35 L30 23 L41 35" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" transform="rotate({angle} 30 30)"/>
""")

save("windowstate_closed_hover", 36, 36, """
  <rect x="2" y="2" width="32" height="32" rx="4" fill="#e81123"/>
  <path d="M12 12 L24 24 M24 12 L12 24" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
""")
