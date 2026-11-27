// Academics flight path (after the work timeline on clevir.li): a line draws itself across a tilted
// plane of clouds as you scroll, the view follows the tip of the line, each paper's label stands up
// as the line reaches it and lies down again once the line has flown past (so labels never stack up
// in the distance), and that paper's glass tile slides in beside it.
// The path is sampled once into a lookup table, so following it costs no SVG geometry calls per frame.
import { onFrame, onLayout, damp, clamp, pointer, pageTop, reduceMotion, setStyle } from "../core/scroll.js";

const TILT = 62; // degrees the plane leans back
const PATH_START = 0.04, PATH_END = 0.96;
const SAMPLES = 600;

export default function flightpath([section]) {
  const plane = section.querySelector("[data-fp-plane]");
  const line = section.querySelector("[data-fp-line]");
  const nodes = [...section.querySelectorAll("[data-fp-node]")];
  const tiles = [...section.querySelectorAll("[data-fp-tile]")];
  const length = line.getTotalLength();
  const viewBoxH = line.ownerSVGElement.viewBox.baseVal.height;
  const unit = plane.offsetHeight / viewBoxH; // svg units to plane px (x uses the 1000px width directly)

  const xs = new Float32Array(SAMPLES + 1), ys = new Float32Array(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i++) {
    const p = line.getPointAtLength((i / SAMPLES) * length);
    xs[i] = p.x; ys[i] = p.y;
  }
  const at = (t) => {
    const f = clamp(t) * SAMPLES, i = Math.min(SAMPLES - 1, Math.floor(f)), k = f - i;
    return { x: xs[i] + (xs[i + 1] - xs[i]) * k, y: ys[i] + (ys[i + 1] - ys[i]) * k };
  };
  // fraction of the path at which each node sits
  const nodeT = nodes.map((n) => {
    const x = parseFloat(n.style.left), y = parseFloat(n.style.top) / unit;
    let best = 0, bestD = Infinity;
    for (let i = 0; i <= SAMPLES; i++) {
      const d = (xs[i] - x) ** 2 + (ys[i] - y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best / SAMPLES;
  });

  line.style.strokeDasharray = "1";
  let top = 0, height = 0;
  const measure = () => { top = pageTop(section); height = section.offsetHeight; };
  measure();
  onLayout(measure);
  const cam = { rz: 0, rx: 0, t: 0 };
  let activeTile = -1;

  const apply = (t, dt) => {
    const lambda = reduceMotion ? 1000 : 6;
    cam.t = damp(cam.t, t, lambda, dt);
    if (Math.abs(cam.t - t) < 1e-5) cam.t = t;
    const pt = at(cam.t);
    cam.rz = damp(cam.rz, reduceMotion ? 0 : pointer.x * 3, 3, dt);
    cam.rx = damp(cam.rx, reduceMotion ? 0 : pointer.y * 2, 3, dt);
    const scale = Math.max(0.55, Math.min(1, innerWidth / 1100));
    setStyle(plane, "transform",
      `scale(${scale.toFixed(3)}) rotateX(${(TILT + cam.rx).toFixed(2)}deg) rotateZ(${cam.rz.toFixed(2)}deg) translate3d(${(-pt.x).toFixed(1)}px, ${(-pt.y * unit).toFixed(1)}px, 0)`);
    setStyle(line, "strokeDashoffset", (1 - clamp(cam.t)).toFixed(4));

    let near = -1, nearD = Infinity;
    nodes.forEach((n, i) => {
      const ahead = nodeT[i] - cam.t;
      // stands up over the last tenth of the path before the node, lies down again soon after it
      const o = ahead >= 0 ? clamp(1 - ahead / 0.1) : clamp(1 - (-ahead - 0.1) / 0.08);
      setStyle(n, "--o", o.toFixed(3));
      const d = Math.abs(ahead);
      if (d < nearD) { nearD = d; near = i; }
    });
    const want = nearD < 0.2 ? near : -1;
    if (want !== activeTile) {
      tiles.forEach((tile, i) => {
        tile.classList.toggle("is-active", i === want);
        tile.tabIndex = i === want ? 0 : -1;
      });
      activeTile = want;
    }
  };

  onFrame(({ y, dt, vh }) => {
    if (y < top - vh * 1.5 || y > top + height + vh) return;
    const p = clamp((y - top) / Math.max(1, height - vh));
    apply(PATH_START + p * (PATH_END - PATH_START), dt);
  });
  apply(PATH_START, 1);
}
