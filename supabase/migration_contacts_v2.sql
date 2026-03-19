-- ── Enrichissement table contacts — infos juridiques société ───────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS siret                  varchar(14),
  ADD COLUMN IF NOT EXISTS siren                  varchar(9),
  ADD COLUMN IF NOT EXISTS tva_intracommunautaire varchar(20),
  ADD COLUMN IF NOT EXISTS forme_juridique        varchar(100),
  ADD COLUMN IF NOT EXISTS libelle_forme_juridique varchar(150),
  ADD COLUMN IF NOT EXISTS capital_social         numeric,
  ADD COLUMN IF NOT EXISTS code_naf               varchar(10),
  ADD COLUMN IF NOT EXISTS libelle_naf            varchar(200),
  ADD COLUMN IF NOT EXISTS date_creation_societe  date,
  ADD COLUMN IF NOT EXISTS nom_dirigeant          varchar(200),
  ADD COLUMN IF NOT EXISTS telephone_fixe         varchar(20),
  ADD COLUMN IF NOT EXISTS site_web               varchar(255);

-- Index SIRET pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_contacts_siret ON contacts (siret);
CREATE INDEX IF NOT EXISTS idx_contacts_siren ON contacts (siren);
