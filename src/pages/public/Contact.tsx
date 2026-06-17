import { Mail, Phone, MapPin, Clock, ShieldCheck } from "lucide-react";
import LeadForm from "@/components/public/LeadForm";

export default function Contact() {
  return (
    <>
      <section className="bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="font-display text-3xl sm:text-4xl">Nous contacter</h1>
          <p className="mt-2 text-primary-foreground/85 max-w-2xl">
            Une question, un projet de cession ou de reprise&nbsp;? Écrivez-nous, nous revenons vers vous rapidement et en toute confidentialité.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 grid gap-8 lg:grid-cols-[1fr,360px]">
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <h2 className="font-display text-2xl text-primary">Votre message</h2>
          <div className="mt-5">
            <LeadForm
              type="contact"
              submitLabel="Envoyer mon message"
              successMessage="Merci, votre message est bien reçu. Nous vous recontactons rapidement."
            />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <MapPin className="h-5 w-5 text-accent" />
            <h3 className="mt-2 font-display text-lg text-primary">Adresse</h3>
            <p className="text-sm text-muted-foreground">128 rue de la Boétie<br />75008 Paris</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <Phone className="h-5 w-5 text-accent" />
            <h3 className="mt-2 font-display text-lg text-primary">Téléphone</h3>
            <a href="tel:+33607037801" className="text-sm text-foreground hover:text-accent">06 07 03 78 01</a>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <Mail className="h-5 w-5 text-accent" />
            <h3 className="mt-2 font-display text-lg text-primary">Email</h3>
            <a href="mailto:contact@tbeecom.com" className="text-sm text-foreground hover:text-accent">contact@tbeecom.com</a>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <Clock className="h-5 w-5 text-accent" />
            <h3 className="mt-2 font-display text-lg text-primary">Horaires</h3>
            <p className="text-sm text-muted-foreground">Du lundi au samedi<br />9h – 18h30</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <h3 className="mt-2 font-display text-lg text-primary">Confidentialité</h3>
            <p className="text-sm text-muted-foreground">Chaque échange est strictement confidentiel.</p>
          </div>
        </aside>
      </section>
    </>
  );
}
