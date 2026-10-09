/**
 * FANISA – Moteur de synchronisation offline → Supabase
 * Surveille la connexion réseau et envoie les données
 * en attente vers Supabase dès que possible.
 */

import { supabase } from './supabase';
import {
  db,
  type CollecteFoyer,
  type CollecteMembre,
  type CollecteVahiny,
  type CollectePhoto,
  type CollecteFoncier,
  type SyncQueue,
} from './offlineDB';

// ── Types résultat ─────────────────────────────────────────────

export interface RapportSync {
  foyers_ok: number;
  membres_ok: number;
  vahiny_ok: number;
  photos_ok: number;
  foncier_ok: number;
  erreurs: string[];
  doublons_ignores: number;
  duree_ms: number;
}

// ── Etat réseau ────────────────────────────────────────────────

export function estEnLigne(): boolean {
  return navigator.onLine;
}

type ListenerReseau = (enLigne: boolean) => void;
const listenersReseau: ListenerReseau[] = [];

export function onChangementReseau(cb: ListenerReseau): () => void {
  listenersReseau.push(cb);
  window.addEventListener('online',  () => cb(true));
  window.addEventListener('offline', () => cb(false));
  return () => {
    const i = listenersReseau.indexOf(cb);
    if (i >= 0) listenersReseau.splice(i, 1);
  };
}

// ── Synchronisation principale ─────────────────────────────────

let syncEnCours = false;

export async function lancerSync(): Promise<RapportSync> {
  if (syncEnCours) {
    return { foyers_ok: 0, membres_ok: 0, vahiny_ok: 0, photos_ok: 0, foncier_ok: 0, erreurs: ['Sync déjà en cours'], doublons_ignores: 0, duree_ms: 0 };
  }
  if (!estEnLigne()) {
    return { foyers_ok: 0, membres_ok: 0, vahiny_ok: 0, photos_ok: 0, foncier_ok: 0, erreurs: ['Pas de connexion réseau'], doublons_ignores: 0, duree_ms: 0 };
  }

  syncEnCours = true;
  const debut = Date.now();
  const rapport: RapportSync = { foyers_ok: 0, membres_ok: 0, vahiny_ok: 0, photos_ok: 0, foncier_ok: 0, erreurs: [], doublons_ignores: 0, duree_ms: 0 };

  try {
    // 1. Récupérer la queue en attente
    const queue = await db.sync_queue.where('statut').anyOf(['en_attente', 'erreur']).toArray();

    for (const item of queue) {
      // Marquer en cours
      await db.sync_queue.update(item.id!, { statut: 'en_cours', derniere_tentative: new Date().toISOString() });

      try {
        switch (item.operation) {
          case 'upsert_foyer':   await syncFoyer(item, rapport);   break;
          case 'upsert_membre':  await syncMembre(item, rapport);  break;
          case 'upsert_vahiny':  await syncVahiny(item, rapport);  break;
          case 'upload_photo':   await syncPhoto(item, rapport);   break;
          case 'upsert_foncier': await syncFoncier(item, rapport); break;
        }
        await db.sync_queue.update(item.id!, { statut: 'synchronise' });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const nb = (item.nb_tentatives || 0) + 1;
        await db.sync_queue.update(item.id!, {
          statut: nb >= 5 ? 'erreur' : 'en_attente',
          nb_tentatives: nb,
          erreur: msg,
        });
        rapport.erreurs.push(`[${item.operation}] ${item.entite_uuid.slice(0, 8)}: ${msg}`);
      }
    }
  } finally {
    syncEnCours = false;
    rapport.duree_ms = Date.now() - debut;
  }

  return rapport;
}

// ── Sync foyer ─────────────────────────────────────────────────

async function syncFoyer(item: SyncQueue, rapport: RapportSync) {
  const foyer = await db.collecte_foyers.where('uuid').equals(item.entite_uuid).first();
  if (!foyer) throw new Error('Foyer introuvable en local');

  // Vérifier doublon sur code_menage
  if (foyer.code_menage) {
    const { data: existing } = await supabase
      .from('foyers')
      .select('id')
      .eq('code_menage', foyer.code_menage)
      .maybeSingle();
    if (existing) {
      rapport.doublons_ignores++;
      await db.collecte_foyers.update(foyer.id!, { statut_sync: 'synchronise' });
      return; // doublon ignoré — foyer déjà dans la base
    }
  }

  const payload = buildFoyerPayload(foyer);
  const { data, error } = await supabase.from('foyers').upsert(payload, { onConflict: 'code_menage' }).select('id').single();
  if (error) throw new Error(error.message);

  // Mettre à jour l'UUID Supabase dans la collecte locale
  await db.collecte_foyers.update(foyer.id!, {
    statut_sync: 'synchronise',
    updated_at: new Date().toISOString(),
  });

  // Propager le foyer_id Supabase aux membres de ce foyer
  if (data?.id) {
    await db.collecte_membres.where('foyer_uuid').equals(foyer.uuid).modify({ foyer_uuid: foyer.uuid }); // uuid conservé pour liaison
    // On stocke le vrai ID Supabase dans un champ dédié si besoin
  }

  rapport.foyers_ok++;
}

// ── Sync membre ────────────────────────────────────────────────

async function syncMembre(item: SyncQueue, rapport: RapportSync) {
  const membre = await db.collecte_membres.where('uuid').equals(item.entite_uuid).first();
  if (!membre) throw new Error('Membre introuvable en local');

  // Trouver le foyer_id Supabase depuis le code_menage
  const foyerLocal = await db.collecte_foyers.where('uuid').equals(membre.foyer_uuid).first();
  if (!foyerLocal?.code_menage) throw new Error('Foyer parent non encore synchronisé');

  const { data: foyerSupabase } = await supabase
    .from('foyers')
    .select('id')
    .eq('code_menage', foyerLocal.code_menage)
    .maybeSingle();
  if (!foyerSupabase) throw new Error('Foyer parent absent de Supabase — synchronisez d\'abord les foyers');

  const payload = buildMembrePayload(membre, foyerSupabase.id);
  const { error } = await supabase.from('membres').upsert(payload, { onConflict: 'code_personne' });
  if (error) throw new Error(error.message);

  await db.collecte_membres.update(membre.id!, { statut_sync: 'synchronise' });
  rapport.membres_ok++;
}

// ── Sync vahiny ────────────────────────────────────────────────

async function syncVahiny(item: SyncQueue, rapport: RapportSync) {
  const vahiny = await db.collecte_vahiny.where('uuid').equals(item.entite_uuid).first();
  if (!vahiny) throw new Error('Vahiny introuvable en local');

  const foyerLocal = await db.collecte_foyers.where('uuid').equals(vahiny.foyer_uuid).first();
  if (!foyerLocal?.code_menage) throw new Error('Foyer parent non encore synchronisé');

  const { data: foyerSupabase } = await supabase
    .from('foyers')
    .select('id')
    .eq('code_menage', foyerLocal.code_menage)
    .maybeSingle();
  if (!foyerSupabase) throw new Error('Foyer parent absent de Supabase');

  // Vahiny → table membres avec flag is_vahiny si elle existe, sinon table séparée
  const payload = {
    foyer_id: foyerSupabase.id,
    nom: vahiny.nom,
    prenom: vahiny.prenom,
    sexe: vahiny.sexe,
    cin: vahiny.cin,
    telephone: vahiny.telephone,
    relation_chef: 'Vahiny',
    is_chef: false,
    code_personne: vahiny.code_personne,
    statut: 'Actif',
    niveau_etude: 'Non renseigné',
    competences: [],
    langues: [],
    vaccination: [],
    est_vulnerable: false,
    vulnerabilite_categories: [],
    niveau_priorite: 'Aucun',
    aides_obtenues: [],
    hypertension: 'Normal',
    diabete: 'Normal',
    // Champs vahiny spécifiques (si la table les a)
    lien_menage: vahiny.lien_menage,
    provenance: vahiny.provenance,
    motif_sejour: vahiny.motif,
    date_arrivee: vahiny.date_arrivee,
    duree_prevue_sejour: vahiny.duree_prevue,
  };

  const { error } = await supabase.from('membres').upsert(payload, { onConflict: 'code_personne' });
  if (error) throw new Error(error.message);

  await db.collecte_vahiny.update(vahiny.id!, { statut_sync: 'synchronise' });
  rapport.vahiny_ok++;
}

// ── Sync photo ─────────────────────────────────────────────────

async function syncPhoto(item: SyncQueue, rapport: RapportSync) {
  const photo = await db.collecte_photos.where('uuid').equals(item.entite_uuid).first();
  if (!photo) throw new Error('Photo introuvable en local');

  // Convertir base64 → Blob
  const blob = base64ToBlob(photo.data_base64, photo.mime_type);
  const ext = photo.mime_type === 'image/png' ? 'png' : 'jpg';
  const path = `collecte/${photo.foyer_uuid}/${photo.type_photo}_${photo.uuid}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('fanisa-photos')
    .upload(path, blob, { contentType: photo.mime_type, upsert: true });

  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = supabase.storage.from('fanisa-photos').getPublicUrl(path);

  await db.collecte_photos.update(photo.id!, {
    statut_sync: 'synchronise',
    supabase_url: urlData.publicUrl,
  });

  // Mettre à jour l'URL dans le foyer ou membre
  if (photo.type_photo === 'maison') {
    const foyerLocal = await db.collecte_foyers.where('uuid').equals(photo.foyer_uuid).first();
    if (foyerLocal?.code_menage) {
      await supabase.from('foyers').update({ photo_maison_url: urlData.publicUrl }).eq('code_menage', foyerLocal.code_menage);
    }
  }

  rapport.photos_ok++;
}

// ── Sync foncier ───────────────────────────────────────────────

async function syncFoncier(item: SyncQueue, rapport: RapportSync) {
  const foncier = await db.collecte_foncier.where('uuid').equals(item.entite_uuid).first();
  if (!foncier) throw new Error('Parcelle introuvable en local');

  // Vérifier doublon sur numero_lot
  const { data: existing } = await supabase
    .from('parcelles')
    .select('id')
    .eq('numero_lot', foncier.numero_lot)
    .maybeSingle();

  if (existing) {
    // Mise à jour de la parcelle existante
    const { error } = await supabase.from('parcelles').update(buildFoncierPayload(foncier)).eq('id', existing.id);
    if (error) throw new Error(error.message);
    // Mettre à jour / créer le détenteur
    if (foncier.detenteur_connu && foncier.detenteur_nom) {
      await upsertDetenteur(existing.id, foncier);
    }
  } else {
    // Nouvelle parcelle
    const { data, error } = await supabase.from('parcelles').insert(buildFoncierPayload(foncier)).select('id').single();
    if (error) throw new Error(error.message);
    if (data?.id && foncier.detenteur_connu && foncier.detenteur_nom) {
      await upsertDetenteur(data.id, foncier);
    }
  }

  await db.collecte_foncier.update(foncier.id!, { statut_sync: 'synchronise', updated_at: new Date().toISOString() });
  rapport.foncier_ok++;
}

async function upsertDetenteur(parcelle_id: string, foncier: CollecteFoncier) {
  const payload = {
    parcelle_id,
    type_detention: foncier.detenteur_type || 'Propriétaire',
    nom: foncier.detenteur_nom,
    prenom: foncier.detenteur_prenom,
    cin: foncier.detenteur_cin,
    telephone: foncier.detenteur_telephone,
  };
  await supabase.from('detenteurs').upsert(payload, { onConflict: 'parcelle_id' });
}

function buildFoncierPayload(f: CollecteFoncier) {
  return {
    numero_lot: f.numero_lot,
    fokontany: f.fokontany,
    adresse: f.adresse,
    gps_lat: f.gps_lat,
    gps_lng: f.gps_lng,
    superficie_m2: f.superficie_m2,
    usage: f.usage || 'Habitation',
    titre_foncier: f.titre_foncier,
    notes: [
      f.terrain_nu_statut ? `Terrain ${f.terrain_nu_statut}` : null,
      f.destruction_cause ? `Destruction : ${f.destruction_cause} (${f.destruction_annee || '?'})` : null,
      f.a_verifier ? 'À vérifier' : null,
      f.notes || null,
    ].filter(Boolean).join(' | ') || null,
  };
}

// ── Constructeurs de payload Supabase ──────────────────────────

function buildFoyerPayload(f: CollecteFoyer) {
  return {
    code_menage: f.code_menage,
    statut: 'Actif',
    adresse: f.adresse,
    fokontany: f.fokontany,
    commune: 'Toamasina Suburbaine',
    district: 'Toamasina I',
    gps_lat: f.gps_lat,
    gps_lng: f.gps_lng,
    carreau: f.quartier,
    num_carreau: f.carreau,
    type_logement: f.type_logement,
    materiau_toiture: f.materiau_toiture,
    materiau_mur: f.materiau_mur,
    materiau_plancher: f.materiau_plancher,
    statut_occupant: f.statut_occupant,
    eau_source: f.eau_source,
    toilette_type: f.toilette_type,
    eclairage_source: f.eclairage_source,
    cuisson_source: f.cuisson_source,
    est_vulnerable: f.est_vulnerable ?? false,
    observations_complementaires: f.observations,
    nombre_membres: 0, // recalculé après insertion des membres
  };
}

function buildMembrePayload(m: CollecteMembre, foyer_id: string) {
  return {
    foyer_id,
    nom: m.nom,
    prenom: m.prenom,
    sexe: m.sexe,
    date_naissance: m.date_naissance,
    lieu_naissance: m.lieu_naissance,
    nationalite: m.nationalite,
    cin: m.cin,
    date_cin: m.date_cin,
    telephone: m.telephone,
    relation_chef: m.relation_chef,
    is_chef: m.is_chef,
    niveau_etude: m.niveau_etude || 'Non renseigné',
    statut: 'Actif',
    code_personne: m.code_personne,
    handicap_oui: m.handicap_oui ?? false,
    est_scolarise: m.est_scolarise,
    ecole: m.ecole,
    // Washington Group
    ...(m.wg_vision ? { wg_vision: m.wg_vision } : {}),
    ...(m.wg_audition ? { wg_audition: m.wg_audition } : {}),
    ...(m.wg_mobilite ? { wg_mobilite: m.wg_mobilite } : {}),
    ...(m.wg_cognition ? { wg_cognition: m.wg_cognition } : {}),
    ...(m.wg_soins_personnels ? { wg_soins_personnels: m.wg_soins_personnels } : {}),
    ...(m.wg_communication ? { wg_communication: m.wg_communication } : {}),
    vaccination: [],
    competences: [],
    langues: [],
    est_vulnerable: false,
    vulnerabilite_categories: [],
    niveau_priorite: 'Aucun',
    aides_obtenues: [],
    hypertension: 'Normal',
    diabete: 'Normal',
  };
}

// ── Utilitaire base64 → Blob ───────────────────────────────────

function base64ToBlob(base64: string, mimeType: string): Blob {
  const dataStr = base64.includes(',') ? base64.split(',')[1] : base64;
  const bytes = atob(dataStr);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mimeType });
}

// ── Sync automatique au retour réseau ─────────────────────────

let syncAutoActif = false;

export function activerSyncAuto(onRapport?: (r: RapportSync) => void) {
  if (syncAutoActif) return;
  syncAutoActif = true;

  const handleOnline = async () => {
    const rapport = await lancerSync();
    if (onRapport) onRapport(rapport);
  };

  window.addEventListener('online', handleOnline);

  // Tenter une sync immédiate si déjà en ligne
  if (estEnLigne()) {
    lancerSync().then(r => { if (onRapport) onRapport(r); });
  }
}
