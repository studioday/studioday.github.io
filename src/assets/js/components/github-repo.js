// Live GitHub panel for a tech project page. GitHub can't be iframed, so this recreates the useful
// parts of a repo page from the public REST API (no token; 60 requests per hour per visitor):
// header with stars and forks, language bar, topics, latest commits and the rendered README.
const API = "https://api.github.com/repos/";

const LANG_COLORS = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5", HTML: "#e34c26", CSS: "#563d7c",
  Jupyter: "#DA5B0B", "Jupyter Notebook": "#DA5B0B", Java: "#b07219", "C++": "#f34b7d", C: "#555555",
  Go: "#00ADD8", Rust: "#dea584", Swift: "#F05138", Kotlin: "#A97BFF", R: "#198CE7", Shell: "#89e051",
};

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const ago = (iso) => {
  const days = Math.round((Date.now() - new Date(iso)) / 86400000);
  if (days < 1) return "today";
  if (days < 31) return `${days} day${days > 1 ? "s" : ""} ago`;
  const m = Math.round(days / 30);
  return m < 12 ? `${m} month${m > 1 ? "s" : ""} ago` : `${Math.round(m / 12)} year${m >= 24 ? "s" : ""} ago`;
};

export default function githubRepo(nodes) {
  for (const host of nodes) load(host);
}

// Responses are kept for the browser session, so moving between project pages does not spend the
// hourly allowance again.
const CACHE_MS = 15 * 60 * 1000;

async function load(host) {
  const repo = host.dataset.githubRepo;
  if (!repo) return;
  host.classList.add("is-loading");
  const key = `gh:${repo}`;
  try {
    const cached = JSON.parse(sessionStorage.getItem(key) || "null");
    if (cached && Date.now() - cached.t < CACHE_MS) { render(host, repo, ...cached.data); return; }
  } catch (e) { /* storage blocked: fetch as usual */ }
  try {
    const get = (path, accept) =>
      fetch(API + repo + path, { headers: { Accept: accept || "application/vnd.github+json" } }).then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return accept && accept.includes("html") ? r.text() : r.json();
      });
    const [info, langs, commits, readme] = await Promise.all([
      get(""), get("/languages"),
      // the owner's own commits; scheduled bots can outnumber them many times over
      get(`/commits?author=${repo.split("/")[0]}&per_page=5`).then((own) => (own.length ? own : get("/commits?per_page=5"))),
      get("/readme", "application/vnd.github.html+json").catch(() => ""),
    ]);
    // keep only what the panel shows
    const slim = [
      { full_name: info.full_name, name: info.name, html_url: info.html_url, description: info.description,
        stargazers_count: info.stargazers_count, forks_count: info.forks_count,
        watchers: info.subscribers_count ?? info.watchers_count, pushed_at: info.pushed_at,
        topics: info.topics || [], default_branch: info.default_branch || "main" },
      langs,
      commits.map((c) => ({ message: c.commit.message, url: c.html_url, sha: c.sha, date: c.commit.author.date })),
      readme,
    ];
    try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), data: slim })); } catch (e) { /* full or blocked */ }
    render(host, repo, ...slim);
  } catch (err) {
    host.classList.remove("is-loading");
    host.querySelector("[data-repo-status]").textContent =
      "GitHub did not answer just now (the public API allows 60 requests an hour). The repo is one click away.";
  }
}

function render(host, repo, info, langs, commits, readme) {
  host.classList.remove("is-loading");
  host.classList.add("is-live");
  host.querySelector("[data-repo-name]").textContent = info.full_name;
  host.querySelector("[data-repo-link]").href = info.html_url;
  host.querySelector("[data-repo-desc]").textContent = info.description || "No description on GitHub yet.";
  host.querySelector("[data-repo-stars]").textContent = fmt(info.stargazers_count);
  host.querySelector("[data-repo-forks]").textContent = fmt(info.forks_count);
  host.querySelector("[data-repo-watchers]").textContent = fmt(info.watchers);
  host.querySelector("[data-repo-updated]").textContent = `Updated ${ago(info.pushed_at)}`;
  host.querySelector("[data-repo-status]").textContent = "";

  const topics = host.querySelector("[data-repo-topics]");
  topics.replaceChildren(...(info.topics || []).map((t) => el("li", "repo__topic", t)));

  const total = Object.values(langs).reduce((a, b) => a + b, 0) || 1;
  const bar = host.querySelector("[data-repo-langbar]");
  const legend = host.querySelector("[data-repo-langs]");
  bar.replaceChildren();
  legend.replaceChildren();
  for (const [name, bytes] of Object.entries(langs)) {
    const pct = (bytes / total) * 100;
    const color = LANG_COLORS[name] || "#9fb4cf";
    const seg = el("span");
    seg.style.cssText = `width:${pct}%;background:${color}`;
    bar.append(seg);
    const li = el("li");
    const dot = el("i");
    dot.style.background = color;
    li.append(dot, `${name} ${pct.toFixed(1)}%`);
    legend.append(li);
  }

  const list = host.querySelector("[data-repo-commits]");
  list.replaceChildren(...commits.map((c) => {
    const li = el("li", "repo__commit");
    const a = el("a", null, c.message.split("\n")[0]);
    a.href = c.url; a.target = "_blank"; a.rel = "noopener";
    li.append(a, el("span", null, `${c.sha.slice(0, 7)} / ${ago(c.date)}`));
    return li;
  }));

  const body = host.querySelector("[data-repo-readme]");
  if (readme) {
    // GitHub's rendering pipeline already sanitises README HTML; this only lands inside the panel.
    // It is parsed in an inert document first, so relative links and images can be pointed at the
    // repository before anything loads (as written they would resolve against this site).
    const doc = new DOMParser().parseFromString(readme, "text/html");
    const branch = info.default_branch;
    const resolve = (url, raw) => {
      if (!url || /^(https?:|data:|mailto:|#)/i.test(url)) return url;
      if (url.startsWith("//")) return `https:${url}`;
      if (url.startsWith("/")) return `https://github.com${url}`;
      const path = url.replace(/^\.\//, "");
      return raw ? `https://raw.githubusercontent.com/${repo}/${branch}/${path}` : `https://github.com/${repo}/blob/${branch}/${path}`;
    };
    // the panel is dark: charts drawn for dark mode are the ones to show
    doc.querySelectorAll("picture").forEach((pic) => {
      const dark = pic.querySelector('source[media*="dark"]'), img = pic.querySelector("img");
      if (dark && img) { img.setAttribute("src", dark.getAttribute("srcset").split(/\s/)[0]); pic.querySelectorAll("source").forEach((x) => x.remove()); }
    });
    doc.querySelectorAll("source[srcset]").forEach((x) => x.setAttribute("srcset", resolve(x.getAttribute("srcset"), true)));
    doc.querySelectorAll("img[src]").forEach((img) => {
      img.setAttribute("src", resolve(img.getAttribute("src"), true));
      img.loading = "lazy";
      if (!img.getAttribute("alt")) img.alt = `Image from the ${info.name} README`;
    });
    doc.querySelectorAll("a[href]").forEach((a) => {
      a.setAttribute("href", resolve(a.getAttribute("href"), false));
      if (!a.getAttribute("href").startsWith("#")) { a.target = "_blank"; a.rel = "noopener"; }
    });
    // the page already has its h1 and section h2s: step README headings down two levels
    doc.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
      const level = Math.min(6, Number(h.tagName[1]) + 2);
      const next = doc.createElement(`h${level}`);
      next.className = `readme-h${h.tagName[1]}`;
      next.append(...h.childNodes);
      h.replaceWith(next);
    });
    body.replaceChildren(...[...doc.body.childNodes].map((n) => document.adoptNode(n)));
  }
}
