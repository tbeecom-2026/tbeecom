import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, Handshake, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import BienCard from "@/components/public/BienCard";
import { listPublicBiens, type PublicBien } from "@/lib/publicBiens";

export default function Accueil() {
  const [biens, setBiens] = useState<PublicBien[]>([]);
  useEffect(() => {
    listPublicBiens({ pageSize: 6 }).then(r => setBiens(r.items)).catch(() => setBiens([]));
  }, []);

  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-25" aria-hidden style={{
          background: "radial-gradient(ellipse at 80% 0%, hsl(34 62% 53% / 0.5), transparent 55%), radial-gradient(ellipse at 0% 100%, hsl(173 27% 65% / 0.35), transparent 55%)",
        }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
              <Sparkles className="h-3.5 w-3.5" /> TBEECOM
            </span>
            <h1 className="mt-4 font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05]">
              Transmettre votre commerce,<br />
              <span className="text-accent">en confiance.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-primary-foreground/85 max-w-xl">
              Cession et acquisition de fonds de commerce. Un accompagnement discret,
              rigoureux et 100% humain — de l'estimation à la signature.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/landingpage/biens">Voir les biens <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                <Link to="/landingpage/vendre">Estimer mon commerce</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-2xl bg-background/95 text-foreground p-6 sm:p-8 shadow-2xl">
              <h2 className="font-display text-2xl text-primary">Rechercher un bien</h2>
              <p className="mt-1 text-sm text-muted-foreground">Restaurants, boutiques, hôtels, services…</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const q = (fd.get("q") as string) || "";
                  window.location.href = `/landingpage/biens?q=${encodeURIComponent(q)}`;
                }}
                className="mt-5 flex gap-2"
              >
                <input
                  name="q"
                  placeholder="Ville, type, activité…"
                  className="flex-1 h-12 px-4 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <Button type="submit" size="lg" className="h-12 bg-accent text-accent-foreground hover:bg-accent/90">
                  <Search className="h-4 w-4" />
                </Button>
              </form>
              <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
                {["Restaurant/bar","Boutique","Hôtel"].map(t => (
                  <Link
                    key={t}
                    to={`/landingpage/biens?type=${encodeURIComponent(t)}`}
                    className="text-center px-3 py-2 rounded-md bg-muted hover:bg-secondary/40 transition-colors text-foreground/80"
                  >{t}</Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 grid gap-6 md:grid-cols-3">
        {[
          { icon: ShieldCheck, title: "Discrétion absolue", text: "Vos informations stratégiques restent confidentielles à chaque étape." },
          { icon: Handshake, title: "Accompagnement humain", text: "Un interlocuteur unique, du premier rendez-vous à la signature notariale." },
          { icon: Sparkles, title: "Expertise métier", text: "Restauration, commerces, services : nous parlons votre langue." },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-6">
            <div className="h-11 w-11 rounded-full bg-accent/15 text-accent flex items-center justify-center">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-xl text-primary">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>

      <section className="bg-muted/60 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-8 gap-4">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl text-primary">Sélection de biens</h2>
              <p className="mt-2 text-muted-foreground">Une sélection actualisée parmi nos opportunités du moment.</p>
            </div>
            <Button asChild variant="ghost" className="text-accent hover:text-accent">
              <Link to="/landingpage/biens">Tout voir <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
          {biens.length === 0 ? (
            <p className="text-muted-foreground">Catalogue en cours de mise à jour. Revenez très bientôt.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {biens.map(b => <BienCard key={b.id} b={b} />)}
            </div>
          )}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="rounded-2xl bg-primary text-primary-foreground p-8 sm:p-12 grid gap-6 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl">Vous envisagez de vendre&nbsp;?</h2>
            <p className="mt-3 text-primary-foreground/80">
              Estimation gratuite et sans engagement. Nous étudions votre dossier avec la confidentialité qu'il mérite.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/landingpage/vendre">Demander une estimation</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/landingpage/contact">Prendre rendez-vous</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
