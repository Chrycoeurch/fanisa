-- Migration : Champs manquants du formulaire foncier KoboToolbox
-- Ajout de colonnes identifiées en comparant le PDF du formulaire FANISA avec le code d'import
-- Fokontany Ambodisaina — Recensement foncier

-- ── Table parcelles : champs manquants ────────────────────────────────────────

-- Section 02 : Situation foncière
ALTER TABLE parcelles
  ADD COLUMN IF NOT EXISTS annee_debut_occupation  INTEGER,         -- Kobo: annee_debut_occupation
  ADD COLUMN IF NOT EXISTS documents_propriete     TEXT,            -- Kobo: documents_etablissant_propriete (titre foncier / certificat / aucun)
  ADD COLUMN IF NOT EXISTS autres_documents        TEXT[],          -- Kobo: autres_documents (JOROLAVA / acte vente / ...)
  ADD COLUMN IF NOT EXISTS constructions_concernees TEXT,           -- Kobo: constructions_concernees
  ADD COLUMN IF NOT EXISTS superficie_gps          NUMERIC(12,2);   -- Superficie calculée depuis le polygone GPS (m²)

-- Section 08 : Origine du droit (détails)
ALTER TABLE parcelles
  ADD COLUMN IF NOT EXISTS origine_droit_detail    TEXT,            -- Précision sur l'origine (vendeur, donateur, défunt...)
  ADD COLUMN IF NOT EXISTS annee_acquisition       INTEGER;         -- Kobo: annee_acquisition (achat/donation)

-- Section 11 : Observations de l'agent
ALTER TABLE parcelles
  ADD COLUMN IF NOT EXISTS personne_rencontree     TEXT,            -- Kobo: personne_rencontree (détenteur / voisin / gardien...)
  ADD COLUMN IF NOT EXISTS besoin_verification     BOOLEAN,         -- Kobo: besoin_verification
  ADD COLUMN IF NOT EXISTS dossier_a_completer     BOOLEAN;         -- Kobo: dossier_a_completer

-- ── Table detenteurs_foncier : champs manquants ────────────────────────────────

-- Section 04 : Détenteur (champs non mappés)
ALTER TABLE detenteurs_foncier
  ADD COLUMN IF NOT EXISTS source_information      TEXT,            -- Kobo: det_source_info
  ADD COLUMN IF NOT EXISTS present_sur_place       BOOLEAN,         -- Kobo: det_present
  ADD COLUMN IF NOT EXISTS cin_lieu                TEXT,            -- Kobo: det_cin_lieu (lieu de délivrance CIN)
  ADD COLUMN IF NOT EXISTS detenteur_connu_valeur  TEXT;            -- Kobo: detenteur_connu (oui/non/incertain) au niveau détenteur

-- NOTE: type_personne accepte maintenant toutes les valeurs du formulaire:
-- personne_physique / couple / indivision / association / entreprise / etat_commune / autre / inconnu
COMMENT ON COLUMN detenteurs_foncier.type_personne IS
  'Type de détenteur: personne_physique / couple / indivision / association / entreprise / etat_commune / autre / inconnu';

COMMENT ON COLUMN detenteurs_foncier.lien_parcelle IS
  'Lien avec la parcelle: detenteur_declare / ayant_droit_declare / proprietaire_titre / heritier_declare / gestionnaire / bailleur / autre';

-- ── RLS : politiques pour rôle anon (FANISA utilise anon key) ─────────────────
-- Ces politiques permettent à l'import KoboToolbox (rôle anon) d'écrire

DO $$
DECLARE
  tables TEXT[] := ARRAY['parcelles','constructions_foncier','detenteurs_foncier','documents_foncier','jorolava_foncier','photos_terrain'];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Politique anon select
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "%s_anon_select" ON %I FOR SELECT TO anon USING (true)',
      t, t
    );
    -- Politique anon insert
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "%s_anon_insert" ON %I FOR INSERT TO anon WITH CHECK (true)',
      t, t
    );
    -- Politique anon update
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "%s_anon_update" ON %I FOR UPDATE TO anon USING (true) WITH CHECK (true)',
      t, t
    );
    -- Politique anon delete
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "%s_anon_delete" ON %I FOR DELETE TO anon USING (true)',
      t, t
    );
  END LOOP;
END $$;
