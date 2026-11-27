// Port of Tanmay's Cat Easter Egg Framer component, now with doodle frames.
// The cat sits on the cloud floor. Within 220px of the cursor it runs up to 140px away from it,
// alternating two run frames every 120ms, then wanders back. On touch screens a tap sends it running.
// It only watches the cursor while it is on screen, and works out where it is from the scroll
// position rather than asking the layout every frame.
import { onLayout, pageTop } from "../core/scroll.js";

const CONFIG = { proximity: 220, moveDistance: 140, frameRate: 120, fadeDuration: 0.6 };
const clamp = (v) => Math.min(1, Math.max(0, v));

export default function cat(nodes) {
  for (const zone of nodes) build(zone);
}

function build(zone) {
  const el = zone.querySelector(".cat");
  const img = el.querySelector("img");
  const { standing, run1, run2 } = zone.dataset;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  [standing, run1, run2].forEach((src) => { new Image().src = src; });
  img.src = standing;

  if (!matchMedia("(hover: hover)").matches) {
    el.style.opacity = "1";
    zone.style.pointerEvents = "none";
    el.style.pointerEvents = "auto";
    let busy = false;
    el.addEventListener("click", () => {
      if (busy || reduce.matches) return;
      busy = true;
      let frame = 0, x = 0;
      const timer = setInterval(() => {
        frame = 1 - frame;
        img.src = frame ? run2 : run1;
        x += 14;
        el.style.transform = `translateX(calc(-50% + ${x}px))`;
        if (x >= CONFIG.moveDistance) {
          clearInterval(timer);
          img.src = standing;
          setTimeout(() => { el.style.transition = "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)"; el.style.transform = "translateX(-50%)"; }, 900);
          setTimeout(() => { el.style.transition = ""; busy = false; }, 1600);
        }
      }, CONFIG.frameRate);
    });
    return;
  }

  // the cat's resting centre in page coordinates (its own offset is added on top)
  const home = { x: 0, y: 0 };
  const measure = () => {
    home.x = zone.getBoundingClientRect().left + el.offsetLeft;
    home.y = pageTop(el) + el.offsetHeight / 2;
  };
  measure();
  onLayout(measure);

  const mouse = { x: -99999, y: -99999 };
  const state = { opacity: 1, offsetX: 0, frame: 0, running: false, dir: 1 };
  let timer = 0, raf = 0, last = { src: "", opacity: "", transform: "" };
  addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });

  const tick = () => {
    raf = requestAnimationFrame(tick);
    const cx = home.x + state.offsetX;
    const cy = home.y - scrollY;
    const dist = Math.hypot(mouse.x - cx, mouse.y - cy);
    const near = dist <= CONFIG.proximity;
    const strength = clamp(1 - dist / CONFIG.proximity);
    const fade = Math.max(0.05, Math.min(0.25, 1 / Math.max(0.01, CONFIG.fadeDuration * 60)));
    state.opacity += (1 - state.opacity) * fade;
    const away = mouse.x < cx ? 1 : -1; // run away from the side the cursor is on
    const targetX = near && !reduce.matches ? away * CONFIG.moveDistance * (0.6 + strength) : 0;
    state.dir = near ? away : state.dir;
    state.offsetX += (targetX - state.offsetX) * 0.16;
    if (Math.abs(targetX - state.offsetX) < 0.05) state.offsetX = targetX;
    state.running = near && !reduce.matches;

    if (state.running && !timer) {
      timer = setInterval(() => { state.frame = state.frame ? 0 : 1; }, CONFIG.frameRate);
    } else if (!state.running && timer) {
      clearInterval(timer); timer = 0; state.frame = 0;
    }
    const src = state.running ? (state.frame ? run2 : run1) : standing;
    if (src !== last.src) img.src = last.src = src;
    const opacity = state.opacity > 0.999 ? "1" : state.opacity.toFixed(3);
    if (opacity !== last.opacity) el.style.opacity = last.opacity = opacity;
    const transform = `translateX(calc(-50% + ${state.offsetX.toFixed(1)}px)) scaleX(${state.dir})`;
    if (transform !== last.transform) el.style.transform = last.transform = transform;
  };
  // only while the cloud floor is on screen
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !raf) raf = requestAnimationFrame(tick);
    else if (!entry.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
  }, { rootMargin: "200px 0px" }).observe(zone);
}
