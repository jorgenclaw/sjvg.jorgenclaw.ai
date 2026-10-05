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
const CSS_VERSION = '2026-09-29';

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PAGE_CATEGORIES = ['hydrosol', 'essential_oil'];
const hasPageFields = p => PAGE_CATEGORIES.includes(p.category) && ['scent', 'distilled_from', 'key_aromatics', 'uses', 'art'].every(k => p[k]);
const detailHref = p => p.detail_html || `/catalog/products/${p.slug}/`;

// The parts of the page that differ between a hydrosol and an essential oil.
const KIND = {
  hydrosol: {
    about: 'About this hydrosol',
    ingredients: '100% pure hydrosol. No fillers, no synthetic fragrance, no preservatives added.',
    care: "Shake well. Keep out of direct sunlight. Refrigeration extends shelf life, but it isn't required.",
    whatIs: ['What is a hydrosol?', "A hydrosol is the fragrant water that comes out of a steam still along with a plant's essential oil. It carries the plant's water-soluble aromatic compounds at a much gentler strength than the oil, so it can go straight onto skin, linens, or into recipes without diluting."],
  },
  essential_oil: {
    about: 'About this oil',
    ingredients: '100% pure essential oil. No fillers, no carrier oil, no synthetic fragrance.',
    care: 'Keep the cap tight and the bottle out of heat and direct sunlight. Keep out of reach of children and pets. Essential oils are flammable: keep away from open flame.',
    whatIs: ['What is an essential oil?', "An essential oil is the concentrated aromatic oil a plant gives off in a steam still. It floats on top of the hydrosol and is collected separately. It is many times stronger than a hydrosol, so dilute it in a carrier oil before it goes on skin (see How much to use), and never take it by mouth."],
  },
};

// Same table as the market binder's oil sheets (build-market-binder.js); keep them in step.
// Drops assume about 20 drops per mL. 1 tablespoon = 15 mL, so 3 drops = 1%.
// Lemongrass ("strong") is citral-rich and kept under the 0.7% skin maximum.
const DILUTION = {
  standard: [['Face', '3 drops per tablespoon of carrier oil (1%)'],
             ['Body', '6 drops per tablespoon of carrier oil (2%)'],
             ['Diffuser', '3–5 drops in the water']],
  strong: [['Skin', '1 drop per 2 teaspoons of carrier oil, no more'],
           ['Diffuser', '2–3 drops in the water']],
};

function priceBlock(p) {
  if (p.price_usd == null) return `
        <p class="pd-price">Price at release <span class="pd-size">· ${esc(p.size)}</span></p>
        <button class="pd-add" disabled>${esc(p.availability)}</button>
        <p class="pd-fine">Local pickup or hand delivery, Manteca, CA area. Cash, Zelle, or bitcoin.</p>`;
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
        <a class="pd-pair" href="${esc(detailHref(q))}">
          <img src="${esc(q.photo)}" alt="${esc(q.photo_alt)}" loading="lazy">
          <span class="pd-pair-name">${esc(q.name)}</span>
          <span class="pd-pair-bot">${esc(q.botanical.replace(/\s*\([^)]*\)\s*$/, ''))}</span>
        </a>`).join('')}
      </div>
    </section>`;
}

function page(p) {
  const kind = KIND[p.category];
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
      ${p.try_this ? `<aside class="pd-try"><p class="pd-try-k">Try this</p><p class="pd-try-t">${esc(p.try_this)}</p></aside>` : ''}
    </section>

    <section class="pd-section">
      <h2 class="pd-h2">${kind.about}</h2>
      <p class="pd-body">${esc(p.description_full)}</p>
    </section>

    <section class="pd-section pd-details">
      ${p.category === 'essential_oil' ? `<details open>
        <summary>How much to use</summary>
        <ul>${DILUTION[p.dilution || 'standard'].map(([k, v]) => `<li><strong>${k}:</strong> ${esc(v)}</li>`).join('')}</ul>
        <p><strong>Never use it undiluted on skin.</strong> ${esc(p.safety || '')}</p>
      </details>
      ` : ''}${p.technical_note ? `<details${p.category === 'essential_oil' ? '' : ' open'}>
        <summary>Technical note</summary>
        <p>${esc(p.technical_note)}</p>
      </details>
      ` : ''}<details>
        <summary>Ingredients</summary>
        <p>${kind.ingredients}</p>
      </details>
      <details>
        <summary>Care</summary>
        <p>${esc(kind.care)}</p>
      </details>
      <details>
        <summary>${kind.whatIs[0]}</summary>
        <p>${esc(kind.whatIs[1])}</p>
      </details>
    </section>
${pairsBlock(p)}

    <section class="consult-section">
      <h2>Get in Touch</h2>
      <p>Questions? Reach out.</p>
      <ul>
        <li><strong>Phone:</strong> <a href="tel:+12096840510">(209) 684-0510</a></li>
        <li><strong>Signal:</strong> Scott.Jorgensen.51</li>
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
