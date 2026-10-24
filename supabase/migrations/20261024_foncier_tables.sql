-- Migration : Tables foncières pour l'import KoboToolbox FANISA
-- Fokontany Ambodisaina — Recensement foncier
-- Correspondance avec export XLSX : FANISA__Formulaire_Foncier__...xlsx

-- ── Table principale : parcelles ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parcelles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiants
  foncier_id            TEXT UNIQUE,               -- ex: FON-2026-2F555F81 (Kobo: foncier_id)
  lot_id                TEXT,                      -- ex: 20/AA-003 (Kobo: lot_id)
  lot_norm              TEXT,                      -- lot normalisé (Kobo: lot_norm)
  lot_prefixe           TEXT,                      -- Kobo: lot_prefixe
  kobo_uuid             TEXT UNIQUE,               -- UUID de soumission Kobo (_uuid)

  -- Localisation
  fokontany             TEXT DEFAULT 'Ambodisaina',
  commune               TEXT DEFAULT 'Ambodisaina',
  district              TEXT DEFAULT 'Antananarivo Avaradrano',
  quartier              TEXT,                      -- Kobo: quartier_lot
  carreau               TEXT,                      -- Kobo: carreau_lot
  adresse               TEXT,

  -- Surfaces
  superficie_declaree   NUMERIC(12,2),             -- m², saisi par l'enquêteur
  superficie_estimee    NUMERIC(12,2),             -- m², estimé sur terrain

  -- Statut foncier
  statut_propriete      TEXT,                      -- proprietaire_declare / ayant_droit / occupant_gratuit
  occupation_terrain    TEXT,                      -- type d'occupation déclaré
  nature_terrain        TEXT,                      -- sec / marecageux
  origine_droit         TEXT,                      -- occupation_ancienne / heritage / donation
  justif_propriete      TEXT,                      -- justification titre/droit

  -- Constructions
  presence_constructions BOOLEAN DEFAULT FALSE,
  nb_constructions      INTEGER DEFAULT 0,

  -- Détenteur principal (info de surface, détail dans detenteurs_foncier)
  detenteur_connu       BOOLEAN,

  -- Mise en valeur
  mise_en_valeur        TEXT[],                    -- cloture / elevage / aucune (Kobo: multiple choice)
  parcelle_amenagee     BOOLEAN,

  -- GPS
  gps_lat               DOUBLE PRECISION,
  gps_lng               DOUBLE PRECISION,

  -- Collecte
  statut_collecte       TEXT DEFAULT 'a_verifier', -- complet / a_verifier / incomplet
  difficulte_rencontree TEXT,
  observations          TEXT,
  code_agent            TEXT,                      -- agent ayant collecté les données
  date_collecte         DATE,

  -- Référence ménage (lien optionnel avec la table foyers)
  nb_menages_lot        INTEGER,

  -- Métadonnées
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE parcelles IS 'Parcelles foncières collectées via KoboToolbox FANISA (formulaire foncier)';
COMMENT ON COLUMN parcelles.foncier_id IS 'Identifiant unique FANISA de la parcelle (format FON-YYYY-XXXXXXXX)';
COMMENT ON COLUMN parcelles.lot_id IS 'Identifiant du lot parcellaire (format 20/AA-003)';
COMMENT ON COLUMN parcelles.kobo_uuid IS 'UUID de la soumission KoboToolbox — clé de déduplication';
COMMENT ON COLUMN parcelles.statut_collecte IS 'complet = données vérifiées, a_verifier = à vérifier, incomplet = manque des infos';

-- ── Table : constructions foncières ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS constructions_foncier (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcelle_id           UUID REFERENCES parcelles(id) ON DELETE CASCADE,

  -- Identifiant Kobo (repeat group)
  kobo_parent_id        TEXT,                      -- _submission__id de la feuille Kobo
  c_num                 INTEGER,                   -- numéro de construction dans la parcelle

  -- Caractéristiques
  type_construction     TEXT,                      -- maison_individuelle / appartement / commerce...
  etat                  TEXT,                      -- achevee / en_construction / ruine
  usage                 TEXT,                      -- habitation / commerce / stockage / autre
  nb_pieces             INTEGER,
  surface_m2            NUMERIC(10,2),

  -- Matériaux
  materiaux_toiture     TEXT,
  materiaux_murs        TEXT,
  materiaux_sol         TEXT,

  -- Référence ménage/propriétaire (Kobo: c_ref_maison)
  ref_maison            TEXT,

  -- Propriétaire de la construction
  proprio_nom           TEXT,                      -- Kobo: c_proprio_nom_final
  proprio_cin           TEXT,
  proprio_tel           TEXT,
  accord_terrain        TEXT,                      -- accord avec propriétaire terrain

  -- GPS de la construction
  gps_lat               DOUBLE PRECISION,
  gps_lng               DOUBLE PRECISION,

  -- Métadonnées
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE constructions_foncier IS 'Bâtiments/constructions sur les parcelles (repeat group Kobo: constructions)';

-- ── Table : détenteurs fonciers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS detenteurs_foncier (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcelle_id           UUID REFERENCES parcelles(id) ON DELETE CASCADE,

  -- Identifiant Kobo
  kobo_parent_id        TEXT,

  -- Identité
  nom                   TEXT,
  prenom                TEXT,
  type_personne         TEXT DEFAULT 'personne_physique',  -- personne_physique / personne_morale
  lien_parcelle         TEXT,                      -- ayant_droit_declare / detenteur_declare / heritier

  -- Documents
  nationalite           TEXT DEFAULT 'Malagasy',
  cin                   TEXT,
  cin_date              DATE,
  telephone             TEXT,

  -- Résidence
  reside_fkt            BOOLEAN,
  adresse               TEXT,

  -- Métadonnées
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE detenteurs_foncier IS 'Détenteurs/ayants-droit des parcelles (repeat group Kobo: detenteurs)';

-- ── Table : documents fonciers ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents_foncier (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcelle_id           UUID REFERENCES parcelles(id) ON DELETE CASCADE,

  -- Identifiant Kobo
  kobo_parent_id        TEXT,

  -- Document
  code_document         TEXT,                      -- Kobo: doc_code
  libelle               TEXT,                      -- Kobo: doc_libelle
  reference             TEXT,                      -- Kobo: doc_reference
  date_document         DATE,
  nom_inscrit           TEXT,
  autorite_emettrice    TEXT,
  superficie_inscrite   NUMERIC(12,2),
  photo_url             TEXT,                      -- Kobo: doc_photo_URL

  -- Métadonnées
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE documents_foncier IS 'Documents justificatifs de propriété (repeat group Kobo: documents)';

-- ── Table : jorolava (registre foncier local) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS jorolava_foncier (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcelle_id           UUID REFERENCES parcelles(id) ON DELETE CASCADE,

  -- Identifiant Kobo
  kobo_parent_id        TEXT,

  -- Entrée registre
  numero_jorolava       INTEGER,                   -- Kobo: jl_num
  annee                 INTEGER,                   -- Kobo: jl_annee
  reference             TEXT,                      -- Kobo: jl_reference
  nom_inscrit           TEXT,                      -- Kobo: jl_nom_inscrit
  photo_url             TEXT,                      -- Kobo: jl_photo_URL

  -- Métadonnées
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE jorolava_foncier IS 'Registre Jorolava local (repeat group Kobo: jorolava_liste)';

-- ── Table : photos terrain ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS photos_terrain (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcelle_id           UUID REFERENCES parcelles(id) ON DELETE CASCADE,

  -- Identifiant Kobo
  kobo_parent_id        TEXT,

  -- Photo
  photo_url             TEXT,                      -- Kobo: photo_terrain_URL

  -- Métadonnées
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE photos_terrain IS 'Photos du terrain/parcelle (repeat group Kobo: photos_terrain)';

-- ── Index pour les recherches courantes ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_parcelles_foncier_id    ON parcelles(foncier_id);
CREATE INDEX IF NOT EXISTS idx_parcelles_lot_id        ON parcelles(lot_id);
CREATE INDEX IF NOT EXISTS idx_parcelles_kobo_uuid     ON parcelles(kobo_uuid);
CREATE INDEX IF NOT EXISTS idx_parcelles_fokontany     ON parcelles(fokontany);
CREATE INDEX IF NOT EXISTS idx_parcelles_statut        ON parcelles(statut_collecte);
CREATE INDEX IF NOT EXISTS idx_constructions_parcelle  ON constructions_foncier(parcelle_id);
CREATE INDEX IF NOT EXISTS idx_detenteurs_parcelle     ON detenteurs_foncier(parcelle_id);
CREATE INDEX IF NOT EXISTS idx_documents_parcelle      ON documents_foncier(parcelle_id);

-- ── RLS (Row-Level Security) — même politique que les autres tables FANISA ────
ALTER TABLE parcelles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE constructions_foncier   ENABLE ROW LEVEL SECURITY;
ALTER TABLE detenteurs_foncier      ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents_foncier       ENABLE ROW LEVEL SECURITY;
ALTER TABLE jorolava_foncier        ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos_terrain          ENABLE ROW LEVEL SECURITY;

-- Politiques : accès complet pour les utilisateurs authentifiés
DO $$
DECLARE
  tables TEXT[] := ARRAY['parcelles','constructions_foncier','detenteurs_foncier','documents_foncier','jorolava_foncier','photos_terrain'];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('CREATE POLICY IF NOT EXISTS "%s_auth_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;
