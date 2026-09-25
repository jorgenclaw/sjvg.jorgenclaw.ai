// Builds /catalog/products/<slug>/index.html from public/catalog/data/products.json.
//
//   node build-product-pages.js                 # every product that has the page fields
//   node build-product-pages.js <slug> [<slug>] # just these
//
// A product needs `scent`, `distilled_from`, `key_aromatics`, `uses` and `art`
// to get the new page; products without them keep their hand-written page.
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, 'public');
const products = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'catalog/data/products.json'), 'utf8'));
const bySlug = Object.fromEntries(products.map(p => [p.slug, p]));
const CSS_VERSION = '2026-09-25';

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const hasPageFields = p => ['scent', 'distilled_from', 'key_aromatics', 'uses', 'art'].every(k => p[k]);

function priceBlock(p) {
  const btc = (p.price_usd * (1 - (p.btc_discount_pct || 0) / 100)).toFixed(2);
  const inStock = p.availability === 'In stock';
  return `
        <p class="pd-price">$${p.price_usd} <span class="pd-size">· ${esc(p.size)}</span></p>
        ${p.btc_discount_pct ? `<p class="pd-btc">$${btc} when you pay in bitcoin (${p.btc_discount_pct}% off)</p>` : ''}
        ${inStock
          ? `<button class="pd-add" id="detail-add-btn">Add to Cart</button>`
          : `<button class="pd-add" disabled>${esc(p.availability)}</button>`}
        <p class="pd-fine">Local pickup or hand delivery, Manteca, CA area. Cash, Zelle, or bitcoin.</p>`;
}

function pairsBlock(p) {
  const pairs = (p.pairs_with || []).map(s => bySlug[s]).filter(Boolean);
  if (!pairs.length) return '';
  return `
    <section class="pd-section">
      <h2 class="pd-h2">Pairs well with</h2>
      <div class="pd-pairs">
        ${pairs.map(q => `
        <a class="pd-pair" href="${esc(q.detail_html)}">
          <img src="${esc(q.photo)}" alt="${esc(q.photo_alt)}" loading="lazy">
          <span class="pd-pair-name">${esc(q.name)}</span>
          <span class="pd-pair-bot">${esc(q.botanical.replace(/\s*\([^)]*\)\s*$/, ''))}</span>
        </a>`).join('')}
      </div>
    </section>`;
}

function page(p) {
  const botanical = p.botanical.replace(/\s*\([^)]*\)\s*$/, '');
  const metaDesc = p.description_full.length > 160 ? p.description_full.slice(0, 157).replace(/\s+\S*$/, '') + '…' : p.description_full;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(p.name)} — San Joaquin Victory Gardens</title>
  <meta name="description" content="${esc(metaDesc)}">
  <meta property="og:title" content="${esc(p.name)}">
  <meta property="og:description" content="${esc(p.description)}">
  <meta property="og:image" content="https://sjvg.jorgenclaw.ai${esc(p.photo)}">
  <link rel="stylesheet" href="/catalog/style.css?v=${CSS_VERSION}">
  <link rel="stylesheet" href="/catalog/product.css?v=${CSS_VERSION}">
</head>
<body>
  <div class="container pd">

    <nav class="nav">
      <a href="/">Home</a>
      <a href="/catalog/">Catalog</a>
      <a href="https://jorgenclaw.ai">jorgenclaw.ai</a>
    </nav>

    <a class="detail-back" href="/catalog/">← Back to Catalog</a>

    <header class="pd-hero">
      <img class="pd-hero-art" src="${esc(p.art)}" alt="">
      <div class="pd-hero-text">
        <p class="pd-brand">San Joaquin Victory Gardens</p>
        <h1 class="pd-name">${esc(p.name)}</h1>
        <p class="pd-botanical">${esc(botanical)}</p>
        <p class="pd-lede">${esc(p.description)}</p>
        ${priceBlock(p)}
      </div>
      <figure class="pd-photo">
        <img src="${esc(p.photo)}" alt="${esc(p.photo_alt)}">
        <figcaption>Photo: <a href="${esc(p.photo_source)}" target="_blank" rel="noopener">${esc(p.photo_credit)}</a>, ${esc(p.photo_license)}</figcaption>
      </figure>
    </header>

    <section class="pd-glance" aria-label="At a glance">
      <div class="pd-tile"><span class="pd-tile-k">Scent</span><span class="pd-tile-v">${esc(p.scent)}</span></div>
      <div class="pd-tile"><span class="pd-tile-k">Distilled from</span><span class="pd-tile-v">${esc(p.distilled_from)}</span></div>
      <div class="pd-tile"><span class="pd-tile-k">Aromatic character</span><span class="pd-tile-v">${esc(p.key_aromatics)}</span></div>
      <div class="pd-tile"><span class="pd-tile-k">Bottle</span><span class="pd-tile-v">${esc(p.page_size || p.size)}</span></div>
    </section>

    <section class="pd-section">
      <h2 class="pd-h2">Ways to use it</h2>
      <ul class="pd-uses">
        ${p.uses.map(u => `<li>${esc(u)}</li>`).join('\n        ')}
      </ul>
    </section>

    <section class="pd-section">
      <h2 class="pd-h2">About this hydrosol</h2>
      <p class="pd-body">${esc(p.description_full)}</p>
    </section>

    <section class="pd-section pd-details">
      <details open>
        <summary>Technical note</summary>
        <p>${esc(p.technical_note)}</p>
      </details>
      <details>
        <summary>Ingredients</summary>
        <p>100% pure hydrosol. No fillers, no synthetic fragrance, no preservatives added.</p>
      </details>
      <details>
        <summary>Care</summary>
        <p>Shake well. Keep out of direct sunlight.</p>
      </details>
      <details>
        <summary>What is a hydrosol?</summary>
        <p>A hydrosol is the fragrant water that comes out of a steam still along with a plant's essential oil. It carries the plant's water-soluble aromatic compounds at a much gentler strength than the oil, so it can go straight onto skin, linens, or into recipes without diluting.</p>
      </details>
    </section>
${pairsBlock(p)}

    <section class="consult-section">
      <h2>Get in Touch</h2>
      <p>Questions? Reach out.</p>
      <ul>
        <li><strong>Phone:</strong> <a href="tel:+12096840510">(209) 684-0510</a></li>
        <li><strong>Email:</strong> <a href="mailto:hello@jorgenclaw.ai">hello@jorgenclaw.ai</a></li>
      </ul>
    </section>

  </div>

  <script>
  const slug = '${p.slug}';
  let cart = JSON.parse(localStorage.getItem('sjvg-cart') || '[]');
  const btn = document.getElementById('detail-add-btn');
  if (btn) {
    const show = () => {
      const item = cart.find(i => i.slug === slug);
      if (item) { btn.textContent = 'In Cart (' + item.qty + ')'; btn.classList.add('added'); }
    };
    show();
    btn.addEventListener('click', () => {
      const existing = cart.find(i => i.slug === slug);
      if (existing) existing.qty += 1; else cart.push({ slug, qty: 1 });
      localStorage.setItem('sjvg-cart', JSON.stringify(cart));
      show();
    });
  }
  </script>
</body>
</html>
`;
}

const wanted = process.argv.slice(2);
const targets = wanted.length ? wanted.map(s => bySlug[s] || (() => { throw new Error('unknown slug ' + s); })()) : products.filter(hasPageFields);
for (const p of targets) {
  if (!hasPageFields(p)) throw new Error(p.slug + ' is missing page fields');
  const dir = path.join(PUBLIC, 'catalog/products', p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(p));
  console.log('built', p.slug);
}
