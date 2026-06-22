// Source de vérité du blog. Pour ajouter un article :
// 1) ajouter une entrée ici, 2) créer content/blog/bodies/<slug>.html,
// 3) lancer: node scripts/build-blog.mjs
export const PILLARS = [
  { id: "fonds",       label: "Le fonds de commerce",        intro: "Comprendre ce qu'est réellement un fonds de commerce : composition, valeur et transmission." },
  { id: "bail",        label: "Le droit au bail",            intro: "Le bail commercial conditionne souvent la valeur d'un commerce : loyer, durée, renouvellement, cession." },
  { id: "murs",        label: "Les murs commerciaux",        intro: "Acheter les murs ou seulement le fonds ? Comprendre la différence et les enjeux." },
  { id: "legislation", label: "Législation & juridique",     intro: "Le cadre légal de la cession d'un fonds de commerce en France." },
  { id: "chiffres",    label: "Les chiffres pour bien acheter", intro: "Chiffre d'affaires, EBE, rentabilité, ratios : les indicateurs avant d'acheter." },
  { id: "vendre",      label: "Vendre son commerce",         intro: "Préparer, estimer et réussir la cession de son commerce, partout en France." },
  { id: "metier",      label: "Par type de commerce",        intro: "Chaque activité a ses codes de valorisation : restauration, boulangerie, bar-tabac…" },
  { id: "france",      label: "Partout en France",           intro: "Acheter ou vendre un commerce ne se limite pas à Paris : repères marché par région." },
];

export const ARTICLES = [
  { slug: "qu-est-ce-qu-un-fonds-de-commerce", pillar: "fonds",
    title: "Qu'est-ce qu'un fonds de commerce ? Définition complète",
    description: "Définition du fonds de commerce : composition (clientèle, droit au bail, matériel, enseigne), différence avec la société et les murs, et ce qui se transmet lors d'une vente." },
  { slug: "fonds-de-commerce-ou-societe", pillar: "fonds",
    title: "Fonds de commerce ou société : que vend-on vraiment ?",
    description: "Vendre le fonds de commerce ou les parts de la société : différences juridiques, fiscales et de garantie pour bien choisir avant une cession." },
  { slug: "droit-au-bail-definition", pillar: "bail",
    title: "Droit au bail : définition, fonctionnement et valeur",
    description: "Comprendre le droit au bail : ce qu'il est, comment il se cède, son rôle dans le prix d'un commerce et la différence avec le pas-de-porte." },
  { slug: "murs-commerciaux-difference-fonds", pillar: "murs",
    title: "Murs commerciaux : définition et différence avec le fonds",
    description: "Murs commerciaux ou fonds de commerce : quelle différence ? Pourquoi on peut être propriétaire du fonds et locataire des murs, et l'intérêt d'acheter les murs." },
  { slug: "chiffres-pour-acheter-commerce", pillar: "chiffres",
    title: "Les chiffres de base pour bien acheter son commerce",
    description: "Chiffre d'affaires, EBE, rentabilité, ratios de valorisation, apport et financement : les chiffres clés à analyser avant d'acheter un commerce." },
  { slug: "vendre-son-commerce-etapes", pillar: "vendre",
    title: "Vendre son commerce : les étapes clés",
    description: "De l'estimation à la signature : les étapes pour vendre son fonds de commerce dans de bonnes conditions, partout en France." },
];
