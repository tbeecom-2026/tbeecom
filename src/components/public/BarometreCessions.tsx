// Baromètre des cessions de fonds de commerce en France (données publiques BODACC).
// Choroplèthe par département (12 derniers mois). Clic sur un département =>
// zoom + détail des cessions récentes ; bouton retour vers la France entière.
// Leaflet + GeoJSON chargés à la volée (aucune dépendance npm). Aucune donnée TBEECOM.
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    L?: any;
  }
}

const API_BODACC =
  "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records";
const GEOJSON_URL =
  "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson";
const MOIS = 12;
const COLORS = ["#d73027", "#fc8d59", "#fee08b", "#91cf60", "#1a9850"]; // rouge -> vert

let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.async = true;
    js.onload = () => resolve(window.L);
    js.onerror = () => reject(new Error("leaflet"));
    document.head.appendChild(js);
  });
  return leafletPromise;
}

function sinceMonths(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

// Normalise un code département BODACC vers le format GeoJSON (2 chiffres, 2A/2B, 97x).
function normCode(raw: string): string {
  const c = String(raw).trim().toUpperCase();
  if (c === "2A" || c === "2B") return c;
  if (/^\d$/.test(c)) return "0" + c;
  return c;
}

interface Cession {
  date: string | null;
  nom: string | null;
  ville: string | null;
}

export default function BarometreCessions({ height = 520 }: { height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const geoRef = useRef<any>(null);
  const countsRef = useRef<Record<string, number>>({});
  const quantsRef = useRef<number[]>([0, 0, 0, 0]);

  const [selected, setSelected] = useState<{ code: string; nom: string } | null>(null);
  const [cessions, setCessions] = useState<Cession[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  function colorFor(code: string): string {
    const nb = countsRef.current[code];
    if (nb == null) return "#e5e7eb";
    const q = quantsRef.current;
    if (nb >= q[3]) return COLORS[4];
    if (nb >= q[2]) return COLORS[3];
    if (nb >= q[1]) return COLORS[2];
    if (nb >= q[0]) return COLORS[1];
    return COLORS[0];
  }

  async function fetchCounts(): Promise<Record<string, number>> {
    const where = `familleavis="vente" and dateparution >= "${sinceMonths(MOIS)}"`;
    const url =
      `${API_BODACC}?select=${encodeURIComponent("numerodepartement, count(*) as nb")}` +
      `&where=${encodeURIComponent(where)}&group_by=numerodepartement&limit=100`;
    const r = await fetch(url);
    const j = await r.json();
    const out: Record<string, number> = {};
    for (const row of j?.results ?? []) {
      const code = row?.numerodepartement;
      const nb = Number(row?.nb);
      if (code && Number.isFinite(nb)) out[normCode(code)] = (out[normCode(code)] ?? 0) + nb;
    }
    return out;
  }

  async function fetchCessions(code: string): Promise<Cession[]> {
    const num = code.replace(/^0/, "");
    const where =
      `familleavis="vente" and (numerodepartement="${code}" or numerodepartement="${num}") ` +
      `and dateparution >= "${sinceMonths(MOIS)}"`;
    const url =
      `${API_BODACC}?where=${encodeURIComponent(where)}` +
      `&order_by=${encodeURIComponent("dateparution desc")}&limit=15`;
    const r = await fetch(url);
    const j = await r.json();
    return (j?.results ?? []).map((rec: any) => ({
      date: rec?.dateparution ?? null,
      nom: rec?.commercant ?? null,
      ville: rec?.ville ?? rec?.cp_ville ?? null,
    }));
  }

  function backToFrance() {
    setSelected(null);
    setCessions(null);
    if (mapRef.current) mapRef.current.flyTo([46.6, 2.4], 5, { duration: 0.8 });
    if (geoRef.current) geoRef.current.setStyle((f: any) => baseStyle(f));
  }

  function baseStyle(feature: any) {
    return {
      fillColor: colorFor(feature?.properties?.code),
      weight: 0.7,
      color: "#ffffff",
      fillOpacity: 0.8,
    };
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [L, geo, counts] = await Promise.all([loadLeaflet(), fetch(GEOJSON_URL).then((r) => r.json()), fetchCounts()]);
        if (cancelled || !ref.current) return;
        countsRef.current = counts;
        const vals = Object.values(counts).filter((v) => v > 0).sort((a, b) => a - b);
        const q = (p: number) => (vals.length ? vals[Math.min(vals.length - 1, Math.floor(vals.length * p))] : 0);
        quantsRef.current = [q(0.2), q(0.4), q(0.6), q(0.8)];

        const map = L.map(ref.current, { scrollWheelZoom: false, zoomControl: true, attributionControl: false }).setView([46.6, 2.4], 5);
        mapRef.current = map;
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
          subdomains: "abcd",
          attribution: "&copy; OpenStreetMap &copy; CARTO — cessions : BODACC",
          maxZoom: 12,
        }).addTo(map);
        L.control.attribution({ prefix: false }).addTo(map);

        const layer = L.geoJSON(geo, {
          style: baseStyle,
          onEachFeature: (feature: any, lyr: any) => {
            const code = feature?.properties?.code;
            const nom = feature?.properties?.nom ?? code;
            const nb = countsRef.current[code];
            lyr.bindTooltip(`${nom} (${code}) — ${nb ?? 0} cession${(nb ?? 0) > 1 ? "s" : ""} / 12 mois`, { sticky: true });
            lyr.on({
              mouseover: () => {
                lyr.setStyle({ weight: 2, color: "#1e293b" });
                lyr.bringToFront();
              },
              mouseout: () => geoRef.current && geoRef.current.resetStyle(lyr),
              click: () => {
                setLoadingDetail(true);
                setCessions(null);
                fetchCessions(code)
                  .then((cs) => !cancelled && setCessions(cs))
                  .catch(() => !cancelled && setCessions([]))
                  .finally(() => !cancelled && setLoadingDetail(false));
                map.flyToBounds(lyr.getBounds(), { padding: [20, 20], maxZoom: 9, duration: 0.8 });
                window.setTimeout(() => {
                  if (!cancelled) setSelected({ code, nom });
                }, 850);
              },
            });
          },
        }).addTo(map);
        geoRef.current = layer;
        setStatus("ready");
      } catch (e) {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      <div ref={ref} style={{ height, width: "100%" }} />


      {/* Légende (vue France) */}
      {!selected && status === "ready" && (
        <div className="absolute bottom-4 left-4 z-[500] rounded-lg bg-background/95 px-3 py-2 text-xs shadow">
          <div className="mb-1 font-medium text-foreground">Cessions / 12 mois</div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Peu</span>
            {COLORS.map((c) => (
              <span key={c} style={{ background: c }} className="inline-block h-3 w-5 rounded-sm" />
            ))}
            <span className="text-muted-foreground">Beaucoup</span>
          </div>
        </div>
      )}

      {/* Panneau détail (département sélectionné) */}
      {selected && (
        <div className="absolute inset-2 z-[500] flex flex-col rounded-lg bg-primary p-3 shadow-lg text-right">
          <button
            onClick={backToFrance}
            className="mb-2 inline-flex self-end items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90"
          >
            ← Voir toute la France
          </button>
          <h4 className="font-display text-lg text-primary-foreground leading-tight">
            {selected.nom} ({selected.code})
          </h4>
          <p className="text-xs text-primary-foreground/80">
            {countsRef.current[selected.code] ?? 0} cession{(countsRef.current[selected.code] ?? 0) > 1 ? "s" : ""} sur 12 mois
          </p>
          <div className="mt-2 flex-1 space-y-1 overflow-auto">
            {loadingDetail ? (
              <p className="text-xs text-primary-foreground/80">Chargement…</p>
            ) : cessions && cessions.length > 0 ? (
              cessions.map((c, i) => (
                <div key={i} className="rounded border border-border bg-card px-2 py-1.5 text-xs">
                  <div className="font-medium text-foreground truncate">{c.nom ?? "Cession"}</div>
                  <div className="text-muted-foreground">
                    {[c.ville, c.date].filter(Boolean).join(" · ")}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-primary-foreground/80">Aucune cession récente trouvée.</p>
            )}
          </div>
          <p className="mt-1 text-[10px] text-primary-foreground/60">Source : BODACC (annonces de cessions).</p>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-background/80 p-6 text-center text-sm text-muted-foreground">
          Carte momentanément indisponible (données publiques BODACC). Réessayez plus tard.
        </div>
      )}
    </div>
  );
}
