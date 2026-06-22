import { Link } from "react-router-dom";
import {
  Store,
  FileSignature,
  Building2,
  Scale,
  Calculator,
  TrendingUp,
  ShoppingBag,
  MapPin,
} from "lucide-react";

/**
 * Hub éditorial "Le Guide TBEECOM".
 * Objectif SEO : capter cédants et repreneurs de commerces dans toute la France.
 * Chaque pilier = une page thématique ; les articles seront publiés progressivement.
 */
const PILIERS = [
  {
    icon: Store,
    titre: "Le fonds de commerce",
    intro:
      "Comprendre ce qu'est réellement un fonds de commerce : sa composition (clientèle, enseigne, matériel, droit au bail), sa valeur et ce qui se transmet lors d'une vente.",
    articles: [
      "Qu'est-ce qu'un fonds de commerce ? Définition complète",
      "Les éléments corporels et incorporels d'un fonds",
      "Fonds de commerce ou société : que vend-on vraiment ?",
      "Clientèle et achalandage : le cœur de la valeur",
    ],
  },
  {
    icon: FileSignature,
    titre: "Le droit au bail",
    intro:
      "Le bail commercial conditionne souvent la valeur d'un commerce. Loyer, durée, renouvellement, cession : tout ce qu'un acheteur ou un vendeur doit maîtriser.",
    articles: [
      "Droit au bail : définition et fonctionnement",
      "Bail commercial 3-6-9 : ce qu'il faut savoir",
      "Céder son droit au bail : procédure et pièges",
      "Droit au bail vs pas-de-porte : quelles différences ?",
      "Renouvellement, déspécialisation et indemnité d'éviction",
    ],
  },
  {
    icon: Building2,
    titre: "Les murs commerciaux",
    intro:
      "Acheter les murs de son commerce ou seulement le fonds ? Comprendre la différence entre murs et fonds, et l'intérêt d'un achat des murs pour sécuriser son activité.",
    articles: [
      "Murs commerciaux : définition et différence avec le fonds",
      "Acheter les murs de son commerce : avantages et risques",
      "Vendre ses murs commerciaux : fiscalité et valorisation",
      "Murs occupés ou murs libres : impact sur le prix",
    ],
  },
  {
    icon: Scale,
    titre: "Législation & juridique",
    intro:
      "Le cadre légal de la cession d'un fonds de commerce : mentions obligatoires, séquestre du prix, information des salariés, formalités et délais d'opposition.",
    articles: [
      "Vendre un fonds de commerce : le cadre légal en France",
      "Les mentions obligatoires de l'acte de cession",
      "Séquestre du prix de vente : pourquoi et combien de temps",
      "Information préalable des salariés (loi Hamon)",
      "Les formalités après la vente : enregistrement et publicité",
    ],
  },
  {
    icon: Calculator,
    titre: "Les chiffres pour bien acheter",
    intro:
      "Les indicateurs indispensables avant d'acheter un commerce : chiffre d'affaires, EBE, rentabilité, ratios de valorisation et budget réel d'une reprise.",
    articles: [
      "Les chiffres de base pour bien acheter son commerce",
      "Comprendre l'EBE et la rentabilité d'un fonds",
      "Comment est calculé le prix d'un fonds de commerce ?",
      "Barèmes de valorisation par activité",
      "Quel apport et quel financement pour reprendre un commerce ?",
    ],
  },
  {
    icon: TrendingUp,
    titre: "Vendre son commerce",
    intro:
      "Préparer, estimer et réussir la cession de son commerce, partout en France : du dossier de présentation à la signature, en passant par la confidentialité.",
    articles: [
      "Vendre son commerce : les étapes clés",
      "Bien estimer son fonds de commerce avant de vendre",
      "Préparer son dossier de cession qui rassure les acheteurs",
      "Vendre dans la discrétion : préserver l'activité",
      "Combien de temps pour vendre un commerce ?",
    ],
  },
  {
    icon: ShoppingBag,
    titre: "Par type de commerce",
    intro:
      "Chaque activité a ses codes de valorisation. Nos guides par métier : restauration, boulangerie, bar-tabac, salon, commerce de détail, services et plus encore.",
    articles: [
      "Acheter / vendre un restaurant : ce qui compte",
      "Reprendre une boulangerie-pâtisserie",
      "Bar, tabac, presse : valoriser une licence et un débit",
      "Salon de coiffure, esthétique : spécificités",
      "Commerce de détail et franchise : points de vigilance",
    ],
  },
  {
    icon: MapPin,
    titre: "Partout en France",
    intro:
      "Acheter ou vendre un commerce ne se limite pas à Paris. Nos repères marché région par région, pour les commerçants de toute la France.",
    articles: [
      "Acheter un commerce en région : les opportunités",
      "Prix des commerces : grandes villes vs villes moyennes",
      "Reprendre un commerce en zone rurale ou touristique",
      "Marché des fonds de commerce : tendances nationales",
    ],
  },
];

export default function Blog() {
  return (
    <>
      <section className="bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <p className="text-accent font-medium">Le Guide TBEECOM</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">
            Acheter et vendre un fonds de commerce, partout en France
          </h1>
          <p className="mt-4 text-primary-foreground/85 max-w-2xl leading-relaxed">
            Fonds de commerce, droit au bail, murs commerciaux, législation, chiffres
            clés pour bien acheter : nos guides pratiques accompagnent cédants et
            repreneurs, à Paris comme en région, dans toutes les villes de France.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-12">
        {PILIERS.map(({ icon: I, titre, intro, articles }) => (
          <div key={titre} className="grid gap-5 lg:grid-cols-[260px_1fr] lg:gap-10">
            <div>
              <I className="h-7 w-7 text-accent" />
              <h2 className="mt-3 font-display text-2xl text-primary">{titre}</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{intro}</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {articles.map((a) => (
                <li
                  key={a}
                  className="rounded-xl border border-border bg-card p-4 text-sm text-foreground/90 flex items-start gap-2"
                >
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="bg-muted/60 py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-display text-2xl text-primary">
            Un projet d'achat ou de vente ?
          </h2>
          <p className="mt-2 text-muted-foreground max-w-xl mx-auto">
            Nos experts estiment votre commerce et vous accompagnent partout en France.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/landingpage/vendre"
              className="px-5 py-3 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90"
            >
              Estimer mon commerce
            </Link>
            <Link
              to="/landingpage/contact"
              className="px-5 py-3 rounded-md border border-border bg-background font-medium hover:text-primary"
            >
              Nous contacter
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
