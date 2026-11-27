// Home page Icarus scene. The section is pinned while you scroll; progress p (0..1) drives two acts.
// It opens on the greeting ("Hi, I'm Tanmay Kaper.") under the sun; as the fall begins the camera
// drops, so the greeting drifts up and away.
// The fall (p 0..FALL): the charcoal figure falls away from the sun (tumbling, growing as it nears),
// loose feathers drift up past it, the two halves of "for stagnation / equals obsolescence." slide
// past each other and near clouds sweep by. He plunges into the clouds
// and is gone. The ending: the world rises to meet a bed of cloud where he kneels, breathing (CSS),
// and darkness climbs from him: smoke wells up, a tide of night covers the sky, the clouds dim and
// the ink drawing hands over to its chalk twin so he stays visible. Pointer adds a little sway.
// Every value is written straight onto the element that shows it (no inherited custom properties),
// and only when it changed, so a still frame costs nothing.
import { onFrame, onLayout, clamp, damp, pointer, pageTop, reduceMotion, setStyle } from "../core/scroll.js";

const FALL = 0.66; // share of the scroll given to the fall
const lerp = (a, b, t) => a + (b - a) * t;
const inOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const out = (t) => 1 - Math.pow(1 - t, 3);
const f1 = (n) => n.toFixed(1);
const f3 = (n) => n.toFixed(3);

export default function icarus([section]) {
  const q = (k) => section.querySelector(`[data-ic="${k}"]`);
  const fig = q("figure"), sun = q("sun"), a = q("lineA"), b = q("lineB");
  const back = q("cloudsBack"), front = q("cloudsFront");
  const dark = q("dark"), end = q("end"), smoke = q("smoke"), chalk = q("chalk");
  const bedBack = q("bedBack"), bedFront = q("bedFront"), floor = q("floor"), halo = q("halo");
  const hello = q("hello"); // the greeting, when the scene opens the page
  const feathers = [...section.querySelectorAll("[data-feather]")].map((el, i) => ({
    el, i,
    x: Number(el.dataset.x), start: Number(el.dataset.start), speed: Number(el.dataset.speed),
    spin: Number(el.dataset.spin), size: Number(el.dataset.size),
  }));

  let top = 0, height = 0, figH = 0;
  const measure = () => { top = pageTop(section); height = section.offsetHeight; figH = fig.offsetHeight; };
  measure();
  onLayout(measure);
  const sway = { x: 0, y: 0 };

  const render = (p, dt) => {
    const vh = innerHeight, vw = innerWidth;
    sway.x = damp(sway.x, pointer.x, 2.5, dt);
    sway.y = damp(sway.y, pointer.y, 2.5, dt);
    const pf = clamp(p / FALL);

    // ---- act one: the fall (positions use the figure's own height so phones frame the same)
    const held = clamp(pf / 0.82);
    // on the home page he starts in full view, small against the sun above the greeting
    const start = hello ? 0.02 * vh - 0.25 * figH : -0.45 * figH;
    const fy = lerp(start, (vh - figH) / 2 - 0.06 * vh, inOut(held)) + Math.pow(clamp((pf - 0.8) / 0.2), 2) * 1.1 * vh;
    const fx = Math.sin(pf * Math.PI * 1.6) * vw * 0.06 + sway.x * 18;
    const rot = lerp(-24, 34, pf) + Math.sin(pf * Math.PI * 3) * 4;
    const sc = lerp(hello ? 0.5 : 0.62, 1.16, held);
    setStyle(fig, "transform", `translate3d(${f1(fx)}px, ${f1(fy)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${f3(sc)})`);
    // he is swallowed by the clouds as he plunges: nothing of him is left at the edge of the frame
    setStyle(fig, "opacity", f3(1 - clamp((pf - 0.84) / 0.14)));
    setStyle(sun, "transform", `translate3d(${f1(sway.x * -10)}px, ${f1(lerp(0.02, -0.34, pf) * vh)}px, 0) scale(${f3(lerp(1, 0.72, pf))})`);
    setStyle(sun, "opacity", f3(1 - clamp((p - FALL + 0.04) / 0.18)));
    setStyle(a, "transform", `translate3d(${f1(lerp(0.32, -0.62, pf) * vw)}px, 0, 0)`);
    setStyle(b, "transform", `translate3d(${f1(lerp(-0.6, 0.3, pf) * vw)}px, 0, 0)`);
    // with a greeting on screen the two lines wait until it has drifted away
    const linesIn = hello ? clamp((pf - 0.12) / 0.14) : 1;
    const lines = f3(linesIn * (1 - clamp((p - FALL + 0.08) / 0.12)));
    setStyle(a, "opacity", lines);
    setStyle(b, "opacity", lines);
    if (hello) {
      const h = clamp(pf / 0.22);
      setStyle(hello, "transform", `translate3d(${f1(sway.x * -6)}px, ${f1(-h * 0.55 * vh)}px, 0)`);
      setStyle(hello, "opacity", f3(1 - h));
      setStyle(hello, "filter", h > 0.01 && h < 0.999 ? `blur(${(h * 8).toFixed(1)}px)` : "");
      setStyle(hello, "visibility", h >= 0.999 ? "hidden" : "");
    }
    setStyle(back, "transform", `translate3d(${f1(sway.x * 8)}px, ${f1(lerp(0.1, -0.3, pf) * vh)}px, 0)`);
    setStyle(front, "transform", `translate3d(${f1(sway.x * 30)}px, ${f1(lerp(0.2, -2.1, pf) * vh)}px, 0)`);
    for (const f of feathers) {
      const t = clamp((pf - f.start) / (1 - f.start));
      const op = clamp(t * 6) * clamp((1 - t) * 3);
      setStyle(f.el, "opacity", f3(op));
      if (op === 0) continue; // an invisible feather does not need to move
      const y = fy + vh * 0.12 - t * f.speed * vh;
      const x = f.x * vw + Math.sin((pf + f.i) * 6) * 40 + fx * (1 - t);
      const r = f.spin * t * 360 + Math.sin(pf * 10 + f.i) * 25;
      setStyle(f.el, "transform", `translate3d(${f1(x)}px, ${f1(y)}px, 0) rotate(${f1(r)}deg) scale(${f.size})`);
    }

    // ---- act two: he kneels in the cloud bed and the dark rises from him
    const rise = out(clamp((p - FALL + 0.06) / 0.24));
    setStyle(end, "transform", `translate3d(${f1(sway.x * 6)}px, ${f1((1 - rise) * 0.8 * vh)}px, 0)`);
    const d = inOut(clamp((p - 0.8) / 0.2));
    setStyle(dark, "transform", `translate3d(0, ${(-d * 100).toFixed(2)}%, 0)`);
    const dim = d > 0.001 ? `brightness(${f3(1 - 0.66 * d)}) saturate(${f3(1 - 0.78 * d)})` : "";
    setStyle(bedBack, "filter", dim);
    setStyle(bedFront, "filter", dim ? `${dim} blur(1.5px)` : "");
    setStyle(floor, "opacity", f3(clamp((d - 0.35) / 0.65)));
    setStyle(halo, "opacity", f3(1 - 0.72 * d));
    setStyle(smoke, "opacity", f3(clamp(d * 1.8)));
    setStyle(smoke, "transform", `translate3d(0, ${f1(-d * 0.16 * vh)}px, 0) scale(${f3(1 + d * 0.9)})`);
    setStyle(chalk, "opacity", f3(clamp((d - 0.2) / 0.55)));
    // the time of day the scene has reached: the logo in the header reads "night" once it is dark
    const phase = d > 0.55 ? "night" : "day";
    if (section.dataset.phase !== phase) section.dataset.phase = phase;
  };

  onFrame(({ y, vh, dt }) => {
    if (y < top - vh * 1.5 || y > top + height + vh) return;
    const span = Math.max(1, height - vh);
    const p = clamp((y - top) / span);
    // reduced motion: no scroll-scrubbed movement, just settled states (the greeting, the fall, the ending)
    const still = hello && p < 0.16 ? 0 : p < 0.55 ? FALL * 0.45 : 1;
    render(reduceMotion ? still : p, reduceMotion ? 1 : dt);
  });
  render(0, 1);
}
