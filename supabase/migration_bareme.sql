-- ── Table barème honoraires TBEECOM ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bareme_honoraires (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordre       int  NOT NULL,
  type_trans  text NOT NULL DEFAULT 'fdc',   -- fdc | dab | murs
  prix_min    numeric,                        -- null = pas de minimum
  prix_max    numeric,                        -- null = au-delà (illimité)
  type_calcul text NOT NULL,                  -- 'forfait' | 'pourcentage'
  valeur      numeric NOT NULL,               -- € si forfait, % si pourcentage
  libelle     text,
  created_at  timestamptz DEFAULT now()
);

-- RLS : accès complet équipe
ALTER TABLE bareme_honoraires ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe TBEECOM" ON bareme_honoraires;
CREATE POLICY "Equipe TBEECOM" ON bareme_honoraires FOR ALL USING (true);

-- ── Données initiales : barème FDC TBEECOM (10/10/2020) ────────────────────
INSERT INTO bareme_honoraires (ordre, type_trans, prix_min, prix_max, type_calcul, valeur, libelle)
VALUES
  (1, 'fdc', null,    30000,  'forfait',     5000, '≤ 30 000 € → forfait 5 000 € HT'),
  (2, 'fdc', 30001,   85000,  'forfait',     7500, '30 001 € à 85 000 € → forfait 7 500 € HT'),
  (3, 'fdc', 85001,   200000, 'pourcentage', 9,    '85 001 € à 200 000 € → 9 % HT'),
  (4, 'fdc', 200001,  400000, 'pourcentage', 8,    '200 001 € à 400 000 € → 8 % HT'),
  (5, 'fdc', 400001,  800000, 'pourcentage', 7,    '400 001 € à 800 000 € → 7 % HT'),
  (6, 'fdc', 800001,  null,   'pourcentage', 6,    '> 800 000 € → 6 % HT')
ON CONFLICT DO NOTHING;
