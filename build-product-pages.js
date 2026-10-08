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
const CSS_VERSION = '2026-10-08d';

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PAGE_CATEGORIES = ['hydrosol', 'essential_oil', 'propolis', 'honey'];
// Propolis isn't distilled, so it lists its own "at a glance" tiles in `glance` instead.
const hasPageFields = p => PAGE_CATEGORIES.includes(p.category) &&
  (p.glance ? ['uses', 'art'] : ['scent', 'distilled_from', 'key_aromatics', 'uses', 'art']).every(k => p[k]);
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

KIND.propolis = {
  about: 'About this tincture',
  ingredients: 'Bee propolis, grain alcohol, distilled water. Nothing else.',
  care: 'Shake well before each use. Keep the cap on, and keep the bottle somewhere cool and dark. The alcohol preserves it, so it keeps for years. Flammable: keep away from flame. Keep out of reach of children.',
  whatIs: ['What is propolis?', 'Propolis, sometimes called bee glue, is the sticky resin honeybees collect from tree buds and bark and mix with beeswax. They use it to seal gaps and coat the inside of the hive, where it helps keep the colony clean. A tincture pulls those resins into alcohol so you can take propolis by the drop.'],
};

KIND.honey = {
  about: 'About this honey',
  ingredients: 'Honey. Nothing added: our bees are never fed sugar syrup.',
  care: 'Keep the lid tight and store at room temperature, away from the stove. Do not refrigerate: it speeds up crystallizing. Do not feed honey to infants under 1 year old.',
  whatIs: ['Why we don\'t call it organic', "To label honey organic, a beekeeper has to be able to show that the flowers the bees visited were organically grown. Honeybees fly a few miles in every direction from the hive, over yards, parks and farms nobody can certify, and in town that's impossible to promise. So we don't call ours organic. We tell you exactly what it is instead: honey from our own hives, from bees that are never fed sugar syrup."],
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

// How the product gets to you, from data/shipping.json. Hydrosols and honey can ship; oils and propolis can't yet.
const SHIPPING = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'catalog/data/shipping.json'), 'utf8'));
function fineText(p) {
  const [small, large] = SHIPPING.boxes;
  const pay = 'Cash, Zelle, or bitcoin.';
  const link = ' <a href="/catalog/#shipping">Shipping options</a>.';
  if (p.category === 'hydrosol') return `Pick up or get local delivery in the Manteca area, or ship it by USPS: $${small.price} for 1–2 bottles, $${large.price} for up to 6.${link} ${pay}`;
  if (p.category === 'honey') return `Pick up or get local delivery in the Manteca area, or ship it by USPS to California addresses only: $${small.price} for 1 jar, $${large.price} for 2.${link} ${pay}`;
  return `Pickup or local delivery in the Manteca area only for now: it's flammable, so it can't go by regular mail yet. ${pay}`;
}

function priceBlock(p) {
  if (p.price_usd == null && p.reserve) return `
        <p class="pd-price">Price at release <span class="pd-size">· ${esc(p.size)}</span></p>
        <p class="pd-btc">Ready around ${esc(p.ready)}</p>
        <button class="pd-add" id="detail-add-btn">${esc(p.reserve_label || 'Reserve a bottle')}</button>
        <p class="pd-fine">No payment now: reserve one, and we'll text you when it's ready. ${fineText(p)}</p>`;
  if (p.price_usd == null) return `
        <p class="pd-price">Price at release <span class="pd-size">· ${esc(p.size)}</span></p>
        <button class="pd-add" disabled>${esc(p.availability)}</button>
        <p class="pd-fine">${fineText(p)}</p>`;
  const btc = (p.price_usd * (1 - (p.btc_discount_pct || 0) / 100)).toFixed(2);
  const inStock = p.availability === 'In stock';
  if (!inStock && p.reserve) return `
        <p class="pd-price">$${p.price_usd} <span class="pd-size">· ${esc(p.size)}</span></p>
        ${p.btc_discount_pct ? `<p class="pd-btc">$${btc} when you pay in bitcoin (${p.btc_discount_pct}% off) · Ready around ${esc(p.ready)}</p>` : ''}
        <button class="pd-add" id="detail-add-btn">${esc(p.reserve_label || 'Reserve a bottle')}</button>
        <p class="pd-fine">No payment now: reserve one, and we'll text you when it's ready. ${fineText(p)}</p>`;
  return `
        <p class="pd-price">$${p.price_usd} <span class="pd-size">· ${esc(p.size)}</span></p>
        ${p.btc_discount_pct ? `<p class="pd-btc">$${btc} when you pay in bitcoin (${p.btc_discount_pct}% off)</p>` : ''}
        ${inStock
          ? `<button class="pd-add" id="detail-add-btn">Add to Cart</button>`
          : `<button class="pd-add" disabled>${esc(p.availability)}</button>`}
        <p class="pd-fine">${fineText(p)}</p>`;
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

// The hero's picture column: our bottle photo first, the plant (or work-in-progress) photo smaller below it.
function heroMedia(p) {
  const portrait = p.category === 'propolis';  // the steeping jar is a tall photo
  const credit = p.photo_credit
    ? `<b>The plant</b>Photo: <a href="${esc(p.photo_source)}" target="_blank" rel="noopener">${esc(p.photo_credit)}</a>, ${esc(p.photo_license)}`
    : `<b>${esc(p.photo_caption || '')}</b>`;
  const second = `
        <figure class="pd-second">
          <img${portrait ? ' class="portrait"' : ''} src="${esc(p.photo)}" alt="${esc(p.photo_alt)}">
          <figcaption>${credit}</figcaption>
        </figure>`;
  if (!p.bottle_photo && !p.bottle_pending && !p.reserve) return `
      <figure class="pd-photo">
        <img src="${esc(p.photo)}" alt="${esc(p.photo_alt)}">
        <figcaption>Photo: <a href="${esc(p.photo_source)}" target="_blank" rel="noopener">${esc(p.photo_credit)}</a>, ${esc(p.photo_license)}</figcaption>
      </figure>`;
  const main = p.bottle_photo
    ? `<img class="pd-main" src="${esc(p.bottle_photo)}" alt="${esc(p.bottle_alt)}">`
    : `<div class="pd-pending${p.category === 'hydrosol' ? '' : ' reserve'}">
          <img src="${esc(p.image)}" alt="${esc(p.image_alt || p.name + ' label')}">
          <p>${esc(p.bottle_pending || `Bottle photo coming when the first batch is bottled, around ${p.ready}.`)}</p>
        </div>`;
  return `
      <div class="pd-media">
        ${main}${second}${p.art_credit ? `
        <figcaption>Background: <a href="${esc(p.art_source)}" target="_blank" rel="noopener">${esc(p.art_credit)}</a>, ${esc(p.art_license)}</figcaption>` : ''}
      </div>`;
}

const glanceTiles = p => p.glance || [['Scent', p.scent], ['Distilled from', p.distilled_from],
  ['Aromatic character', p.key_aromatics], ['Bottle', p.page_size || p.size]];

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
  <meta property="og:image" content="https://sjvg.jorgenclaw.ai${esc(p.bottle_photo || p.photo)}">
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
${heroMedia(p)}
    </header>

    <section class="pd-glance" aria-label="At a glance">
      ${glanceTiles(p).map(([k, v]) => `<div class="pd-tile"><span class="pd-tile-k">${esc(k)}</span><span class="pd-tile-v">${esc(v)}</span></div>`).join('\n      ')}
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
      ` : ''}${p.dosage ? `<details open>
        <summary>How much to use</summary>
        <ul>${p.dosage.map(([k, v]) => `<li><strong>${esc(k)}:</strong> ${esc(v)}</li>`).join('')}</ul>
        <p>${esc(p.safety || '')}</p>
        ${p.disclaimer ? `<p class="pd-disclaimer">${esc(p.disclaimer)}</p>` : ''}
      </details>
      ` : ''}${p.technical_note ? `<details${p.category === 'hydrosol' ? ' open' : ''}>
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
      if (item) { btn.textContent = '${p.reserve ? 'Reserved' : 'In Cart'} (' + item.qty + ')'; btn.classList.add('added'); }
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
