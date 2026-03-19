export function formatEuros(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export const TYPES_COMMERCE = [
  "Restaurant/bar",
  "Commerce d'alimentation",
  "Commerce de services",
  "Hôtel",
  "Presse/tabac",
  "Boutique",
  "Garage",
  "Autres",
] as const;

export const STATUTS_MANDAT = [
  { value: "sur_le_marche", label: "Sur le marché", color: "bg-success text-success-foreground" },
  { value: "sous_compromis", label: "Sous compromis", color: "bg-warning text-warning-foreground" },
  { value: "vendu", label: "Vendu", color: "bg-info text-info-foreground" },
  { value: "retire", label: "Retiré", color: "bg-muted text-muted-foreground" },
] as const;

export const TYPES_MANDAT = [
  { value: "simple", label: "Simple" },
  { value: "exclusif", label: "Exclusif" },
  { value: "co_exclusif", label: "Co-exclusif" },
  { value: "semi_exclusif", label: "Semi-exclusif" },
  { value: "delegation", label: "Délégation" },
] as const;

export const TYPES_ACTIVITE = [
  { value: "appel", label: "Appel", color: "bg-info text-info-foreground" },
  { value: "email", label: "Email", color: "bg-primary text-primary-foreground" },
  { value: "visite", label: "Visite", color: "bg-success text-success-foreground" },
  { value: "relance", label: "Relance", color: "bg-warning text-warning-foreground" },
  { value: "note", label: "Note", color: "bg-muted text-muted-foreground" },
  { value: "rdv", label: "RDV", color: "bg-destructive text-destructive-foreground" },
] as const;

export const ROLES_CONTACT = [
  { value: "vendeur",     label: "Vendeur",      color: "bg-amber-600 text-white" },
  { value: "acquereur",   label: "Acquéreur",    color: "bg-blue-600 text-white" },
  { value: "notaire",     label: "Notaire",      color: "bg-purple-600 text-white" },
  { value: "partenaire",  label: "Partenaire",   color: "bg-green-600 text-white" },
  { value: "bailleur",    label: "Bailleur",     color: "bg-orange-600 text-white" },
  { value: "investisseur",label: "Investisseur", color: "bg-cyan-600 text-white" },
  { value: "autre",       label: "Autre",        color: "bg-slate-500 text-white" },
] as const;

export function getStatutBadge(statut: string) {
  return STATUTS_MANDAT.find((s) => s.value === statut) ?? STATUTS_MANDAT[3];
}

export function getActiviteBadge(type: string) {
  return TYPES_ACTIVITE.find((t) => t.value === type) ?? TYPES_ACTIVITE[4];
}
