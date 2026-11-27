#!/usr/bin/env python3
"""Turn a drawing on paper into ink on transparency (stdlib only, no PIL).

    python3 tools/ink_to_alpha.py in.png out.png [--ink 1b2433] [--paper 214] [--black 60] [--flatten 1]

Reads an 8-bit RGB/RGBA non-interlaced PNG. Each pixel's darkness becomes its alpha:
luminance >= paper  -> fully transparent, luminance <= black -> fully opaque ink.
Output pixels are all the ink colour, so the drawing can be tinted and layered over any sky.

--flatten 1 is for photographed drawings with uneven light: a smooth quadratic surface is fitted to
the bare-paper areas and divided out first, so a shadowed corner reads as paper (255) rather than ink.
paper/black then apply to that flattened luminance.
"""
import struct
import sys
import zlib


def read_png(path):
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    pos, idat = 8, b""
    while pos < len(data):
        length, kind = struct.unpack(">I4s", data[pos:pos + 8])
        chunk = data[pos + 8:pos + 8 + length]
        if kind == b"IHDR":
            w, h, depth, ctype, _, _, interlace = struct.unpack(">IIBBBBB", chunk)
            assert depth == 8 and ctype in (2, 6) and interlace == 0, "need 8-bit RGB/RGBA, non-interlaced"
        elif kind == b"IDAT":
            idat += chunk
        pos += 12 + length
    bpp = 3 if ctype == 2 else 4
    raw = zlib.decompress(idat)
    stride = w * bpp
    rows, prev = [], bytearray(stride)
    i = 0
    for _ in range(h):
        f = raw[i]; i += 1
        line = bytearray(raw[i:i + stride]); i += stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + ((a + b) >> 1)) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line); prev = line
    return w, h, bpp, rows


def paper_surface(w, h, lum):
    """Least-squares quadratic fit of paper brightness: block 90th percentiles over mostly-blank blocks."""
    B = 24
    samples = []
    for by in range(0, h - B + 1, B):
        for bx in range(0, w - B + 1, B):
            vals = sorted(lum[y][x] for y in range(by, by + B, 2) for x in range(bx, bx + B, 2))
            p25, p90 = vals[len(vals) // 4], vals[int(len(vals) * 0.9)]
            if p90 - p25 < 18:  # little drawing in this block: it is paper
                samples.append(((bx + B / 2) / w, (by + B / 2) / h, p90))
    feats = lambda u, v: (1.0, u, v, u * u, u * v, v * v)
    n = 6
    A = [[0.0] * n for _ in range(n)]
    rhs = [0.0] * n
    for u, v, z in samples:
        f = feats(u, v)
        for i in range(n):
            rhs[i] += f[i] * z
            for j in range(n):
                A[i][j] += f[i] * f[j]
    for i in range(n):  # Gauss-Jordan solve of the normal equations
        piv = max(range(i, n), key=lambda r: abs(A[r][i]))
        A[i], A[piv], rhs[i], rhs[piv] = A[piv], A[i], rhs[piv], rhs[i]
        for r in range(n):
            if r != i and A[i][i]:
                k = A[r][i] / A[i][i]
                A[r] = [a - k * b for a, b in zip(A[r], A[i])]
                rhs[r] -= k * rhs[i]
    coef = [rhs[i] / A[i][i] for i in range(n)]
    print(f"paper fit from {len(samples)} blank blocks")
    return lambda x, y: sum(c * f for c, f in zip(coef, feats(x / w, y / h)))


def write_png(path, w, h, rows):
    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    open(path, "wb").write(png)


def main():
    args = sys.argv[1:]
    src, dst = args[0], args[1]
    opts = dict(zip(args[2::2], args[3::2]))
    ink = bytes.fromhex(opts.get("--ink", "1b2433"))
    paper = int(opts.get("--paper", 214))
    black = int(opts.get("--black", 60))
    w, h, bpp, rows = read_png(src)
    lums = [[0.299 * r[x * bpp] + 0.587 * r[x * bpp + 1] + 0.114 * r[x * bpp + 2] for x in range(w)] for r in rows]
    surface = paper_surface(w, h, lums) if opts.get("--flatten") == "1" else None
    out = []
    for y, r in enumerate(rows):
        line = bytearray(w * 4)
        for x in range(w):
            lum = lums[y][x]
            if surface:
                lum = min(255.0, lum / max(1.0, surface(x, y)) * 255)
            a = (paper - lum) / (paper - black)
            a = 0 if a < 0 else 1 if a > 1 else a
            line[x * 4:x * 4 + 4] = bytes((ink[0], ink[1], ink[2], int(a ** 0.85 * 255)))
        out.append(line)
    write_png(dst, w, h, out)
    print(f"wrote {dst} {w}x{h}")


if __name__ == "__main__":
    main()
