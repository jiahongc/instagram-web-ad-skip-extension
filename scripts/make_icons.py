#!/usr/bin/env python3
"""Generate 16/48/128 PNG icons by auto-cropping icons/source.png to square."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "icons"
SOURCE = OUT / "source.png"


def content_bbox(img):
    """Find non-background bounding box. Assumes light near-white padding."""
    px = img.load()
    w, h = img.size

    def is_icon(p):
        r, g, b = p[:3]
        mx, mn = max(r, g, b), min(r, g, b)
        return (mx - mn) > 20 or mx < 230

    left, top, right, bottom = w, h, 0, 0
    step = max(1, min(w, h) // 800)
    for y in range(0, h, step):
        for x in range(0, w, step):
            if is_icon(px[x, y]):
                if x < left: left = x
                if x > right: right = x
                if y < top: top = y
                if y > bottom: bottom = y
    return left, top, right, bottom


def square_crop(img, bbox, pad_ratio=0.025):
    w, h = img.size
    left, top, right, bottom = bbox
    pad = int(max(w, h) * pad_ratio)
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(w, right + pad)
    bottom = min(h, bottom + pad)
    side = max(right - left, bottom - top)
    cx, cy = (left + right) // 2, (top + bottom) // 2
    sx0 = max(0, cx - side // 2)
    sy0 = max(0, cy - side // 2)
    sx1 = sx0 + side
    sy1 = sy0 + side
    if sx1 > w:
        sx0 -= sx1 - w
        sx1 = w
    if sy1 > h:
        sy0 -= sy1 - h
        sy1 = h
    return img.crop((sx0, sy0, sx1, sy1))


def main():
    if not SOURCE.exists():
        raise SystemExit(f"missing {SOURCE}")
    src = Image.open(SOURCE).convert("RGB")
    cropped = square_crop(src, content_bbox(src)).convert("RGBA")
    for s in (16, 48, 128):
        out = cropped.resize((s, s), Image.LANCZOS)
        out.save(OUT / f"icon{s}.png", "PNG")
        print(f"wrote {OUT / f'icon{s}.png'} ({s}x{s})")


if __name__ == "__main__":
    main()
