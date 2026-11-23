#!/usr/bin/env python3
"""Generate dependency-free PNG icons for the extension."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "extension" / "icons"


def rounded_rect(x: float, y: float, size: float, radius: float) -> bool:
    if radius <= x <= size - radius or radius <= y <= size - radius:
        return 0 <= x <= size and 0 <= y <= size
    cx = radius if x < radius else size - radius
    cy = radius if y < radius else size - radius
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius**2


def shield(x: float, y: float, size: float) -> bool:
    cx = size / 2
    top = size * 0.22
    bottom = size * 0.78
    half = size * 0.235
    if y < top or y > bottom or abs(x - cx) > half:
        return False
    taper_start = size * 0.52
    if y > taper_start:
        allowed = half * (1 - (y - taper_start) / (bottom - taper_start))
        return abs(x - cx) <= allowed
    return True


def check(x: float, y: float, size: float) -> bool:
    # Two line segments: (0.38, 0.51) -> (0.47, 0.60) -> (0.64, 0.40)
    thickness = size * 0.045
    points = [
        ((0.38, 0.51), (0.47, 0.60)),
        ((0.47, 0.60), (0.65, 0.39)),
    ]
    for (x1, y1), (x2, y2) in points:
        ax, ay = x1 * size, y1 * size
        bx, by = x2 * size, y2 * size
        dx, dy = bx - ax, by - ay
        length2 = dx * dx + dy * dy
        t = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / length2))
        px, py = ax + t * dx, ay + t * dy
        if (x - px) ** 2 + (y - py) ** 2 <= thickness**2:
            return True
    return False


def render(size: int) -> bytes:
    ss = 4
    hi = size * ss
    pixels: list[tuple[int, int, int, int]] = []
    for py in range(size):
        for px in range(size):
            navy = white = green = 0
            for sy in range(ss):
                for sx in range(ss):
                    x = px * ss + sx + 0.5
                    y = py * ss + sy + 0.5
                    if rounded_rect(x, y, hi, hi * 0.22):
                        navy += 1
                        if shield(x, y, hi):
                            white += 1
                            if check(x, y, hi):
                                green += 1
            total = ss * ss
            if navy == 0:
                pixels.append((0, 0, 0, 0))
                continue
            base = (22, 32, 59)
            if white:
                if green / white > 0.35:
                    color = (116, 226, 178)
                else:
                    color = (245, 247, 252)
            else:
                color = base
            alpha = int(255 * navy / total)
            pixels.append((*color, alpha))

    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            raw.extend(pixels[y * size + x])

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    return png


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (16, 48, 128):
        path = OUT / f"icon{size}.png"
        path.write_bytes(render(size))
        print(f"wrote {path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
