// Creatives loader, after pamidordesign.co. STUDIO and day rise into place, a window opens between
// them and flicks through photos from every project (its width follows each photo's shape), then
// the word lifts away and the screen fades into the dusk. It plays once per browser session (the
// head script decides before the first paint), any key, click or scroll skips it, and the page's
// own entrance (the letter-drop title) waits for it.
import { setScrollLock } from "../core/scroll.js";

const OPEN = 820;       // the window opens once the letters have landed
const CYCLE = 1880;     // first photo change
const TICK = 200;       // one photo
const H = 1.508;        // window height in em, as on the reference

export default function intro([screen]) {
  const root = document.documentElement;
  if (!root.hasAttribute("data-intro")) { screen.remove(); return; }
  try { sessionStorage.setItem("sd-intro", "1"); } catch (e) { /* private mode: it just plays again */ }
  setScrollLock(true);
  scrollTo(0, 0);

  const chip = screen.querySelector("[data-intro-chip]");
  const frame = screen.querySelector("[data-intro-frame]");
  const pics = [...screen.querySelectorAll("[data-intro-img]")];
  const width = (k) => (Number(pics[k].dataset.w) / Number(pics[k].dataset.h)) * H;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  let k = 0, ticker = 0, done = false;
  const t0 = performance.now();

  const show = (n) => {
    pics.forEach((p, j) => p.classList.toggle("is-on", j === n));
    frame.style.width = `${width(n).toFixed(3)}em`;
    chip.style.width = `${(width(n) + 0.24).toFixed(3)}em`;
  };

  later(() => { chip.classList.add("is-open"); show(0); }, OPEN);
  later(() => { ticker = setInterval(() => show((k = (k + 1) % pics.length)), TICK); }, CYCLE);

  const finish = () => {
    screen.remove();
    root.removeAttribute("data-intro");
    setScrollLock(false);
  };
  const leave = () => {
    if (done) return;
    done = true;
    clearInterval(ticker);
    timers.forEach(clearTimeout);
    chip.classList.remove("is-open");
    chip.style.width = "0em";
    screen.classList.add("is-leaving");
    // the title starts dropping while the screen is still fading, so there is no empty beat
    setTimeout(() => document.dispatchEvent(new Event("intro:done")), 260);
    setTimeout(finish, 720);
  };

  // leave on a whole pass of the photos once the page has loaded, two passes at most
  const pass = TICK * pics.length;
  const ready = () => {
    const t = performance.now() - t0;
    const passes = Math.max(1, Math.ceil((t - CYCLE) / pass));
    later(leave, Math.max(0, CYCLE + passes * pass - t));
  };
  if (document.readyState === "complete") ready();
  else addEventListener("load", ready, { once: true });
  later(leave, CYCLE + 2 * pass);

  for (const type of ["pointerdown", "keydown", "wheel", "touchmove"]) {
    addEventListener(type, leave, { once: true, passive: true });
  }
}
