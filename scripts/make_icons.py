#!/usr/bin/env python3
"""Generate extension icons: rounded-square IG gradient + white skip-forward glyph."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "icons"
OUT.mkdir(exist_ok=True)

# IG-inspired gradient stops (purple -> magenta -> orange -> yellow)
STOPS = [
    (0.00, (131, 58, 180)),
    (0.35, (193, 53, 132)),
    (0.65, (225, 48, 108)),
    (0.85, (253, 29, 29)),
    (1.00, (252, 175, 69)),
]


def lerp(a, b, t):
    return int(a + (b - a) * t)


def sample_gradient(t):
    t = max(0.0, min(1.0, t))
    for i in range(len(STOPS) - 1):
        p0, c0 = STOPS[i]
        p1, c1 = STOPS[i + 1]
        if p0 <= t <= p1:
            u = 0 if p1 == p0 else (t - p0) / (p1 - p0)
            return tuple(lerp(c0[k], c1[k], u) for k in range(3))
    return STOPS[-1][1]


def gradient_image(size):
    img = Image.new("RGB", (size, size))
    px = img.load()
    diag_max = 2 * (size - 1)
    for y in range(size):
        for x in range(size):
            t = (x + y) / diag_max
            px[x, y] = sample_gradient(t)
    return img


def round_corners(img, radius):
    size = img.size[0]
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size, size), radius=radius, fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def draw_skip_glyph(img):
    """White skip-forward (double chevron + bar)."""
    size = img.size[0]
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)

    cx, cy = size / 2, size / 2
    tri_h = size * 0.34          # triangle height
    tri_w = size * 0.26          # triangle width (base)
    spacing = size * 0.04        # gap between triangles
    bar_w = max(2, int(size * 0.055))
    bar_h = tri_h
    gap_bar = size * 0.04

    # Two right-pointing triangles
    def triangle(x_left):
        pts = [
            (x_left, cy - tri_h / 2),
            (x_left + tri_w, cy),
            (x_left, cy + tri_h / 2),
        ]
        d.polygon(pts, fill=(255, 255, 255, 255))

    total_width = tri_w * 2 + spacing + gap_bar + bar_w
    start_x = cx - total_width / 2

    triangle(start_x)
    triangle(start_x + tri_w + spacing)

    # Vertical bar on the right
    bar_x = start_x + tri_w * 2 + spacing + gap_bar
    d.rectangle(
        (bar_x, cy - bar_h / 2, bar_x + bar_w, cy + bar_h / 2),
        fill=(255, 255, 255, 255),
    )

    # Soft shadow for depth
    shadow = overlay.filter(ImageFilter.GaussianBlur(radius=max(1, size // 64)))
    shadow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)
    offs = max(1, size // 64)
    # Re-render shadow with dark color
    shadow_dark = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sdd = ImageDraw.Draw(shadow_dark)
    sdd.bitmap((0, 0), overlay.split()[-1].point(lambda p: 90 if p > 0 else 0), fill=(0, 0, 0, 90))
    shadow_dark = shadow_dark.filter(ImageFilter.GaussianBlur(radius=max(1, size // 40)))

    img.alpha_composite(shadow_dark, (offs, offs))
    img.alpha_composite(overlay)
    return img


def make_icon(size, path):
    grad = gradient_image(size)
    rounded = round_corners(grad, radius=max(2, size // 5))
    final = draw_skip_glyph(rounded)
    final.save(path, "PNG")
    print(f"wrote {path} ({size}x{size})")


if __name__ == "__main__":
    for s in (16, 48, 128):
        make_icon(s, OUT / f"icon{s}.png")
