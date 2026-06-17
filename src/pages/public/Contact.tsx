import { Mail, Clock, MessageSquare } from "lucide-react";
import LeadForm from "@/components/public/LeadForm";

export default function Contact() {
  return (
    <>
      <section className="bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="font-display text-3xl sm:text-4xl">Nous contacter</h1>
          <p className="mt-2 text-primary-foreground/85 max-w-2xl">
            Une question, un projet&nbsp;? Écrivez-nous, nous revenons vers vous rapidement.
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
            <Mail className="h-5 w-5 text-accent" />
            <h3 className="mt-2 font-display text-lg text-primary">Email</h3>
            <a href="mailto:contact@tbeecom.com" className="text-sm text-foreground hover:text-accent">contact@tbeecom.com</a>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <Clock className="h-5 w-5 text-accent" />
            <h3 className="mt-2 font-display text-lg text-primary">Horaires</h3>
            <p className="text-sm text-muted-foreground">Lun – Ven · 9h – 19h<br />Sur rendez-vous le samedi</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <MessageSquare className="h-5 w-5 text-accent" />
            <h3 className="mt-2 font-display text-lg text-primary">Confidentialité</h3>
            <p className="text-sm text-muted-foreground">
              Chaque échange est strictement confidentiel.
            </p>
          </div>
        </aside>
      </section>
    </>
  );
}
