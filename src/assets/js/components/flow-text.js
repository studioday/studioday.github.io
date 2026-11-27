// Project descriptions as a Star Wars opening crawl that parts around the console.
// The text lies on a plane hinged at the bottom of the screen and tilted back under a perspective set
// on the host, so each line arrives large and readable below the console, then tilts away and shrinks
// as it rises. Lines are pre-wrapped and split at their visual midpoint; while a line passes the console
// its halves glide apart to clear it (worked out in projected screen space), then close up again and
// recede into the distance above it. On narrow screens (no room beside the console) lines fade out
// before they reach it, so the readable part sits in the space below.
import { clamp, setStyle } from "../core/scroll.js";

const MARGIN = 30;
const TILT = (36 * Math.PI) / 180; // how far the plane leans back from the screen
const SIN = Math.sin(TILT), COS = Math.cos(TILT);
const ease = (t) => t * t * (3 - 2 * t);

export function createFlow(host, device, texts) {
  let activeKey = null;
  let lastQ = 0;
  let lines = [];
  let blockH = 0;
  let narrow = false;
  let lastW = 0, lastH = 0;
  let geo = null;
  const measureCtx = document.createElement("canvas").getContext("2d");
  let ready = false;

  const fonts = () => {
    const small = innerWidth < 810;
    return {
      title: { font: `900 ${small ? 34 : 60}px Inter`, size: small ? 34 : 60, lh: 1, upper: true, cls: "flow__line--title" },
      body: { font: `400 ${small ? 36 : 56}px "Instrument Serif"`, size: small ? 36 : 56, lh: 1.04, upper: false, cls: "flow__line--body" },
    };
  };

  Promise.all([
    document.fonts.load('900 60px Inter'),
    document.fonts.load('400 56px "Instrument Serif"'),
  ]).catch(() => {}).then(() => { ready = true; refresh(); });

  // ---- the plane: perspective P from an eye level near the top; hinge at the bottom of the screen
  const setGeometry = () => {
    const vh = innerHeight;
    const P = vh * 1.15, eyeY = vh * 0.1, hinge = vh;
    host.style.perspective = `${P}px`;
    host.style.perspectiveOrigin = `50% ${eyeY}px`;
    // d: distance of a point up the plane from the hinge -> its screen y and scale
    const project = (d) => {
      const s = P / (P + d * SIN);
      return { y: eyeY + (hinge - d * COS - eyeY) * s, s };
    };
    const dAt = (y) => { // the plane distance that lands on screen y (bisection; y falls as d grows)
      let lo = -vh, hi = vh * 6;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if (project(mid).y > y) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    };
    geo = { P, eyeY, hinge, project, dAt, dTop: dAt(vh * 0.02) };
  };

  const wrap = (text, style, width) => {
    measureCtx.font = style.font;
    const words = (style.upper ? text.toUpperCase() : text).split(/\s+/).filter(Boolean);
    const space = measureCtx.measureText(" ").width;
    const out = [];
    let cur = [], curW = 0;
    for (const word of words) {
      const w = measureCtx.measureText(word).width;
      if (cur.length && curW + space + w > width) {
        out.push(cur);
        cur = [word]; curW = w;
      } else {
        cur.push(word); curW += (cur.length > 1 ? space : 0) + w;
      }
    }
    if (cur.length) out.push(cur);
    // Split each line where the two halves are closest in width.
    return out.map((ws) => {
      if (ws.length === 1) return [ws[0], ""];
      const widths = ws.map((w) => measureCtx.measureText(w).width);
      const total = widths.reduce((a, b) => a + b, 0) + space * (ws.length - 1);
      let best = 1, bestD = Infinity, acc = 0;
      for (let k = 1; k < ws.length; k++) {
        acc += widths[k - 1] + (k > 1 ? space : 0);
        const d = Math.abs(acc - (total - acc - space));
        if (d < bestD) { bestD = d; best = k; }
      }
      return [ws.slice(0, best).join(" "), ws.slice(best).join(" ")];
    });
  };

  const build = (key, force = false) => {
    if (!force && key === activeKey && innerWidth === lastW && innerHeight === lastH) return;
    activeKey = key;
    lastW = innerWidth; lastH = innerHeight;
    setGeometry();
    const item = texts[key];
    host.replaceChildren();
    lines = [];
    if (!item) return;
    const rect = device.getBoundingClientRect();
    const side = (innerWidth - rect.width) / 2 - MARGIN;
    narrow = side < 170;
    // halves of a balanced split are ~width/2 wide and are drawn at the plane's scale; they are
    // largest where parting begins (the console's bottom edge), so size them to clear the screen edge there
    const sPart = geo.project(geo.dAt(rect.bottom)).s;
    const width = narrow ? innerWidth - 40 : Math.min((side * 1.7) / sPart, (innerWidth - 60) / geo.project(0).s);
    const f = fonts();
    let y = 0;
    const add = (pairs, style) => {
      for (const [left, right] of pairs) {
        const el = document.createElement("div");
        el.className = `flow__line ${style.cls}`;
        el.style.fontSize = `${style.size}px`;
        el.style.lineHeight = String(style.lh);
        const l = document.createElement("span");
        const r = document.createElement("span");
        l.textContent = left;
        r.textContent = right;
        el.append(l, " ", r);
        host.append(el);
        measureCtx.font = style.font;
        lines.push({ el, l, r, y, h: style.size * style.lh, wl: 0, wr: 0, sp: right ? measureCtx.measureText(" ").width : 0 });
        y += style.size * style.lh;
      }
    };
    // titles stay on one line where possible and split across the console
    add(wrap(item.title, f.title, narrow ? width : innerWidth - 40), f.title);
    y += f.body.size * 0.5;
    add(wrap(item.text, f.body, width), f.body);
    blockH = y;
    for (const line of lines) {
      line.wl = line.l.offsetWidth;
      line.wr = line.r.offsetWidth;
    }
  };

  /** Show `key` with progress q (0 = text just below the screen, 1 = receded out of sight above).
      `rect` is where the console sits on screen; the caller works it out from the scroll position. */
  let lastRect = null;
  const set = (key, q, rect) => {
    lastQ = q;
    if (rect) lastRect = rect;
    if (!ready) { activeKey = key; return; }
    if (key !== activeKey || innerWidth !== lastW || innerHeight !== lastH) build(key);
    if (!lines.length) return;
    const vh = innerHeight, vw = innerWidth, c = vw / 2;
    const dev = lastRect || device.getBoundingClientRect();
    // the block's leading edge climbs the plane from the hinge until its last line is past the top
    const head = q * (blockH + geo.dTop + vh * 0.04);
    for (const line of lines) {
      const d = head - line.y - line.h / 2;              // this line's centre, up the plane
      const { y: yc, s } = geo.project(d);
      let opacity = clamp((yc - vh * 0.03) / (vh * 0.2)) * clamp((vh + line.h * 0.3 - yc) / (vh * 0.08));
      let t = 0;
      if (narrow) {
        opacity *= clamp((yc - dev.bottom - 6) / 90);
      } else {
        // fully parted by the time a line reaches the console, closing again once it is above it
        const enter = clamp((dev.bottom + 150 - yc) / 140);
        const leave = clamp((yc - (dev.top - 110)) / 120);
        t = ease(Math.min(enter, leave));
      }
      // where the halves meet, in plane units and then on screen
      const xLr = c - (line.wl + line.sp + line.wr) / 2 + line.wl;
      const sxL = c + (xLr - c) * s, sxR = c + (xLr + line.sp - c) * s;
      const dL = Math.min(0, dev.left - MARGIN - sxL) / s;
      const dR = Math.max(0, dev.right + MARGIN - sxR) / s;
      setStyle(line.el, "opacity", opacity.toFixed(3));
      if (opacity === 0) continue; // a line out of sight keeps its place until it returns
      setStyle(line.el, "transform", `translate3d(0, ${(geo.hinge - d * COS - line.h / 2).toFixed(1)}px, ${(-d * SIN).toFixed(1)}px) rotateX(${TILT}rad)`);
      setStyle(line.l, "transform", `translateX(${(dL * t).toFixed(1)}px)`);
      setStyle(line.r, "transform", `translateX(${(dR * t).toFixed(1)}px)`);
    }
  };

  // rebuilding (fonts arriving, resize) must re-place the lines at once, or they stack unpositioned
  function refresh() {
    if (activeKey === null) return;
    build(activeKey, true);
    set(activeKey, lastQ);
  }
  addEventListener("resize", refresh);
  return { set };
}
