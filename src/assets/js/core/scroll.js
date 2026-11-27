// Shared motion core: Lenis smooth scroll, one animation frame loop for every scroll-driven
// component, and the damping / range helpers (same maths as three.js MathUtils.damp and drei's
// useScroll().range, which the clevir.li reference is built on).
// Components keep their per-frame cost near zero when nothing moves: geometry is measured on
// resize (never inside the frame), and setStyle() skips writes whose value has not changed, so an
// idle page does no style work at all.
import Lenis from "../vendor/lenis.mjs";

export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

// lerp 0.09 settles a wheel flick in about a third of a second: smooth without feeling behind the hand
export const lenis = reduceMotion ? null : new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, touchMultiplier: 1, smoothWheel: true, anchors: true });

/** Pointer position normalised to -1..1 (stays 0 on touch devices). */
export const pointer = { x: 0, y: 0 };
if (finePointer) {
  addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
}

// viewport size, cached: reading innerHeight is cheap, but keep one source of truth for the loop
const view = { w: innerWidth, h: innerHeight };
addEventListener("resize", () => { view.w = innerWidth; view.h = innerHeight; });

const subscribers = new Set();
let last = 0;
function frame(t) {
  const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60;
  last = t;
  lenis?.raf(t);
  const state = { y: window.scrollY, v: lenis ? lenis.velocity : 0, dt, t, vh: view.h, vw: view.w };
  for (const fn of subscribers) fn(state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/** Run fn({ y, v, dt, t, vh, vw }) every frame. Returns an unsubscribe function. */
export function onFrame(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Call fn when the layout may have moved: resize, fonts and images arriving, content changing height. */
export function onLayout(fn) {
  let queued = false;
  const run = () => { queued = false; fn(); };
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(run); } };
  addEventListener("resize", later);
  addEventListener("load", later);
  document.fonts?.ready.then(later);
  new ResizeObserver(later).observe(document.body);
  return later;
}

/** Set a style property only when its value changed: an identical write still costs a style pass. */
export function setStyle(el, prop, value) {
  if (!el) return;
  const cache = el.__style || (el.__style = {});
  if (cache[prop] === value) return;
  cache[prop] = value;
  if (prop.startsWith("--")) el.style.setProperty(prop, value);
  else el.style[prop] = value;
}

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** Frame-rate independent easing toward a target. */
export const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
/** 0 before start, 1 after start + length, linear in between. */
export const range = (v, start, length) => clamp((v - start) / length);

/** Document top of an element, ignoring transforms. */
export function pageTop(el) {
  let y = 0;
  for (let n = el; n; n = n.offsetParent) y += n.offsetTop;
  return y;
}

/** Scrollable height of the page, cached and refreshed when the layout changes. */
const doc = { max: 1 };
const measureDoc = () => { doc.max = Math.max(1, document.documentElement.scrollHeight - innerHeight); };
measureDoc();
onLayout(measureDoc);
export const scrollMax = () => doc.max;

export function scrollToY(y, duration = 1.6) {
  if (lenis) lenis.scrollTo(y, { duration });
  else window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" });
}

export function setScrollLock(locked) {
  if (!lenis) return;
  if (locked) lenis.stop();
  else lenis.start();
}

/** A small event bus for sounds: components announce what happened, sound.js decides what to play. */
export const sfx = (name, detail) => document.dispatchEvent(new CustomEvent("sfx", { detail: { name, ...detail } }));
