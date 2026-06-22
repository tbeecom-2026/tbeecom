// Générateur du blog statique TBEECOM.
// Lit content/blog/manifest.mjs + content/blog/bodies/<slug>.html
// Produit public/blog/<slug>.html, public/blog/index.html et public/sitemap.xml
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PILLARS, ARTICLES } from "../content/blog/manifest.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "public", "blog");
const SITE = "https://www.tbeecom.com";

const NAV = `
  <nav class="nav">
    <a href="/landingpage">Accueil</a>
    <a href="/landingpage/biens">Nos biens</a>
    <a href="/landingpage/vendre">Vendre</a>
    <a href="/landingpage/acheter">Acheter</a>
    <a href="/blog/">Blog</a>
    <a href="/landingpage/contact">Contact</a>
  </nav>`;

const HEADER = `<header class="site"><div class="wrap">
  <a class="brand" href="/landingpage"><img class="logoimg" src="/logo-tbeecom.svg" alt="TBEECOM" /></a>
  <div class="hright">${NAV}
    <a class="estim" href="/landingpage/vendre">Estimer mon commerce</a>
  </div>
</div></header>`;

const FOOTER = `<footer class="site"><div class="wrap">
  <nav class="fnav">
    <a href="/landingpage">Accueil</a>
    <a href="/landingpage/biens">Nos biens</a>
    <a href="/landingpage/vendre">Vendre</a>
    <a href="/landingpage/acheter">Acheter</a>
    <a href="/blog/">Blog</a>
    <a href="/landingpage/contact">Contact</a>
  </nav>
  <p class="fcopy">© <span id="y"></span> TBEECOM — Transmission de fonds de commerce</p>
  <script>document.getElementById('y').textContent=new Date().getFullYear()</script>
</div></footer>`;

const CTA = `<div class="cta"><div class="wrap">
  <h2>Un projet d'achat ou de vente ?</h2>
  <p>TBEECOM.COM estime votre commerce et vous accompagne partout en France.</p>
  <a class="btn" href="/landingpage/vendre">Estimer mon commerce</a>
  <a class="btn alt" href="/landingpage/contact">Nous contacter</a>
</div></div>`;

const pillarLabel = (id) => (PILLARS.find((p) => p.id === id)?.label ?? "");

function articlePage(a) {
  const url = `${SITE}/blog/${a.slug}.html`;
  const body = readFileSync(join(ROOT, "content/blog/bodies", `${a.slug}.html`), "utf8");
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${a.title} | TBEECOM</title>
<meta name="description" content="${a.description}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${a.title}" />
<meta property="og:description" content="${a.description}" />
<meta property="og:url" content="${url}" />
<link rel="stylesheet" href="/blog/blog.css" />
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Article","headline":"${a.title.replace(/"/g, "'")}","description":"${a.description.replace(/"/g, "'")}","inLanguage":"fr-FR","author":{"@type":"Organization","name":"TBEECOM"},"publisher":{"@type":"Organization","name":"TBEECOM"},"mainEntityOfPage":"${url}"}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Blog","item":"${SITE}/blog/"},{"@type":"ListItem","position":2,"name":"${a.title.replace(/"/g, "'")}","item":"${url}"}]}
</script>
</head>
<body>
${HEADER}
<div class="hero"><div class="wrap reading">
  <p class="kicker">${pillarLabel(a.pillar)}</p>
  <h1>${a.title}</h1>
  <p>${a.description}</p>
</div></div>
<div class="wrap reading">
<p class="crumb"><a href="/blog/">Blog</a> › ${a.title}</p>
<article>
${body}
</article>
</div>
${CTA.replace("</div></div>", `<p class="related" style="margin-top:18px"><a href="/blog/">← Retour à tous les guides</a></p></div></div>`)}
${FOOTER}
</body>
</html>`;
}

function indexPage() {
  const sections = PILLARS.map((p) => {
    const arts = ARTICLES.filter((a) => a.pillar === p.id);
    if (!arts.length) return "";
    const cards = arts
      .map(
        (a) =>
          `      <a class="card live" href="/blog/${a.slug}.html"><span class="tag">Article</span><br>${a.title}</a>`
      )
      .join("\n");
    return `  <div class="pillar" data-pillar="${p.id}">
    <h2>${p.label}</h2>
    <p class="intro">${p.intro}</p>
    <div class="cards">
${cards}
    </div>
  </div>`;
  }).filter(Boolean).join("\n\n");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Le Guide TBEECOM — Acheter et vendre un fonds de commerce en France</title>
<meta name="description" content="Guides pratiques pour acheter ou vendre un fonds de commerce partout en France : fonds de commerce, droit au bail, murs commerciaux, législation, chiffres pour bien acheter." />
<link rel="canonical" href="${SITE}/blog/" />
<meta property="og:type" content="website" />
<meta property="og:title" content="Le Guide TBEECOM — Acheter et vendre un commerce en France" />
<meta property="og:url" content="${SITE}/blog/" />
<link rel="stylesheet" href="/blog/blog.css" />
</head>
<body>
${HEADER}
<div class="hero"><div class="wrap">
  <p class="kicker">Le Guide TBEECOM</p>
  <h1>Acheter et vendre un fonds de commerce, partout en France</h1>
  <p>Fonds de commerce, droit au bail, murs commerciaux, législation, chiffres clés pour bien acheter : les guides de TBEECOM.COM accompagnent cédants et repreneurs, à Paris comme en région, dans toutes les villes de France.</p>
</div></div>
<div class="tabbar"><div class="wrap tabnav">
<button class="tabarrow" data-dir="-1" aria-label="Précédent">‹</button>
<div class="tabs" id="tabs">
<button class="tab active" data-f="all">Tous</button>
${PILLARS.filter((p)=>ARTICLES.some((a)=>a.pillar===p.id)).map((p)=>`<button class="tab" data-f="${p.id}">${p.label}</button>`).join("\n")}
</div>
<button class="tabarrow" data-dir="1" aria-label="Suivant">›</button>
</div></div>
<section class="pillars"><div class="wrap">
${sections}
</div></section>
<script>
(function(){
  var tabs=document.querySelectorAll('.tab');
  var secs=document.querySelectorAll('.pillar');
  function show(f){
    secs.forEach(function(s){ s.style.display=(f==='all'||s.getAttribute('data-pillar')===f)?'':'none'; });
    tabs.forEach(function(t){ t.classList.toggle('active', t.getAttribute('data-f')===f); });
    window.scrollTo({top:0,behavior:'smooth'});
  }
  tabs.forEach(function(t){ t.addEventListener('click', function(){ show(t.getAttribute('data-f')); }); });
  var box=document.getElementById('tabs');
  var arrows=document.querySelectorAll('.tabarrow');
  arrows.forEach(function(a){ a.addEventListener('click', function(){ box.scrollBy({left:parseInt(a.getAttribute('data-dir'),10)*220,behavior:'smooth'}); }); });
  function upd(){ var max=box.scrollWidth-box.clientWidth-1; arrows[0].style.visibility=box.scrollLeft>2?'visible':'hidden'; arrows[1].style.visibility=box.scrollLeft<max?'visible':'hidden'; }
  box.addEventListener('scroll',upd); window.addEventListener('resize',upd); setTimeout(upd,0);
})();
</script>
${CTA}
${FOOTER}
</body>
</html>`;
}

function sitemap() {
  const urls = [
    `${SITE}/landingpage`,
    `${SITE}/blog/`,
    ...ARTICLES.map((a) => `${SITE}/blog/${a.slug}.html`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>`;
}

// --- écriture ---
for (const a of ARTICLES) {
  writeFileSync(join(OUT, `${a.slug}.html`), articlePage(a));
}
writeFileSync(join(OUT, "index.html"), indexPage());
writeFileSync(join(ROOT, "public", "sitemap.xml"), sitemap());
console.log(`Généré : ${ARTICLES.length} articles + index + sitemap`);
