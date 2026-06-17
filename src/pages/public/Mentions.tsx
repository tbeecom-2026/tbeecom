export default function Mentions() {
  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-display text-3xl text-primary">Mentions légales</h1>
      <p className="text-muted-foreground mt-2">Dernière mise à jour&nbsp;: {new Date().toLocaleDateString("fr-FR")}</p>

      <h2 className="font-display text-2xl text-primary mt-8">Éditeur du site</h2>
      <p className="mt-2 text-foreground/85">TBEECOM — Cession de fonds de commerce.<br />Email&nbsp;: contact@tbeecom.com</p>

      <h2 className="font-display text-2xl text-primary mt-6">Carte professionnelle</h2>
      <p className="mt-2 text-foreground/85">Carte professionnelle Transactions sur immeubles et fonds de commerce, conforme à la loi Hoguet.</p>

      <h2 className="font-display text-2xl text-primary mt-6">Hébergement</h2>
      <p className="mt-2 text-foreground/85">Site hébergé par Lovable.</p>

      <h2 className="font-display text-2xl text-primary mt-6">Propriété intellectuelle</h2>
      <p className="mt-2 text-foreground/85">L'ensemble des contenus (textes, images, logos) est protégé. Toute reproduction sans autorisation est interdite.</p>

      <h2 id="rgpd" className="font-display text-2xl text-primary mt-10">Politique RGPD &amp; cookies</h2>
      <p className="mt-2 text-foreground/85">
        Les données personnelles collectées via les formulaires (nom, email, téléphone, message, critères
        de recherche) sont utilisées exclusivement pour traiter votre demande. Elles sont conservées pour
        une durée maximale de 3 ans à compter du dernier contact.
      </p>
      <p className="mt-3 text-foreground/85">
        Conformément au RGPD et à la loi Informatique et Libertés, vous disposez d'un droit d'accès, de
        rectification, d'opposition, d'effacement et de portabilité de vos données. Pour exercer ces droits,
        contactez-nous à <a href="mailto:contact@tbeecom.com" className="text-accent">contact@tbeecom.com</a>.
      </p>
      <p className="mt-3 text-foreground/85">
        Ce site n'utilise pas de cookies publicitaires. Seuls des cookies techniques nécessaires au bon
        fonctionnement du site peuvent être déposés.
      </p>
    </article>
  );
}
