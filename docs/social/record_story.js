const { chromium } = require('playwright');
const W = 1200, H = 760;
const BASE = process.env.GW_BASE || 'http://localhost:4321';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const GREEN = [14.9755, 120.6341]; // Slope protection, Pampanga — construction visible
const RED = [14.7744, 120.7815];   // Revetment, Paombong, Bulacan — no construction visible
const SHOWCASE = [14.85, 120.78];  // Central Luzon cluster for the radar beat

const STYLE = `
#story-ov, #story-cap { font-family: var(--font-body-stack); }
#story-ov {
  position: fixed; inset: 0; z-index: 100000;
  background: #0b0e0f;
  background-image:
    linear-gradient(rgba(230,237,234,0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(230,237,234,0.045) 1px, transparent 1px);
  background-size: 56px 56px;
  opacity: 0; transition: opacity 0.55s ease; pointer-events: none;
}
#story-ov.show { opacity: 1; }
#story-ov .mark {
  position: absolute; top: 46px; left: 9%;
  display: flex; align-items: center; gap: 11px;
  font-family: var(--font-mono-stack); font-size: 14px; letter-spacing: 0.2em;
  text-transform: uppercase; color: var(--color-text-primary);
}
#story-ov .body { position: absolute; left: 9%; right: 9%; top: 50%; transform: translateY(-50%); }
.story-label { font-family: var(--font-mono-stack); font-size: 15px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-accent); margin-bottom: 22px; }
.story-h { font-family: var(--font-display-stack); font-weight: 800; font-size: 64px; line-height: 1.05; color: var(--color-text-primary); letter-spacing: -0.015em; }
.story-h .a { color: var(--color-accent); }
.story-h .r { color: var(--color-ghost); }
.story-sub { font-family: var(--font-body-stack); font-size: 23px; color: var(--color-text-muted); margin-top: 24px; max-width: 760px; }
.story-url { font-family: var(--font-mono-stack); font-size: 30px; color: var(--color-accent); margin-top: 30px; }
.story-fine { font-family: var(--font-mono-stack); font-size: 13px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--color-text-muted); margin-top: 16px; }
.corner { position: absolute; width: 13px; height: 13px; }
.corner::before, .corner::after { content: ""; position: absolute; background: rgba(45,212,191,0.5); }
.corner::before { left: 0; top: 6px; width: 13px; height: 1px; }
.corner::after { left: 6px; top: 0; width: 1px; height: 13px; }
.c-tl { top: 44px; left: calc(9% - 26px); } .c-tr { top: 44px; right: 44px; }
.c-bl { bottom: 44px; left: calc(9% - 26px); } .c-br { bottom: 44px; right: 44px; }
#story-cap {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 99000;
  padding: 70px 8% 30px;
  background: linear-gradient(to top, rgba(7,10,11,0.96) 32%, rgba(7,10,11,0.0));
  opacity: 0; transition: opacity 0.4s ease; pointer-events: none;
}
#story-cap.show { opacity: 1; }
#story-cap .dot { display: inline-block; width: 11px; height: 11px; border-radius: 50%; margin-right: 12px; vertical-align: middle; }
.cap-text { font-family: var(--font-display-stack); font-weight: 700; font-size: 33px; color: var(--color-text-primary); letter-spacing: -0.005em; vertical-align: middle; }
`;

const MARK = `<span style="display:flex;align-items:center;gap:11px">
  <svg width="20" height="20" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="none" stroke="#2dd4bf" stroke-width="1.2"/><line x1="9" y1="0" x2="9" y2="18" stroke="#2dd4bf" stroke-width="1"/><line x1="0" y1="9" x2="18" y2="9" stroke="#2dd4bf" stroke-width="1"/></svg>
  Tulay Pinoy</span>`;
const CORNERS = `<div class="corner c-tl"></div><div class="corner c-tr"></div><div class="corner c-bl"></div><div class="corner c-br"></div>`;

const HOOK = `<div class="mark">${MARK}</div>${CORNERS}
  <div class="body">
    <div class="story-label">Satellite verification of public works</div>
    <div class="story-h">21,356 completed<br>flood-control projects.</div>
    <div class="story-sub">All reported complete. Checked against free satellite imagery.</div>
  </div>`;
const CLOSE = `<div class="mark">${MARK}</div>${CORNERS}
  <div class="body">
    <div class="story-label">21,356 completed projects, assessed</div>
    <div class="story-h">549 visible.<br>480 not.</div>
    <div class="story-url">tulaypinoy.ph</div>
    <div class="story-fine">Open source · free satellite data</div>
  </div>`;

async function glide(page, x1, y1, x2, y2, steps) {
  for (let i = 1; i <= steps; i++) { const t = i / steps; await page.mouse.move(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t); await sleep(13); }
}
// Wait for the Wayback comparison: tiles actually rendered + the auto-wipe intro
// (pos 0.5 -> 0.8 -> 0.22 -> 0.5, ~1.6s) settled so the handle is back at center.
async function waitWayback(page) {
  await page.waitForSelector('[role=dialog] .leaflet-container', { timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => {
    const c = document.querySelector('[role=dialog] .leaflet-container');
    if (!c) return false;
    return c.querySelectorAll('img.leaflet-tile-loaded').length >= 8;
  }, null, { timeout: 11000 }).catch(() => {});
  await sleep(850); // auto-wipe settle + final tile paint
}
// Move the before/after divider by grabbing the real handle ([role=slider]).
// Only the initial press must hit the handle; after that the cursor drives `pos`
// (and map dragging is disabled inside the handler, so the basemap never pans).
async function wipe(page) {
  const handle = await page.$('[role=dialog] [role=slider]');
  if (!handle) return;
  const hb = await handle.boundingBox();
  const box = await page.evaluate(() => { const c = document.querySelector('[role=dialog] .leaflet-container'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.x, w: r.width, cy: r.y + r.height / 2 }; });
  if (!hb || !box) return;
  const hx = hb.x + hb.width / 2, hy = hb.y + hb.height / 2;
  const cy = box.cy, R = box.x + box.w * 0.86, L = box.x + box.w * 0.14, mid = box.x + box.w * 0.5;
  await page.mouse.move(hx, hy);
  await page.mouse.down();
  await glide(page, hx, hy, R, cy, 20); await sleep(320); // reveal older
  await glide(page, R, cy, L, cy, 28); await sleep(360);  // reveal newer
  await glide(page, L, cy, mid, cy, 16);                  // back to split
  await page.mouse.up();
}
async function flyClick(page, latlng, zoom, settle = 1300) {
  await page.evaluate(([c, z]) => new Promise((res) => {
    const m = window.__gwmap; let done = false; const fin = () => { if (!done) { done = true; res(); } };
    m.once('moveend', () => setTimeout(fin, 350)); setTimeout(fin, 4500);
    m.setView(c, z, { animate: true, duration: 1.0 });
  }), [latlng, zoom]);
  await sleep(settle);
  const t = await page.evaluate((c) => { const m = window.__gwmap; const pt = m.latLngToContainerPoint(c); const r = m.getContainer().getBoundingClientRect(); return { x: Math.round(r.left + pt.x), y: Math.round(r.top + pt.y) }; }, latlng);
  for (const [dx, dy] of [[0, 0], [0, -3], [3, 0], [-3, 0], [0, 3], [6, 0], [-6, 0], [0, 6], [9, 0]]) {
    await page.mouse.click(t.x + dx, t.y + dy); await sleep(360);
    if (await page.$('[role=dialog]')) return true;
  }
  return false;
}
const showCard = (page, html) => page.evaluate((h) => { const o = document.getElementById('story-ov'); o.innerHTML = h; o.classList.add('show'); }, html);
const hideCard = (page) => page.evaluate(() => document.getElementById('story-ov').classList.remove('show'));
const showCap = (page, text, color) => page.evaluate(({ text, color }) => { const c = document.getElementById('story-cap'); c.innerHTML = `<span class="dot" style="background:${color}"></span><span class="cap-text">${text}</span>`; c.classList.add('show'); }, { text, color });
const hideCap = (page) => page.evaluate(() => document.getElementById('story-cap').classList.remove('show'));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: '/tmp/storyvid', size: { width: W, height: H } } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/map/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: STYLE });
  await page.evaluate(() => { for (const id of ['story-ov', 'story-cap']) { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); } });

  // Show the hook immediately so the map load happens behind it (no dead air).
  const tHook = Date.now();
  await showCard(page, HOOK);
  await page.waitForFunction(() => !!window.__gwmap, null, { timeout: 20000 });
  await page.waitForFunction(async () => { try { const r = await fetch('/data/projects.json'); const d = await r.json(); return d.data.features.length > 1000; } catch { return false; } }, null, { timeout: 20000 });
  await page.evaluate((c) => window.__gwmap.setView(c, 11, { animate: false }), SHOWCASE);
  await sleep(650); // let the cluster + pings paint behind the card
  await sleep(Math.max(400, 2900 - (Date.now() - tHook)));
  await hideCard(page);
  await sleep(650);

  // Radar beat: pings sweep the cluster as the method line reads.
  await showCap(page, 'Sentinel-2 imagery, every site, from space.', '#2dd4bf');
  await sleep(2200);
  await hideCap(page);
  await sleep(250);

  // Proof 1 — construction visible. Wait for the imagery, then wipe the divider.
  if (await flyClick(page, GREEN, 16)) {
    await waitWayback(page);
    await showCap(page, 'Construction visible.', '#3fb950');
    await sleep(500);
    await wipe(page);
    await sleep(500);
    await hideCap(page);
    await page.keyboard.press('Escape'); await sleep(400);
  }

  // Proof 2 — a completed project with none.
  if (await flyClick(page, RED, 16)) {
    await waitWayback(page);
    await showCap(page, 'No construction visible.', '#f0533f');
    await sleep(500);
    await wipe(page);
    await sleep(500);
    await hideCap(page);
    await page.keyboard.press('Escape'); await sleep(400);
  }

  // Close
  await showCard(page, CLOSE);
  await sleep(2900);

  await ctx.close(); await browser.close(); console.log('story done');
})().catch(e => { console.error(e.message); process.exit(1); });
