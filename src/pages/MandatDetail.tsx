import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check } from "lucide-react";
import { formatDate, formatEuros, getStatutBadge } from "@/lib/formatters";
import { getMandatDateState, getVenduClass } from "@/lib/mandatStatus";
import type { Mandat } from "@/types/database";
// -- Helpers ---------------------------------------------------------------
const hasVal = (v: any) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
const fmtSurface = (v: number | null | undefined) =>
  hasVal(v) ? `${new Intl.NumberFormat("fr-FR").format(v as number)} m²` : null;
const fmtNumber = (v: number | null | undefined) =>
  hasVal(v) ? new Intl.NumberFormat("fr-FR").format(v as number) : null;
const fmtBool = (v: boolean | null | undefined) => (v === true ? "Oui" : v === false ? "Non" : null);
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!hasVal(value)) return null;
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground break-words">{value}</div>
    </div>
  );
}
function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  // Hide card if no Row inside has a value
  const arr = Array.isArray(children) ? children : [children];
  const visible = arr.filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
      </CardContent>
    </Card>
  );
}
// -- Stepper ---------------------------------------------------------------
const STEPS = [
  { key: "prospection", label: "Prospection" },
  { key: "sur_le_marche", label: "Sur le marché" },
  { key: "sous_compromis", label: "Sous compromis" },
  { key: "vendu", label: "Vendu" },
];
function StatusStepper({ statut }: { statut: string | null }) {
  const isRetire = statut === "retire";
  const currentIdx = isRetire ? -1 : STEPS.findIndex((s) => s.key === statut);
  const activeIdx = currentIdx === -1 && !isRetire ? 1 : currentIdx;
  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-center justify-between gap-2">
          {STEPS.map((step, i) => {
            const done = !isRetire && i < activeIdx;
            const active = !isRetire && i === activeIdx;
            return (
              <div key={step.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5 min-w-0">
                  <div
                    className={[
                      "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors",
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30"
                        : done
                          ? "bg-success text-success-foreground border-success"
                          : "bg-secondary text-muted-foreground border-border",
                    ].join(" ")}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <span
                    className={[
                      "text-xs whitespace-nowrap",
                      active ? "text-primary font-semibold" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={["flex-1 h-0.5 mx-2 transition-colors", done ? "bg-success" : "bg-border"].join(" ")}
                  />
                )}
              </div>
            );
          })}
        </div>
        {isRetire && (
          <div className="mt-4 text-center">
            <Badge variant="secondary" className="text-sm">
              Mandat retiré
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
// -- Page ------------------------------------------------------------------
export default function MandatDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromMandat = params.get("fromMandat");
  const [mandat, setMandat] = useState<Mandat | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("mandats").select("*").eq("id", id).single();
      setMandat((data as Mandat) ?? null);
      setLoading(false);
    })();
  }, [id]);
  if (loading) {
    return <div className="p-6 text-muted-foreground">Chargement…</div>;
  }
  if (!mandat) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/mandats")}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Retour
        </Button>
        <div className="text-muted-foreground">Mandat introuvable.</div>
      </div>
    );
  }
  const m = mandat;
  const statutBadge = getStatutBadge(m.statut ?? "");
  const etatMandat = getMandatDateState(m.mandat_date_fin);
  const issueMandat = (m.attributs as any)?.issue_mandat as string | undefined;
  const isCommerce = !!m.categorie && /fonds de commerce|entreprise/i.test(m.categorie);
  return (
    <div className="space-y-4 max-w-6xl">
      {/* Retour */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/biens")}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Retour aux biens
        </Button>
        {fromMandat && (
          <Button
            variant="outline"
            size="sm"
            className="bg-primary/15 text-primary hover:bg-primary/25 border-primary/30"
            onClick={() => navigate(`/mandats?focus=${fromMandat}`)}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Retour au mandat N° {fromMandat}
          </Button>
        )}
      </div>
      {/* 1. EN-TÊTE */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {hasVal(m.mandat_numero) && (
                  <span className="text-2xl font-bold text-primary">N° {m.mandat_numero}</span>
                )}
                {hasVal(m.reference) && <span className="text-sm text-muted-foreground">— Réf. {m.reference}</span>}
                {hasVal(m.categorie) && (
                  <Badge variant="outline" className="border-primary/50 text-primary">
                    {m.categorie}
                  </Badge>
                )}
                {hasVal(m.statut) && (
                  <Badge className={m.statut === "vendu" ? getVenduClass(issueMandat) : statutBadge.color}>
                    {issueMandat ?? statutBadge.label}
                  </Badge>
                )}
              </div>
              {hasVal(m.titre) && <h1 className="text-xl font-semibold text-foreground">{m.titre}</h1>}
              {(hasVal(m.commune) || hasVal(m.code_postal)) && (
                <div className="text-sm text-muted-foreground">
                  {[m.code_postal, m.commune].filter(Boolean).join(" ")}
                </div>
              )}
            </div>
            {hasVal(m.prix_demande) && (
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Prix demandé</div>
                <div className="text-2xl font-bold text-primary">{formatEuros(m.prix_demande)}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {/* Alerte échéance du mandat (rouge = dépassé, orange = fin proche) */}
      {(etatMandat.level === "expired" || etatMandat.level === "soon") && (
        <div
          className={[
            "rounded-md px-4 py-2.5 text-sm font-semibold text-white",
            etatMandat.level === "expired" ? "bg-red-600" : "bg-orange-500",
          ].join(" ")}
        >
          {etatMandat.label}
          {hasVal(m.mandat_date_fin) && <span className="font-normal"> — fin le {formatDate(m.mandat_date_fin)}</span>}
        </div>
      )}
      {/* 2. STEPPER */}
      <StatusStepper statut={m.statut} />
      {/* 3. MANDAT */}
      <InfoCard title="Mandat">
        <Row label="N° mandat" value={m.mandat_numero} />
        <Row
          label="Période"
          value={
            hasVal(m.mandat_date_debut) || hasVal(m.mandat_date_fin)
              ? `${formatDate(m.mandat_date_debut)} → ${formatDate(m.mandat_date_fin)}`
              : null
          }
        />
        <Row label="Type de mandat" value={m.type_mandat} />
        <Row label="État du mandat (Netty)" value={issueMandat} />
        <Row label="Mandant" value={m.mandant_nom} />
        <Row label="Objet" value={m.mandat_objet} />
        <Row label="N° répertoire" value={m.numero_repertoire} />
        <Row label="Négociateur" value={m.mandat_negociateur} />
      </InfoCard>
      {/* 4. COMMERCE */}
      {isCommerce && (
        <InfoCard title="Commerce">
          <Row label="Enseigne" value={m.enseigne} />
          <Row label="Nature d'activité" value={m.nature_activite} />
          <Row label="Type de commerce" value={m.type_commerce} />
          <Row label="CA annuel" value={hasVal(m.ca_annuel) ? formatEuros(m.ca_annuel) : null} />
          <Row label="Résultat net" value={hasVal(m.resultat_net) ? formatEuros(m.resultat_net) : null} />
          <Row label="EBE" value={hasVal(m.ebe) ? formatEuros(m.ebe) : null} />
          <Row label="Effectif" value={fmtNumber(m.effectif)} />
          <Row label="Licence" value={m.licence} />
          <Row label="Raison de la vente" value={m.raison_vente} />
        </InfoCard>
      )}
      {/* 5. PRIX & HONORAIRES */}
      <InfoCard title="Prix & honoraires">
        <Row label="Prix demandé" value={hasVal(m.prix_demande) ? formatEuros(m.prix_demande) : null} />
        <Row label="Prix net vendeur" value={hasVal(m.prix_net_vendeur) ? formatEuros(m.prix_net_vendeur) : null} />
        <Row label="Honoraires" value={hasVal(m.honoraires_montant) ? formatEuros(m.honoraires_montant) : null} />
        <Row label="Honoraires à charge" value={m.honoraires_charge} />
        {m.murs_a_vendre && <Row label="Prix des murs" value={hasVal(m.prix_murs) ? formatEuros(m.prix_murs) : null} />}
      </InfoCard>
      {/* 6. SURFACES & LOCAL */}
      <InfoCard title="Surfaces & local">
        <Row label="Surface totale" value={fmtSurface(m.surface_totale)} />
        <Row label="Surface commerciale" value={fmtSurface(m.surface_commerciale)} />
        <Row label="Surface réserves" value={fmtSurface(m.surface_reserves)} />
        <Row label="Surface cuisine" value={fmtSurface(m.surface_cuisine)} />
        <Row label="Couverts salle" value={fmtNumber(m.nb_couverts_salle)} />
        <Row label="Couverts terrasse" value={fmtNumber(m.nb_couverts_terrasse)} />
        <Row label="Extraction" value={fmtBool(m.extraction)} />
        <Row label="Conforme ERP" value={fmtBool(m.conforme_erp)} />
        <Row label="Conforme PMR" value={fmtBool(m.conforme_pmr)} />
        <Row label="Vitrines" value={m.vitrines} />
        <Row label="Répartition surface" value={m.repartition_surface} />
      </InfoCard>
      {/* 7. BAIL */}
      <InfoCard title="Bail">
        <Row label="Loyer mensuel" value={hasVal(m.loyer_mensuel) ? formatEuros(m.loyer_mensuel) : null} />
        <Row
          label="Charges mensuelles"
          value={hasVal(m.charges_mensuelles) ? formatEuros(m.charges_mensuelles) : null}
        />
        <Row label="Droit au bail" value={fmtBool(m.droit_au_bail)} />
        <Row
          label="Montant droit au bail"
          value={hasVal(m.montant_droit_bail) ? formatEuros(m.montant_droit_bail) : null}
        />
        <Row label="Début du bail" value={hasVal(m.date_debut_bail) ? formatDate(m.date_debut_bail) : null} />
        <Row label="Fin du bail" value={hasVal(m.date_fin_bail) ? formatDate(m.date_fin_bail) : null} />
      </InfoCard>
      {/* 8. LOCALISATION */}
      <InfoCard title="Localisation">
        <Row label="Adresse" value={m.adresse} />
        <Row label="Code postal" value={m.code_postal} />
        <Row label="Commune" value={m.commune} />
        <Row label="Secteur" value={m.secteur} />
      </InfoCard>
      {/* 9. PROPRIÉTAIRE / VENDEUR */}
      <InfoCard title="Propriétaire / Vendeur">
        <Row label="Nom" value={m.proprietaire_nom} />
        <Row label="Société" value={m.proprietaire_societe} />
        <Row
          label="Email"
          value={
            hasVal(m.proprietaire_email) ? (
              <a href={`mailto:${m.proprietaire_email}`} className="text-primary hover:underline">
                {m.proprietaire_email}
              </a>
            ) : null
          }
        />
        <Row
          label="Téléphone"
          value={
            hasVal(m.proprietaire_tel) ? (
              <a href={`tel:${m.proprietaire_tel}`} className="text-primary hover:underline">
                {m.proprietaire_tel}
              </a>
            ) : null
          }
        />
      </InfoCard>
      {/* 10. DESCRIPTION */}
      {hasVal(m.description) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{m.description}</p>
          </CardContent>
        </Card>
      )}
      {/* 11. PHOTOS */}
      {(hasVal(m.photo_principale) || hasVal(m.photos)) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Photos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {hasVal(m.photo_principale) && (
                <a
                  href={m.photo_principale!}
                  target="_blank"
                  rel="noreferrer"
                  className="block relative aspect-[4/3] overflow-hidden rounded-md border border-border hover:opacity-90 transition"
                >
                  <img src={m.photo_principale!} alt="Photo principale" className="w-full h-full object-cover" />
                  <Badge className="absolute top-2 left-2">Principale</Badge>
                </a>
              )}
              {(m.photos ?? []).map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-[4/3] overflow-hidden rounded-md border border-border hover:opacity-90 transition"
                >
                  <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
