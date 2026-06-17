import { Link } from "react-router-dom";
import { ImageOff, MapPin, Ruler, Tag } from "lucide-react";
import { formatEuros } from "@/lib/formatters";
import { localisationLabel, titreLabel, type PublicBien } from "@/lib/publicBiens";

export default function BienCard({ b }: { b: PublicBien }) {
  // Image de couverture : photo_principale, sinon la 1re des photos (comme la fiche).
  const cover = b.photo_principale || (b.photos && b.photos[0]) || null;
  return (
    <Link
      to={`/landingpage/biens/${encodeURIComponent(b.reference)}`}
      className="group block rounded-xl overflow-hidden bg-card border border-border hover:shadow-lg hover:-translate-y-0.5 transition-all"
    >
      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
        {cover ? (
          <img
            src={cover}
            alt={titreLabel(b)}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            <ImageOff className="h-10 w-10" />
          </div>
        )}
        {b.confidentiel && (
          <span className="absolute top-3 left-3 text-[11px] uppercase tracking-wider px-2 py-1 rounded-full bg-primary/90 text-primary-foreground">
            Confidentiel
          </span>
        )}
        {b.categorie && (
          <span className="absolute top-3 right-3 text-[11px] uppercase tracking-wider px-2 py-1 rounded-full bg-accent text-accent-foreground">
            {b.categorie}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-display text-lg leading-snug text-primary line-clamp-2">{titreLabel(b)}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {localisationLabel(b)}
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-foreground/70">
          {b.type_commerce && (
            <span className="inline-flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {b.type_commerce}
            </span>
          )}
          {b.surface_commerciale != null && (
            <span className="inline-flex items-center gap-1">
              <Ruler className="h-3 w-3" />
              {b.surface_commerciale} m²
            </span>
          )}
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="font-display text-xl text-accent">
            {b.prix_demande != null ? formatEuros(b.prix_demande) : "Prix sur demande"}
          </span>
          <span className="text-xs text-muted-foreground">Réf. {b.reference}</span>
        </div>
      </div>
    </Link>
  );
}
