/**
 * koboMapping.ts — Transformation des données Kobo vers le format FANISA
 *
 * Mappe les soumissions brutes des formulaires KoboToolbox vers les types
 * Foyer et Membre définis dans types.ts.
 *
 * Formulaires couverts :
 *   - fanisa_formulaire_a (ménage) → Foyer + Membres
 *   - fanisa_foncier (foncier)     → Parcelles (futur)
 *
 * Principes respectés :
 *   - Pas de double saisie : dédoublonnage par code_menage / UUID Kobo
 *   - Bilingue FR/MG : les deux colonnes sont lues si présentes
 *   - Numérotation : M1/M2… pour membres, lot format 20/AA-054
 *   - "Autre → Précisez" : champs _other lus en fallback
 */

import { Foyer, Membre } from '../types';
import { KoboSubmission } from './koboApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Lit un champ Kobo en gérant les variantes bilingues FR/MG et les _other */
function koboGet(row: KoboSubmission, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== '') return String(v).trim();
  }
  return '';
}

/** Lit un booléen depuis une réponse Kobo (yes/no, true/false, 1/0) */
function koboBool(row: KoboSubmission, key: string): boolean | undefined {
  const v = koboGet(row, key).toLowerCase();
  if (v === 'yes' || v === 'true' || v === '1' || v === 'oui') return true;
  if (v === 'no' || v === 'false' || v === '0' || v === 'non') return false;
  return undefined;
}

/** Lit un nombre depuis une réponse Kobo */
function koboNum(row: KoboSubmission, key: string): number | undefined {
  const v = koboGet(row, key);
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

/** Convertit une date Kobo (YYYY-MM-DD ou DD/MM/YYYY) vers YYYY-MM-DD */
function koboDate(raw: string): string | undefined {
  if (!raw) return undefined;
  // Déjà au format ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  // Format JJ/MM/AAAA
  const parts = raw.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
  }
  return raw;
}

/** Génère un code_menage de fallback depuis les données Kobo */
function generateCodeMenage(row: KoboSubmission, idx: number): string {
  const existing = koboGet(row, 'code_menage', 'code_famille', 'id_menage');
  if (existing) return existing;
  const year = new Date().getFullYear().toString().slice(-2);
  return `M${year}-${String(idx + 1).padStart(4, '0')}`;
}

// ── Résultat du mapping ────────────────────────────────────────────────────────

export interface KoboImportResult {
  /** Données prêtes pour Supabase */
  foyer: Partial<Foyer>;
  membres: Partial<Membre>[];
  /** UUID Kobo original pour traçabilité */
  koboUuid: string;
  /** Timestamp de soumission */
  submittedAt: string;
  /** Avertissements non-bloquants */
  warnings: string[];
}

export interface KoboFoncierResult {
  parcelle: KoboParcelle;
  koboUuid: string;
  submittedAt: string;
  warnings: string[];
}

export interface KoboParcelle {
  numero_lot?: string;
  superficie?: number;
  nature?: string;
  usage?: string;
  proprietaire_nom?: string;
  proprietaire_prenom?: string;
  proprietaire_cin?: string;
  gps_lat?: number;
  gps_lng?: number;
  adresse?: string;
  fokontany?: string;
  commune?: string;
  district?: string;
  statut_juridique?: string;
  titre_foncier?: string;
  observations?: string;
  kobo_uuid?: string;
}

// ── Mapping formulaire MÉNAGE ─────────────────────────────────────────────────

export function mapKoboMenage(row: KoboSubmission, idx: number): KoboImportResult {
  const warnings: string[] = [];

  // ── Foyer ──────────────────────────────────────────────────────────────────
  const fokontany = koboGet(row,
    'fokontany', 'Fokontany', 'fokontany_fr', 'fokontany_mg',
    'group_localisation/fokontany'
  ) || 'Ambodisaina';

  const codeMenage = generateCodeMenage(row, idx);

  const adresse = koboGet(row,
    'adresse', 'adresse_fr', 'adresse_complete',
    'group_localisation/adresse', 'rue_quartier'
  );

  const foyer: Partial<Foyer> = {
    code_menage: codeMenage,
    statut: 'Actif',
    fokontany,
    commune: koboGet(row, 'commune', 'Commune', 'group_localisation/commune') || 'Ambodisaina',
    district: koboGet(row, 'district', 'District', 'group_localisation/district') || 'Antananarivo Avaradrano',
    adresse: adresse || `${fokontany}, Ambodisaina`,
    nombre_membres: 0, // sera recalculé

    // Logement
    type_logement: koboGet(row, 'type_logement', 'type_habitat', 'group_logement/type_logement'),
    nombre_pieces: koboNum(row, 'nombre_pieces') ?? koboNum(row, 'group_logement/nombre_pieces'),
    materiau_toiture: koboGet(row, 'materiau_toiture', 'group_logement/materiau_toiture'),
    materiau_mur: koboGet(row, 'materiau_mur', 'group_logement/materiau_mur'),
    materiau_plancher: koboGet(row, 'materiau_plancher', 'group_logement/materiau_plancher'),
    statut_occupant: koboGet(row, 'statut_occupant', 'statut_occupation', 'group_logement/statut_occupant'),

    // GPS
    gps_lat: koboNum(row, '_geolocation/0') ?? koboNum(row, 'gps_lat') ?? koboNum(row, 'localisation/_geolocation_latitude'),
    gps_lng: koboNum(row, '_geolocation/1') ?? koboNum(row, 'gps_lng') ?? koboNum(row, 'localisation/_geolocation_longitude'),

    // Eau
    eau_source: koboGet(row, 'source_eau', 'eau_source', 'group_eau/source_eau'),
    eau_potable: koboBool(row, 'eau_potable') ?? koboBool(row, 'group_eau/eau_potable'),

    // Assainissement
    toilette_type: koboGet(row, 'type_toilette', 'toilette', 'group_assainissement/type_toilette'),

    // Énergie
    a_electricite: koboBool(row, 'a_electricite') ?? koboBool(row, 'electricite'),
    eclairage_source: koboGet(row, 'source_eclairage', 'eclairage', 'group_energie/source_eclairage'),
    cuisson_source: koboGet(row, 'source_cuisson', 'cuisson', 'group_energie/source_cuisson'),

    // Connectivité
    reseau_mobile: koboGet(row, 'reseau_mobile', 'operateur_mobile'),
    acces_internet: koboBool(row, 'acces_internet'),

    // Vulnérabilité
    est_vulnerable: koboBool(row, 'est_vulnerable') ?? koboBool(row, 'menage_vulnerable'),
    difficulte_alimentaire: koboBool(row, 'difficulte_alimentaire') ?? koboBool(row, 'insecurite_alimentaire'),
  };

  // Nettoyer les undefined
  Object.keys(foyer).forEach(k => {
    if ((foyer as Record<string, unknown>)[k] === undefined) {
      delete (foyer as Record<string, unknown>)[k];
    }
  });

  // ── Membres ────────────────────────────────────────────────────────────────
  const membres: Partial<Membre>[] = [];

  // Stratégie 1 : groupe repeat "membres" (KoboToolbox repeat group)
  const membresRepeat = row['membres'] ?? row['group_membres'] ?? row['personnes'];
  if (Array.isArray(membresRepeat) && membresRepeat.length > 0) {
    for (const m of membresRepeat as KoboSubmission[]) {
      membres.push(mapKoboMembre(m, codeMenage, membres.length, warnings));
    }
  }
  // Stratégie 2 : champs plats (chef_nom, membre_2_nom, etc.)
  else {
    const chef = mapKoboChefFromFlat(row, codeMenage, warnings);
    if (chef) membres.push(chef);

    for (let i = 2; i <= 12; i++) {
      const nom = koboGet(row,
        `membre_${i}_nom`, `personne_${i}_nom`, `m${i}_nom`,
        `group_membres/membre_${i}/nom`
      );
      if (!nom) break;
      membres.push(mapKoboMembrePlat(row, i, codeMenage, warnings));
    }
  }

  if (membres.length === 0) {
    warnings.push(`Aucun membre trouvé pour le ménage ${codeMenage} (UUID: ${row._uuid})`);
  }

  foyer.nombre_membres = membres.length;

  return {
    foyer,
    membres,
    koboUuid: String(row._uuid || row._id || ''),
    submittedAt: String(row._submission_time || ''),
    warnings,
  };
}

/** Mappe un membre depuis un repeat group Kobo */
function mapKoboMembre(
  m: KoboSubmission,
  codeMenage: string,
  idx: number,
  warnings: string[]
): Partial<Membre> {
  const nom = koboGet(m, 'nom', 'nom_fr', 'anarana');
  const prenom = koboGet(m, 'prenom', 'prenom_fr', 'fanampin_anarana');
  if (!nom) warnings.push(`Membre #${idx+1} sans nom dans le ménage ${codeMenage}`);

  const sexeRaw = koboGet(m, 'sexe', 'genre', 'lahy_vavy').toLowerCase();
  const sexe: 'M' | 'F' = (sexeRaw === 'f' || sexeRaw === 'féminin' || sexeRaw === 'vavy') ? 'F' : 'M';

  const isChef = idx === 0 ||
    koboGet(m, 'relation_chef', 'relation', 'lien_parente').toLowerCase().includes('chef');

  return {
    nom: nom || '—',
    prenom: prenom || '',
    sexe,
    statut: 'Actif',
    is_chef: isChef,
    relation_chef: isChef ? 'Chef' : mapRelation(koboGet(m, 'relation_chef', 'relation', 'lien_parente')),
    date_naissance: koboDate(koboGet(m, 'date_naissance', 'naissance', 'daty_nahaterahan')),
    lieu_naissance: koboGet(m, 'lieu_naissance', 'toerana_nahaterahan'),
    nationalite: koboGet(m, 'nationalite', 'nationality') || 'Malagasy',
    cin: koboGet(m, 'cin', 'numero_cin', 'cin_number'),
    situation_matrimoniale: koboGet(m, 'situation_matrimoniale', 'statut_matrimonial', 'fanambadiana'),
    niveau_etude: koboGet(m, 'niveau_etude', 'niveau_scolaire', 'fanabeazana') || 'Non précisé',
    profession: koboGet(m, 'profession', 'metier', 'asa'),
    telephone: koboGet(m, 'telephone', 'tel', 'finday'),
    competences: [],
    langues: ['Malagasy'],
  };
}

/** Mappe le chef de ménage depuis des champs plats (chef_nom, chef_prenom…) */
function mapKoboChefFromFlat(row: KoboSubmission, codeMenage: string, warnings: string[]): Partial<Membre> | null {
  const nom = koboGet(row, 'chef_nom', 'nom_chef', 'chef_menage_nom', 'nom_responsable');
  if (!nom) {
    warnings.push(`Chef de ménage sans nom pour ${codeMenage}`);
    return null;
  }

  const sexeRaw = koboGet(row, 'chef_sexe', 'sexe_chef', 'genre_chef').toLowerCase();
  const sexe: 'M' | 'F' = (sexeRaw === 'f' || sexeRaw === 'féminin' || sexeRaw === 'vavy') ? 'F' : 'M';

  return {
    nom,
    prenom: koboGet(row, 'chef_prenom', 'prenom_chef', 'prenom_responsable'),
    sexe,
    statut: 'Actif',
    is_chef: true,
    relation_chef: 'Chef',
    date_naissance: koboDate(koboGet(row, 'chef_date_naissance', 'date_naissance_chef')),
    lieu_naissance: koboGet(row, 'chef_lieu_naissance', 'lieu_naissance_chef'),
    nationalite: koboGet(row, 'chef_nationalite') || 'Malagasy',
    cin: koboGet(row, 'chef_cin', 'cin_chef', 'numero_cin_chef'),
    situation_matrimoniale: koboGet(row, 'chef_situation_matrimoniale', 'situation_matrimoniale'),
    niveau_etude: koboGet(row, 'chef_niveau_etude', 'niveau_etude') || 'Non précisé',
    profession: koboGet(row, 'chef_profession', 'profession_chef'),
    telephone: koboGet(row, 'chef_telephone', 'telephone_chef', 'tel_contact'),
    competences: [],
    langues: ['Malagasy'],
  };
}

/** Mappe un membre numéroté depuis des champs plats (membre_2_nom, membre_2_prenom…) */
function mapKoboMembrePlat(row: KoboSubmission, n: number, codeMenage: string, _w: string[]): Partial<Membre> {
  const prefix = [`membre_${n}`, `personne_${n}`, `m${n}`];
  const nom = koboGet(row, ...prefix.map(p => `${p}_nom`));
  const prenom = koboGet(row, ...prefix.map(p => `${p}_prenom`));
  const sexeRaw = koboGet(row, ...prefix.map(p => `${p}_sexe`)).toLowerCase();
  const sexe: 'M' | 'F' = (sexeRaw === 'f' || sexeRaw === 'féminin') ? 'F' : 'M';

  return {
    nom: nom || '—',
    prenom: prenom || '',
    sexe,
    statut: 'Actif',
    is_chef: false,
    relation_chef: mapRelation(koboGet(row, ...prefix.map(p => `${p}_relation`))),
    date_naissance: koboDate(koboGet(row, ...prefix.map(p => `${p}_date_naissance`))),
    nationalite: 'Malagasy',
    niveau_etude: koboGet(row, ...prefix.map(p => `${p}_niveau_etude`)) || 'Non précisé',
    profession: koboGet(row, ...prefix.map(p => `${p}_profession`)),
    competences: [],
    langues: ['Malagasy'],
  };
}

/** Mappe une relation Kobo vers le type RelationChef */
function mapRelation(raw: string): import('../types').RelationChef {
  const r = raw.toLowerCase();
  if (r.includes('épou') || r.includes('femme') || r.includes('vady')) return 'Épouse/Époux';
  if (r.includes('fils') || r.includes('lahy') && r.includes('zanaka')) return 'Fils';
  if (r.includes('fille') || r.includes('vavy') && r.includes('zanaka')) return 'Fille';
  if (r.includes('père') || r.includes('papa') || r.includes('baba')) return 'Père';
  if (r.includes('mère') || r.includes('mama') || r.includes('neny')) return 'Mère';
  if (r.includes('frère') || r.includes('rahalahy')) return 'Frère';
  if (r.includes('sœur') || r.includes('anabavy')) return 'Sœur';
  if (r.includes('grand-père') || r.includes('dadabe')) return 'Grand-père';
  if (r.includes('grand-mère') || r.includes('nenibe')) return 'Grand-mère';
  if (r.includes('petit-fils')) return 'Petit-fils';
  if (r.includes('petite-fille')) return 'Petite-fille';
  if (r.includes('oncle') || r.includes('rangahy')) return 'Oncle';
  if (r.includes('tante') || r.includes('rangahy vavy')) return 'Tante';
  if (r.includes('neveu')) return 'Neveu';
  if (r.includes('nièce')) return 'Nièce';
  return 'Autre';
}

// ── Mapping formulaire FONCIER ────────────────────────────────────────────────

export function mapKoboFoncier(row: KoboSubmission): KoboFoncierResult {
  const warnings: string[] = [];

  const parcelle: KoboParcelle = {
    numero_lot: koboGet(row, 'numero_lot', 'lot', 'ref_parcelle', 'num_parcelle'),
    superficie: koboNum(row, 'superficie') ?? koboNum(row, 'superficie_m2') ?? koboNum(row, 'surface'),
    nature: koboGet(row, 'nature_terrain', 'nature', 'type_terrain'),
    usage: koboGet(row, 'usage_terrain', 'usage', 'utilisation'),
    proprietaire_nom: koboGet(row, 'proprietaire_nom', 'tompon_tany_nom', 'nom_proprietaire'),
    proprietaire_prenom: koboGet(row, 'proprietaire_prenom', 'tompon_tany_prenom'),
    proprietaire_cin: koboGet(row, 'proprietaire_cin', 'cin_proprietaire'),
    gps_lat: koboNum(row, '_geolocation/0') ?? koboNum(row, 'gps_lat') ?? koboNum(row, 'parcelle_gps_latitude'),
    gps_lng: koboNum(row, '_geolocation/1') ?? koboNum(row, 'gps_lng') ?? koboNum(row, 'parcelle_gps_longitude'),
    adresse: koboGet(row, 'adresse_parcelle', 'localisation', 'adresse'),
    fokontany: koboGet(row, 'fokontany', 'Fokontany') || 'Ambodisaina',
    commune: koboGet(row, 'commune', 'Commune') || 'Ambodisaina',
    district: koboGet(row, 'district') || 'Antananarivo Avaradrano',
    statut_juridique: koboGet(row, 'statut_juridique', 'titre', 'type_titre'),
    titre_foncier: koboGet(row, 'titre_foncier', 'numero_titre', 'ref_titre'),
    observations: koboGet(row, 'observations', 'notes', 'remarques'),
    kobo_uuid: String(row._uuid || ''),
  };

  if (!parcelle.numero_lot) {
    warnings.push(`Parcelle sans numéro de lot (UUID: ${row._uuid})`);
  }

  return {
    parcelle,
    koboUuid: String(row._uuid || ''),
    submittedAt: String(row._submission_time || ''),
    warnings,
  };
}

// ── Dédoublonnage ─────────────────────────────────────────────────────────────

export interface DeduplicationResult {
  toInsert: KoboImportResult[];
  duplicates: { item: KoboImportResult; reason: string }[];
}

export function deduplicateKoboResults(
  results: KoboImportResult[],
  existingCodesMenage: Set<string>
): DeduplicationResult {
  const toInsert: KoboImportResult[] = [];
  const duplicates: { item: KoboImportResult; reason: string }[] = [];
  const seenUuids = new Set<string>();
  const seenCodes = new Set<string>(existingCodesMenage);

  for (const r of results) {
    // Doublon par UUID Kobo
    if (r.koboUuid && seenUuids.has(r.koboUuid)) {
      duplicates.push({ item: r, reason: `UUID Kobo en double : ${r.koboUuid}` });
      continue;
    }
    // Doublon par code_menage déjà en base ou dans ce lot
    const code = r.foyer.code_menage || '';
    if (code && seenCodes.has(code)) {
      duplicates.push({ item: r, reason: `Code ménage déjà existant : ${code}` });
      continue;
    }
    if (r.koboUuid) seenUuids.add(r.koboUuid);
    if (code) seenCodes.add(code);
    toInsert.push(r);
  }

  return { toInsert, duplicates };
}
