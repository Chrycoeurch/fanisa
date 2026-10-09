/**
 * FANISA – Base de données offline (IndexedDB via Dexie)
 * Stocke toutes les données de collecte terrain localement,
 * puis les synchronise vers Supabase quand la connexion est disponible.
 */

import Dexie, { type Table } from 'dexie';

// ── Types de collecte offline ──────────────────────────────────

export type StatutSync = 'en_attente' | 'en_cours' | 'synchronise' | 'erreur';

export interface CollecteFoyer {
  id?: number;               // clé auto IndexedDB
  uuid: string;              // UUID local unique
  code_menage?: string;      // scan QR ou saisie manuelle
  agent_id: string;
  date_collecte: string;     // ISO
  statut_sync: StatutSync;
  nb_tentatives_sync: number;
  erreur_sync?: string;
  // Données du foyer (même structure que Foyer dans types.ts)
  adresse: string;
  quartier: string;
  carreau?: string;
  fokontany: string;
  gps_lat?: number;
  gps_lng?: number;
  // Logement
  type_logement?: string;
  materiau_toiture?: string;
  materiau_mur?: string;
  materiau_plancher?: string;
  // Occupation
  statut_occupant?: string;
  // Eau & assainissement
  eau_source?: string;
  toilette_type?: string;
  // Énergie
  eclairage_source?: string;
  cuisson_source?: string;
  // Vulnérabilité
  est_vulnerable?: boolean;
  observations?: string;
  // Carnet Fokontany
  possede_carnet?: boolean;
  ancien_numero_carnet?: string;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface CollecteMembre {
  id?: number;
  uuid: string;
  foyer_uuid: string;        // lien vers CollecteFoyer.uuid
  statut_sync: StatutSync;
  // Identité
  nom: string;
  prenom: string;
  sexe: 'M' | 'F';
  date_naissance?: string;
  lieu_naissance?: string;
  nationalite: 'Malagasy' | 'Etrangere' | 'Double';
  nationalite_pays?: string;
  cin?: string;
  date_cin?: string;
  telephone?: string;
  relation_chef: string;
  is_chef: boolean;
  // Éducation
  niveau_etude?: string;
  est_scolarise?: boolean;
  ecole?: string;
  classe?: string;
  // Santé
  handicap_oui?: boolean;
  // Washington Group (6 questions, 5 ans et +)
  wg_vision?: string;
  wg_audition?: string;
  wg_mobilite?: string;
  wg_cognition?: string;
  wg_soins_personnels?: string;
  wg_communication?: string;
  // Moins de 5 ans
  vaccination_complete?: boolean;
  acte_naissance?: boolean;
  // Pièce d'identité étrangère
  type_piece_etrangere?: string;
  numero_piece_etrangere?: string;
  // Identifiant personne (AMB-TRV-26-K7P4M)
  code_personne?: string;
  created_at: string;
}

export interface CollecteVahiny {
  id?: number;
  uuid: string;
  foyer_uuid: string;
  statut_sync: StatutSync;
  nom: string;
  prenom: string;
  sexe: 'M' | 'F';
  cin?: string;
  telephone?: string;
  lien_menage?: string;
  provenance?: string;
  motif?: string;
  date_arrivee?: string;
  duree_prevue?: string;
  code_personne?: string;
  created_at: string;
}

export interface CollectePhoto {
  id?: number;
  uuid: string;
  foyer_uuid: string;
  membre_uuid?: string;
  type_photo: 'maison' | 'carnet_couverture' | 'cin' | 'acte_naissance' | 'carnet_vaccination' | 'piece_etrangere' | 'autre';
  data_base64: string;       // photo encodée en base64
  mime_type: string;         // image/jpeg ou image/png
  statut_sync: StatutSync;
  supabase_url?: string;     // URL après upload
  created_at: string;
}

export interface CollecteFoncier {
  id?: number;
  uuid: string;
  agent_id: string;
  date_collecte: string;
  statut_sync: StatutSync;
  nb_tentatives_sync: number;
  erreur_sync?: string;
  // Identification de la parcelle
  numero_lot: string;           // ex: 20/AA-012
  quartier: string;             // sigle quartier
  carreau?: string;
  fokontany: string;
  adresse?: string;
  gps_lat?: number;
  gps_lng?: number;
  superficie_m2?: number;
  usage?: string;               // Habitation, Commercial, Agricole, Mixte
  titre_foncier?: string;
  // Terrain nu / construction
  type_terrain: 'construit' | 'nu';
  terrain_nu_statut?: 'jamais_construit' | 'vestiges' | 'detruit';
  destruction_cause?: string;
  destruction_annee?: number;
  destruction_description?: string;
  // Bâtiment (si construit)
  type_batiment?: string;
  etat_batiment?: string;
  nb_niveaux?: number;
  superficie_batiment_m2?: number;
  materiau_mur?: string;
  materiau_toiture?: string;
  annee_construction?: number;
  // Détenteur
  detenteur_connu: boolean;
  detenteur_nom?: string;
  detenteur_prenom?: string;
  detenteur_cin?: string;
  detenteur_telephone?: string;
  detenteur_type?: string;      // Propriétaire, Locataire, Occupant...
  detenteur_reside_fokontany?: boolean;
  detenteur_residence_ailleurs?: string;
  // Contacts
  contacts?: { type: string; valeur: string; proprietaire?: string; principal?: boolean }[];
  // Nationalité du détenteur (si non recensé dans ménage)
  detenteur_nationalite?: string;
  detenteur_nationalite_pays?: string;
  // Lien ménage
  code_menage_lie?: string;
  // Statut dossier
  a_verifier?: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SyncQueue {
  id?: number;
  operation: 'upsert_foyer' | 'upsert_membre' | 'upsert_vahiny' | 'upload_photo' | 'upsert_foncier';
  foyer_uuid: string;
  entite_uuid: string;       // uuid de la CollecteFoyer, CollecteMembre, etc.
  statut: StatutSync;
  nb_tentatives: number;
  derniere_tentative?: string;
  erreur?: string;
  created_at: string;
}

// ── Schéma Dexie ───────────────────────────────────────────────

class FanisaOfflineDB extends Dexie {
  collecte_foyers!: Table<CollecteFoyer>;
  collecte_membres!: Table<CollecteMembre>;
  collecte_vahiny!: Table<CollecteVahiny>;
  collecte_photos!: Table<CollectePhoto>;
  collecte_foncier!: Table<CollecteFoncier>;
  sync_queue!: Table<SyncQueue>;

  constructor() {
    super('fanisa_offline');
    this.version(1).stores({
      collecte_foyers:  '++id, uuid, code_menage, agent_id, statut_sync, date_collecte',
      collecte_membres: '++id, uuid, foyer_uuid, statut_sync',
      collecte_vahiny:  '++id, uuid, foyer_uuid, statut_sync',
      collecte_photos:  '++id, uuid, foyer_uuid, membre_uuid, type_photo, statut_sync',
      sync_queue:       '++id, operation, foyer_uuid, entite_uuid, statut',
    });
    // v2 : ajout table foncier
    this.version(2).stores({
      collecte_foyers:  '++id, uuid, code_menage, agent_id, statut_sync, date_collecte',
      collecte_membres: '++id, uuid, foyer_uuid, statut_sync',
      collecte_vahiny:  '++id, uuid, foyer_uuid, statut_sync',
      collecte_photos:  '++id, uuid, foyer_uuid, membre_uuid, type_photo, statut_sync',
      collecte_foncier: '++id, uuid, numero_lot, agent_id, statut_sync, date_collecte',
      sync_queue:       '++id, operation, foyer_uuid, entite_uuid, statut',
    });
  }
}

export const db = new FanisaOfflineDB();

// ── Utilitaires ────────────────────────────────────────────────

/** Génère un UUID v4 simple */
export function genUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Génère un code personne aléatoire type AMB-TRV-26-K7P4M */
export function genCodePersonne(sigle = 'TRV'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `AMB-${sigle}-26-${code}`;
}

/** Enregistre un foyer en offline et ajoute à la sync queue */
export async function sauvegarderFoyerOffline(foyer: Omit<CollecteFoyer, 'id' | 'statut_sync' | 'nb_tentatives_sync' | 'created_at' | 'updated_at'>): Promise<string> {
  const now = new Date().toISOString();
  const uuid = foyer.uuid || genUUID();
  const record: CollecteFoyer = {
    ...foyer,
    uuid,
    statut_sync: 'en_attente',
    nb_tentatives_sync: 0,
    created_at: now,
    updated_at: now,
  };
  await db.collecte_foyers.put(record);
  await ajouterQueue('upsert_foyer', uuid, uuid);
  return uuid;
}

/** Enregistre un membre en offline */
export async function sauvegarderMembreOffline(membre: Omit<CollecteMembre, 'id' | 'statut_sync' | 'created_at'>): Promise<string> {
  const uuid = membre.uuid || genUUID();
  const record: CollecteMembre = {
    ...membre,
    uuid,
    statut_sync: 'en_attente',
    created_at: new Date().toISOString(),
  };
  await db.collecte_membres.put(record);
  await ajouterQueue('upsert_membre', membre.foyer_uuid, uuid);
  return uuid;
}

/** Enregistre un vahiny en offline */
export async function sauvegarderVahinyOffline(vahiny: Omit<CollecteVahiny, 'id' | 'statut_sync' | 'created_at'>): Promise<string> {
  const uuid = vahiny.uuid || genUUID();
  const record: CollecteVahiny = {
    ...vahiny,
    uuid,
    statut_sync: 'en_attente',
    created_at: new Date().toISOString(),
  };
  await db.collecte_vahiny.put(record);
  await ajouterQueue('upsert_vahiny', vahiny.foyer_uuid, uuid);
  return uuid;
}

/** Enregistre une photo en offline (base64) */
export async function sauvegarderPhotoOffline(
  foyer_uuid: string,
  type_photo: CollectePhoto['type_photo'],
  data_base64: string,
  mime_type = 'image/jpeg',
  membre_uuid?: string,
): Promise<string> {
  const uuid = genUUID();
  await db.collecte_photos.add({
    uuid,
    foyer_uuid,
    membre_uuid,
    type_photo,
    data_base64,
    mime_type,
    statut_sync: 'en_attente',
    created_at: new Date().toISOString(),
  });
  await ajouterQueue('upload_photo', foyer_uuid, uuid);
  return uuid;
}

async function ajouterQueue(operation: SyncQueue['operation'], foyer_uuid: string, entite_uuid: string) {
  await db.sync_queue.add({
    operation,
    foyer_uuid,
    entite_uuid,
    statut: 'en_attente',
    nb_tentatives: 0,
    created_at: new Date().toISOString(),
  });
}

/** Enregistre une parcelle foncière en offline */
export async function sauvegarderFoncierOffline(
  foncier: Omit<CollecteFoncier, 'id' | 'statut_sync' | 'nb_tentatives_sync' | 'created_at' | 'updated_at'>
): Promise<string> {
  const now = new Date().toISOString();
  const uuid = foncier.uuid || genUUID();
  const record: CollecteFoncier = {
    ...foncier,
    uuid,
    statut_sync: 'en_attente',
    nb_tentatives_sync: 0,
    created_at: now,
    updated_at: now,
  };
  await db.collecte_foncier.put(record);
  // foyer_uuid = uuid foncier pour la queue (pas lié à un foyer)
  await db.sync_queue.add({
    operation: 'upsert_foncier',
    foyer_uuid: uuid,
    entite_uuid: uuid,
    statut: 'en_attente',
    nb_tentatives: 0,
    created_at: now,
  });
  return uuid;
}

/** Statistiques offline pour l'indicateur UI */
export async function getStatsOffline() {
  const [foyers, membres, photos, foncier, enAttente, erreurs] = await Promise.all([
    db.collecte_foyers.count(),
    db.collecte_membres.count(),
    db.collecte_photos.count(),
    db.collecte_foncier.count(),
    db.sync_queue.where('statut').equals('en_attente').count(),
    db.sync_queue.where('statut').equals('erreur').count(),
  ]);
  return { foyers, membres, photos, foncier, enAttente, erreurs };
}

/** Supprime toutes les données synchronisées (nettoyage après sync réussie) */
export async function nettoyerDonneesSynchronisees() {
  const foyersSyncs = await db.collecte_foyers.where('statut_sync').equals('synchronise').toArray();
  const foncierSyncs = await db.collecte_foncier.where('statut_sync').equals('synchronise').toArray();
  const uuids = foyersSyncs.map(f => f.uuid);
  const uuidsFoncier = foncierSyncs.map(f => f.uuid);

  await db.transaction('rw', [db.collecte_foyers, db.collecte_membres, db.collecte_vahiny, db.collecte_photos, db.collecte_foncier, db.sync_queue], async () => {
    for (const uuid of uuids) {
      await db.collecte_membres.where('foyer_uuid').equals(uuid).delete();
      await db.collecte_vahiny.where('foyer_uuid').equals(uuid).delete();
      await db.collecte_photos.where('foyer_uuid').equals(uuid).delete();
      await db.sync_queue.where('foyer_uuid').equals(uuid).delete();
    }
    for (const uuid of uuidsFoncier) {
      await db.sync_queue.where('foyer_uuid').equals(uuid).delete();
    }
    await db.collecte_foyers.where('statut_sync').equals('synchronise').delete();
    await db.collecte_foncier.where('statut_sync').equals('synchronise').delete();
  });
  return uuids.length + uuidsFoncier.length;
}
