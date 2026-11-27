# Tanmay Kaper portfolio

Personal portfolio for Tanmay Kaper, presenting two sides of their work: **analysis** (economics and academic papers) and **expression** (creative and digital work). The Framer version lives at https://tanmaykaper.framer.website/. It was captured in full on 2026-10-05 and is the baseline: we continue from it rather than starting over.

Everything captured is in [`_capture/`](_capture/): content, original media, custom component source and the parsing tools.

## The code version (current)

Hand-built static site, with no framework and no Node required.

- **Build:** `python3 tools/build.py` turns `src/` into `site/`.
  - Templates use `{{var}}`, `{{> partial}}` and `{{roll:text}}`.
  - JS ships in a content-hashed folder (`assets/js-<hash8>/`) and CSS as `site.css?v=<hash>`. Relative ES-module imports drop query strings, so the folder name itself busts the cache.
- **Preview:** run `python3 -m http.server 4322` from `site/`, then open http://localhost:4322.
- **Smooth scroll:** Lenis 1.3.26, self-hosted in `src/assets/js/vendor/`, with lerp 0.055, wheel multiplier 0.7 and touch multiplier 0.9.
- **Motion:** one frame loop in `src/assets/js/core/scroll.js` drives every scroll and pointer effect, using damping maths in the style of clevir.li. Components load per page from data attributes (see `main.js`).
- **Tools:**
  - `tools/ink_to_alpha.py` turns a drawing on paper into ink on a transparent background (luminance becomes alpha). It produced both Icarus figures. `--flatten 1` fits and divides out uneven light in photographed drawings first.
  - `tools/cdp.py` drives a separate headless Chrome over its DevTools pipe (stdlib only, throwaway profile). Use it to verify timed motion, page transitions and screenshots that the hidden preview pane can't show.
  - `tools/render_social.py` renders `og.jpg` (1200×630) and `apple-touch-icon.png` from the site's own assets and fonts. Rerun it, with the site served on 4322, after a brand change.
  - `tools/docx_to_html.py paper.docx <slug>` turns a Word paper into `src/content/papers/<slug>.html` (headings, lists, tables, captions, code) and copies its charts to `img/papers/<slug>/` as PNG. sips' AVIF encoder blanked some charts, so charts stay PNG. Hand edits after conversion: the drone appendix code was re-indented (Word lost it) and four typos in the media report were fixed. Re-running the tool overwrites both.
  - `tools/intro_frames.py` picks the Creatives loader's photos (every project in turn, featured image first, then every other gallery image, 10 at most), writes 400px thumbnails to `img/work/intro/` and their sizes to `src/content/intro.json`. Rerun it after adding gallery images.
- **SEO:**
  - Per-page titles (60 characters or fewer) and descriptions (160 or fewer; placeholders are never shipped), `og:type` article for papers, and an author tag.
  - JSON-LD: WebSite and Person (home), ProfilePage (about), ScholarlyArticle (papers), CollectionPage with ItemList (academics, creatives), and BreadcrumbList on every sub page.
  - The 404 page is `noindex`.
  - `robots.txt` is always written. `sitemap.xml`, absolute `og:image` and canonical links appear once `url` is set in `site.json`.
  - Every image has descriptive alt text. Gallery alts live in `creative.json` (`galleryAlts`, `videoLabel`). The ASCII portrait canvas is `role="img"` with a label.
  - Pages have one `<h1>` each, and README headings in the GitHub panel are stepped down two levels.
- **Page transitions:**
  - Cross-document View Transitions (`@view-transition`, Chrome/Edge 126+, Safari 18.2+). Other browsers, and reduced motion, get a plain page load.
  - The card you pick flies from the home spread into its page's hero and back. Names sit on the `.card` links, so the grayscale filter is part of the snapshot.
  - A head script listens for `pagereveal` and lifts the returning card above the deck.
  - Everything else passes through cloud: the old page drifts forward into a bright haze and the new one settles out of it.

### Round 8 (2026-10-29): performance, legibility, new work, hosting
- **Performance:** every component writes styles only when a value changes (`setStyle` in `core/scroll.js`) and measures layout on resize/load only (`onLayout`). The sky moves by transform instead of repainting `background-position`; the cat, flight path and console no longer force a layout per frame; the ASCII portrait draws its field once and sleeps off screen; blurred mist clouds no longer bob; grain moves on the compositor; live backdrop blur is off on touch screens. Measured at 4x CPU throttle, main-thread busy share at idle fell 31% to 15% (home), 36% to 2% (tech), 17% to 2% (academics), 10% to 2% (creatives). Lenis is tuned to lerp 0.09 / wheel 0.9 so scrolling no longer trails the hand.
- **Legibility (contrast never bends):** glass tiles, record items and pills are now "frost" (`--frost`) with navy ink; small text on the day sky is navy; the home statement is a navy serif manifesto at 40ch; body text is 16px; nothing under 12px. Every sub page ends at dusk behind its footer.
- **Fixes:** README images and links on Tech project pages now point at the repo (were broken relative paths), with session caching of GitHub responses; 38px sideways scroll at 1024 (project glow); dial arrow over the stack list at tablet widths; flight-path labels now lie down after the line passes (they piled up on phones) and long papers use `shortTitle`; Lenis no longer swallows wheel scrolling inside the README panel.
- **New work:** Kinda Jeety (creative.json `youtube` list; thumbnails load from YouTube, Play opens the episode). Precomp, an auto-editing model in progress, on both pages: a "dev cart" on the console that plays an LCD editing timeline scrubbed by scroll, and a Tech stop with its own face (serif italic), a timeline glow, an IN PROGRESS stamp and a render-queue status panel instead of a repo.
- **After Awwwards practice:** the logo keeps time (`phase.js`: "STUDIO day / night / dawn / dusk" follows the sky); opt-in synthesised sound (`sound.js`: wind that gusts with scroll speed, dial ticks, console blips; nothing downloaded); the console's d-pad, A, B, Start and Select work, as do the arrow keys; magnetic buttons; paper pages get reading time, contents (sticky beside the sheet at 1400px+) and a reading ring in the Back button; live Bombay time beside "Based in".
- **Hosting (live 2026-11-27):** GitHub Pages at https://studioday.github.io (org `studioday`, repo `studioday/studioday.github.io`); `.github/workflows/deploy.yml` builds and deploys on every push to main. Pages ignores `_headers`/`_redirects` (no CSP header, 10-minute cache; `/about/` still forwards via its page). For a custom domain later, see README. Earlier plan: see the hosting guide (Claude doc). `SITE_URL` env var overrides `site.json` url; the build writes `_headers` (immutable caching, CSP with inline-script hashes), `_redirects`, `site.webmanifest`; `wrangler.jsonc` and `.gitignore` are in the project root. Recommended: Cloudflare Registrar + Workers static assets + Email Routing with Gmail send-as, about US$10.46/year.
- **Needs Tanmay:** prune `youtube` in creative.json to the Kinda Jeety episodes actually edited, add shorts links; confirm Precomp's name (working title) and copy; `src/assets/og 2.jpg` is a Finder duplicate (git-ignored, safe to delete).

### Design direction (agreed 2026-10-05, revised 2026-10-06)
- **One sky world on every page:**
  - The home sky gradient lightens as you scroll, with clouds drifting at different depths. Sub pages use `sky(seed, count, variant)` in `build.py`.
  - Creatives uses the `dusk` variant: blue hour with dimmed clouds.
  - Each cloud is drawn once, by its bobbing `<i>` child. The span carries the image at size 0, because painting it there too ghosted every cloud.
- **Type (revised 2026-10-06, round 5): Inter Black leads, the serif complements it.**

  | Role | Face | Token |
  |---|---|---|
  | Display, headings, LCD | Inter 900 (Inter Black), tight tracking | `--f-display` / `--f-heavy` |
  | Complement | Instrument Serif, mostly italic | `--f-serif` |
  | Body and labels | Inter 400–700 | `--f-sans` |
  | Doodles and hand notes | Gochi Hand | `--f-hand` |

  The serif's jobs are subtitles, years, eyebrows, the logo's "day", the Back pill, the accent words ("*analysis*", "*expression*") and the crawl's body text. Druk Wide and Outrun were retired to `_capture/retired/`.
- **Project identities (round 7, 2026-10-06):** each tech project has a face and a glow, set in `tech.json` (`face`, `glow.color`, `glow.shape`) and applied through `data-face`:
  - **nsebot:** JetBrains Mono ExtraBold, lowercase, like a trading terminal. Its market-green glow rises diagonally like a chart.
  - **Outbound Sniper:** Big Shoulders Stencil, like a crate stamp. Its red glow is the tight dot of a scope, sitting on the dial's pointer.
  - **All repos:** Inter Black, with a wide lavender haze.
  - The face carries through the dial's preview title and wheel labels, the folder tab and sheet, and the project page's hero title. The glow also sits behind the project page title. Both fonts are OFL and self-hosted.
- **Colour:** one accent, dark navy `--accent: #0f2152` (4.7:1 on the sky), replacing orange. On dark surfaces (the about stage, the dial, the repo panel) the same hue is lifted to `--accent-light: #b4c9ef`.
- **Inspiration:** clevir.li (github.com/mohitvirli/mohitvirli.github.io) for scroll smoothness, depth and the Academics page.
- **No dark mode, on purpose.** The sky's time of day carries meaning (day is analysis, dusk is expression), so a system dark theme would erase it. This breaks the skill's dual-mode rule deliberately.
- **Cards are the navigation. There is no menu.**
  - Home has three cards (since 2026-10-07): King to Academics, Queen to Creatives, Jack to Tech. The Jack flies into the Tech hero. Hovering writes a doodled label.
  - The Ace was removed on 2026-10-07; both versions (circuit heart, ace of spades) are in `_capture/retired/`. The share image and touch icon show the three-card hand and the Jack.
  - Every sub page has a back button in place of the menu. It runs `history.back()` when you arrived from this site, otherwise it goes to the parent page.
  - Every card page shows its card floating in the hero (`.hero-card`). That is where the card lands when it flies in.

### Pages
- **Home (About merged in on 2026-10-07):** one day in the sky, top to bottom.
  - **Morning:** the typewriter greeting ("Hi, I'm Tanmay Kaper.", the page's h1) opens the Icarus scene. The sun is a warm wash of light along the top edge, not a disc. The opening keeps only two small clouds in the lower corners, and the sky's drifting clouds start after the scene (`sky(..., start=0.46, hero=False)`).
    - The scene itself: (`icarus.js`, 480vh pinned). Icarus starts small and whole against the sun above the greeting. As the fall begins, the greeting drifts up and blurs away, then the fall and the kneeling ending play as before (without the "icarus, mid-fall" paper note, removed on 2026-10-08). Reduced motion shows three settled states: the greeting, mid-fall and the ending.
  - **Dawn** (`#deck`): out of the night, through a bank of mist, to the four cards and the "analysis and expression" statement. The Jack now scrolls to `#about` on the same page. Card pages' Back buttons go to `/#deck` when there is no history to return to.
  - **Day** (`#about`): "About me" with the ID card and interest cards, the record (`#record`), the Analysis/Expression/Tech columns, the toolkit and contact.
  - **Dusk:** the old About hero closes the page: the open-for-work bar (Resume points up to the record), the three facts, then the glitchy "tanmay" seen through evening mist. The mist is dimmed clouds plus a haze veil over the foot of the letters, and the doodle cat sits on it with a dusk halo so it reads over the white letters.
    - Since 2026-10-08 there is no badge row: the cloud bank fades into night at the bottom of the section, and the footer links sit on that fade (negative margin, no background of their own; on phones the footer column continues on night).
  - `/about/` forwards to `/#about` (noindex, canonical `/`), and the home page carries the ProfilePage JSON-LD. The old template is in `_capture/retired/about-page.html`.
  - The old 5002px fixed-height scene and its diagonal cloud strips are gone; the sky backdrop is the shared `sky()` world.
- **Academics:**
  - A clevir-style flight path over a canyon of standing clouds. The path ends shortly after the last paper.
  - The card beside the path shows the full research question. Tiles share one grid cell, so the box takes the longest paper's height and stays centred. Long questions or titles, and short screens, step the type down instead of clipping. On phones the card shows the question, not a repeat of the title.
  - "All papers" tiles follow. Papers are ordered by `order` in `papers.json`. Labels for titles over 48 characters step down a size.
  - Four papers since round 7:
    1. *Should India Scale i-Drone?* (Sep 2026), from `Drone_Research_Paper_FINAL.docx`.
    2. *Comparing the Economic Contribution of Broadcasters and Foreign OTT Platforms in India* (Jul 2026), from `India Media Economy Research Report.docx`. Its search title is the shorter `seoTitle`.
    3. The EV paper.
    4. *Transfer of Knowledge*.
  - `abstract` holds the research question (labelled as such on the paper page), and `summary` is the meta description. `figureAlts` fills chart descriptions the Word file lacked.
  - The Sony deck (`Sony Research PPT.pptx`) is the media report's presentation and is not published. It still has template text on slides 2 and 7.
- **Paper pages:** a sky hero with an Inter Black title and a serif-italic year, then the paper as a white sheet.
- **Creatives** (generated from `creative.json`):
  - **Loader** (`intro.js`, after pamidordesign.co):
    - "STUDIO" (Inter Black) and "*day*" (serif italic) rise out of clip-path masks, letter by letter.
    - A window opens between them and flicks through photos from every project every 200ms. Its width follows each photo's shape.
    - The word then lifts away, the screen fades into the dusk, and the title drops.
    - It plays once per browser session. A head script sets `html[data-intro]` before first paint; the session key is `sd-intro`.
    - It is skipped under reduced motion. Any key, click or scroll skips it.
    - It holds scroll and hides the header while it plays. Under it, the queen card and header drop their view-transition names so nothing flies above the screen.
    - A 9-second failsafe clears it if the script never loads.
  - Inline SVG console (`partials/console.html`) with a tall screen and compact controls.
  - It boots to NOW PLAYING. Scrolling goes from menu to loading to gallery to back to the menu for each project.
  - Gallery photos load progressively: the first three warm up during the loading screen, then each frame fetches the next two.
  - Description text (`flow-text.js`) is a Star Wars opening crawl.
    - It sits on a plane hinged at the screen bottom, tilted 36° under a perspective set on the host.
    - Lines arrive full width and readable below the console. They part at their midpoint into two columns around it, with offsets worked out in projected screen space, then recede above it.
    - Titles are in Inter Black and body text in Instrument Serif.
    - On narrow screens lines fade before reaching the console.
  - The orbit in the hero was removed (`orbit.js` is retired).
- **Tech** (`/tech/`, from `tech.json`), with real projects from github.com/tanmaykaper since 2026-10-06:
  - **nsebot** (`tanmaykaper/Paper-Trading-Bot`) and **Outbound Sniper** (`tanmaykaper/Automated-Targeted-Cold-Emailer`). The copy comes only from their READMEs. The two forked curated lists are not featured.
  - A rotary dial after haroonrashidi.com (`dial.js`). It turns by dragging, the arrows, or the arrow keys, and Enter opens the project.
  - The last stop, "All repos", opens the GitHub profile in a new tab.
  - With fewer than five stops, the build repeats the cycle round the wheel like a slot reel, so neighbours stay visible. The counter and screen readers see each stop once.
  - Behind it, the user's portrait redrawn in ASCII ink on a canvas, after eddy-naboulet.dev (`ascii-portrait.js`). The cursor reveals the photo.
    - Since 2026-10-07 it is framed chest-up between the header and the dial (50svh, top 5svh). The dial sits lower (54svh, 740px max) with its arrows out on the wheel's shoulders, so nothing covers the portrait.
    - The reveal tracks the cursor on the whole window, so the title and preview text on its edges no longer block it; over the dial or a control it stays hidden.
  - **The file folder** (`folder.js`) replaces the project tiles below the dial:
    - A navy folder holds one paper sheet per stop, each with an index tab in its project's colour and face.
    - The tabs pop up out of the folder as it scrolls in, and the dial's current project nudges its tab.
    - Clicking a tab pulls the sheet up to show its meta, description, stack and an icon. The page scrolls to make room.
    - Clicking the tab again, the sheet or "Open file" goes to the project. The sheet's title flies into the project page's title (view transition `tech-title`).
    - Escape or a click outside puts the sheet back. Arrow keys move between tabs. Closed sheets are `inert`.
    - Phones show the tagline instead of the long overview.
  - Each project page has an overview, highlights and a GitHub recreation (`github-repo.js`, unauthenticated api.github.com at 60 requests an hour) with stats, languages, the owner's latest five commits and the README.
    - Commits are filtered by owner because scheduled bots outnumber human commits.
    - README headings are stepped down two levels.
- **About:** now part of the home page (see Home). Its Icarus scene, record and collage live there.

### Still needed from Tanmay
- **CV and drone paper disagree:** the CV says the drone CBA verified "an 11.39% wastage reduction and 109.1 benefit-cost ratio". The final paper reports median benefit-cost ratios of 1.69 to 5.63 and recommends against scaling on vaccines alone. Update the CV line. The site uses the paper's figures.
- **KPMG detail:** the record names Sony Pictures Networks India as the client, with the CV's figures. Check KPMG's confidentiality terms allow that on a public site.
- **A downloadable resume** without date of birth, phone or address, if wanted. Set `about.resume` to its URL; it is `#record` for now.
- **Photos for the four interests** (`about.interests[].photo`).
- **A sharper ace of spades photo**, if one exists.
- **Outbound Sniper privacy (raised 2026-10-06):** the public repo commits `state/pipeline.csv` and `state/dispatch_log.jsonl`, which, per its README, hold the names and emails of the people contacted and every email sent. Make the state private, by moving it to a private repo or an Actions artifact and purging it from history, or make the repo private. If the repo goes private, swap its `repo` in `tech.json` for "" so the panel shows the placeholder.
- **Live links** for the tech projects, if any (`live` in `tech.json`).
- **MorF Media's live URL.** morfmedia.framer.website returned 404 on 2026-10-05.
- **Gallery images** for MorF Media and Arnifi. Arnifi only has its logo.
- **PDFs** for "Download paper" and **Graph 1** for the EV paper.
- **Hosting:** where to host the site, and its domain. Once it's set as `url` in `site.json`, the build writes the canonical link, `og:url` and an absolute `og:image`. Share previews need that absolute image URL.

Settled on 2026-10-06: Tanmay confirmed that all licences are in place and that the site is for personal use only. The open items had been the fonts and the Icarus drawing.

## Where the Framer build stood

The site was assembled from the Framer University "Parallax" template (home page and menu), a portfolio template whose metadata still says "CONCRETE" (academic list and paper pages), and **four custom code components Tanmay wrote**: Night Sky, Cursor Orbit, Gameboy Switcher and Cat Easter Egg. The original work is the concept, the content and those components. Much of the rest is still template default.

### The idea already present

- **Home is daytime sky** that lightens as you scroll, with clouds drifting at different parallax depths. The logo is "STUDIO *day*".
- **Creative is night sky**: stars, a moon glow, orbit rings that follow the cursor, and dark clouds rolling in.
- **Academic is near-black**, editorial and type-led.
- **Tagline:** "experiences built in analysis and expression".

Day versus night, analysis versus expression, is the strongest thread to build on. A hand-held game console that swaps project "cartridges" as you scroll, and three playing cards (Jack, Queen, King), add personality.

## Sitemap

| Route | Status |
|---|---|
| `/` | Live: hero, intro, footer. Mostly empty on mobile. |
| `/academic` | Live, but **not linked from anywhere**. |
| `/academic/the-impact-of-government-intervention-on-demand-for-evs` | Live: the full paper (about 4,400 words, 4 tables). |
| `/academic/transfer-of-knowledge` | Live: the full essay (about 1,800 words). |
| `/creative` | Live, but **not linked from anywhere**. |
| `/creative/:slug` | **Doesn't exist**, although the CMS holds full project data (see Content). |

Menu items in Framer: HOME, WORKS, ABOUT US, CONTACT. All four link to `/`.

## Page specs (measured at 1440 × 900)

### Home (`/`), 5,002px tall
- **Header** (fixed, 68px high, z 10). Left: logo at (20, 26), "STUDIO" in Instrument Sans 500 16px uppercase, tracking -0.64px, followed by "day" in Instrument Serif italic lowercase. Right: "MENU" (Inter 16px uppercase) plus a two-line 30×10 icon at (1390, 29).
- **Layers**
  - Z-1: the sky image `mit3ux6G…png` (original 3840×10240; it renders 2052px wide), absolutely positioned and covering the full page height.
  - Z-2: parallax speed 75. It holds Cloud-1, Cloud-2 and Cloud-3, each a long diagonal track of one cloud PNG repeated, looping linearly over 720s. The x/y offsets are Cloud-1 (-17001, -7929.57), Cloud-2 (-27007, -7929.57, scale 1.1) and Cloud-3 (-37001, -7929.57).
  - Z-3: parallax speed 50.
- **Hero:** a typewriter centred near y 380. Text: "Hi, I'm Tanmay Kaper." in Inter 600 30/33px, white, with a "|" cursor in #999. It loops, uses natural typing delay and pauses 1s.
- **Section - Details**, at y 2000 with parallax speed 110:
  - A fan of three cards (Jack `Dv0g5…`, King `eeuQQ…`, Queen `nsiZf…`), each about 113×140. They're greyscale and turn colour on hover.
  - H2 "EXPERIENCES BUILT IN ANALYSIS AND EXPRESSION": Inter Display 600 24/28.8px, uppercase, tracking -0.48px.
  - Paragraph: Inter 500 16/22.4px, uppercase, centred, about 1,277px wide. It reads: "while not necessarily for the mastery of either, a dabble in both creative digital expression and economic analysis has surrounded the use of my most precious resource. time devoted to exploring the 'why', while the 'how' prevents creative stagnation. / for stagnation equals obsolescence."
- **Empty sky** from about y 2,400 to 4,950.
- **Footer** (56px high, at the bottom):
  - Items: "BUILT FOR KAPER" (x 20), "REACH OUT" (349), the email (638), "IN , LK" (1088) and "BOM, INDIA" (1337). All are Inter 16px uppercase.
  - Hover is a text roll (two stacked copies).
- **Cat Easter Egg**: a 1440×220 band at y 4,662, z 9 (see Components).

### Menu overlay
- Full screen, split in two. The left half is near-black, with links at bottom left in Inter Display 600 72/72px, uppercase, tracking -2.88px.
- On hover, a link swaps to Instrument Serif italic.
- The right half shows a full-height photo that changes per link: HOME `Z7BJR8eY`, WORKS `gXLUxBYj`, ABOUT `nKsstLq1`, CONTACT `qHrL5THw`. All four are template stock.
- The close button reads "CLOSE ✕".

### Academic (`/academic`), 1,041px tall
- Background #0a0a0a. There's **no header or menu**.
- Title "ACADEMIC WORKS": Inter Display 600 100px, centred.
- List rows: title in Inter Display 600 24px uppercase, then subject tags in Inter 12px #8a8a8a. Rows are separated by hairlines.
- Hovering a row shows a 161×121 thumbnail on the right (the paper's featured image).

### Paper page (`/academic/:slug`), CMS template
- **Hero:** H1 in Inter Display 600 100/120px uppercase, centred. Below it, the year in Instrument Serif italic, e.g. "(2024)".
- **Featured image:** full-bleed, 1440×1080.
- **Abstract and Subject:** H2 Inter Display 24px plus Inter 500 16px uppercase, centred in an 800px column. A "/-/" divider follows.
- **Body** (800px column at x 320):
  - h2 headings in Satoshi Bold.
  - h3 in Satoshi Bold 22/28.6px, white.
  - p in Satoshi Medium 20/30px, #9ba1a5.
  - Tables and italic captions.
- **"Download paper" button.**
- **Next project:** "NEXT PROJECT", the title, then the date in Instrument Serif italic and the featured image.

### Creative (`/creative`), 4,762px tall
- **Background:** the Night Sky component.
- **Hero:** the Cursor Orbit component behind the title "CREATIVE WORKS" in Inter Display 600, uppercase, tracking -0.04em (80px at tablet). The title reveals word by word on load: from blur 10px, scale 0.95 and y 10, a spring lasting 1.8s after a 0.6s delay.
- **Section - Gameboy:** the Gameboy Switcher, sticky across 300vh.
- **Section - Projects:** rows like the academic list. Titles are MORF MEDIA, NIGHTWALK FASHION and ARNIFI, each with its subject tags and a hover thumbnail. Every link goes to `./`.

## Design tokens in use

| Token | Value |
|---|---|
| Ink / dark background | #0a0a0a |
| Text on dark | #ffffff; muted #8a8a8a (tags), #9ba1a5 (body), #999 (cursor) |
| Day sky | the sky image, sampled: #5793c7 (top quarter), #4f8dc3 (middle), #6a9ecb, #87b2d4, then #afc8dc at the bottom |
| Night sky | top rgb(11,16,38), mid rgb(20,27,61), bottom rgb(30,36,80) |
| Orbit | ring rgba(180,190,255,.35), accent and core rgb(143,179,255) |
| Console | shell rgb(200,202,208), bezel rgb(56,61,74), LCD rgb(155,188,15) |
| Fonts | Inter, Inter Display, Instrument Sans 500, Instrument Serif italic, Satoshi Medium and Bold |
| Motion | springs (stiffness 500, damping 60), (stiffness 400, damping 30) and (0.4s, bounce 0.2); tween 0.4s with ease [.12,.23,.5,1] |

## Custom components (source in `_capture/components/`, compiled from Framer)

- **Night Sky** (`night-sky.js`):
  - A gradient from top to mid to bottom colour.
  - A moon at (99%, 4%), 180px wide, opacity 0.12.
  - 75 seeded stars (seed 1337).
  - Clouds 1-3 (the home cloud PNGs) at darkness 0.4 and opacity 0.5, drifting at speed 60.
  - Cursor parallax of 18.
- **Cursor Orbit** (`cursor-orbit.js`): 3 rings and 2 orbiting bodies, orbit speed 20, parallax strength 30, following the cursor.
- **Gameboy Switcher** (`gameboy-switcher.js`):
  - The console PNG `rM4GAoM0` (1988×3202), with a screen rectangle at top 23%, left 15.5%, width 69% and height 31%.
  - A projects array of {title, subtitle, link}. Cartridge chips travel 160px and stack 14px apart.
  - Sticky across 300vh, with a 0.3s transition between projects.
  - Labels: title in Inter 700 24px, subtitle in Inter 500 14px, button "Play Now".
  - The current data is placeholder: Project One, Experimental Interaction; Project Two, Immersive Product Story; Project Three, Creative Portfolio Build. All links are `#`.
- **Cat Easter Egg** (`cat-easter-egg.js`):
  - Fades in when the cursor is within 180px. It then runs 140px to the right, cycling 2 run frames at 120ms, and is 120px wide. The fade lasts 0.6s, and it respects reduced motion.
  - Props: standingImage, runFrame1 and runFrame2. **These were never set, so it renders "CAT PLACEHOLDER".**

## Content (in `_capture/content/`)

- **Collection `academia.json`** (papers). Fields: title, slug, next paper, year, description (used as the abstract), subject refs, featured image, rich-text content, button link and text, gallery, two video files.
  - *The Impact of Government Intervention on Demand for EVs* (2024, Economics). It asks how effective India's FAME II policy has been. Sections: Introduction, Methodology, Theory, Market Efficiency, Correlation and Cost-Benefit analysis, Evaluation, Conclusion, Limitations, Bibliography. It has 4 tables. **Graph 1 is referred to in the text but was never uploaded.**
  - *Transfer of Knowledge* (May 2024, Philosophy / Business). Prompt: "Do we underestimate the challenges of taking knowledge out of its original context…".
  - Clean HTML of both bodies is in `content/papers/`.
- **Collection `creatives.json`**, with the same fields:
  - **MorF Media** (2026, UI/UX and Web Design): full-stack agency site, hosting and SEO. Link: morfmedia.framer.website. No images.
  - **Nightwalk Fashion** (May 2024, Apparel Design, Instagram Marketing, Web Design, UI/UX): a pan-India D2C graphic apparel brand that broke even within 2 months, run as a sole proprietorship. It has a featured image, **16 gallery images and 1 video**, none of which appear on the live site.
  - **Arnifi** (2026, Video Editing, After Effects, Figma, Premiere Pro): freelance video editing, 3D and kinetic videos. Link: youtube.com/@Arnifi.official, button "View Works". Its only image is the logo.
- **`subjects.json`**: Economics, Philosophy, Business, UI/UX, Web Design, Apparel Design, Instagram Marketing, Video Editing, After Effects, Premiere Pro, Figma, Photoshop, Adobe Illustrator.
- **`site-text.json`**: Framer's search index, holding every page's text.
- **Contact:**
  - Email: tanmay.kaper1401@gmail.com
  - Instagram: instagram.com/kapertanmay
  - LinkedIn: linkedin.com/in/tanmay-k-a344b1226
  - Location: Bombay, India

## Media (in `_capture/media/`)

There are 35 originals (52 MB). [`_capture/media-manifest.json`](_capture/media-manifest.json) labels each file's role, and [`_capture/contact-sheet.html`](_capture/contact-sheet.html) shows them all at once. The real work assets are the sky, the 3 clouds, the 3 cards, the console, the Nightwalk set (featured, 16 gallery images, video) and the Arnifi logo. The 4 menu photos, both paper images, the favicon and the share image are template stock.

## Problems found in the live Framer site

**Broken or misleading. Fix as part of reaching parity:**
1. **Navigation dead ends.** WORKS, ABOUT US and CONTACT all go to `/`. `/academic` and `/creative` can't be reached from the site, and those pages have no header or menu, so there's no way back.
2. **Template author's links in the footer.** "BUILT FOR KAPER" goes to twitter.com/ludoviclosco. "REACH OUT" goes to **a checkout page for the template** on ludoviclosco.lemonsqueezy.com. "Download paper" goes to framer.link/ludoviclosco. The paper's "Next project" link goes to `/`.
3. **Template metadata on every page.** Title "Parallax by Framer University", a description crediting Nandor Muzsik, the "PARALLAX" share image and the template favicon. Paper titles end in "- CONCRETE".
4. **Mobile home is nearly empty.** It's 1,239px tall, with a white band at the top, no hero text and no intro section.
5. **The Cat Easter Egg shows the text "CAT PLACEHOLDER"** because its images were never set.
6. **The console is all placeholder** (Project One/Two/Three, links `#`). Its title overlaps the "Select / Start" labels, and on mobile the labels render twice.
7. **No project pages for creative work**, so Nightwalk's 16 images and video are never shown.

**Quality gaps (improvements):**
- Stock template photos represent the papers and the menu.
- About 2,500px of empty sky sits between the intro and the footer.
- The menu says "ABOUT US" on a personal site.
- "IN" means Instagram, but most people read IN as LinkedIn.
- There's a visible seam where two cloud images meet on /creative.
- The correlation table wraps long decimals onto two lines.
- No alt text, no H1 on home, uppercase body paragraphs, and the "Made in Framer" badge.

## Open decisions (ask before acting)

- **Platform:** keep building in Framer, or move to hand-built code in this folder? This folder assumes code, which means choosing hosting and deciding what happens to the Framer domain.
- **"STUDIO day"**: is it the intended brand, or a template leftover? It pairs well with the day/night idea.
- **Graph 1** for the EV paper, PDFs for "Download paper", the cat sprite images, and real cartridge projects for the console.
