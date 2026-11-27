// Sound, off until asked for. Everything is synthesised with Web Audio (no files to download):
//   wind    a bed of filtered noise that gusts with scroll speed, so falling with Icarus rushes;
//           brighter under the day sky, darker at dusk
//   flick   a card or a gallery frame changing          tick   the dial, the timeline's playhead
//   blip / select / load / press   the console, in 8-bit square waves
// Components announce events with sfx() (core/scroll.js); this module decides what they sound like.
// The choice is remembered; browsers only let audio start after a click or key, so a remembered
// "on" waits for the first one on each page.
import { onFrame } from "../core/scroll.js";

const KEY = "sd-sound";

export default function sound([button]) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  button.hidden = false;
  let ctx = null, master = null, wind = null, on = false;
  try { on = localStorage.getItem(KEY) === "on"; } catch (e) { /* storage blocked */ }
  const dusk = document.body.dataset.phase === "dusk";

  const start = () => {
    if (ctx) return ctx.resume();
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // two seconds of brown noise, looped
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.5; }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass"; filter.Q.value = 0.7; filter.frequency.value = dusk ? 260 : 420;
    const gain = ctx.createGain();
    gain.gain.value = 0.18;
    src.connect(filter).connect(gain).connect(master);
    src.start();
    wind = { filter, gain, level: 0.18 };
    return ctx.resume();
  };

  const set = (next, persist = true) => {
    on = next;
    button.setAttribute("aria-pressed", String(on));
    button.classList.toggle("is-on", on);
    if (persist) try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) { /* storage blocked */ }
    if (on) start()?.then(() => fade(0.55));
    else if (ctx) fade(0);
  };
  const fade = (to) => { if (master) master.gain.setTargetAtTime(to, ctx.currentTime, 0.25); };

  button.addEventListener("click", () => { set(!on); if (on) play("press"); });
  if (on) {
    button.setAttribute("aria-pressed", "true");
    button.classList.add("is-on");
    const first = () => { if (on) set(true, false); };
    addEventListener("pointerdown", first, { once: true });
    addEventListener("keydown", first, { once: true });
  }
  // a hidden tab goes quiet
  document.addEventListener("visibilitychange", () => { if (ctx && on) fade(document.hidden ? 0 : 0.55); });

  // gusts follow scroll speed
  onFrame(({ v }) => {
    if (!on || !wind) return;
    const speed = Math.min(1, Math.abs(v) / 40);
    const level = 0.14 + speed * 0.5;
    if (Math.abs(level - wind.level) < 0.01) return;
    wind.level = level;
    const t = ctx.currentTime;
    wind.gain.gain.setTargetAtTime(level, t, 0.3);
    wind.filter.frequency.setTargetAtTime((dusk ? 240 : 380) + speed * 900, t, 0.3);
  });

  const tone = (type, freq, dur, vol = 0.12, slide = 0) => {
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  };
  const noise = (dur, freq, vol = 0.2) => {
    const t = ctx.currentTime, len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; f.type = "highpass"; f.frequency.value = freq; g.gain.value = vol;
    src.connect(f).connect(g).connect(master);
    src.start(t);
  };
  const play = (name) => {
    if (!on || !ctx || ctx.state !== "running") return;
    switch (name) {
      case "flick": noise(0.05, 2500, 0.16); break;
      case "tick": tone("square", 1800, 0.018, 0.035); break;
      case "blip": tone("square", 660, 0.06, 0.05); break;
      case "select": tone("square", 520, 0.05, 0.05); setTimeout(() => tone("square", 780, 0.07, 0.05), 55); break;
      case "load": tone("square", 330, 0.28, 0.04, 2.2); break;
      case "press": tone("triangle", 220, 0.07, 0.12); break;
      case "paper": noise(0.14, 900, 0.12); break;
    }
  };
  document.addEventListener("sfx", (e) => play(e.detail.name));
}
