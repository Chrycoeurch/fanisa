-- ═══════════════════════════════════════════════════════════
-- TABLES MATÉRIELS — Gestion de stock + prêts FANISA
-- À exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Table principale des matériels
CREATE TABLE IF NOT EXISTS materiels (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom               TEXT NOT NULL,
  categorie         TEXT NOT NULL CHECK (categorie IN ('Mobilier','Informatique','Logistique','Événementiel','Sécurité','Autre')),
  quantite_total    INTEGER NOT NULL DEFAULT 1,
  quantite_disponible INTEGER NOT NULL DEFAULT 1,
  etat              TEXT NOT NULL DEFAULT 'Bon' CHECK (etat IN ('Excellent','Bon','Moyen','Détérioré','En panne')),
  date_acquisition  DATE,
  valeur_unitaire   INTEGER NOT NULL DEFAULT 0,   -- prix unitaire en Ariary
  prix_location     INTEGER NOT NULL DEFAULT 0,   -- tarif de location par unité par jour (0 = gratuit)
  responsable       TEXT NOT NULL DEFAULT 'Secrétaire Fokontany',
  lieu_stockage     TEXT NOT NULL DEFAULT 'Salle du Fokontany',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ
);

-- Table des prêts
CREATE TABLE IF NOT EXISTS materiels_prets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  materiel_id       UUID NOT NULL REFERENCES materiels(id) ON DELETE CASCADE,
  emprunteur        TEXT NOT NULL,         -- nom de l'emprunteur
  foyer_id          UUID REFERENCES foyers(id) ON DELETE SET NULL,
  quantite          INTEGER NOT NULL DEFAULT 1,
  date_emprunt      DATE NOT NULL DEFAULT CURRENT_DATE,
  date_retour_prevue DATE NOT NULL,
  date_retour_reel  DATE,                  -- null = pas encore rendu
  tarif_total       INTEGER NOT NULL DEFAULT 0,  -- montant calculé (prix_location * qte * jours)
  statut            TEXT NOT NULL DEFAULT 'En cours' CHECK (statut IN ('En cours','Retourné')),
  notes             TEXT,
  finance_id        UUID,                  -- lien vers la recette créée dans finances (si payant)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_materiels_prets_materiel ON materiels_prets (materiel_id);
CREATE INDEX IF NOT EXISTS idx_materiels_prets_statut ON materiels_prets (statut);

-- RLS
ALTER TABLE materiels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_materiels" ON materiels;
CREATE POLICY "allow_all_materiels" ON materiels FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE materiels_prets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_materiels_prets" ON materiels_prets;
CREATE POLICY "allow_all_materiels_prets" ON materiels_prets FOR ALL USING (true) WITH CHECK (true);
