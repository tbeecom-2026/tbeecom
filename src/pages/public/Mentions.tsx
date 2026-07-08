// src/pages/public/Mentions.tsx
// Mentions légales + Barème d'honoraires + RGPD + CGU (loi Hoguet / ALUR / code conso / RGPD).
// ⚠️ Les [À COMPLÉTER] doivent être renseignés AVANT la mise en ligne (obligation légale).
export default function Mentions() {
  const maj = new Date().toLocaleDateString("fr-FR");
  const bareme = [
    { tranche: "Jusqu'à 30 000 €", ht: "Forfait 5 000 € HT", ttc: "6 000 € TTC" },
    { tranche: "De 30 001 € à 85 000 €", ht: "Forfait 7 500 € HT", ttc: "9 000 € TTC" },
    { tranche: "De 85 001 € à 200 000 €", ht: "9 % HT", ttc: "10,80 % TTC" },
    { tranche: "De 200 001 € à 400 000 €", ht: "8 % HT", ttc: "9,60 % TTC" },
    { tranche: "De 400 001 € à 800 000 €", ht: "7 % HT", ttc: "8,40 % TTC" },
    { tranche: "Au-delà de 800 000 €", ht: "6 % HT", ttc: "7,20 % TTC" },
  ];

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-display text-3xl text-primary">Mentions légales</h1>
      <p className="text-muted-foreground mt-2">Dernière mise à jour&nbsp;: {maj}</p>

      {/* Sommaire */}
      <nav className="mt-6 rounded-lg border border-border bg-card p-4 text-sm">
        <p className="font-medium text-primary mb-2">Sommaire</p>
        <ul className="grid sm:grid-cols-2 gap-1 text-foreground/80">
          <li><a href="#editeur" className="hover:text-accent">1. Éditeur du site</a></li>
          <li><a href="#carte" className="hover:text-accent">2. Activité réglementée &amp; carte professionnelle</a></li>
          <li><a href="#fonds" className="hover:text-accent">3. Garantie financière &amp; maniement de fonds</a></li>
          <li><a href="#assurance" className="hover:text-accent">4. Assurance responsabilité civile pro</a></li>
          <li><a href="#mediateur" className="hover:text-accent">5. Médiateur de la consommation</a></li>
          <li><a href="#hebergeur" className="hover:text-accent">6. Hébergeur</a></li>
          <li><a href="#bareme" className="hover:text-accent">7. Barème des honoraires</a></li>
          <li><a href="#pi" className="hover:text-accent">8. Propriété intellectuelle</a></li>
          <li><a href="#rgpd" className="hover:text-accent">9. Données personnelles &amp; cookies</a></li>
          <li><a href="#cgu" className="hover:text-accent">10. Conditions d'utilisation (CGU)</a></li>
        </ul>
      </nav>

      <h2 id="editeur" className="font-display text-2xl text-primary mt-10 scroll-mt-24">1. Éditeur du site</h2>
      <div className="mt-2 text-foreground/85 space-y-1">
        <p><strong>MENESGUEN IMMOBILIER</strong> — nom commercial <strong>TBEECOM</strong></p>
        <p>Société à responsabilité limitée (SARL) au capital de <strong>[À COMPLÉTER&nbsp;: capital en €]</strong></p>
        <p>Siège social&nbsp;: 128 rue de la Boétie, 75008 Paris</p>
        <p>RCS Paris&nbsp;: 849 721 469 — SIRET&nbsp;: 849 721 469 00013</p>
        <p>Code APE&nbsp;: 68.31Z (Agences immobilières)</p>
        <p>N° TVA intracommunautaire&nbsp;: FR 54 849 721 469</p>
        <p>Directeur de la publication&nbsp;: Bertrand Menesguen, gérant</p>
        <p>Téléphone&nbsp;: 06 07 03 78 01 — Email&nbsp;: <a href="mailto:contact@tbeecom.com" className="text-accent">contact@tbeecom.com</a></p>
      </div>

      <h2 id="carte" className="font-display text-2xl text-primary mt-8 scroll-mt-24">2. Activité réglementée &amp; carte professionnelle</h2>
      <p className="mt-2 text-foreground/85">
        Activité de transaction sur immeubles et fonds de commerce, régie par la loi n°&nbsp;70-9 du 2&nbsp;janvier 1970
        (loi Hoguet) et son décret d'application n°&nbsp;72-678 du 20&nbsp;juillet 1972.<br />
        <strong>Carte professionnelle « Transactions sur immeubles et fonds de commerce »</strong> n°&nbsp;
        <strong>CPI 7501 2019 000 041 080</strong>, délivrée par la <strong>CCI Paris Île-de-France</strong>.
      </p>

      <h2 id="fonds" className="font-display text-2xl text-primary mt-8 scroll-mt-24">3. Garantie financière &amp; maniement de fonds</h2>
      <p className="mt-2 text-foreground/85">
        Conformément à l'article 3 de la loi du 2&nbsp;janvier 1970, MENESGUEN IMMOBILIER déclare
        <strong> ne percevoir ni détenir, directement ou indirectement, aucun fonds, effet ou valeur</strong> autres
        que ceux représentatifs de sa rémunération. À ce titre, la société <strong>n'est pas titulaire d'une garantie
        financière</strong> et ne peut recevoir de maniement de fonds.
      </p>

      <h2 id="assurance" className="font-display text-2xl text-primary mt-8 scroll-mt-24">4. Assurance responsabilité civile professionnelle</h2>
      <p className="mt-2 text-foreground/85">
        Contrat groupe RC Professionnelle n°&nbsp;<strong>W3095517PNPI</strong>, souscrit par l'intermédiaire du cabinet
        <strong> Agirela-Courtage</strong> (UNAPI), valable jusqu'au 10&nbsp;février 2027.<br />
        Assureur&nbsp;: <strong>[À COMPLÉTER&nbsp;: nom de la compagnie d'assurance]</strong> — Couverture géographique&nbsp;: France.
      </p>

      <h2 id="mediateur" className="font-display text-2xl text-primary mt-8 scroll-mt-24">5. Médiateur de la consommation</h2>
      <p className="mt-2 text-foreground/85">
        Conformément aux articles L.&nbsp;612-1 et suivants du Code de la consommation, tout consommateur a le droit de
        recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable d'un litige.<br />
        Médiateur compétent&nbsp;: <strong>[À COMPLÉTER&nbsp;: nom du médiateur]</strong>,
        <strong> [À COMPLÉTER&nbsp;: adresse]</strong> — <strong>[À COMPLÉTER&nbsp;: site web]</strong>.
      </p>

      <h2 id="hebergeur" className="font-display text-2xl text-primary mt-8 scroll-mt-24">6. Hébergeur</h2>
      <p className="mt-2 text-foreground/85">
        Hébergeur&nbsp;: <strong>Cloudflare,&nbsp;Inc.</strong>, 101&nbsp;Townsend Street, San&nbsp;Francisco, CA&nbsp;94107,
        États-Unis — <a href="https://www.cloudflare.com" className="underline">www.cloudflare.com</a>.
      </p>

      <h2 id="bareme" className="font-display text-2xl text-primary mt-8 scroll-mt-24">7. Barème des honoraires</h2>
      <p className="mt-2 text-foreground/85">
        Honoraires de négociation applicables à la cession de fonds de commerce, TVA à 20&nbsp;% incluse dans le montant TTC.
        Honoraires à la charge de l'acquéreur ou du vendeur selon les stipulations du mandat.
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-left text-muted-foreground">
            <tr>
              <th className="p-3">Prix de cession</th>
              <th className="p-3">Honoraires HT</th>
              <th className="p-3">Honoraires TTC</th>
            </tr>
          </thead>
          <tbody>
            {bareme.map((b) => (
              <tr key={b.tranche} className="border-t border-border/60">
                <td className="p-3">{b.tranche}</td>
                <td className="p-3">{b.ht}</td>
                <td className="p-3 font-medium text-foreground">{b.ttc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Barème en vigueur. Pour les cessions de droit au bail et de murs commerciaux, honoraires sur devis — nous consulter.
      </p>

      <h2 id="pi" className="font-display text-2xl text-primary mt-8 scroll-mt-24">8. Propriété intellectuelle</h2>
      <p className="mt-2 text-foreground/85">
        L'ensemble des contenus du site (textes, images, logos, marque TBEECOM) est protégé par le droit de la propriété
        intellectuelle. Toute reproduction ou représentation, totale ou partielle, sans autorisation écrite préalable, est interdite.
      </p>

      <h2 id="rgpd" className="font-display text-2xl text-primary mt-8 scroll-mt-24">9. Données personnelles &amp; cookies</h2>
      <p className="mt-2 text-foreground/85">
        Les données personnelles collectées via les formulaires (nom, email, téléphone, message, critères de recherche)
        sont traitées par MENESGUEN IMMOBILIER, responsable de traitement, dans le seul but de répondre à votre demande.
        Elles sont conservées au maximum 3&nbsp;ans à compter du dernier contact, et ne sont jamais cédées à des tiers à des fins commerciales.
      </p>
      <p className="mt-3 text-foreground/85">
        Conformément au RGPD et à la loi Informatique et Libertés, vous disposez d'un droit d'accès, de rectification,
        d'opposition, d'effacement, de limitation et de portabilité de vos données. Pour les exercer&nbsp;:
        <a href="mailto:contact@tbeecom.com" className="text-accent"> contact@tbeecom.com</a>. Vous pouvez également
        introduire une réclamation auprès de la CNIL (www.cnil.fr).
      </p>
      <p className="mt-3 text-foreground/85">
        Ce site n'utilise pas de cookies publicitaires&nbsp;; seuls des cookies techniques nécessaires à son
        fonctionnement peuvent être déposés.
      </p>

      <h2 id="cgu" className="font-display text-2xl text-primary mt-8 scroll-mt-24">10. Conditions générales d'utilisation (CGU)</h2>
      <p className="mt-2 text-foreground/85">
        L'accès et l'utilisation du site tbeecom.com impliquent l'acceptation des présentes conditions. Le site a pour objet
        de présenter l'agence et ses biens à céder, et de permettre la prise de contact. Les informations diffusées
        (annonces, prix, surfaces) sont fournies à titre indicatif et non contractuel&nbsp;; elles ne constituent pas une offre
        de vente au sens juridique. L'éditeur s'efforce d'assurer l'exactitude et la mise à jour des informations mais ne
        saurait être tenu responsable d'erreurs, d'omissions ou d'une indisponibilité temporaire du site. Les liens externes
        éventuels n'engagent pas la responsabilité de l'éditeur. Les présentes CGU sont régies par le droit français&nbsp;;
        tout litige relève des tribunaux compétents, sous réserve d'une médiation préalable (voir §5).
      </p>
    </article>
  );
}
