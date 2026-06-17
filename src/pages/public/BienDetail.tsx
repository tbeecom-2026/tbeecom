import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatEuros } from "@/lib/formatters";
import { getPublicBien, localisationLabel, titreLabel, type PublicBien } from "@/lib/publicBiens";
import LeadForm from "@/components/public/LeadForm";

export default function BienDetail() {
  const { reference = "" } = useParams();
  const [b, setB] = useState<PublicBien | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setLoading(true);
    getPublicBien(reference).then(r => setB(r)).finally(() => setLoading(false));
  }, [reference]);

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-muted-foreground">Chargement…</div>;
  }
  if (!b) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="font-display text-2xl text-primary">Annonce introuvable</h1>
        <p className="mt-2 text-muted-foreground">Ce bien n'est plus disponible ou a été retiré.</p>
        <Button asChild className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/landingpage/biens">Voir les autres biens</Link>
        </Button>
      </div>
    );
  }

  const gallery = [b.photo_principale, ...(b.photos ?? [])].filter(Boolean) as string[];
  const cover = gallery[active] ?? gallery[0];

  const features = [
    b.conforme_erp && "Conforme ERP",
    b.conforme_pmr && "Conforme PMR",
    b.extraction && "Extraction",
    b.murs_a_vendre && "Murs à vendre",
  ].filter(Boolean) as string[];

  const specs: Array<[string, any]> = [
    ["Type", b.type_commerce],
    ["Activité", b.nature_activite],
    ["Sous-type", b.sous_type],
    ["Surface commerciale", b.surface_commerciale != null ? `${b.surface_commerciale} m²` : null],
    ["Surface totale", b.surface_totale != null ? `${b.surface_totale} m²` : null],
    ["Réserves", b.surface_reserves != null ? `${b.surface_reserves} m²` : null],
    ["Cuisine", b.surface_cuisine != null ? `${b.surface_cuisine} m²` : null],
    ["Couverts (salle)", b.nb_couverts_salle || null],
    ["Couverts (terrasse)", b.nb_couverts_terrasse || null],
    ["Linéaire vitrine", b.lineaire_vitrine != null ? `${b.lineaire_vitrine} m` : null],
  ];

  return (
    <article className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/landingpage/biens" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4 mr-1" /> Retour aux biens
      </Link>

      <header className="mt-4 grid gap-3 sm:flex sm:items-end sm:justify-between">
        <div>
          {b.categorie && (
            <span className="inline-block text-[11px] uppercase tracking-wider px-2 py-1 rounded-full bg-accent text-accent-foreground">{b.categorie}</span>
          )}
          <h1 className="mt-2 font-display text-3xl sm:text-4xl text-primary">{titreLabel(b)}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-4 w-4" /> {localisationLabel(b)} <span className="text-xs">· Réf. {b.reference}</span>
          </p>
        </div>
        <div className="text-right">
          <div className="font-display text-3xl text-accent">
            {b.prix_demande != null ? formatEuros(b.prix_demande) : "Prix sur demande"}
          </div>
          <div className="text-xs text-muted-foreground">Honoraires inclus, à la charge de l'acquéreur</div>
        </div>
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr,400px]">
        <div>
          {gallery.length > 0 ? (
            <div className="space-y-3">
              <div className="aspect-[16/10] rounded-xl overflow-hidden bg-muted">
                <img src={cover} alt={titreLabel(b)} className="h-full w-full object-cover" />
              </div>
              {gallery.length > 1 && (
                <div className="grid grid-cols-5 gap-2">
                  {gallery.slice(0, 10).map((src, i) => (
                    <button
                      key={src + i}
                      onClick={() => setActive(i)}
                      className={`aspect-square rounded-lg overflow-hidden border ${i === active ? "border-accent ring-2 ring-accent" : "border-border"}`}
                    >
                      <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-[16/10] rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
              Pas de photo disponible
            </div>
          )}

          {b.description && (
            <section className="mt-8">
              <h2 className="font-display text-2xl text-primary">Présentation</h2>
              <p className="mt-3 whitespace-pre-line text-foreground/85 leading-relaxed">{b.description}</p>
            </section>
          )}

          <section className="mt-8">
            <h2 className="font-display text-2xl text-primary">Caractéristiques</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {specs.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-border pb-2">
                  <dt className="text-sm text-muted-foreground">{k}</dt>
                  <dd className="text-sm font-medium text-foreground text-right">{v}</dd>
                </div>
              ))}
            </dl>
            {features.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-2">
                {features.map(f => (
                  <li key={f} className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full bg-secondary/30 text-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> {f}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside>
          <div className="sticky top-24 rounded-xl bg-card border border-border p-6">
            <h2 className="font-display text-xl text-primary">Cette annonce vous intéresse&nbsp;?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Recevez le dossier confidentiel après signature d'un accord de confidentialité.</p>
            <div className="mt-5">
              <LeadForm
                type="annonce"
                referenceBien={b.reference}
                submitLabel="Demander le dossier"
                successMessage="Votre demande est enregistrée. Nous revenons vers vous très rapidement."
              />
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}
