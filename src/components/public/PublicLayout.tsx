import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV: { to: string; label: string; end?: boolean; external?: boolean }[] = [
  { to: "/landingpage", label: "Accueil", end: true },
  { to: "/landingpage/biens", label: "Nos biens" },
  { to: "/landingpage/vendre", label: "Vendre / Estimation" },
  { to: "/landingpage/acheter", label: "Acheter / Alerte" },
  { to: "/landingpage/agence", label: "L'agence" },
  { to: "/blog/", label: "Blog", external: true },
  { to: "/landingpage/contact", label: "Contact" },
];

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="tbee min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/landingpage" className="flex items-center">
            <img src="/logo-tbeecom.png" alt="TBEECOM" className="h-12 w-auto" />
          </Link>
          <nav className="hidden lg:flex items-center gap-1">
            {NAV.map(n => (
              n.external ? (
                <a key={n.to} href={n.to} className="px-3 py-2 rounded-md text-sm font-medium transition-colors text-foreground/80 hover:text-primary">{n.label}</a>
              ) : (
              <NavLink
                key={n.to} to={n.to} end={n.end}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive ? "text-accent" : "text-foreground/80 hover:text-primary"
                  }`
                }
              >{n.label}</NavLink>
              )
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="inline-flex bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/landingpage/vendre">Estimer mon commerce</Link>
            </Button>
            <button
              aria-label="Menu"
              className="lg:hidden p-2 rounded-md hover:bg-muted"
              onClick={() => setOpen(o => !o)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="lg:hidden border-t border-border bg-background">
            <div className="px-4 py-3 flex flex-col gap-1">
              {NAV.map(n => (
                n.external ? (
                  <a key={n.to} href={n.to} className="px-3 py-3 rounded-md text-base text-foreground/85">{n.label}</a>
                ) : (
                <NavLink
                  key={n.to} to={n.to} end={n.end}
                  className={({ isActive }) =>
                    `px-3 py-3 rounded-md text-base ${isActive ? "bg-muted text-accent" : "text-foreground/85"}`
                  }
                >{n.label}</NavLink>
                )
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-20 bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-primary font-display font-bold">T</span>
              <span className="font-display text-xl">TBEECOM</span>
            </div>
            <p className="text-sm text-primary-foreground/75">
              Transmission de fonds de commerce. Un accompagnement humain, discret et rigoureux.
            </p>
          </div>
          <div>
            <h4 className="font-display text-lg mb-3 text-accent">Navigation</h4>
            <ul className="space-y-2 text-sm">
              {NAV.map(n => (
                <li key={n.to}>
                  {n.external
                    ? <a href={n.to} className="hover:text-accent">{n.label}</a>
                    : <Link to={n.to} className="hover:text-accent">{n.label}</Link>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-display text-lg mb-3 text-accent">Informations</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/landingpage/mentions" className="hover:text-accent">Mentions légales</Link></li>
              <li><Link to="/landingpage/mentions#rgpd" className="hover:text-accent">RGPD & cookies</Link></li>
              <li><Link to="/landingpage/agence" className="hover:text-accent">L'équipe</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display text-lg mb-3 text-accent">Contact</h4>
            <p className="text-sm text-primary-foreground/80">
              contact@tbeecom.com<br />
              Du lundi au vendredi
            </p>
            <Button asChild className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/landingpage/contact">Nous écrire</Link>
            </Button>
          </div>
        </div>
        <div className="border-t border-primary-foreground/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-xs text-primary-foreground/60 flex flex-wrap justify-between gap-2">
            <span>© {new Date().getFullYear()} TBEECOM — Tous droits réservés</span>
            <span>Carte professionnelle Transactions • Garantie financière</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
