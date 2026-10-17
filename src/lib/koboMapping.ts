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

import * as XLSX from 'xlsx';
import { Foyer, Membre } from '../types';
import { KoboSubmission } from './koboApi';

// ── Parsing XLSX KoboCollect ──────────────────────────────────────────────────

/**
 * Lit un export XLSX KoboCollect et retourne les soumissions prêtes pour mapKoboMenage.
 *
 * Structure attendue :
 *   - Feuille principale : une ligne par soumission, colonnes = noms de champs Kobo
 *   - Feuille "personnes" : repeat group membres (liée via _index/_parent_index)
 *   - Feuille "vahiny" : visiteurs (optionnel)
 *
 * @param file  Fichier .xlsx sélectionné par l'utilisateur
 * @returns     Tableau de KoboSubmission avec le repeat group "personnes" imbriqué
 */
export async function parseKoboXlsxMenage(file: File): Promise<KoboSubmission[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });

  // Feuille principale
  const mainSheet = wb.Sheets[wb.SheetNames[0]];
  const mainRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(mainSheet, { defval: null });

  // Debug : noms de feuilles disponibles (visible dans la console du navigateur)
  console.debug('[FANISA XLSX] Feuilles trouvées :', wb.SheetNames);
  if (mainRows[0]) {
    console.debug('[FANISA XLSX] Colonnes feuille principale (10 premières) :', Object.keys(mainRows[0]).slice(0, 10));
  }

  // Feuille personnes (repeat group) — cherche plusieurs variantes de nom
  // KoboCollect exporte souvent : "personnes", "personnes_du_menage", "members", etc.
  // On exclut la feuille principale (index 0) pour ne pas la confondre.
  const personnesSheetName = wb.SheetNames.slice(1).find(n =>
    /^personnes?/i.test(n.trim()) ||
    /membre/i.test(n) ||
    /person/i.test(n) ||
    /^membres?/i.test(n.trim()) ||
    /^foyer.membre/i.test(n.trim()) ||
    /zanaka/i.test(n) // malgache: membres de la famille
  );
  const personnesSheet = personnesSheetName ? wb.Sheets[personnesSheetName] : undefined;
  let personnesRows: Record<string, unknown>[] = [];
  if (personnesSheet) {
    personnesRows = XLSX.utils.sheet_to_json(personnesSheet, { defval: null });
    console.debug(`[FANISA XLSX] Feuille personnes "${personnesSheetName}" : ${personnesRows.length} lignes`);
    if (personnesRows[0]) {
      console.debug('[FANISA XLSX] Colonnes personnes :', Object.keys(personnesRows[0]).slice(0, 15));
    }
  } else {
    console.warn('[FANISA XLSX] Feuille "personnes" introuvable. Feuilles dispo :', wb.SheetNames);
  }

  // Feuille vahiny (visiteurs)
  const vahinySheetName = wb.SheetNames.find(n => /^vahiny$/i.test(n.trim()) || /visiteur/i.test(n));
  const vahinySheet = vahinySheetName ? wb.Sheets[vahinySheetName] : undefined;
  let vahinyRows: Record<string, unknown>[] = [];
  if (vahinySheet) {
    vahinyRows = XLSX.utils.sheet_to_json(vahinySheet, { defval: null });
  }

  // Regrouper personnes par _parent_index
  // IMPORTANT : chercher la clé _parent_index avec ou sans préfixe de groupe
  // (SheetJS peut retourner la clé exacte ou avec préfixe selon la version du XLSX)
  const findParentIdx = (p: Record<string, unknown>): number => {
    // Clé exacte
    if (p['_parent_index'] !== undefined && p['_parent_index'] !== null) {
      const v = Number(p['_parent_index']);
      if (!isNaN(v) && v > 0) return v;
    }
    // Chercher parmi toutes les clés
    for (const [k, v] of Object.entries(p)) {
      if (k === '_parent_index' || k.endsWith('/_parent_index') || k.endsWith('__parent_index')) {
        const n = Number(v);
        if (!isNaN(n) && n > 0) return n;
      }
    }
    return 0;
  };

  const personnesParParent = new Map<number, Record<string, unknown>[]>();
  for (const p of personnesRows) {
    const parentIdx = findParentIdx(p);
    if (parentIdx === 0) continue;
    if (!personnesParParent.has(parentIdx)) personnesParParent.set(parentIdx, []);
    personnesParParent.get(parentIdx)!.push(p);
  }
  console.debug('[FANISA XLSX] Index parents trouvés :', [...personnesParParent.keys()]);
  console.debug('[FANISA XLSX] Nb personnes par parent :', Object.fromEntries(
    [...personnesParParent.entries()].map(([k, v]) => [k, v.length])
  ));

  // Regrouper vahiny par _parent_index
  const vahinyParParent = new Map<number, Record<string, unknown>[]>();
  for (const v of vahinyRows) {
    const parentIdx = findParentIdx(v);
    if (!vahinyParParent.has(parentIdx)) vahinyParParent.set(parentIdx, []);
    vahinyParParent.get(parentIdx)!.push(v);
  }

  // Construire les soumissions avec sous-tableaux imbriqués
  // IMPORTANT : _index est à la colonne 346 (dernière) dans ce XLSX.
  // sheet_to_json avec defval:null peut retourner null pour les cellules vides,
  // mais _index a toujours une valeur. On cherche aussi avec préfixe.
  const findMainIdx = (row: Record<string, unknown>, fallback: number): number => {
    // Clé exacte
    if (row['_index'] !== undefined && row['_index'] !== null) {
      const v = Number(row['_index']);
      if (!isNaN(v) && v > 0) return v;
    }
    // Chercher parmi toutes les clés (cas où SheetJS préfixe)
    for (const [k, v] of Object.entries(row)) {
      if (k === '_index' || k.endsWith('/_index')) {
        const n = Number(v);
        if (!isNaN(n) && n > 0) return n;
      }
    }
    return fallback;
  };

  return mainRows.map((row, i) => {
    const idx = findMainIdx(row, i + 1);
    const personnes = personnesParParent.get(idx) ?? [];
    const vahiny = vahinyParParent.get(idx) ?? [];

    console.debug(`[FANISA XLSX] Soumission ${i+1}: _index=${idx}, personnes=${personnes.length}, vahiny=${vahiny.length}`);

    return {
      ...normaliseRowMenage(row),
      personnes: personnes.map(p => p as unknown as KoboSubmission),
      vahiny: vahiny.map(v => v as unknown as KoboSubmission),
    } as unknown as KoboSubmission;
  });
}

/**
 * Lit un export XLSX KoboCollect foncier et retourne les soumissions.
 *
 * Structure :
 *   - Feuille principale
 *   - Feuille "constructions" : repeat group bâtiments
 *   - Feuille "detenteurs"   : repeat group détenteurs
 *   - Feuille "documents"    : repeat group documents
 */
export async function parseKoboXlsxFoncier(file: File): Promise<KoboSubmission[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });

  const mainSheet = wb.Sheets[wb.SheetNames[0]];
  const mainRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(mainSheet, { defval: null });

  // Sous-tables
  const subTables: Record<string, Map<number, Record<string, unknown>[]>> = {};
  for (const name of ['constructions', 'detenteurs', 'documents', 'heritiers', 'jorolava_liste']) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
    const map = new Map<number, Record<string, unknown>[]>();
    for (const r of rows) {
      const parentIdx = Number(r['_parent_index'] ?? 0);
      if (!map.has(parentIdx)) map.set(parentIdx, []);
      map.get(parentIdx)!.push(r);
    }
    subTables[name] = map;
  }

  return mainRows.map((row, i) => {
    const idx = Number(row['_index'] ?? (i + 1));
    const submission: Record<string, unknown> = { ...normaliseRowFoncier(row) };

    for (const [name, map] of Object.entries(subTables)) {
      submission[name] = (map.get(idx) ?? map.get(i + 1) ?? []).map(r => r as KoboSubmission);
    }

    return submission as KoboSubmission;
  });
}

/** Normalise les noms de champs du formulaire ménage pour compatibilité avec mapKoboMenage */
function normaliseRowMenage(row: Record<string, unknown>): Record<string, unknown> {
  const n: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    // Normaliser les dates JavaScript -> ISO string
    const val = v instanceof Date ? v.toISOString() : v;
    n[k] = val;
  }

  // Alias pour les champs utilisés par mapKoboMenage
  // GPS : convertir "LAT LNG ALT PREC" en _geolocation tableau
  const gps = n['gps'] as string | null;
  if (gps && typeof gps === 'string') {
    const parts = gps.trim().split(/\s+/);
    if (parts.length >= 2) {
      n['_geolocation/0'] = parseFloat(parts[0]);
      n['_geolocation/1'] = parseFloat(parts[1]);
    }
  }
  // GPS split par Kobo (_gps_latitude)
  if (!n['_geolocation/0'] && n['_gps_latitude']) {
    n['_geolocation/0'] = n['_gps_latitude'];
    n['_geolocation/1'] = n['_gps_longitude'];
  }

  // Noms de champs directs déjà bien nommés dans le formulaire FANISA :
  // menage_id, numero_lot, quartier_final, carreau_final, maison_id, unite_id,
  // nom_chef_menage, person_count, statut_occupation, consentement → OK tels quels

  return n;
}

/** Normalise les noms de champs du formulaire foncier */
function normaliseRowFoncier(row: Record<string, unknown>): Record<string, unknown> {
  const n: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const val = v instanceof Date ? v.toISOString() : v;
    n[k] = val;
  }

  // Alias pour mapKoboFoncier (qui attend des noms génériques)
  n['numero_lot']    = n['lot_id']    ?? n['lot_norm']   ?? n['numero_lot'];
  n['quartier_final']= n['quartier_lot'] ?? n['quartier_final'];
  n['carreau_final'] = n['carreau_lot']  ?? n['carreau_final'];
  n['code_agent']    = n['agent']     ?? n['code_agent'];
  n['parcelle_id']   = n['foncier_id']   ?? n['parcelle_id'];

  // GPS visite foncière
  const gpsVisite = n['gps_visite_fonciere'] as string | null;
  if (gpsVisite && typeof gpsVisite === 'string') {
    const parts = gpsVisite.trim().split(/\s+/);
    if (parts.length >= 2) {
      n['_geolocation/0'] = parseFloat(parts[0]);
      n['_geolocation/1'] = parseFloat(parts[1]);
    }
  }
  if (!n['_geolocation/0'] && n['_gps_visite_fonciere_latitude']) {
    n['_geolocation/0'] = n['_gps_visite_fonciere_latitude'];
    n['_geolocation/1'] = n['_gps_visite_fonciere_longitude'];
  }

  // Champs détenteur (depuis sous-table ou champs plats)
  // La sous-table "detenteurs" sera traitée séparément dans mapKoboFoncierXlsx
  n['detenteur_nom']    = n['det_nom']    ?? n['detenteur_nom'];
  n['detenteur_prenom'] = n['det_prenom'] ?? n['detenteur_prenom'];
  n['detenteur_cin']    = n['det_cin']    ?? n['detenteur_cin'];
  n['detenteur_tel']    = n['det_telephone'] ?? n['detenteur_tel'];
  n['detenteur_type']   = n['det_type']   ?? n['detenteur_type'];

  // Surfaces
  n['superficie_m2'] = n['superficie_declaree'] ?? n['superficie_estimee'] ?? n['superficie_m2'];
  n['nature_terrain']  = n['nature_terrain'] ?? n['presence_final'];

  return n;
}

// ── Validation identifiant FANISA ──────────────────────────────────────────────

/**
 * Format : AMB-(TRV|THN|BTN|MHV|AMN)-YY-X-XXXXX
 * Exemple : AMB-TRV-26-T-EJC2U  (T = Titulaire)
 *           AMB-TRV-26-P-80973  (P = Provisoire, ou autre type)
 * Le 4e segment peut être n'importe quelle lettre majuscule (T, P, M…)
 * Alphabet QR : 23456789ABCDEFGHJKMNPQRSTUVWXYZ (exclut 0,O,1,I,L)
 */
export const RX_MENAGE_ID = /^AMB-(TRV|THN|BTN|MHV|AMN)-[0-9]{2}-[A-Z]-[2-9A-HJKMNP-Z]{5}$/;

export function normaliserId(saisie: string): string {
  return saisie.trim().toUpperCase();
}

export function idValide(saisie: string): boolean {
  return RX_MENAGE_ID.test(normaliserId(saisie));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Lit un champ Kobo en gérant les variantes bilingues FR/MG et les _other.
 *
 * Dans l'export XLSX KoboCollect, les colonnes du repeat group ont souvent un
 * préfixe de groupe : "personnes/nom_prenoms" au lieu de "nom_prenoms".
 * Cette fonction essaie d'abord la clé exacte, puis recherche parmi toutes
 * les clés de l'objet celles qui se terminent par "/clé".
 */
function koboGet(row: KoboSubmission, ...keys: string[]): string {
  for (const k of keys) {
    // 1. Clé exacte
    const v = row[k];
    if (v !== undefined && v !== null && v !== '') return String(v).trim();
    // 2. Clé avec préfixe de groupe (ex: "personnes/nom_prenoms")
    for (const fullKey of Object.keys(row)) {
      if (fullKey.endsWith('/' + k)) {
        const vv = row[fullKey];
        if (vv !== undefined && vv !== null && vv !== '') return String(vv).trim();
      }
    }
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
function koboNum(row: KoboSubmission, ...keys: string[]): number | undefined {
  const v = koboGet(row, ...keys);
  if (!v) return undefined;
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

/**
 * Récupère le menage_id depuis le formulaire Kobo.
 * Chemin Kobo : grp_enquete/grp_identifiants/menage_id
 * Fallback : autres noms possibles, puis génération d'urgence.
 */
function getCodeMenage(row: KoboSubmission, idx: number): { code: string; valid: boolean } {
  // Priorité 1 : chemin exact du formulaire FANISA
  const fromKobo = koboGet(
    row,
    'grp_enquete/grp_identifiants/menage_id',
    'menage_id',
    'id_menage',
    'code_menage',
    'code_famille',
  );
  if (fromKobo) {
    const normalised = normaliserId(fromKobo);
    return { code: normalised, valid: idValide(normalised) };
  }
  // Fallback d'urgence (si Kobo ne fournit pas de menage_id)
  const year = new Date().getFullYear().toString().slice(-2);
  return { code: `SECOURS-${year}-${String(idx + 1).padStart(4, '0')}`, valid: false };
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
    'grp_enquete/grp_localisation/quartier_final',
    'grp_enquete/grp_localisation/fokontany',
    'fokontany', 'Fokontany', 'fokontany_fr', 'fokontany_mg',
    'group_localisation/fokontany'
  ) || 'Ambodisaina';

  // Identifiant principal : menage_id du carnet QR
  const { code: codeMenage, valid: codeValide } = getCodeMenage(row, idx);
  if (!codeValide) {
    warnings.push(`menage_id invalide ou absent : "${codeMenage}" (UUID Kobo: ${row._uuid}). Format attendu : AMB-QQQ-AA-T-XXXXX`);
  }

  // Numéro de lot (lien avec le formulaire Foncier)
  const numeroLot = koboGet(row,
    'grp_enquete/grp_lot/numero_lot',
    'numero_lot', 'num_lot', 'lot'
  );

  // Maison ID et unité (pour construction M1, U1)
  const maisonId = koboGet(row, 'grp_enquete/grp_identifiants/maison_id', 'maison_id');
  const uniteId  = koboGet(row, 'grp_enquete/grp_identifiants/unite_id',  'unite_id');

  // Carreau
  const carreau = koboGet(row,
    'grp_enquete/grp_localisation/carreau_final',
    'carreau_final', 'carreau', 'num_carreau'
  );

  const adresse = koboGet(row,
    'adresse', 'adresse_fr', 'adresse_complete',
    'group_localisation/adresse', 'rue_quartier'
  );

  // ── GPS : colonnes directes du XLSX (_gps_latitude/_gps_longitude) ────────
  const gpsLat = koboNum(row, '_gps_latitude')
    ?? koboNum(row, '_geolocation/0')
    ?? koboNum(row, 'gps_lat')
    ?? koboNum(row, 'localisation/_geolocation_latitude');
  const gpsLng = koboNum(row, '_gps_longitude')
    ?? koboNum(row, '_geolocation/1')
    ?? koboNum(row, 'gps_lng')
    ?? koboNum(row, 'localisation/_geolocation_longitude');

  // ── Énergie : colonnes réelles du XLSX ────────────────────────────────────
  const sourceElec = koboGet(row, 'source_electricite', 'source_eclairage', 'group_energie/source_eclairage');
  const aElec = sourceElec
    ? sourceElec !== 'aucun' && sourceElec !== 'non' && sourceElec !== ''
    : (koboBool(row, 'a_electricite') ?? koboBool(row, 'electricite') ?? false);
  const cuissonSource = koboGet(row,
    'combustible_principal_final', 'combustible_principal',
    'source_cuisson', 'cuisson', 'group_energie/source_cuisson'
  );

  // ── Eau : colonne réelle du XLSX ──────────────────────────────────────────
  const eauSource = koboGet(row, 'acces_eau', 'source_eau', 'eau_source', 'group_eau/source_eau');

  // ── Assainissement ────────────────────────────────────────────────────────
  const toiletteType = koboGet(row,
    'type_toilettes', 'type_toilette', 'toilette', 'group_assainissement/type_toilette'
  );
  const dechetsMode = koboGet(row, 'gestion_dechets', 'dechets_mode', 'evacuation_dechets');

  // ── Connectivité ──────────────────────────────────────────────────────────
  const accesConnectivite = koboGet(row, 'acces_connectivite', 'connectivite');
  const aInternet = accesConnectivite
    ? accesConnectivite !== 'aucun' && accesConnectivite !== ''
    : (koboBool(row, 'acces_internet') ?? false);
  const internetMoyens = accesConnectivite && accesConnectivite !== 'aucun'
    ? accesConnectivite.split(' ').filter(Boolean)
    : undefined;
  // Mobile money / réseau
  const operateurMM = koboGet(row, 'operateur_mobile_money', 'reseau_mobile', 'operateur_mobile');
  const reseauMobile = operateurMM || koboGet(row, 'reseau_mobile', 'operateur_mobile');

  // ── Aide sociale ──────────────────────────────────────────────────────────
  const aideSociale = koboGet(row, 'aide_sociale');
  const aideRecue = aideSociale ? aideSociale === 'oui' : undefined;
  const aideTypes = koboGet(row, 'type_aide_sociale');
  const aideDonateur = koboGet(row, 'donateur');

  // ── Vulnérabilité ─────────────────────────────────────────────────────────
  const niveauVulnerabilite = koboGet(row, 'niveau_vulnerabilite', 'niveau_vulnerabilite_global');
  const scoreVulnerabilite = koboGet(row, 'score_vulnerabilite_total');
  const estVulnerable = koboBool(row, 'est_vulnerable')
    ?? koboBool(row, 'menage_vulnerable')
    ?? (scoreVulnerabilite ? Number(scoreVulnerabilite) > 0 : undefined);

  const foyer: Partial<Foyer> = {
    code_menage: codeMenage,
    statut: 'Actif',
    fokontany,
    commune: koboGet(row, 'grp_enquete/grp_localisation/commune', 'commune', 'Commune', 'group_localisation/commune') || 'Ambodisaina',
    district: koboGet(row, 'grp_enquete/grp_localisation/district', 'district', 'District', 'group_localisation/district') || 'Antananarivo Avaradrano',
    adresse: adresse || `${fokontany}, Ambodisaina`,
    carreau: carreau || undefined,
    nombre_membres: 0, // sera recalculé
    // Lot et identifiants logement
    ...(numeroLot ? { numero_maison: numeroLot } : {}),
    ...(maisonId  ? { identification_logement: maisonId } : {}),

    // GPS (colonnes directes XLSX _gps_latitude/_gps_longitude)
    ...(gpsLat != null ? { gps_lat: gpsLat } : {}),
    ...(gpsLng != null ? { gps_lng: gpsLng } : {}),

    // Logement
    type_logement: koboGet(row, 'type_logement', 'type_habitat', 'group_logement/type_logement'),
    nombre_pieces: koboNum(row, 'nombre_pieces', 'nb_pieces', 'group_logement/nombre_pieces') ?? undefined,
    conditions_vie: koboGet(row, 'etat_logement', 'conditions_vie') || undefined,
    materiau_toiture: koboGet(row, 'materiau_toiture', 'group_logement/materiau_toiture'),
    materiau_mur: koboGet(row, 'materiau_mur', 'group_logement/materiau_mur'),
    materiau_plancher: koboGet(row, 'materiau_plancher', 'group_logement/materiau_plancher'),
    statut_occupant: koboGet(row, 'statut_occupant', 'statut_occupation', 'group_logement/statut_occupant'),

    // Eau (colonne réelle XLSX : acces_eau)
    eau_source: eauSource || undefined,
    eau_potable: eauSource
      ? ['robinet_logement', 'robinet_quartier', 'eau_minerale'].includes(eauSource)
      : (koboBool(row, 'eau_potable') ?? undefined),

    // Assainissement
    toilette_type: toiletteType || undefined,
    dechets_mode: dechetsMode || undefined,

    // Énergie (colonnes réelles XLSX)
    a_electricite: aElec || undefined,
    eclairage_source: sourceElec || undefined,
    cuisson_source: cuissonSource || undefined,

    // Connectivité
    reseau_mobile: reseauMobile || undefined,
    acces_internet: aInternet || undefined,
    ...(internetMoyens ? { internet_moyens: internetMoyens } : {}),

    // Aide sociale
    ...(aideRecue !== undefined ? { aide_recue: aideRecue } : {}),
    ...(aideTypes ? { aide_types: aideTypes.split(' ').filter(Boolean) } : {}),
    ...(aideDonateur ? { aide_organismes: aideDonateur.split(' ').filter(Boolean) } : {}),

    // Vulnérabilité ménage (colonnes réelles XLSX)
    est_vulnerable: estVulnerable ?? undefined,
    niveau_vulnerabilite_global: niveauVulnerabilite || undefined,
    difficulte_alimentaire: koboBool(row, 'difficulte_alimentaire') ?? koboBool(row, 'insecurite_alimentaire') ?? undefined,
    // Comptages démographiques depuis feuille principale
    nb_enfants_moins5: koboNum(row, 'nb_moins_5') ?? undefined,
    nb_personnes_agees: koboNum(row, 'nb_65_plus') ?? undefined,
    nb_personnes_handicapees: koboNum(row, 'nb_handicap') ?? undefined,
    nb_femmes_enceintes: koboNum(row, 'nb_enceintes') ?? undefined,
    nb_maladies_chroniques: koboNum(row, 'nb_malades_chroniques') ?? undefined,
  };

  // Nettoyer les undefined
  Object.keys(foyer).forEach(k => {
    if ((foyer as Record<string, unknown>)[k] === undefined) {
      delete (foyer as Record<string, unknown>)[k];
    }
  });

  // ── Membres ────────────────────────────────────────────────────────────────
  const membres: Partial<Membre>[] = [];

  // Stratégie 1 : groupe repeat "personnes" (feuille XLSX ou KoboAPI repeat group)
  // Cherche d'abord les clés connues, puis n'importe quel tableau dans la submission
  // dont le nom ressemble à un repeat group de membres (pour les exports XLSX dont
  // le nom de feuille est différent de "personnes").
  let membresRepeat: unknown = row['personnes'] ?? row['membres'] ?? row['group_membres'];
  if (!Array.isArray(membresRepeat) || membresRepeat.length === 0) {
    // Cherche parmi toutes les clés un tableau qui ressemble à des membres
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      if (
        Array.isArray(v) && v.length > 0 &&
        (/^personnes?/i.test(k) || /^membres?/i.test(k) || /person/i.test(k))
      ) {
        membresRepeat = v;
        console.debug(`[FANISA] Repeat group membres trouvé sous la clé "${k}" (${v.length} entrées)`);
        break;
      }
    }
  }
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

  // Vahiny (visiteurs) : feuille séparée dans le XLSX, aussi attachés à la submission
  const vahinyRepeat = row['vahiny'] ?? row['visiteurs'];
  if (Array.isArray(vahinyRepeat) && vahinyRepeat.length > 0) {
    for (const v of vahinyRepeat as KoboSubmission[]) {
      membres.push(mapKoboVahiny(v, codeMenage, warnings));
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
  // Structure XLSX KoboCollect FANISA :
  //   - Chef  : lien_parente='chef', nom dans 'nom_personne' (col 16),
  //             'nom_prenoms' (col 15) est NULL pour le chef
  //   - Autres: nom dans 'nom_prenoms' (col 15), 'nom_personne' peut aussi contenir le nom
  // → on essaie les deux dans les deux ordres selon le contexte
  const lienParente = koboGet(m, 'lien_parente', 'relation_chef', 'relation');
  // lien_parente='chef' est la source de vérité ; idx===0 seulement en fallback si lienParente absent
  const isChef = lienParente.toLowerCase().includes('chef') || (idx === 0 && !lienParente);

  const nom = isChef
    ? koboGet(m, 'nom_personne', 'nom_prenoms', 'nom', 'nom_fr', 'anarana')
    : koboGet(m, 'nom_prenoms',  'nom_personne', 'nom', 'nom_fr', 'anarana');

  if (!nom) warnings.push(`Membre #${idx+1} sans nom dans le ménage ${codeMenage}`);

  // Sexe : le XLSX KoboCollect retourne 'masculin'/'feminin' (pas 'm'/'f')
  const sexeRaw = koboGet(m, 'sexe', 'genre', 'lahy_vavy').toLowerCase();
  const sexe: 'M' | 'F' = (
    sexeRaw === 'f' || sexeRaw === 'féminin' || sexeRaw === 'feminin' ||
    sexeRaw === 'vavy' || sexeRaw.startsWith('f')
  ) ? 'F' : 'M';

  // date_naissance : le XLSX retourne une date ISO avec timezone ex: "1990-04-08T00:00:00.000+03:00"
  const dateNaissanceRaw = koboGet(m, 'date_naissance', 'date_naissance_saisie', 'naissance', 'daty_nahaterahan');

  // niveau_instruction = colonne réelle dans XLSX (pas niveau_etude)
  const niveauEtude = koboGet(m,
    'niveau_instruction', 'niveau_etude', 'niveau_scolaire', 'fanabeazana'
  ) || 'Non précisé';

  // profession : 'statut_activite' + 'profession' + 'poste_occupe' dans XLSX
  const professionRaw = koboGet(m, 'poste_occupe', 'profession', 'metier', 'asa');

  // situation_matrimoniale_finale = valeur consolidée dans le XLSX
  const situationMatri = koboGet(m,
    'situation_matrimoniale_finale', 'situation_matrimoniale', 'statut_matrimonial', 'fanambadiana'
  );

  // CIN complet
  const cinNum       = koboGet(m, 'numero_cin', 'cin', 'cin_number', 'num_cin', 'numero_serie_cin', 'chef_cin_numero');
  const dateCin      = koboDate(koboGet(m, 'date_delivrance_cin', 'date_delivrance_cin_saisie', 'chef_cin_date'));
  const photoUrl     = koboGet(m, 'photo_identite_URL', 'photo_url', 'photo_membre_URL');

  // Filiation
  const nomPere = koboGet(m, 'nom_pere', 'pere_nom', 'nom_du_pere');
  const nomMere = koboGet(m, 'nom_mere', 'mere_nom', 'nom_de_la_mere');

  // Emploi / économie (colonnes XLSX réelles)
  const statutActivite  = koboGet(m, 'statut_activite', 'situation_emploi', 'statut_emploi');
  const statutEmploi    = koboGet(m, 'statut_emploi', 'type_emploi');
  const employeur       = koboGet(m, 'societe', 'employeur', 'entreprise');
  const activite        = koboGet(m, 'activite', 'secteur_activite', 'activite_principale');
  const lieuTravail     = koboGet(m, 'lieu_travail', 'localite_travail');

  // Scolarité
  const frequenteEcole  = koboGet(m, 'frequente_ecole');
  const mentionFiliere  = koboGet(m, 'mention_filiere', 'filiere_etudes');
  const diplome         = koboGet(m, 'diplome_obtenu', 'diplome');
  const saitLire        = koboGet(m, 'sait_lire_ecrire');

  // Santé
  const tailleCm        = koboNum(m, 'taille_cm', 'taille');
  const poidsKg         = koboNum(m, 'poids_kg', 'poids');
  const handicap        = koboGet(m, 'handicap');
  const maladieChronique = koboGet(m, 'maladie_chronique', 'maladies_chroniques');
  const couvertureSante = koboGet(m, 'couverture_sante_type', 'assurance', 'couverture_sante');
  const vaccinStatut    = koboGet(m, 'vaccination_statut', 'statut_vaccinal');
  const femmeEnceinte   = koboGet(m, 'femme_enceinte');
  const grossesseCoursRaw = femmeEnceinte ? femmeEnceinte === 'oui' : undefined;

  // Langues et religion
  const languesParlees  = koboGet(m, 'langues_parlees', 'langue_principale', 'langues_autres');
  const religion        = koboGet(m, 'religion', 'religion_choix');

  // Langues : construire tableau depuis les colonnes multiples
  const languesTab: string[] = ['Malagasy'];
  if (languesParlees) {
    languesParlees.split(' ').forEach(l => {
      const lc = l.charAt(0).toUpperCase() + l.slice(1);
      if (lc && !languesTab.includes(lc)) languesTab.push(lc);
    });
  }

  // Handicap
  const handicapOui = handicap === 'oui';
  const wgFields    = ['wg_voir','wg_entendre','wg_marcher','wg_memoire','wg_soins','wg_communiquer'];
  const handicapTypes = wgFields
    .filter(f => koboGet(m, f) && koboGet(m, f) !== 'aucune' && koboGet(m, f) !== 'non')
    .map(f => f.replace('wg_', ''));

  // Pour 'enfant' générique, affiner selon le sexe
  const relationChef: import('../types').RelationChef = isChef
    ? 'Chef'
    : (lienParente.toLowerCase() === 'enfant' || lienParente.toLowerCase().includes('zanaka'))
      ? (sexe === 'F' ? 'Fille' : 'Fils')
      : mapRelation(lienParente);

  return {
    nom: nom || '—',
    prenom: '',  // prénom intégré dans nom_prenoms/nom_personne
    sexe,
    statut: 'Actif',
    is_chef: isChef,
    relation_chef: relationChef,
    date_naissance: koboDate(dateNaissanceRaw),
    lieu_naissance: koboGet(m, 'lieu_naissance', 'toerana_nahaterahan'),
    nationalite: koboGet(m, 'nationalite', 'nationality') || 'Malagasy',
    cin: cinNum || undefined,
    date_cin: dateCin || undefined,
    ...(nomPere ? { pere_nom: nomPere } : {}),
    ...(nomMere ? { mere_nom: nomMere } : {}),
    ...(photoUrl ? { photo_url: photoUrl } : {}),
    situation_matrimoniale: situationMatri || undefined,
    religion: religion || undefined,
    telephone: koboGet(m, 'telephone', 'tel', 'finday') || undefined,
    // Éducation
    niveau_etude: niveauEtude,
    filiere_etudes: mentionFiliere || undefined,
    diplome: diplome || undefined,
    // Économie
    profession: professionRaw || undefined,
    statut_professionnel: statutEmploi || undefined,
    situation_emploi: statutActivite || undefined,
    secteur_activite: activite || undefined,
    employeur: employeur || undefined,
    // Santé
    ...(tailleCm != null ? { taille: tailleCm } : {}),
    ...(poidsKg  != null ? { poids: poidsKg }  : {}),
    handicap_oui: handicapOui || undefined,
    ...(handicapTypes.length > 0 ? { handicap_types: handicapTypes } : {}),
    maladies_chroniques: maladieChronique && maladieChronique !== 'non'
      ? [maladieChronique] : undefined,
    assurance: couvertureSante || undefined,
    statut_vaccinal: vaccinStatut || undefined,
    // Grossesse (F seulement)
    ...(sexe === 'F' && grossesseCoursRaw !== undefined ? { grossesse_cours: grossesseCoursRaw } : {}),
    // Langues
    langues: languesTab,
    // Divers
    ...(saitLire ? {} : {}), // pas de champ direct dans Membre — ignoré
    ...(lieuTravail ? {} : {}), // pas de champ direct — ignoré
    est_vulnerable: false,
    vulnerabilite_categories: [],
    competences: [],
    vaccination: [],
    hypertension: 'Normal' as const,
    diabete: 'Normal' as const,
  };
}

/** Mappe un vahiny (visiteur temporaire) depuis la feuille XLSX 'vahiny' */
function mapKoboVahiny(v: KoboSubmission, codeMenage: string, _warnings: string[]): Partial<Membre> {
  const nom = koboGet(v, 'v_nom', 'nom', 'nom_prenoms');
  const sexeRaw = koboGet(v, 'v_sexe', 'sexe').toLowerCase();
  const sexe: 'M' | 'F' = (
    sexeRaw === 'f' || sexeRaw === 'féminin' || sexeRaw === 'feminin' ||
    sexeRaw === 'vavy' || sexeRaw.startsWith('f')
  ) ? 'F' : 'M';
  const dateNaissanceRaw = koboGet(v, 'v_date_naissance', 'v_date_naissance_saisie', 'date_naissance');
  const cinNum = koboGet(v, 'v_numero_cin', 'numero_cin', 'cin');
  const lienParente = koboGet(v, 'v_lien', 'lien_parente', 'lien');

  void codeMenage; // vahiny pas lié à un code ménage spécifique
  return {
    nom: nom || '—',
    prenom: '',
    sexe,
    statut: 'Visiteur' as unknown as import('../types').StatutMembre,
    is_chef: false,
    relation_chef: mapRelation(lienParente) || 'Autre',
    date_naissance: koboDate(dateNaissanceRaw),
    nationalite: koboGet(v, 'v_nationalite', 'nationalite') || 'Malagasy',
    cin: cinNum || undefined,
    telephone: koboGet(v, 'v_telephone', 'telephone') || undefined,
    niveau_etude: 'Non précisé',
    est_vulnerable: false,
    vulnerabilite_categories: [],
    competences: [],
    langues: ['Malagasy'],
    vaccination: [],
    hypertension: 'Normal' as const,
    diabete: 'Normal' as const,
  };
}

/** Mappe le chef de ménage depuis des champs plats (chef_nom, chef_prenom…) */
function mapKoboChefFromFlat(row: KoboSubmission, codeMenage: string, warnings: string[]): Partial<Membre> | null {
  // Colonne réelle dans le XLSX principal KoboCollect : 'nom_chef_menage'
  const nom = koboGet(row, 'nom_chef_menage', 'chef_nom', 'nom_chef', 'chef_menage_nom', 'nom_responsable');
  if (!nom) {
    warnings.push(`Chef de ménage sans nom pour ${codeMenage}`);
    return null;
  }

  const sexeRaw = koboGet(row, 'chef_sexe', 'sexe_chef', 'genre_chef').toLowerCase();
  const sexe: 'M' | 'F' = (
    sexeRaw === 'f' || sexeRaw === 'féminin' || sexeRaw === 'feminin' ||
    sexeRaw === 'vavy' || sexeRaw.startsWith('f')
  ) ? 'F' : 'M';

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
    cin: koboGet(row, 'chef_cin_numero', 'chef_cin', 'cin_chef', 'numero_cin_chef'),
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
  const r = raw.toLowerCase().trim();
  // Valeurs exactes du XLSX KoboCollect FANISA
  if (r === 'marie' || r === 'marié' || r === 'mariee' || r === 'mariée') return 'Épouse/Époux';
  if (r === 'conjoint') return 'Épouse/Époux';
  if (r === 'enfant') return 'Fils'; // générique — sexe détermine si c'est fils ou fille
  if (r === 'neveu') return 'Neveu';
  if (r === 'niece' || r === 'nièce') return 'Nièce';
  // Patterns plus larges
  if (r.includes('épou') || r.includes('femme') || r.includes('vady') || r.includes('mari')) return 'Épouse/Époux';
  if (r.includes('fils') || (r.includes('lahy') && r.includes('zanaka'))) return 'Fils';
  if (r.includes('fille') || (r.includes('vavy') && r.includes('zanaka'))) return 'Fille';
  if (r.includes('enfant') || r.includes('zanaka')) return 'Fils'; // sexe ignoré ici
  if (r.includes('père') || r.includes('papa') || r.includes('baba')) return 'Père';
  if (r.includes('mère') || r.includes('mama') || r.includes('neny')) return 'Mère';
  if (r.includes('frère') || r.includes('rahalahy')) return 'Frère';
  if (r.includes('sœur') || r.includes('soeur') || r.includes('anabavy')) return 'Sœur';
  if (r.includes('grand-père') || r.includes('dadabe')) return 'Grand-père';
  if (r.includes('grand-mère') || r.includes('nenibe')) return 'Grand-mère';
  if (r.includes('petit-fils')) return 'Petit-fils';
  if (r.includes('petite-fille')) return 'Petite-fille';
  if (r.includes('oncle') || r.includes('rangahy')) return 'Oncle';
  if (r.includes('tante') || r.includes('rangahy vavy')) return 'Tante';
  if (r.includes('neveu')) return 'Neveu';
  if (r.includes('nièce') || r.includes('niece')) return 'Nièce';
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
