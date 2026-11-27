// Depth engine for every page.
//   data-parallax="0.3"        offset = scroll * factor (positive = slower than the page = farther away)
//   data-parallax-origin="center"  measure from when the element is centred in the viewport
//                              (default "page" measures from the top of the document, like Framer)
//   data-sway="12"             drift with the pointer by up to 12px, damped (nearer layers sway more)
//   data-sky                   sky backdrop that slides through the gradient as you scroll the page
// The sky is a tall picture inside a fixed frame, moved with a transform, so scrolling never repaints
// it. Layers are measured on layout changes only, and a layer well outside the viewport is skipped.
import { onFrame, onLayout, damp, pointer, pageTop, reduceMotion, setStyle, scrollMax } from "../core/scroll.js";

const MARGIN = 300; // px outside the viewport within which layers keep moving

export default function parallax(nodes) {
  if (reduceMotion) return;
  const layers = [...nodes].filter((el) => el.hasAttribute("data-parallax") || el.hasAttribute("data-sway")).map((el) => ({
    el,
    factor: Number(el.dataset.parallax || 0),
    center: el.dataset.parallaxOrigin === "center",
    sway: Number(el.dataset.sway || 0),
    sx: 0, sy: 0, top: 0, h: 0, anchor: 0,
  }));
  const skies = [...document.querySelectorAll("[data-sky]")]
    .map((el) => ({ img: el.firstElementChild, travel: 0 }))
    .filter((s) => s.img);

  const measure = () => {
    for (const l of layers) {
      l.top = pageTop(l.el);
      l.h = l.el.offsetHeight;
      l.anchor = l.center ? l.top + l.h / 2 : 0;
    }
    for (const s of skies) s.travel = Math.max(0, s.img.offsetHeight - innerHeight);
  };
  measure();
  onLayout(measure);

  onFrame(({ y, dt, vh }) => {
    for (const l of layers) {
      const ty = (l.center ? y + vh / 2 - l.anchor : y) * l.factor;
      const top = l.top - y + ty;
      if (top > vh + MARGIN || top + l.h < -MARGIN) continue;
      if (l.sway) {
        l.sx = damp(l.sx, pointer.x * l.sway, 3, dt);
        l.sy = damp(l.sy, pointer.y * l.sway * 0.5, 3, dt);
      }
      setStyle(l.el, "transform", `translate3d(${l.sx.toFixed(1)}px, ${(ty + l.sy).toFixed(1)}px, 0)`);
    }
    if (skies.length) {
      const p = Math.min(1, Math.max(0, y / scrollMax()));
      for (const s of skies) setStyle(s.img, "transform", `translate3d(0, ${(-p * s.travel).toFixed(1)}px, 0)`);
    }
  });
}
