// ASCII portrait (after the portrait on eddy-naboulet.dev): the photo is redrawn in dark ink
// characters whose density follows darkness (hair, suit and features dense, skin sparse), shaped by
// a soft head-and-shoulders silhouette so it reads against the sky. Under the cursor a soft window
// shows the real photo, and characters around its edge scramble. The portrait is framed chest-up.
// The full character field is drawn once into an offscreen canvas; a frame copies it and redraws
// only what changed (a few shimmering characters, the ring around the cursor), and the loop sleeps
// while the portrait is off screen or nothing is moving.
import { reduceMotion } from "../core/scroll.js";

const RAMP = " .,:;irsXA253hMHGS#9B&@";
const SCRAMBLE = "01<>/\\{}[]=+*#%$";

export default function asciiPortrait(nodes) {
  for (const host of nodes) init(host);
}

function init(host) {
  const canvas = host.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const base = document.createElement("canvas");
  const bctx = base.getContext("2d");
  const img = new Image();
  img.src = host.dataset.src;
  let grid = null, W = 0, H = 0, cell = 9, dpr = 1, font = "";
  const pointer = { x: -9999, y: -9999, inside: false };
  const reveal = { x: -9999, y: -9999, r: 0 };

  const alphaAt = (k) => grid.weight[k] * (0.2 + 0.8 * grid.lum[k]);
  const ink = (a) => `rgba(11,20,38,${a.toFixed(3)})`;
  const drawCell = (c, k, ch, a) => {
    const x = (k % grid.cols) * cell, y = Math.floor(k / grid.cols) * cell;
    if (ch === " ") return;
    c.fillStyle = ink(a);
    c.fillText(ch, x, y);
  };

  const sample = () => {
    const rect = host.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    W = rect.width; H = rect.height;
    canvas.width = base.width = Math.round(W * dpr);
    canvas.height = base.height = Math.round(H * dpr);
    cell = W < 420 ? 7 : 8;
    font = `600 ${cell + 1}px ui-monospace, "SF Mono", Menlo, monospace`;
    const cols = Math.floor(W / cell), rows = Math.floor(H / cell);
    const off = document.createElement("canvas");
    off.width = cols; off.height = rows;
    const o = off.getContext("2d", { willReadFrequently: true });
    // cover-fit the photo into the grid
    const s = Math.max(cols / img.width, rows / img.height);
    o.drawImage(img, (cols - img.width * s) / 2, (rows - img.height * s) / 2, img.width * s, img.height * s);
    const px = o.getImageData(0, 0, cols, rows).data;
    grid = { cols, rows, lum: new Float32Array(cols * rows), weight: new Float32Array(cols * rows), ch: [], live: [] };
    // silhouette fitted to the crop: head centred near (0.47, 0.33), shoulders from y ~0.6 down
    let lo = 1, hi = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const k = y * cols + x, p = k * 4;
        const nx = x / cols, ny = y / rows;
        const head = 1 - Math.hypot((nx - 0.47) / 0.205, (ny - 0.33) / 0.27);
        const neck = 1 - Math.hypot((nx - 0.48) / 0.12, (ny - 0.6) / 0.14);
        const body = 1 - Math.hypot((nx - 0.5) / 0.47, (ny - 1.04) / 0.42);
        const w = Math.min(1, Math.max(0, Math.max(head, neck, body) * 4));
        const lum = (0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2]) / 255;
        grid.lum[k] = lum;
        grid.weight[k] = w;
        if (w > 0.5) { lo = Math.min(lo, lum); hi = Math.max(hi, lum); }
      }
    }
    // stretch contrast inside the silhouette so features read, then pick characters by density
    const span = Math.max(0.05, hi - lo);
    for (let k = 0; k < grid.lum.length; k++) {
      const v = Math.min(1, Math.max(0, (grid.lum[k] - lo) / span));
      grid.lum[k] = Math.pow(1 - v, 1.1); // darkness drives density
      grid.ch[k] = RAMP[Math.min(RAMP.length - 1, Math.floor(grid.lum[k] * RAMP.length))];
      if (grid.weight[k] >= 0.03) grid.live.push(k); // cells that are drawn at all
    }
    // the whole field, once
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.clearRect(0, 0, W, H);
    bctx.font = font;
    bctx.textBaseline = "top";
    for (const k of grid.live) drawCell(bctx, k, grid.ch[k], alphaAt(k));
    dirty = true;
  };

  // idle shimmer: a handful of characters change, redrawn in place on the offscreen field
  const shimmer = () => {
    for (let n = 0; n < 24; n++) {
      const k = grid.live[(Math.random() * grid.live.length) | 0];
      const j = Math.min(RAMP.length - 1, Math.max(0, RAMP.indexOf(grid.ch[k]) + ((Math.random() * 3) | 0) - 1));
      if (RAMP[j] === grid.ch[k]) continue;
      grid.ch[k] = RAMP[j];
      // repaint just this cell; glyphs overhang their cell a little, so the rows above and below
      // are redrawn inside the same clip
      const x = (k % grid.cols) * cell, y = Math.floor(k / grid.cols) * cell;
      bctx.save();
      bctx.beginPath();
      bctx.rect(x, y, cell, cell);
      bctx.clip();
      bctx.clearRect(x, y, cell, cell);
      for (const n of [k - grid.cols, k, k + grid.cols]) {
        if (n >= 0 && n < grid.ch.length && grid.weight[n] >= 0.03) drawCell(bctx, n, grid.ch[n], alphaAt(n));
      }
      bctx.restore();
    }
    dirty = true;
  };

  const draw = () => {
    if (!grid) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);
    const R = reveal.r;
    if (R <= 0) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // inside the window the characters give way; around its edge they scramble
    ctx.save();
    ctx.beginPath();
    ctx.arc(reveal.x, reveal.y, R * 1.35, 0, Math.PI * 2);
    ctx.clip();
    ctx.clearRect(reveal.x - R * 1.4, reveal.y - R * 1.4, R * 2.8, R * 2.8);
    ctx.font = font;
    ctx.textBaseline = "top";
    const x0 = Math.max(0, Math.floor((reveal.x - R * 1.35) / cell)), x1 = Math.min(grid.cols - 1, Math.ceil((reveal.x + R * 1.35) / cell));
    const y0 = Math.max(0, Math.floor((reveal.y - R * 1.35) / cell)), y1 = Math.min(grid.rows - 1, Math.ceil((reveal.y + R * 1.35) / cell));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const k = y * grid.cols + x;
        if (grid.weight[k] < 0.03) continue;
        const d = Math.hypot(x * cell + cell / 2 - reveal.x, y * cell + cell / 2 - reveal.y);
        if (d < R * 0.85) continue;
        const scramble = d < R * 1.35;
        const a = scramble ? Math.min(1, alphaAt(k) + 0.35) : alphaAt(k);
        drawCell(ctx, k, scramble ? SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0] : grid.ch[k], a);
      }
    }
    ctx.restore();
    // the real photo through a soft round window
    ctx.save();
    const g = ctx.createRadialGradient(reveal.x, reveal.y, R * 0.55, reveal.x, reveal.y, R);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(reveal.x, reveal.y, R, 0, Math.PI * 2);
    ctx.clip();
    const s = Math.max(W / img.width, H / img.height);
    ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = g;
    ctx.fillRect(reveal.x - R, reveal.y - R, R * 2, R * 2);
    ctx.restore();
  };

  // Track the cursor on the whole window, not the canvas: the page title and the project text sit
  // on top of the portrait's edges and would otherwise swallow the hover. Over the dial or a control
  // the photo stays hidden. Scrolling with a still cursor re-checks where it is.
  let cx = -9999, cy = -9999, over = null, rect = null;
  const locate = () => {
    rect = canvas.getBoundingClientRect();
    pointer.x = cx - rect.left; pointer.y = cy - rect.top;
    pointer.inside = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= rect.width && pointer.y <= rect.height
      && !(over && over.closest(".dial, a, button"));
    wake();
  };
  addEventListener("pointermove", (e) => { cx = e.clientX; cy = e.clientY; over = e.target; locate(); }, { passive: true });
  addEventListener("scroll", () => { if (visible) locate(); }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { pointer.inside = false; wake(); });

  let last = 0, idle = 0, raf = 0, visible = false, dirty = false;
  const loop = (t) => {
    raf = 0;
    if (!visible || !grid) return;
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 1 / 30;
    if (t - last < 1000 / 40) { raf = requestAnimationFrame(loop); return; }
    last = t;
    const targetR = pointer.inside && !reduceMotion ? Math.min(W, H) * 0.2 : 0;
    const before = reveal.r;
    reveal.r += (targetR - reveal.r) * Math.min(1, dt * 8);
    if (reveal.r < 0.5) reveal.r = 0;
    reveal.x += (pointer.x - reveal.x) * Math.min(1, dt * 12);
    reveal.y += (pointer.y - reveal.y) * Math.min(1, dt * 12);
    if (!reduceMotion && (idle += dt) > 0.12) { idle = 0; shimmer(); }
    if (dirty || reveal.r > 0 || before > 0) { draw(); dirty = false; }
    // keep running while the window is open or easing; the shimmer alone ticks at a gentle rate
    raf = requestAnimationFrame(loop);
  };
  function wake() { if (visible && !raf) raf = requestAnimationFrame(loop); }

  img.onload = () => {
    sample();
    draw();
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake();
    }).observe(host);
    let rt = 0;
    addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { sample(); draw(); }, 150); });
  };
}
