import { Handshake, ShieldCheck, Users, Award } from "lucide-react";

export default function Agence() {
  return (
    <>
      <section className="bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
          <h1 className="font-display text-3xl sm:text-4xl">L'agence TBEECOM</h1>
          <p className="mt-3 text-primary-foreground/85 max-w-2xl">
            Spécialistes de la transmission de fonds de commerce, nous accompagnons
            cédants et repreneurs avec exigence, discrétion et bienveillance.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="font-display text-3xl text-primary">Notre approche</h2>
          <p className="mt-4 text-foreground/85 leading-relaxed">
            Nous croyons à un métier de relations longues. Chaque dossier est
            traité par un interlocuteur unique qui vous accompagne de la première
            estimation jusqu'à la signature, et au-delà.
          </p>
          <p className="mt-3 text-foreground/85 leading-relaxed">
            Notre méthode allie rigueur juridique, finesse commerciale et
            connaissance terrain des métiers de bouche, du retail et des services.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: Handshake, t: "Conseil sur-mesure", d: "Une stratégie adaptée à votre commerce." },
            { icon: ShieldCheck, t: "Confidentialité", d: "Vos données restent protégées." },
            { icon: Users, t: "Réseau qualifié", d: "Un vivier d'acquéreurs sérieux." },
            { icon: Award, t: "Expertise reconnue", d: "Carte professionnelle Transactions." },
          ].map(({ icon: I, t, d }) => (
            <div key={t} className="rounded-xl border border-border bg-card p-5">
              <I className="h-6 w-6 text-accent" />
              <h3 className="mt-3 font-display text-lg text-primary">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-muted/60 py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="font-display text-3xl text-primary">L'équipe</h2>
          <p className="mt-2 text-muted-foreground">Une équipe à taille humaine, joignable et engagée.</p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { nom: "Direction", role: "Fondateur · Conseil stratégique" },
              { nom: "Pôle Cession", role: "Estimation et mandats" },
              { nom: "Pôle Acquisition", role: "Accompagnement repreneurs" },
            ].map(p => (
              <div key={p.nom} className="rounded-xl bg-card border border-border p-6 text-center">
                <div className="h-20 w-20 mx-auto rounded-full bg-secondary/40 flex items-center justify-center text-primary font-display text-2xl">
                  {p.nom.charAt(0)}
                </div>
                <h3 className="mt-4 font-display text-lg text-primary">{p.nom}</h3>
                <p className="text-sm text-muted-foreground">{p.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
