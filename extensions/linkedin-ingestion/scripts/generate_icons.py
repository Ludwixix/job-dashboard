#!/usr/bin/env python3
"""
Deterministic Extension Icon Generator
Generates crisp, professional Antigravity-themed icons (16x16, 48x48, 128x128 px)
for the Job Dashboard Ingestion Chrome Extension.
"""

import os
from PIL import Image, ImageDraw

ICONS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "icons"))
os.makedirs(ICONS_DIR, exist_ok=True)

SIZES = [16, 48, 128]


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if size == 16:
        # 16x16: Pixel-aligned high-contrast toolbar icon
        # Dark obsidian base squircle
        draw.rounded_rectangle(
            [1, 1, 14, 14],
            radius=3,
            fill=(15, 23, 42, 255),
            outline=(6, 182, 212, 255),
            width=1,
        )
        # Center cyan intake badge (3x3 dot with intake notch)
        draw.rectangle([5, 5, 10, 8], fill=(56, 189, 248, 255))
        draw.polygon([(5, 9), (10, 9), (7, 12)], fill=(20, 184, 166, 255))
        # Emerald active indicator at top right
        draw.point((12, 3), fill=(16, 185, 129, 255))
    elif size == 48:
        # 48x48: Detailed extension management icon
        margin = 3
        draw.rounded_rectangle(
            [margin, margin, size - margin, size - margin],
            radius=10,
            fill=(15, 23, 42, 255),
            outline=(6, 182, 212, 255),
            width=2,
        )
        # Glowing green active badge
        draw.ellipse(
            [34, 7, 40, 13],
            fill=(16, 185, 129, 255),
            outline=(5, 150, 105, 255),
            width=1,
        )

        # Ingestion tray (bottom bracket)
        draw.line(
            [(14, 30), (14, 34), (34, 34), (34, 30)], fill=(56, 189, 248, 255), width=2
        )

        # Downward intake arrow
        draw.line([(24, 16), (24, 27)], fill=(45, 212, 191, 255), width=2)
        draw.polygon([(20, 25), (28, 25), (24, 30)], fill=(45, 212, 191, 255))
    else:
        # 128x128: Crisp high-resolution Chrome Web Store / Action HUD icon
        margin = 8
        draw.rounded_rectangle(
            [margin, margin, size - margin, size - margin],
            radius=26,
            fill=(15, 23, 42, 255),
            outline=(6, 182, 212, 255),
            width=4,
        )
        # Subtle inner highlight border
        draw.rounded_rectangle(
            [margin + 4, margin + 4, size - margin - 4, size - margin - 4],
            radius=22,
            fill=None,
            outline=(30, 41, 59, 255),
            width=2,
        )
        # Emerald status indicator orb with cyan halo
        draw.ellipse(
            [90, 18, 108, 36],
            fill=(16, 185, 129, 255),
            outline=(6, 182, 212, 255),
            width=2,
        )

        # Ingestion Tray (bracket: (36, 82) -> (36, 94) -> (92, 94) -> (92, 82))
        draw.line(
            [(36, 82), (36, 94), (92, 94), (92, 82)], fill=(56, 189, 248, 255), width=5
        )
        # Center intake notch on tray
        draw.line([(58, 94), (70, 94)], fill=(15, 23, 42, 255), width=5)
        draw.line([(58, 97), (70, 97)], fill=(56, 189, 248, 255), width=2)

        # Vertical intake arrow stem
        draw.line([(64, 40), (64, 72)], fill=(45, 212, 191, 255), width=6)
        # Arrowhead pointing downward
        draw.polygon([(52, 68), (76, 68), (64, 82)], fill=(45, 212, 191, 255))

    return img


def main():
    for size in SIZES:
        icon_img = draw_icon(size)
        out_path = os.path.join(ICONS_DIR, f"icon-{size}.png")
        icon_img.save(out_path, "PNG")
        print(f"Successfully generated {out_path} ({size}x{size})")


if __name__ == "__main__":
    main()
