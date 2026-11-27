// Creatives console. The section is pinned while you scroll through a sequence of states:
//   intro    NOW PLAYING menu listing every project in the creatives CMS
//   select   project i highlighted
//   load     LOADING meter fills
//   gallery  project i's images, video or YouTube edits play on the screen, scrubbed by scroll;
//            a project still in development (a "dev cart") plays an editing timeline instead
//   back     returns to the menu, then the next project is highlighted
// Around the console, the active project's description rises and parts (flow-text.js).
// The scroll budget is computed from the data, so adding a project or images lengthens the section.
// The console's own buttons work: the d-pad (and the arrow keys) changes cartridge, A plays, B goes
// back, START opens the gallery and SELECT moves to the next cartridge.
import { onFrame, onLayout, clamp, pageTop, scrollToY, setStyle, sfx } from "../core/scroll.js";
import { createFlow } from "./flow-text.js";

const U = { intro: 1.2, select: 0.6, load: 0.3, perItem: 0.26, minGallery: 0.9, dev: 1.6, back: 0.25, outro: 0.6 };
// what the dev cart's timeline is learning, one skill per stretch of the playhead
const SKILLS = ["Easy ease", "Speed ramp", "Match cut", "J-cut", "Kinetic type", "Beat sync", "Colour match", "Motion blur"];

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

export default function arcade([section]) {
  const projects = JSON.parse(section.querySelector("[data-arcade-projects]").textContent);
  const screenEl = section.querySelector("[data-screen]");
  const device = section.querySelector("[data-device]");
  const stage = section.querySelector(".arcade__stage");
  const play = section.querySelector("[data-play]");
  if (!projects.length) return;
  const flow = createFlow(section.querySelector("[data-flow]"), device, JSON.parse(section.querySelector("[data-flow-text]").textContent));

  // ---- sequence
  const segments = [{ type: "intro", len: U.intro }];
  projects.forEach((p, i) => {
    segments.push({ type: "select", i, len: U.select });
    segments.push({ type: "load", i, len: U.load });
    segments.push({ type: "gallery", i, len: p.dev ? U.dev : Math.max(U.minGallery, p.gallery.length * U.perItem) });
    segments.push({ type: "back", i, len: U.back });
  });
  segments.push({ type: "outro", len: U.outro });
  let acc = 0;
  for (const s of segments) { s.start = acc; acc += s.len; }
  const total = acc;
  section.style.height = `${(total + 1) * 100}vh`;

  // ---- screens
  const make = (cls, ...children) => {
    const s = el("div", `screen ${cls}`);
    s.append(...children);
    screenEl.append(s);
    return s;
  };
  const bar = (label) => {
    const b = el("div", "screen__bar");
    b.append(el("span", null, label), el("span", "dot"));
    return b;
  };
  const list = el("ol", "screen__list");
  const menu = make("screen--menu", bar("Now playing"), list);
  const rows = projects.map((p) => {
    const li = el("li", null, p.title);
    if (p.dev) li.append(el("i", "screen__tag", "Dev"));
    list.append(li);
    return li;
  });
  const loadTitle = el("strong"), loadLabel = el("span", "screen__load-label", "Loading");
  const meter = el("div", "screen__meter"), meterFill = el("span");
  meter.append(meterFill);
  const load = make("screen--load", loadTitle, meter, loadLabel);
  const media = el("div", "screen__media");
  const status = el("div", "screen__status");
  const statusTitle = el("span"), statusCount = el("span");
  status.append(statusTitle, statusCount);
  const caption = el("p", "screen__caption");
  const gal = make("screen--gallery", media, status, caption);
  const info = make("screen--info", el("strong"), el("span"), el("span"));

  // the dev cart: an editing timeline drawn in LCD pixels, its playhead scrubbed by scroll
  const timeline = el("div", "tl");
  const names = el("div", "tl__names");
  const lanesBox = el("div", "tl__lanes"); // a size container: the playhead travels its width in cqw
  timeline.append(names, lanesBox);
  const lanes = [];
  for (const [name, keys] of [["Type", [6, 19, 31, 58, 71]], ["Camera", [12, 44, 63, 90]], ["Cuts", [9, 24, 38, 50, 66, 79, 93]]]) {
    names.append(el("b", null, name));
    const lane = el("span", "tl__lane");
    for (const x of keys) {
      const k = el("i", "tl__key");
      k.style.left = `${x}%`;
      lane.append(k);
      lanes.push({ x: x / 100, k });
    }
    lanesBox.append(lane);
  }
  names.append(el("b", null, "Sound"));
  const waveLane = el("span", "tl__lane tl__wave");
  for (let k = 0; k < 40; k++) {
    const level = el("i");
    level.style.height = `${(22 + 70 * Math.abs(Math.sin(k * 0.9) * Math.cos(k * 0.37))).toFixed(0)}%`;
    waveLane.append(level);
  }
  const head = el("i", "tl__head");
  lanesBox.append(waveLane, head);
  const skill = el("strong");
  const learn = el("p", "screen__learn");
  learn.append(el("span", null, "Learning"), skill);
  const devBar = el("div", "screen__bar");
  const devTitle = el("span");
  devBar.append(devTitle, el("span", "screen__rec", "Dev build"));
  const dev = make("screen--dev", devBar, timeline, learn);

  const screens = [menu, load, gal, info, dev];
  let shown = null;
  const showScreen = (s) => {
    if (s === shown) return;
    shown = s;
    screens.forEach((x) => x.classList.toggle("is-on", x === s));
  };

  // Gallery media are created the first time a project's gallery opens. Image sources stay parked in
  // data attributes until the viewer is within two frames of them, so opening a gallery fetches three
  // pictures rather than all of them at once.
  const built = new Map();
  let galleryFor = -1;
  const picture = (sources, src, alt) => {
    const pic = el("picture");
    for (const [srcset, type] of sources) {
      const s = el("source");
      s.dataset.srcset = srcset;
      s.type = type;
      pic.append(s);
    }
    const img = el("img");
    img.dataset.src = src;
    img.alt = alt || "";
    img.decoding = "async";
    // a thumbnail that has gone missing is hidden rather than shown broken
    img.addEventListener("error", () => { pic.hidden = true; });
    pic.append(img);
    return pic;
  };
  const mediaFor = (i) => {
    if (!built.has(i)) {
      built.set(i, projects[i].gallery.map((item) => {
        let node;
        if (item.type === "video") {
          node = el("video");
          node.muted = true; node.loop = true; node.playsInline = true; node.preload = "none";
          node.src = item.src;
          node.setAttribute("aria-label", item.label || `${projects[i].title} video`);
          node.title = item.label || `${projects[i].title} video`;
        } else if (item.type === "youtube") {
          node = el("figure", "yt");
          node.append(picture([[`https://i.ytimg.com/vi_webp/${item.id}/maxresdefault.webp`, "image/webp"]],
            `https://i.ytimg.com/vi/${item.id}/maxresdefault.jpg`, `${item.title}, thumbnail of the YouTube video`));
        } else {
          node = picture([[item.avif, "image/avif"]], item.jpg, item.alt);
        }
        if (item.fit === "contain") node.classList.add("contain");
        return node;
      }));
    }
    return built.get(i);
  };
  const prime = (nodes, k) => {
    for (const node of nodes.slice(k, k + 3)) {
      if (node.tagName === "VIDEO" || node.dataset.primed) continue;
      node.dataset.primed = "1";
      node.querySelectorAll("source[data-srcset]").forEach((s) => { s.srcset = s.dataset.srcset; });
      const img = node.querySelector("img[data-src]");
      if (img) img.src = img.dataset.src;
    }
  };
  const openGallery = (i) => {
    if (galleryFor === i) return;
    media.querySelectorAll("video").forEach((v) => v.pause());
    media.replaceChildren(...mediaFor(i));
    galleryFor = i;
  };

  const fillInfo = (p) => {
    const [t, a, b] = info.children;
    t.textContent = p.title;
    a.textContent = p.subtitle;
    b.textContent = `${p.year} / ${p.subjects.join(", ")}`;
  };

  // ---- the Play button under the glass: jump into a gallery, or follow the project's link
  let playJump = null;
  play.addEventListener("click", (e) => {
    if (play.dataset.mode !== "jump") return;
    e.preventDefault();
    if (playJump !== null) go(playJump);
  });
  const setPlay = (mode, { label, href, jump, external } = {}) => {
    const key = `${mode}|${label}|${href}|${jump}`;
    if (play.dataset.key === key) return;
    play.dataset.key = key;
    play.dataset.mode = mode;
    play.hidden = mode === "none";
    if (mode === "none") return;
    play.textContent = label;
    play.href = href || "#";
    playJump = mode === "jump" ? jump : null;
    if (external) { play.target = "_blank"; play.rel = "noopener"; } else { play.removeAttribute("target"); play.removeAttribute("rel"); }
    if (mode === "jump") play.setAttribute("aria-label", `Play Now: open the ${projects[jump].title} gallery`);
    else play.removeAttribute("aria-label");
  };
  const projectLink = (p) => {
    if (!p.link) return null;
    const external = /^https?:/.test(p.link);
    return { label: `${p.linkLabel || "Visit"}${external ? " ↗" : " →"}`, href: p.link, external };
  };

  // ---- geometry, measured on layout changes only (the stage is sticky, so the console's place on
  // screen follows from the scroll position)
  const geo = { top: 0, height: 0, stageH: 0, devTop: 0, devLeft: 0, devW: 0, devH: 0 };
  let lastU = -1;
  const measure = () => {
    geo.top = pageTop(section);
    geo.height = section.offsetHeight;
    geo.stageH = stage.offsetHeight;
    const s = stage.getBoundingClientRect(), d = device.getBoundingClientRect();
    geo.devTop = d.top - s.top; geo.devLeft = d.left; geo.devW = d.width; geo.devH = d.height;
  };
  measure();
  onLayout(() => { measure(); lastU = -1; });
  const devRect = (y) => {
    const stageTop = Math.min(Math.max(geo.top - y, 0), geo.top + geo.height - geo.stageH - y);
    const top = stageTop + geo.devTop;
    return { top, bottom: top + geo.devH, left: geo.devLeft, right: geo.devLeft + geo.devW };
  };
  const yAt = (u) => geo.top + (u / total) * Math.max(1, geo.height - innerHeight) + 4;
  const go = (segment) => { if (segment) scrollToY(yAt(segment.start), 1.1); };
  const seg = (type, i) => segments.find((s) => s.type === type && s.i === i);

  // ---- state
  let current = { type: "intro", i: -1 };
  let lastKey = "", lastItem = -1, lastSkill = -1, lastHit = "";
  const render = (u, rect) => {
    const s = segments.find((x) => u >= x.start && u < x.start + x.len) || segments[segments.length - 1];
    const local = clamp((u - s.start) / s.len);
    const i = s.i ?? -1;
    const p = projects[i];
    current = s;

    if (s.type === "intro" || s.type === "outro") {
      flow.set(s.type === "intro" ? "intro" : "none", local, rect);
    } else {
      const span = segments.filter((x) => x.i === i);
      const start = span[0].start, len = span.reduce((a, x) => a + x.len, 0);
      flow.set(String(i), clamp((u - start) / len), rect);
    }

    if (s.type === "gallery" && p.dev) {
      // the playhead runs the length of the timeline; keyframes light up as it passes them
      setStyle(head, "transform", `translateX(${(local * 100).toFixed(2)}cqw)`);
      const k = Math.min(SKILLS.length - 1, Math.floor(local * SKILLS.length));
      if (k !== lastSkill) { lastSkill = k; skill.textContent = SKILLS[k]; sfx("tick"); }
      const hit = lanes.map((m) => (m.x <= local ? 1 : 0)).join("");
      if (hit !== lastHit) { lastHit = hit; lanes.forEach((m, j) => m.k.classList.toggle("is-hit", hit[j] === "1")); }
    } else if (s.type === "gallery" && p.gallery.length) {
      openGallery(i);
      const k = Math.min(p.gallery.length - 1, Math.floor(local * p.gallery.length));
      const nodes = mediaFor(i);
      prime(nodes, k);
      if (k !== lastItem || lastKey !== `gallery:${i}`) {
        lastItem = k;
        nodes.forEach((node, j) => {
          node.classList.toggle("is-on", j === k);
          if (node.tagName === "VIDEO") (j === k ? node.play().catch(() => {}) : node.pause());
        });
        statusTitle.textContent = p.title;
        statusCount.textContent = `${String(k + 1).padStart(2, "0")}/${String(p.gallery.length).padStart(2, "0")}`;
        const item = p.gallery[k];
        caption.textContent = item.type === "youtube" ? item.title : "";
        caption.hidden = item.type !== "youtube";
        // a YouTube edit on screen: Play opens that video
        if (item.type === "youtube") setPlay("link", { label: "Watch on YouTube ↗", href: `https://www.youtube.com/watch?v=${item.id}`, external: true });
        else { const l = projectLink(p); setPlay(l ? "link" : "none", l || {}); }
        if (lastKey === `gallery:${i}`) sfx("flick");
      }
    }

    const key = `${s.type}:${i}`;
    if (key === lastKey && s.type !== "load") return;
    if (key !== lastKey) sfx(s.type === "load" ? "load" : s.type === "select" ? "select" : "blip");
    lastKey = key;

    if (s.type === "gallery") {
      if (p.dev) {
        devTitle.textContent = p.title;
        showScreen(dev);
        const l = projectLink(p);
        setPlay(l ? "link" : "none", l || {});
      } else if (p.gallery.length) {
        showScreen(gal);
      } else {
        fillInfo(p);
        showScreen(info);
        const l = projectLink(p);
        setPlay(l ? "link" : "none", l || {});
      }
    } else if (s.type === "load") {
      loadTitle.textContent = p.title;
      loadLabel.textContent = p.dev ? "Compiling" : "Loading";
      if (p.gallery.length) prime(mediaFor(i), 0); // warm the first frames while the bar fills
      setStyle(meterFill, "--p", local.toFixed(3));
      showScreen(load);
      const l = projectLink(p);
      setPlay(l ? "link" : "none", l || {});
    } else {
      // Menu states: intro (nothing highlighted), select/back (project i), outro (all played).
      const hi = s.type === "select" || s.type === "back" ? i : -1;
      rows.forEach((row, j) => {
        row.classList.toggle("is-active", j === hi);
        row.classList.toggle("is-done", s.type === "outro" || j < i || (s.type === "back" && j === i));
      });
      showScreen(menu);
      if (s.type === "outro") setPlay("none");
      else { const j = hi >= 0 ? hi : 0; setPlay("jump", { label: "Play Now", jump: j }); }
    }
  };

  // ---- the console's buttons, and the arrow keys while the console is on screen
  const project = () => (current.i ?? -1);
  const actions = {
    prev: () => { const i = project(); go(i <= 0 ? segments[0] : seg("select", i - 1)); },
    next: () => { const i = project(); go(seg("select", Math.min(projects.length - 1, i + 1))); },
    a: () => {
      if (play.hidden) return;
      if (play.dataset.mode === "jump") go(seg("gallery", playJump));
      else if (play.target === "_blank") open(play.href, "_blank", "noopener");
      else location.href = play.href;
    },
    b: () => { const i = project(); go(current.type === "select" || i < 0 ? segments[0] : seg("select", i)); },
    start: () => go(seg("gallery", Math.max(0, project()))),
    select: () => { const i = project(); go(seg("select", (i + 1) % projects.length)); },
  };
  const press = (key) => {
    const art = device.querySelector(`.console-svg [data-key="${["up", "down", "left", "right"].includes(key) ? "dpad" : key}"]`);
    if (art) {
      art.classList.remove("is-down");
      void art.getBoundingClientRect();
      art.classList.add("is-down");
      setTimeout(() => art.classList.remove("is-down"), 160);
    }
    sfx("press");
  };
  section.querySelectorAll("[data-console-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.consoleKey;
      press(key);
      const act = { up: "prev", left: "prev", down: "next", right: "next" }[key] || key;
      actions[act]?.();
    });
  });
  let onScreen = false;
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; }, { threshold: 0.5 }).observe(device);
  addEventListener("keydown", (e) => {
    if (!onScreen || e.altKey || e.metaKey || e.ctrlKey || e.target.closest("input, textarea, select")) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); press("left"); actions.prev(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); press("right"); actions.next(); }
  });

  onFrame(({ y, vh }) => {
    if (y < geo.top - vh * 1.5 || y > geo.top + geo.height + vh) return;
    const u = clamp((y - geo.top) / Math.max(1, geo.height - vh)) * total;
    if (Math.abs(u - lastU) < 0.0005) return;
    lastU = u;
    render(Math.min(u, total - 0.0001), devRect(y));
  });
  render(0, devRect(scrollY));
}
