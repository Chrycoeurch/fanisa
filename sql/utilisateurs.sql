-- ═══════════════════════════════════════════════════════════
-- TABLE UTILISATEURS — Gestion des comptes FANISA
-- À exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS utilisateurs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_utilisateur TEXT NOT NULL UNIQUE,
  mot_de_passe  TEXT NOT NULL,  -- SHA-256 hex du mot de passe
  role          TEXT NOT NULL CHECK (role IN ('chef','agent','secretaire','tresorier','superviseur')),
  nom_complet   TEXT,
  actif         BOOLEAN NOT NULL DEFAULT true,
  derniere_connexion TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ
);

-- Compte admin par défaut : chef / fanisa2026
-- Changer le mot de passe immédiatement après la première connexion
INSERT INTO utilisateurs (nom_utilisateur, mot_de_passe, role, nom_complet, actif)
VALUES (
  'chef',
  'd0b17390407212ce987b57c9701fa102699b239dea23d3a9721dc520c494ce06',  -- SHA-256 de "fanisa2026"
  'chef',
  'Chef Fokontany',
  true
)
ON CONFLICT (nom_utilisateur) DO NOTHING;

-- Index pour recherche rapide au login
CREATE INDEX IF NOT EXISTS idx_utilisateurs_login ON utilisateurs (nom_utilisateur, actif);

-- RLS : table accessible par la clé anon (lecture/écriture via app uniquement)
ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;

-- Politique : lecture et écriture autorisées (contrôle géré côté app)
DROP POLICY IF EXISTS "allow_all_utilisateurs" ON utilisateurs;
CREATE POLICY "allow_all_utilisateurs" ON utilisateurs
  FOR ALL USING (true) WITH CHECK (true);
