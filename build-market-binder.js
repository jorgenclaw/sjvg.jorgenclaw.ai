// Builds the printable market-table binder (8.5 x 11 in, home inkjet) from
// public/catalog/data/products.json — the same data as the product pages.
//
//   node build-market-binder.js [<out-dir>]
//
// Writes <out-dir>/sheets/*.html, pdf/*.pdf (one per sheet),
// preview/*.png and SJVG-market-binder.pdf (every sheet, in binder order).
// The binder ends with the four Sovereignty by Design flyers, printed from their
// own HTML in the SbD flyers folder.
// Needs google-chrome, qrencode, pdfunite, pdfinfo and pdftoppm on the PATH.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PUBLIC = path.join(__dirname, 'public');
const SITE = 'https://sjvg.jorgenclaw.ai';
// The bottle labels' print sheets (batch-<label>.html) live in the marketing folder.
const LLC = path.join(process.env.HOME, 'NanoClaw/groups/main/Jorgenclaw.ai_LLC');
const MARKETING = path.join(LLC, 'San Joaquin Victory Gardens/hydrosol_and_oils_marketing');
const FLYERS = path.join(LLC, 'Sovereignty by Design/flyers');
const OUT = path.resolve(process.argv[2] || path.join(MARKETING, 'market-binder'));

const all = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'catalog/data/products.json'), 'utf8'));
const bySlug = Object.fromEntries(all.map(p => [p.slug, p]));
// In-stock first (catalog order), then what's coming.
const inStockFirst = list => [...list.filter(p => p.availability === 'In stock'),
                              ...list.filter(p => p.availability !== 'In stock')];
const products = all.filter(p => p.category === 'hydrosol');
const ordered = inStockFirst(products);
const oils = inStockFirst(all.filter(p => p.category === 'essential_oil'));
const isOil = p => p.category === 'essential_oil';
// Not distilled at volume yet: listed as one line on the price page until its lab analysis is back.
const COMING_OIL_LINE = { name: 'African Blue Basil Essential Oil', when: 'Coming June 2027, after lab testing' };

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const img = p => 'file://' + path.join(PUBLIC, p);              // site path -> local file
const botanical = p => p.botanical.replace(/\s*\([^)]*\)\s*$/, '');
const btcPrice = p => (p.price_usd * (1 - (p.btc_discount_pct || 0) / 100)).toFixed(2);
const comingText = p => p.availability.replace(/^Expected available /, 'Coming ');
const shortName = p => p.name.replace(/ (Hydrosol|Essential Oil)$/, '');

// Renders one label from the bottle print sheet, exactly as printed, to OUT/labels/<label>.png.
// Label cell on the sheet is 3.79 x 1.894 in; drawn at 4x for a crisp print.
function renderLabel(p) {
  const name = path.basename(p.image, '.png');
  const src = path.join(MARKETING, `batch-${name}.html`);
  const png = path.join(OUT, 'labels', `${name}.png`);
  const tmp = path.join(OUT, 'labels', `.${name}.html`);
  const html = fs.readFileSync(src, 'utf8')
    .replace('<head>', `<head><base href="file://${MARKETING}/">`)
    .replace('</style>', `  .sheet { display: block; height: auto; }
  .label { box-sizing: border-box; width: 3.79in; height: 1.894in; border: none; border-radius: 0; }
  .label ~ .label { display: none; }
</style>`);
  fs.writeFileSync(tmp, html);
  execFileSync('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files',
    '--hide-scrollbars', '--force-device-scale-factor=4', '--window-size=364,182', '--virtual-time-budget=5000',
    `--screenshot=${png}`, 'file://' + tmp], { stdio: 'ignore' });
  fs.unlinkSync(tmp);
  return png;
}

// Printed on every product sheet's footer; the catalog links to each product page.
const CATALOG_ADDR = 'sjvg.jorgenclaw.ai/catalog';
// Payment details Scott confirmed on 2026-09-29. Check with him before changing them: customers pay into these.
const PAY = {
  // Cropped from Scott's Zelle PDF (payment/scott-zelle-qr-source.pdf).
  zelleQr: path.join(MARKETING, 'payment/zelle-qr.png'),
  lightning: 'scott@jorgenclaw.ai',
  silentPayment: 'sp1qqdlm5jjcxtx8l3pkjz7atw3j0jkxp339mk6w89hhpmc82ny96wj6jqmu6zqm6wxycn8nnnf2q5q6mx3jdat00tvs4vlhk3ux7wnc38urd5lxafs7',
};

function qr(url) {
  const svg = execFileSync('qrencode', ['-t', 'SVG', '-m', '0', '-l', 'M', '--rle', '-o', '-', url], { encoding: 'utf8' });
  return svg.slice(svg.indexOf('<svg')).replace(/ width="[^"]*" height="[^"]*"/, '');
}

const CONTACT = {
  phone: '(209) 684-0510',
  signal: 'Scott.Jorgensen.51',
  email: 'hello@jorgenclaw.ai',
};

const CSS = `
@page { size: letter; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --ink: #2b2b1f; --soft: #4a4a38; --olive: #6b6b4f; --amber: #9a6a16;
  --cream: #fbf7ec; --line: #ddd3b8; --leaf: #5d6b3a;
}
html, body { background: #fff; }
body { font-family: Georgia, 'Times New Roman', serif; color: var(--ink);
       -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sheet { width: 8.5in; height: 11in; padding: 0.45in 0.5in 0.4in; display: flex; flex-direction: column;
         page-break-after: always; overflow: hidden; }
.kicker { font-size: 8pt; letter-spacing: 0.2em; text-transform: uppercase; color: var(--olive); }
.h2 { font-size: 14pt; font-weight: 700; margin-bottom: 0.08in; display: flex; align-items: center; gap: 0.1in; }
.h2::after { content: ''; flex: 1; border-bottom: 1px solid var(--line); }
.sans { font-family: 'Helvetica Neue', Arial, sans-serif; }

/* Cream panel with the faded engraving behind it — the label look */
.panel { position: relative; isolation: isolate; overflow: hidden; background: var(--cream);
         border: 1px solid var(--line); border-radius: 12px; flex: none; }
.panel-art { position: absolute; inset: 0; z-index: -1; width: 100%; height: 100%; object-fit: cover;
             opacity: 0.16; filter: grayscale(1) sepia(0.45) contrast(0.85) brightness(1.25); }

/* Product hero */
.hero { display: grid; grid-template-columns: 1.1fr 1fr; gap: 0.3in; align-items: center; padding: 0.28in 0.32in 0.24in; }
.name { font-size: 25pt; line-height: 1.1; font-weight: 700; margin: 0.06in 0 0.04in; }
.bot { font-style: italic; color: var(--olive); font-size: 12pt; margin-bottom: 0.14in; }
.lede { font-style: italic; font-size: 11.5pt; line-height: 1.5; color: #3a3a2c; }
.photo { margin: 0; position: relative; }
.photo img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 8px; display: block;
             box-shadow: 0 2px 10px rgba(60, 50, 20, 0.18); }
.credit { font-size: 6.5pt; color: #8a8a70; margin-top: 0.05in; }
.grown { display: flex; gap: 0.08in; align-items: baseline; margin-top: 0.14in; font-size: 9.5pt; color: var(--leaf); line-height: 1.4; }
.grown::before { content: '❧'; font-size: 11pt; }
.coming { position: absolute; top: 0.12in; left: 0.12in; background: var(--cream); padding: 0.05in 0.14in; border: 1.5px solid var(--amber);
          border-radius: 999px; color: var(--amber); font-size: 9pt; letter-spacing: 0.12em; text-transform: uppercase; }

/* At a glance */
.glance { display: grid; grid-template-columns: repeat(4, 1fr); margin: 0.16in 0 0.14in;
          border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.tile { padding: 0.11in 0.12in; }
.tile + .tile { border-left: 1px solid var(--line); }
.tile-k { display: block; font-size: 7pt; letter-spacing: 0.16em; text-transform: uppercase; color: var(--amber); margin-bottom: 0.04in; }
.tile-v { font-size: 9.5pt; line-height: 1.35; }

.about { font-size: 10.5pt; line-height: 1.55; color: var(--soft); margin-bottom: 0.14in; }

.mid { display: grid; grid-template-columns: 1fr 2.9in; gap: 0.3in; margin-bottom: 0.12in; }
.uses { list-style: none; display: grid; gap: 0.07in; }
.uses li { font-size: 10.5pt; padding-left: 0.22in; position: relative; line-height: 1.35; }
.uses li::before { content: '❧'; position: absolute; left: 0; top: -0.01in; color: var(--leaf); font-size: 11pt; }
.label-box { text-align: center; }
.label-img { width: 100%; aspect-ratio: 2 / 1; display: block; margin: 0 auto; border: 1px solid var(--line);
             border-radius: 4px; box-shadow: 0 1px 6px rgba(60, 50, 20, 0.2); }
.cap { font-size: 7.5pt; color: var(--olive); margin-top: 0.06in; font-style: italic; }

.bottom { margin-top: auto; display: grid; grid-template-columns: 1fr 3.05in; gap: 0.3in; align-items: end; }
.try { background: var(--cream); border: 1px solid var(--line); border-left: 3px solid var(--amber); border-radius: 10px; padding: 0.16in 0.2in; }
.try-k { font-size: 7.5pt; letter-spacing: 0.16em; text-transform: uppercase; color: var(--amber); margin-bottom: 0.06in; }
.try-t { font-size: 11pt; font-style: italic; line-height: 1.45; }
.pairs { display: flex; gap: 0.16in; }
.pair { width: 1.2in; }
.pair img { width: 1.2in; height: 0.8in; object-fit: cover; border-radius: 6px; display: block; }
.pair-n { font-size: 8.5pt; font-weight: 700; margin-top: 0.05in; line-height: 1.2; }
.pair-b { font-size: 7pt; font-style: italic; color: var(--olive); }
.qr { display: flex; gap: 0.14in; align-items: center; padding: 0.12in; border: 1px solid var(--line); border-radius: 10px; }
.qr svg { width: 0.95in; height: 0.95in; flex: none; }
.qr-t { font-size: 10pt; font-weight: 700; line-height: 1.25; }
.qr-u { font-size: 6.5pt; color: var(--olive); margin-top: 0.05in; word-break: break-all; }

.foot { margin-top: 0.12in; padding-top: 0.08in; border-top: 1px solid var(--line); display: grid;
        grid-template-columns: 1fr auto 1fr; gap: 0.2in; font-size: 7.5pt; color: var(--olive); }
.foot-c { text-align: center; font-size: 9pt; font-weight: 700; color: var(--ink, #2b2b1f); letter-spacing: 0.02em; }
.foot-r { text-align: right; }

/* Cover */
.cover-top { padding: 0.55in 0.5in 0.45in; text-align: center; }
.cover-title { font-size: 38pt; line-height: 1.05; font-weight: 700; margin: 0.12in 0 0.14in; }
.cover-sub { font-style: italic; font-size: 13pt; color: var(--soft); max-width: 5.4in; margin: 0 auto; line-height: 1.45; }
.rule-orn { color: var(--leaf); font-size: 14pt; margin: 0.14in 0 0; }
.grid9 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.16in; margin: 0.3in 0 0.2in; }
.g { position: relative; }
.g img { width: 100%; height: 1.2in; object-fit: cover; border-radius: 8px; display: block; }
.g-n { font-size: 10pt; font-weight: 700; margin-top: 0.05in; }
.g-s { font-size: 7.5pt; letter-spacing: 0.1em; text-transform: uppercase; color: var(--amber); }
.cover-line { text-align: center; font-size: 11pt; color: var(--soft); margin-bottom: 0.1in; }
.credits { font-size: 6pt; color: #9a9a82; line-height: 1.4; margin-top: 0.1in; }

/* Info pages */
.page-head { padding: 0.35in 0.4in 0.3in; }
.page-title { font-size: 28pt; font-weight: 700; margin-top: 0.06in; }
.page-lede { font-size: 12pt; font-style: italic; line-height: 1.5; color: var(--soft); margin-top: 0.1in; max-width: 6.2in; }
.section { margin-top: 0.26in; }
.body { font-size: 10.5pt; line-height: 1.55; color: var(--soft); }
.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.2in; margin-top: 0.1in; }
.step-n { width: 0.34in; height: 0.34in; border-radius: 50%; border: 1.5px solid var(--amber); color: var(--amber);
          display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11pt; margin-bottom: 0.08in; }
.step-t { font-weight: 700; font-size: 10.5pt; margin-bottom: 0.03in; }
table.cmp { width: 100%; border-collapse: collapse; margin-top: 0.1in; font-size: 10pt; }
.cmp th, .cmp td { text-align: left; padding: 0.08in 0.1in; border-bottom: 1px solid var(--line); vertical-align: top; line-height: 1.4; }
.cmp th { font-size: 7.5pt; letter-spacing: 0.14em; text-transform: uppercase; color: var(--amber); font-weight: 400; }
.cmp td:first-child { font-weight: 700; width: 1.3in; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3in; }
table.prices { width: 100%; border-collapse: collapse; margin-top: 0.08in; }
.prices td, .prices th { padding: 0.075in 0.08in; border-bottom: 1px solid var(--line); font-size: 10.5pt; text-align: left; }
.prices th { font-size: 7.5pt; letter-spacing: 0.14em; text-transform: uppercase; color: var(--amber); font-weight: 400; }
.prices td.num, .prices th.num { text-align: right; white-space: nowrap; }
.prices .soon td { color: #8a8a70; }
.soon-when { display: block; font-size: 7.5pt; letter-spacing: 0.08em; text-transform: uppercase; color: var(--amber); }
.pay { display: grid; grid-template-columns: 0.6fr 1fr 1fr 1fr; align-items: start; gap: 0.16in; margin-top: 0.1in; }
.pay div { border: 1px solid var(--line); border-radius: 10px; padding: 0.12in; text-align: center; }
.pay b { display: block; font-size: 12pt; }
.pay span { font-size: 8.5pt; color: var(--olive); }
.pay .btc { border-color: var(--amber); }
.pay svg, .pay-qr { display: block; width: 0.95in; height: 0.95in; margin: 0.08in auto 0.05in; }
.pay-lg svg, .pay-lg .pay-qr { width: 1.35in; height: 1.35in; }
.pay-a { font-size: 5.5pt; color: var(--olive); word-break: break-all; line-height: 1.3; }
.contact { font-size: 11pt; line-height: 1.8; }
.contact b { display: inline-block; width: 0.8in; font-weight: 700; }
.bigqr { display: flex; gap: 0.2in; align-items: center; }
.bigqr svg { width: 1.05in; height: 1.05in; flex: none; }

/* Essential-oil sheets: dilution box where the hydrosol sheets show the label */
table.dil { width: 100%; border-collapse: collapse; font-size: 9pt; text-align: left; }
.dil td { padding: 0.05in 0.04in; border-bottom: 1px solid var(--line); vertical-align: top; line-height: 1.3; }
.dil td:first-child { font-weight: 700; white-space: nowrap; }
.dil td:last-child { color: var(--soft); }
.safety { margin-top: 0.08in; font-size: 8.5pt; line-height: 1.4; color: var(--soft); text-align: left;
          border-left: 3px solid var(--amber); padding-left: 0.1in; }
.safety b { color: var(--ink); }

/* Cover with two product rows */
.cover-k { text-align: center; margin-top: 0.22in; }
.grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.16in; margin: 0.1in 0 0; }
.grid4 img { height: 1.1in; }
.grid5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.12in 0.14in; margin: 0.1in 0 0; }
.grid5 img { height: 0.85in; }
.grid4 .g-n, .grid5 .g-n { font-size: 9pt; line-height: 1.2; }
.grid5 .g-s { font-size: 6.5pt; }
.also { margin-top: 0.18in; text-align: center; font-size: 9.5pt; color: var(--soft); font-style: italic; }
.also b { font-style: normal; color: var(--ink); }

/* Price page */
.note-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3in; margin-top: 0.1in; }
.prices .line td { font-style: italic; }

/* Sovereignty by Design divider: same palette as the SbD flyers */
.sbd { padding: 0; }
.sbd-head { background: #1a2332; color: #fff; padding: 0.5in 0.55in 0.4in; }
.sbd-k { font-family: 'DejaVu Sans Mono', monospace; font-size: 9pt; letter-spacing: 0.2em; text-transform: uppercase; color: #d69e2e; }
.sbd-t { font-family: Arial, sans-serif; font-size: 34pt; font-weight: 700; line-height: 1.05; margin: 0.1in 0 0.12in; }
.sbd-s { font-family: Arial, sans-serif; font-size: 13pt; line-height: 1.45; color: #d6dbe4; max-width: 6.2in; }
.sbd-body { padding: 0.35in 0.55in 0; font-family: Arial, sans-serif; color: #2d3748; display: flex; flex-direction: column; flex: 1; }
.sbd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.2in; }
.sbd-card { border: 1px solid #e2e6ed; border-top: 4px solid #1a2332; border-radius: 8px; padding: 0.18in 0.2in; }
.sbd-n { font-family: 'DejaVu Sans Mono', monospace; font-size: 7.5pt; letter-spacing: 0.14em; text-transform: uppercase; color: #b7791f; }
.sbd-card h3 { font-size: 15pt; margin: 0.05in 0 0.06in; color: #1a2332; }
.sbd-card p { font-size: 10pt; line-height: 1.45; color: #5c6577; }
.sbd-p { font-family: 'DejaVu Sans Mono', monospace; font-size: 16pt; font-weight: 700; color: #1a2332; margin-top: 0.1in; }
.sbd-p span { font-family: Arial, sans-serif; font-size: 8.5pt; font-weight: 400; color: #5c6577; }
.sbd-notes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.2in; margin-top: 0.25in; font-size: 9.5pt; line-height: 1.45; color: #5c6577; }
.sbd-notes b { color: #2d3748; }
.sbd-foot { margin-top: auto; background: #d69e2e; color: #1a2332; padding: 0.22in 0.55in; font-family: Arial, sans-serif;
            display: flex; justify-content: space-between; align-items: center; }
.sbd-qr { display: flex; align-items: center; gap: 0.14in; font-family: 'DejaVu Sans Mono', monospace; font-size: 8.5pt; font-weight: 700; }
.sbd-qr svg { width: 0.9in; height: 0.9in; background: #fff; padding: 4px; border-radius: 4px; }
.sbd-foot b { font-size: 16pt; display: block; margin-bottom: 0.04in; }
.sbd-foot span { font-size: 11pt; font-weight: 700; margin-right: 0.35in; }
`;

function doc(title, body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${CSS}</style></head><body>${body}</body></html>`;
}

function footer(right, center = '') {
  return `<div class="foot"><span>San Joaquin Victory Gardens · Manteca, California</span><span class="foot-c">${center}</span><span class="foot-r">${right}</span></div>`;
}

// Drops assume about 20 drops per mL. 1 tablespoon = 15 mL, so 3 drops = 1%.
// Lemongrass ("strong") is citral-rich and kept under the 0.7% skin maximum.
const DILUTION = {
  standard: [['Face', '3 drops per tablespoon of carrier oil (1%)'],
             ['Body', '6 drops per tablespoon of carrier oil (2%)'],
             ['Diffuser', '3–5 drops in the water']],
  strong: [['Skin', '1 drop per 2 teaspoons of carrier oil, no more'],
           ['Diffuser', '2–3 drops in the water']],
};

function dilutionBox(p) {
  return `<div>
      <h2 class="h2">How much to use</h2>
      <table class="dil">${DILUTION[p.dilution || 'standard'].map(([k, v]) => `<tr><td>${k}</td><td>${esc(v)}</td></tr>`).join('')}</table>
      <p class="safety"><b>Never use it undiluted on skin.</b> ${esc(p.safety)}</p>
    </div>`;
}

function productSheet(p) {
  const url = `${SITE}${p.detail_html}`;
  const pairs = (p.pairs_with || []).map(s => bySlug[s]).filter(Boolean).slice(0, 3);
  const soon = p.availability !== 'In stock';
  return `<section class="sheet">
  <header class="panel hero">
    <img class="panel-art" src="${img(p.art)}" alt="">
    <div>
      <p class="kicker">San Joaquin Victory Gardens</p>
      <h1 class="name">${esc(p.name)}</h1>
      <p class="bot">${esc(botanical(p))}</p>
      <p class="lede">${esc(p.description)}</p>
      <p class="grown">Grown on our SJVG garden and farmed lands in Manteca, California, and steam-distilled by us.</p>
    </div>
    <figure class="photo">
      ${soon ? `<span class="coming sans">${esc(comingText(p))}</span>` : ''}
      <img src="${img(p.photo)}" alt="${esc(p.photo_alt)}">
      <figcaption class="credit sans">Photo: ${esc(p.photo_credit)}, ${esc(p.photo_license)}, via Wikimedia Commons</figcaption>
    </figure>
  </header>

  <section class="glance">
    <div class="tile"><span class="tile-k sans">Scent</span><span class="tile-v">${esc(p.scent)}</span></div>
    <div class="tile"><span class="tile-k sans">Distilled from</span><span class="tile-v">${esc(p.distilled_from)}</span></div>
    <div class="tile"><span class="tile-k sans">Aromatic character</span><span class="tile-v">${esc(p.key_aromatics)}</span></div>
    <div class="tile"><span class="tile-k sans">Bottle</span><span class="tile-v">${esc(p.page_size || p.size)}</span></div>
  </section>

  <h2 class="h2">About this ${isOil(p) ? 'oil' : 'hydrosol'}</h2>
  <p class="about">${esc(p.description_full)}</p>

  <div class="mid">
    <div>
      <h2 class="h2">Ways to use it</h2>
      <ul class="uses">${p.uses.map(u => `<li>${esc(u)}</li>`).join('')}</ul>
    </div>
    ${isOil(p) ? dilutionBox(p) : `<div class="label-box">
      <h2 class="h2">Look for this label</h2>
      <img class="label-img" src="file://${renderLabel(p)}" alt="${esc(p.name)} label">
      <p class="cap">The label on the bottle</p>
    </div>`}
  </div>

  <div class="bottom">
    <div>
      ${pairs.length ? `<h2 class="h2">Pairs well with</h2>
      <div class="pairs">${pairs.map(q => `
        <div class="pair"><img src="${img(q.photo)}" alt="">
          <p class="pair-n">${esc(q.name)}</p><p class="pair-b">${esc(botanical(q))}</p></div>`).join('')}
      </div>` : ''}
    </div>
    ${p.try_this ? `<div class="try"><p class="try-k sans">Try this</p><p class="try-t">${esc(p.try_this)}</p></div>` : ''}
  </div>
  ${footer(`${CONTACT.phone} · ${CONTACT.email}`, CATALOG_ADDR)}
</section>`;
}

const coverTile = p => `
    <div class="g"><img src="${img(p.photo)}" alt="">
      <p class="g-n">${esc(shortName(p))}</p>
      <p class="g-s sans">${p.availability === 'In stock' ? 'Available now' : esc(comingText(p))}</p></div>`;

function coverSheet() {
  const credits = ordered.map(p => `${shortName(p)}: ${p.photo_credit} (${p.photo_license})`).join(' · ');
  return `<section class="sheet">
  <header class="panel cover-top">
    <img class="panel-art" src="${img(bySlug['phenomenal-lavender-hydrosol'].art)}" alt="">
    <p class="kicker">Grown and steam-distilled in Manteca, California</p>
    <h1 class="cover-title">San Joaquin<br>Victory Gardens</h1>
    <p class="cover-sub">Essential oil distillery, beehive products, and more from our garden in Manteca, California.</p>
    <p class="rule-orn">❦</p>
  </header>
  <p class="kicker cover-k">Our essential oils</p>
  <div class="grid4">${oils.map(coverTile).join('')}
  </div>
  <p class="kicker cover-k">Our hydrosols</p>
  <div class="grid5">${ordered.map(coverTile).join('')}
  </div>
  <p class="cover-line" style="margin-top:0.2in;">Essential oils in 15 mL amber glass bottles · Hydrosols in 4 oz. amber glass spray bottles<br>Pure and steam-distilled, nothing added</p>
  <p class="also">Also in this binder: <b>Sovereignty by Design</b>, privacy setup for your home network, phone, bitcoin and computer.</p>
  <div style="margin-top:auto;">
    <p class="credits sans">Plant photos via Wikimedia Commons — ${esc(credits)}.</p>
    ${footer(`${CONTACT.phone} · ${CONTACT.email}`, CATALOG_ADDR)}
  </div>
</section>`;
}

function hydrosolSheet() {
  return `<section class="sheet">
  <header class="panel page-head">
    <img class="panel-art" src="${img(bySlug['rosemary-hydrosol'].art)}" alt="">
    <p class="kicker">San Joaquin Victory Gardens</p>
    <h1 class="page-title">What is a hydrosol?</h1>
    <p class="page-lede">A hydrosol is the fragrant water that comes out of a steam still along with a plant's essential oil.
      It carries the plant's water-soluble aromatic compounds at a much gentler strength than the oil, so it can go
      straight onto skin, linens, or into lotions and sprays without diluting.</p>
  </header>

  <div class="section">
    <h2 class="h2">How we make it</h2>
    <div class="steps">
      <div><div class="step-n">1</div><p class="step-t">Harvest</p>
        <p class="body">Fresh plants from our SJVG garden and farmed lands go into the still: peel, leaves, stalks or flowers.</p></div>
      <div><div class="step-n">2</div><p class="step-t">Steam</p>
        <p class="body">Steam passes through the plants and carries their aromatic compounds up and out of the still.</p></div>
      <div><div class="step-n">3</div><p class="step-t">Condense</p>
        <p class="body">The steam cools back into liquid. The essential oil separates out, and the fragrant water left behind is the hydrosol.</p></div>
    </div>
  </div>

  <div class="section">
    <h2 class="h2">Hydrosol or essential oil?</h2>
    <table class="cmp">
      <tr><th></th><th>Hydrosol</th><th>Essential oil</th></tr>
      <tr><td>What it is</td><td>The fragrant water from the still</td><td>The oil that separates from that water</td></tr>
      <tr><td>Strength</td><td>Gentle and softly scented</td><td>Highly concentrated</td></tr>
      <tr><td>How to use</td><td>Straight from the bottle, no diluting</td><td>A few drops, usually diluted first</td></tr>
    </table>
  </div>

  <div class="section two">
    <div>
      <h2 class="h2">Ways people use them</h2>
      <ul class="uses">
        <li>Facial toner after cleansing</li>
        <li>Water swap in lotions and creams</li>
        <li>A lift for clay masks</li>
        <li>Room and linen spray</li>
      </ul>
      <p class="body" style="margin-top:0.1in;">Each product sheet lists the best uses for that plant.</p>
    </div>
    <div>
      <h2 class="h2">Care</h2>
      <p class="body">Shake well. Keep out of direct sunlight. Refrigeration extends shelf life, but it isn't required.</p>
      <h2 class="h2" style="margin-top:0.18in;">What's inside</h2>
      <p class="body">100% pure hydrosol. No fillers, no synthetic fragrance, no preservatives added.
        Every batch is a little different in scent and color, the natural result of small-batch distilling.</p>
    </div>
  </div>

  <p class="body" style="margin-top:auto;font-style:italic;text-align:center;">For cosmetic and household use only.</p>
  ${footer(`${CONTACT.phone} · ${CONTACT.email}`)}
</section>`;
}

function oilSheet() {
  return `<section class="sheet">
  <header class="panel page-head">
    <img class="panel-art" src="${img(bySlug['white-sage-hydrosol'].art)}" alt="">
    <p class="kicker">San Joaquin Victory Gardens</p>
    <h1 class="page-title">Using essential oils safely</h1>
    <p class="page-lede">An essential oil is the small layer of oil that floats on top of the water coming out of the still.
      It is the same run that makes our hydrosols, but the oil holds the plant's aromatic compounds at full strength.
      A single drop is strong, so a 15 mL bottle (about 300 drops) lasts a long time.</p>
  </header>

  <div class="section two">
    <div>
      <h2 class="h2">How much to use</h2>
      <table class="cmp">
        <tr><th>For</th><th>Drops</th></tr>
        <tr><td>Face</td><td>3 drops per tablespoon of carrier oil (1%)</td></tr>
        <tr><td>Body &amp; massage</td><td>6 drops per tablespoon of carrier oil (2%)</td></tr>
        <tr><td>Bath</td><td>5 drops, mixed into a tablespoon of carrier oil or bath salts first</td></tr>
        <tr><td>Diffuser</td><td>3–5 drops in the water</td></tr>
      </table>
      <p class="body" style="margin-top:0.1in;">Carrier oils are plain plant oils such as jojoba, sweet almond, olive or fractionated coconut.
        Lemongrass is stronger on skin: no more than 1 drop per 2 teaspoons of carrier oil.</p>
    </div>
    <div>
      <h2 class="h2">Safety</h2>
      <ul class="uses">
        <li>Always dilute before it touches skin.</li>
        <li>Patch-test a little on your inner arm and wait a day.</li>
        <li>Do not swallow. Keep away from eyes.</li>
        <li>Keep out of reach of children and pets. Cats are especially sensitive.</li>
        <li>Pregnant, nursing, or managing a health condition? Ask your doctor first.</li>
        <li>Essential oils can catch fire. Keep them away from open flame.</li>
      </ul>
    </div>
  </div>

  <div class="section two">
    <div>
      <h2 class="h2">Care</h2>
      <p class="body">Keep the cap tight and the bottle in a cool, dark place. Most oils keep their scent for 2 to 3 years.
        Citrus-scented oils like lemongrass are best used within a year or two.</p>
    </div>
    <div>
      <h2 class="h2">What's inside</h2>
      <p class="body">100% pure, steam-distilled essential oil from plants we grow in Manteca. Nothing added, nothing cut.
        Every small batch smells a little different.</p>
    </div>
  </div>

  <p class="body" style="margin-top:auto;font-style:italic;text-align:center;">For aromatic and external use only. Not intended to diagnose, treat, cure or prevent any disease.</p>
  ${footer(`${CONTACT.phone} · ${CONTACT.email}`)}
</section>`;
}

function priceRows(list) {
  return list.map(p => {
    const soon = p.availability !== 'In stock';
    const priced = p.price_usd != null;
    return `<tr class="${soon ? 'soon' : ''}"><td>${esc(p.name)}${soon ? `<span class="soon-when sans">${esc(comingText(p))}</span>` : ''}</td><td>${esc(p.size)}</td>
      <td class="num">${priced ? `$${p.price_usd}` : 'Price at release'}</td>
      <td class="num">${priced ? `$${btcPrice(p)}` : ''}</td></tr>`;
  }).join('');
}

function pricesSheet() {
  return `<section class="sheet">
  <header class="panel page-head">
    <img class="panel-art" src="${img(bySlug['valencia-orange-hydrosol'].art)}" alt="">
    <p class="kicker">San Joaquin Victory Gardens</p>
    <h1 class="page-title">Prices</h1>
    <p class="page-lede">Pay in bitcoin and save ${products[0].btc_discount_pct}%. Ways to pay and how to order are on the next page.</p>
  </header>

  <div class="section">
    <h2 class="h2">Hydrosols</h2>
    <table class="prices">
      <tr><th>Hydrosol</th><th>Size</th><th class="num">Price</th><th class="num">Paying in bitcoin</th></tr>
      ${priceRows(ordered)}
    </table>
    <p class="body" style="margin-top:0.08in;">Ask about 8 oz. refills.</p>
  </div>

  <div class="section">
    <h2 class="h2">Essential oils</h2>
    <table class="prices">
      <tr><th>Essential oil</th><th>Size</th><th class="num">Price</th><th class="num">Paying in bitcoin</th></tr>
      ${priceRows(oils)}
      <tr class="soon line"><td colspan="4">${esc(COMING_OIL_LINE.name)}<span class="soon-when sans">${esc(COMING_OIL_LINE.when)}</span></td></tr>
    </table>
    <p class="body" style="margin-top:0.08in;">Essential oils are concentrated. See "Using essential oils safely" before you use them.</p>
  </div>

  <div style="margin-top:auto;">${footer('sjvg.jorgenclaw.ai', CATALOG_ADDR)}</div>
</section>`;
}

function orderSheet() {
  const catalog = `${SITE}/catalog/`;
  const pct = products[0].btc_discount_pct;
  return `<section class="sheet">
  <header class="panel page-head">
    <img class="panel-art" src="${img(bySlug['lemongrass-hydrosol'].art)}" alt="">
    <p class="kicker">San Joaquin Victory Gardens</p>
    <h1 class="page-title">How to order &amp; pay</h1>
    <p class="page-lede">Cash and Zelle pay the listed price. Pay in bitcoin and save ${pct}%.</p>
  </header>

  <div class="section">
    <h2 class="h2">Ways to pay</h2>
    <div class="pay pay-lg">
      <div><b>Cash</b><span>Listed price</span></div>
      <div><b>Zelle</b><span>Listed price</span><img class="pay-qr" src="file://${PAY.zelleQr}" alt="Zelle QR code"><p class="pay-a sans">Scott Jorgensen · scan in your banking app</p></div>
      <div class="btc"><b>Lightning</b><span>Bitcoin · save ${pct}%</span>${qr(`lightning:${PAY.lightning}`)}<p class="pay-a sans">${PAY.lightning}</p></div>
      <div class="btc"><b>On-chain</b><span>Bitcoin silent payments · save ${pct}%</span>${qr(PAY.silentPayment)}<p class="pay-a sans">${PAY.silentPayment}</p></div>
    </div>
  </div>

  <div class="section two">
    <div>
      <h2 class="h2">Order anytime</h2>
      <div class="bigqr">${qr(catalog)}
        <div><p class="body">Buy here at the table today, or order later from our online catalog.
          Local pickup or hand delivery in the Manteca, CA area.</p>
          <p class="qr-t" style="margin-top:0.06in;">Scan for the online catalog</p><p class="qr-u sans">${CATALOG_ADDR}</p></div></div>
    </div>
    <div>
      <h2 class="h2">Get in touch</h2>
      <p class="contact"><b>Phone</b>${CONTACT.phone}<br><b>Signal</b>${CONTACT.signal}<br><b>Email</b>${CONTACT.email}</p>
      <p class="body" style="margin-top:0.1in;">Questions, orders, or want to learn more? Reach out.</p>
    </div>
  </div>

  <div style="margin-top:auto;">
    <div class="try" style="margin-bottom:0.1in;"><p class="try-k sans">Also from jorgenclaw.ai, LLC</p>
      <p class="try-t">Sovereignty by Design: privacy setup for your home network, phone, bitcoin and computer, done in person.
        See the back of this binder, or just ask.</p></div>
    ${footer('sjvg.jorgenclaw.ai')}
  </div>
</section>`;
}

// SbD "from" prices. Keep in step with the four flyers in FLYERS.
const SBD = [
  ['1 of 4', 'Home Network Security', 'A firewall and router you own, with guests and smart-home gadgets walled off from your computers.', 'From $905', 'hardware at cost + setup'],
  ['2 of 4', 'Private Phone Setup', 'GrapheneOS on your own Pixel, with your apps, accounts and banking set up and tested.', '$250', 'flat, up to 2 hrs'],
  ['3 of 4', 'Bitcoin Self-Custody', 'Your own wallet, plus exchange, node or Bisq setup if you want them, all at your kitchen table.', 'From $150', 'add-ons à la carte'],
  ['4 of 4', 'Private AI & Computing', 'Your own private AI agent, matched to the hardware you already have.', 'From $375', 'flat, up to 2.5 hrs'],
];
const SBD_SITE = 'https://sovereignty.jorgenclaw.ai';
const SBD_FLYERS = ['home-network-security-flyer', 'mobile-privacy-flyer', 'bitcoin-privacy-flyer-v2', 'computer-ai-privacy-flyer-v2'];

function sbdSheet() {
  return `<section class="sheet sbd">
  <header class="sbd-head">
    <p class="sbd-k">Also from jorgenclaw.ai, LLC</p>
    <h1 class="sbd-t">Sovereignty by Design</h1>
    <p class="sbd-s">Hardware-privacy services, installed in person, in your home. You watch every step and leave knowing how your setup works.</p>
  </header>
  <div class="sbd-body">
    <div class="sbd-grid">${SBD.map(([n, t, d, p, s]) => `
      <div class="sbd-card"><p class="sbd-n">${n}</p><h3>${esc(t)}</h3><p>${esc(d)}</p>
        <p class="sbd-p">${p} <span>${esc(s)}</span></p></div>`).join('')}
    </div>
    <div class="sbd-notes">
      <div><b>Flat, not hourly.</b> Each service includes the hours on its flyer; extra time is $150/hr.</div>
      <div><b>Hardware at cost</b>, no markup. Hardware prices are moving fast in 2026, so we confirm them when we quote.</div>
      <div><b>Bundle &amp; save 10%</b> when you add another service to the same visit.</div>
    </div>
    <p class="body" style="margin-top:0.3in;text-align:center;font-family:Arial,sans-serif;">The four flyers that follow have the details for each service.</p>
  </div>
  <footer class="sbd-foot"><div><b>Book a walkthrough</b><span>${CONTACT.email}</span><span>${CONTACT.phone}</span></div>
    <div class="sbd-qr">${qr(SBD_SITE)}<p>Scan for details<br>&amp; booking</p></div></footer>
</section>`;
}

// Sheet numbers shift when products are added, so clear the old ones out first.
for (const d of ['sheets', 'pdf', 'preview']) fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
for (const d of ['sheets', 'pdf', 'preview', 'labels']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
const pages = [
  ['cover', 'Cover', coverSheet()],
  ['prices', 'Prices', pricesSheet()],
  ['how-to-order', 'How to order & pay', orderSheet()],
  ['what-is-a-hydrosol', 'What is a hydrosol?', hydrosolSheet()],
  ...ordered.map(p => [p.slug, p.name, productSheet(p)]),
  ['using-essential-oils', 'Using essential oils safely', oilSheet()],
  ...oils.map(p => [p.slug, p.name, productSheet(p)]),
  ['sovereignty-by-design', 'Sovereignty by Design', sbdSheet()],
  ...SBD_FLYERS.map(f => [`sbd-${f.replace(/-v\d+$/, '')}`, null, path.join(FLYERS, f + '.html')]),
];
const num = i => String(i + 1).padStart(2, '0');

const chrome = (url, pdf, extra = []) => execFileSync('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox',
  '--allow-file-access-from-files', '--no-pdf-header-footer', '--virtual-time-budget=5000', ...extra,
  `--print-to-pdf=${pdf}`, url], { stdio: 'ignore' });

const pdfs = [];
pages.forEach(([name, title, body], i) => {
  const file = `${num(i)}-${name}`;
  const pdf = path.join(OUT, 'pdf', file + '.pdf');
  if (title === null) {
    // An SbD flyer, printed from its own HTML. Its Google Fonts are blocked on purpose: the approved
    // flyers were laid out with the fallback fonts, and the web fonts push the footer onto a second page.
    chrome(new URL('file://' + body).href, pdf,
      ['--host-resolver-rules=MAP fonts.googleapis.com ~NOTFOUND, MAP fonts.gstatic.com ~NOTFOUND']);
  } else {
    const html = path.join(OUT, 'sheets', file + '.html');
    fs.writeFileSync(html, doc(title, body));
    chrome('file://' + html, pdf);
  }
  const n = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' }).match(/Pages:\s+(\d+)/)[1];
  if (n !== '1') throw new Error(`${file} runs to ${n} pages; it must fit on one`);
  execFileSync('pdftoppm', ['-png', '-r', '60', '-singlefile', pdf, path.join(OUT, 'preview', file)]);
  pdfs.push(pdf);
  console.log('built', file);
});
execFileSync('pdfunite', [...pdfs, path.join(OUT, 'SJVG-market-binder.pdf')]);
console.log('wrote', path.join(OUT, 'SJVG-market-binder.pdf'));
