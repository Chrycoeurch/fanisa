-- Migration : Ajout des champs Kobo manquants dans la table foyers
-- Correspond aux sections §7, §10, §11, §12 du formulaire KoboToolbox
-- Fokontany Ambodisaina — recensement administratif

-- ── § Logement — état général & appartenance (Kobo §10 / §7) ──
ALTER TABLE foyers
  ADD COLUMN IF NOT EXISTS etat_logement TEXT,
  ADD COLUMN IF NOT EXISTS appartenance_maison TEXT;

-- ── § Aide sociale ménage (Kobo §7) ──
ALTER TABLE foyers
  ADD COLUMN IF NOT EXISTS aide_sociale_menage TEXT,
  ADD COLUMN IF NOT EXISTS types_aide_sociale TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS donateurs_aide_cash TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS donateurs_aide_vivres TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS donateurs_aide_sante TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS donateurs_aide_education TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS donateurs_aide_logement TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS donateurs_aide_materiaux TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS donateurs_aide_autre TEXT[] DEFAULT '{}';

-- ── § Mobile Money (Kobo §10 / connectivité) ──
ALTER TABLE foyers
  ADD COLUMN IF NOT EXISTS utilise_mobile_money BOOLEAN,
  ADD COLUMN IF NOT EXISTS operateurs_mobile_money TEXT[] DEFAULT '{}';

-- ── § Équipements du ménage (Kobo §11) ──
ALTER TABLE foyers
  ADD COLUMN IF NOT EXISTS moyen_transport TEXT,
  ADD COLUMN IF NOT EXISTS biens_menage TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS nb_motos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nb_voitures INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nb_cyclopousses INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nb_bajaj INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_vehicules TEXT[] DEFAULT '{}';

-- ── § Élevage (Kobo §12) ──
ALTER TABLE foyers
  ADD COLUMN IF NOT EXISTS pratique_elevage BOOLEAN,
  ADD COLUMN IF NOT EXISTS types_elevage TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS nb_poules INTEGER,
  ADD COLUMN IF NOT EXISTS nb_canards INTEGER,
  ADD COLUMN IF NOT EXISTS nb_oies INTEGER,
  ADD COLUMN IF NOT EXISTS nb_dindes INTEGER,
  ADD COLUMN IF NOT EXISTS nb_porcs INTEGER,
  ADD COLUMN IF NOT EXISTS nb_zebus INTEGER,
  ADD COLUMN IF NOT EXISTS nb_chevres INTEGER,
  ADD COLUMN IF NOT EXISTS nb_lapins INTEGER,
  ADD COLUMN IF NOT EXISTS nb_bassins_pisciculture INTEGER,
  ADD COLUMN IF NOT EXISTS nb_ruches INTEGER,
  ADD COLUMN IF NOT EXISTS but_elevage TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lieu_elevage TEXT,
  ADD COLUMN IF NOT EXISTS carnet_eleveur BOOLEAN,
  ADD COLUMN IF NOT EXISTS animaux_vaccines BOOLEAN;

-- Commentaires pour la documentation
COMMENT ON COLUMN foyers.etat_logement IS 'État général du logement : Bon / Moyen / Dégradé / Très dégradé (Kobo §10)';
COMMENT ON COLUMN foyers.appartenance_maison IS 'À qui appartient la maison (Kobo §7)';
COMMENT ON COLUMN foyers.aide_sociale_menage IS 'Le ménage reçoit une aide sociale ? Oui/Non/Ne sait pas/Refuse (Kobo §7)';
COMMENT ON COLUMN foyers.types_aide_sociale IS 'Types d'aide reçue (cash, vivres, santé, éducation…)';
COMMENT ON COLUMN foyers.utilise_mobile_money IS 'Le ménage utilise le Mobile Money (Kobo §10)';
COMMENT ON COLUMN foyers.operateurs_mobile_money IS 'Opérateurs Mobile Money utilisés (MVola, Orange Money…)';
COMMENT ON COLUMN foyers.moyen_transport IS 'Moyen de transport principal du ménage (Kobo §11)';
COMMENT ON COLUMN foyers.biens_menage IS 'Biens possédés par le ménage (TV, frigo, moto…) (Kobo §11)';
COMMENT ON COLUMN foyers.pratique_elevage IS 'Le ménage pratique l'élevage ? (Kobo §12)';
COMMENT ON COLUMN foyers.types_elevage IS 'Types d'animaux élevés (Kobo §12)';
