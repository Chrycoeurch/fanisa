/**
 * KoboFoncierSyncModule.tsx — Import XLSX KoboToolbox foncier vers FANISA
 *
 * Parse l'export XLSX du formulaire foncier (7 feuilles) et insère dans
 * les tables Supabase : parcelles, constructions_foncier, detenteurs_foncier,
 * documents_foncier, jorolava_foncier, photos_terrain.
 *
 * Structure XLSX attendue (FANISA__Formulaire_Foncier__...xlsx) :
 *   Feuille 0  — feuille principale (1 ligne = 1 parcelle)
 *   constructions — bâtiments sur la parcelle (_submission__id → _id parent)
 *   detenteurs    — ayants-droit / détenteurs (_submission__id → _id parent)
 *   documents     — documents justificatifs
 *   jorolava_liste — registre Jorolava local
 *   heritiers     — héritiers déclarés
 *   photos_terrain — photos du terrain
 */

import React, { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  MapPin, FileSpreadsheet, Upload, Loader2, CheckCircle,
  AlertTriangle, XCircle, Eye, ChevronDown, ChevronRight,
  Info, Building2, Users, FileText, Camera, RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ── Types internes ────────────────────────────────────────────────────────────

interface FoncierConstruction {
  kobo_parent_id?: string;
  c_num?: number;
  type_construction?: string;
  etat?: string;
  usage?: string;
  nb_pieces?: number;
  surface_m2?: number;
  materiaux_toiture?: string;
  materiaux_murs?: string;
  materiaux_sol?: string;
  ref_maison?: string;
  proprio_nom?: string;
  proprio_cin?: string;
  proprio_tel?: string;
  accord_terrain?: string;
  gps_lat?: number;
  gps_lng?: number;
}

interface FoncierDetenteur {
  kobo_parent_id?: string;
  nom?: string;
  prenom?: string;
  type_personne?: string;
  lien_parcelle?: string;
  nationalite?: string;
  cin?: string;
  cin_date?: string;
  telephone?: string;
  reside_fkt?: boolean;
  adresse?: string;
}

interface FoncierDocument {
  kobo_parent_id?: string;
  code_document?: string;
  libelle?: string;
  reference?: string;
  date_document?: string;
  nom_inscrit?: string;
  autorite_emettrice?: string;
  superficie_inscrite?: number;
  photo_url?: string;
}

interface FoncierJorolava {
  kobo_parent_id?: string;
  numero_jorolava?: number;
  annee?: number;
  reference?: string;
  nom_inscrit?: string;
  photo_url?: string;
}

interface FoncierPhoto {
  kobo_parent_id?: string;
  photo_url?: string;
}

interface FoncierParcelle {
  // Identifiants
  foncier_id?: string;
  lot_id?: string;
  lot_norm?: string;
  lot_prefixe?: string;
  kobo_uuid?: string;
  kobo_submission_id?: string; // _id Kobo pour liaison sous-tables

  // Localisation
  fokontany?: string;
  commune?: string;
  district?: string;
  quartier?: string;
  carreau?: string;
  adresse?: string;

  // Surfaces
  superficie_declaree?: number;
  superficie_estimee?: number;

  // Statut foncier
  statut_propriete?: string;
  occupation_terrain?: string;
  nature_terrain?: string;
  origine_droit?: string;
  justif_propriete?: string;

  // Constructions
  presence_constructions?: boolean;
  nb_constructions?: number;
  detenteur_connu?: boolean;

  // Mise en valeur
  mise_en_valeur?: string[];
  parcelle_amenagee?: boolean;

  // GPS
  gps_lat?: number;
  gps_lng?: number;

  // Collecte
  statut_collecte?: string;
  difficulte_rencontree?: string;
  observations?: string;
  code_agent?: string;
  date_collecte?: string;
  nb_menages_lot?: number;
}

interface FoncierImportResult {
  parcelle: FoncierParcelle;
  constructions: FoncierConstruction[];
  detenteurs: FoncierDetenteur[];
  documents: FoncierDocument[];
  jorolava: FoncierJorolava[];
  photos: FoncierPhoto[];
  koboUuid: string;
  submittedAt: string;
  warnings: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function get(row: Row, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== '') return String(v).trim();
    // Cherche avec préfixe de groupe (ex: "grp_identif/lot_id")
    for (const fk of Object.keys(row)) {
      if (fk.endsWith('/' + k)) {
        const vv = row[fk];
        if (vv !== undefined && vv !== null && vv !== '') return String(vv).trim();
      }
    }
  }
  return '';
}

function getNum(row: Row, ...keys: string[]): number | undefined {
  const v = get(row, ...keys);
  if (!v) return undefined;
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

function getBool(row: Row, key: string): boolean | undefined {
  const v = get(row, key).toLowerCase();
  if (v === 'yes' || v === 'true' || v === '1' || v === 'oui') return true;
  if (v === 'no' || v === 'false' || v === '0' || v === 'non') return false;
  return undefined;
}

function getDate(raw: string): string | undefined {
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  // Date JavaScript ISO avec timezone
  if (raw.includes('T')) return raw.slice(0, 10);
  const parts = raw.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
  }
  return raw;
}

function getMultiSelect(row: Row, key: string): string[] {
  const v = get(row, key);
  if (!v) return [];
  return v.split(' ').filter(Boolean);
}

// ── Parsing XLSX ──────────────────────────────────────────────────────────────

async function parseFoncierXlsx(file: File): Promise<FoncierImportResult[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });

  console.debug('[FANISA Foncier] Feuilles :', wb.SheetNames);

  // Feuille principale
  const mainSheet = wb.Sheets[wb.SheetNames[0]];
  const mainRows: Row[] = XLSX.utils.sheet_to_json(mainSheet, { defval: null });
  console.debug('[FANISA Foncier] Parcelles :', mainRows.length);

  // Sous-tables indexées par _submission__id (= _id de la feuille principale)
  const subSheetNames = ['constructions', 'detenteurs', 'documents', 'heritiers', 'jorolava_liste', 'photos_terrain'];
  const subTables: Record<string, Map<string, Row[]>> = {};

  for (const name of subSheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) {
      console.debug(`[FANISA Foncier] Feuille "${name}" absente`);
      continue;
    }
    const rows: Row[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      // La clé de jointure est _submission__id dans les sous-tables
      const parentId = String(r['_submission__id'] ?? r['_parent_index'] ?? '');
      if (!parentId) continue;
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId)!.push(r);
    }
    subTables[name] = map;
    console.debug(`[FANISA Foncier] "${name}" : ${rows.length} lignes, ${map.size} parents`);
  }

  return mainRows.map((row, i): FoncierImportResult => {
    const warnings: string[] = [];
    const submissionId = String(row['_id'] ?? row['_index'] ?? (i + 1));

    // GPS parcelle
    const gpsRaw = get(row, 'gps_visite_fonciere', '_gps_visite_fonciere');
    let gpsLat: number | undefined;
    let gpsLng: number | undefined;
    if (gpsRaw) {
      const parts = gpsRaw.split(/\s+/);
      if (parts.length >= 2) {
        gpsLat = parseFloat(parts[0]);
        gpsLng = parseFloat(parts[1]);
      }
    }
    if (!gpsLat) {
      gpsLat = getNum(row, '_gps_visite_fonciere_latitude', 'gps_lat', '_geolocation/0');
      gpsLng = getNum(row, '_gps_visite_fonciere_longitude', 'gps_lng', '_geolocation/1');
    }

    // Lot ID / numéro de référence
    const lotId = get(row, 'lot_id', 'lot_norm', 'numero_lot');
    if (!lotId) warnings.push(`Parcelle #${i+1} sans numéro de lot`);

    // Mise en valeur (select_multiple)
    const miseEnValeur = getMultiSelect(row, 'mise_en_valeur');

    // Date collecte
    const dateCollecteRaw = get(row, 'date_collecte', '_submission_time');
    const dateCollecte = getDate(dateCollecteRaw);

    const parcelle: FoncierParcelle = {
      foncier_id:            get(row, 'foncier_id') || undefined,
      lot_id:                lotId || undefined,
      lot_norm:              get(row, 'lot_norm') || undefined,
      lot_prefixe:           get(row, 'lot_prefixe') || undefined,
      kobo_uuid:             get(row, '_uuid') || undefined,
      kobo_submission_id:    submissionId,

      fokontany:             get(row, 'fokontany', 'Fokontany') || 'Ambodisaina',
      commune:               get(row, 'commune', 'Commune') || 'Ambodisaina',
      district:              get(row, 'district') || 'Antananarivo Avaradrano',
      quartier:              get(row, 'quartier_lot', 'quartier') || undefined,
      carreau:               get(row, 'carreau_lot', 'carreau') || undefined,

      superficie_declaree:   getNum(row, 'superficie_declaree'),
      superficie_estimee:    getNum(row, 'superficie_estimee'),

      statut_propriete:      get(row, 'statut_propriete', 'statut_foncier'),
      occupation_terrain:    get(row, 'occupation_terrain'),
      nature_terrain:        get(row, 'nature_terrain'),
      origine_droit:         get(row, 'origine_droit'),
      justif_propriete:      get(row, 'justif_propriete'),

      presence_constructions: getBool(row, 'presence_constructions') ?? (getNum(row, 'nb_constructions') ?? 0) > 0,
      nb_constructions:      getNum(row, 'nb_constructions') ?? 0,
      detenteur_connu:       getBool(row, 'detenteur_connu'),

      mise_en_valeur:        miseEnValeur.length > 0 ? miseEnValeur : undefined,
      parcelle_amenagee:     getBool(row, 'parcelle_amenagee'),

      gps_lat:               gpsLat,
      gps_lng:               gpsLng,

      statut_collecte:       get(row, 'statut_collecte') || 'a_verifier',
      difficulte_rencontree: get(row, 'difficulte_rencontree') || undefined,
      observations:          get(row, 'observations') || undefined,
      code_agent:            get(row, 'agent', 'code_agent') || undefined,
      date_collecte:         dateCollecte,
      nb_menages_lot:        getNum(row, 'nb_menages_lot'),
    };

    // ── Sous-tables (liées par _submission__id = submissionId) ─────────────

    // Constructions
    const constructionRows = subTables['constructions']?.get(submissionId) ?? [];
    const constructions: FoncierConstruction[] = constructionRows.map((r): FoncierConstruction => {
      // GPS construction
      const gpsC = get(r, '_c_gps', 'c_gps');
      let cLat: number | undefined;
      let cLng: number | undefined;
      if (gpsC) {
        const parts = gpsC.split(/\s+/);
        if (parts.length >= 2) { cLat = parseFloat(parts[0]); cLng = parseFloat(parts[1]); }
      }
      if (!cLat) {
        cLat = getNum(r, '_c_gps_latitude');
        cLng = getNum(r, '_c_gps_longitude');
      }
      return {
        kobo_parent_id: submissionId,
        c_num:               getNum(r, 'c_num'),
        type_construction:   get(r, 'c_type', 'type_construction'),
        etat:                get(r, 'c_etat', 'etat_construction'),
        usage:               get(r, 'c_usage', 'usage_construction'),
        nb_pieces:           getNum(r, 'c_pieces', 'nb_pieces'),
        surface_m2:          getNum(r, 'c_surface_finale', 'c_surface', 'surface_m2'),
        materiaux_toiture:   get(r, 'c_toiture', 'materiaux_toiture'),
        materiaux_murs:      get(r, 'c_murs', 'materiaux_murs'),
        materiaux_sol:       get(r, 'c_sol', 'materiaux_sol'),
        ref_maison:          get(r, 'c_ref_maison'),
        proprio_nom:         get(r, 'c_proprio_nom_final', 'c_proprio_nom', 'proprio_nom'),
        proprio_cin:         get(r, 'c_proprio_cin'),
        proprio_tel:         get(r, 'c_proprio_tel'),
        accord_terrain:      get(r, 'c_accord_terrain'),
        gps_lat:             cLat,
        gps_lng:             cLng,
      };
    });

    // Détenteurs
    const detenteurRows = subTables['detenteurs']?.get(submissionId) ?? [];
    const detenteurs: FoncierDetenteur[] = detenteurRows.map((r): FoncierDetenteur => {
      const cinDateRaw = get(r, 'det_cin_date');
      return {
        kobo_parent_id: submissionId,
        nom:              get(r, 'det_nom'),
        prenom:           get(r, 'det_prenom'),
        type_personne:    get(r, 'det_type') || 'personne_physique',
        lien_parcelle:    get(r, 'det_lien'),
        nationalite:      get(r, 'det_nationalite') || 'Malagasy',
        cin:              get(r, 'det_cin'),
        cin_date:         getDate(cinDateRaw),
        telephone:        get(r, 'det_telephone'),
        reside_fkt:       getBool(r, 'det_reside_fkt'),
        adresse:          get(r, 'det_adresse'),
      };
    });

    // Documents
    const documentRows = subTables['documents']?.get(submissionId) ?? [];
    const documents: FoncierDocument[] = documentRows.map((r): FoncierDocument => {
      const dateDocRaw = get(r, 'doc_date');
      return {
        kobo_parent_id:       submissionId,
        code_document:        get(r, 'doc_code'),
        libelle:              get(r, 'doc_libelle'),
        reference:            get(r, 'doc_reference'),
        date_document:        getDate(dateDocRaw),
        nom_inscrit:          get(r, 'doc_nom_inscrit'),
        autorite_emettrice:   get(r, 'doc_autorite'),
        superficie_inscrite:  getNum(r, 'doc_superficie'),
        photo_url:            get(r, 'doc_photo_URL', 'doc_photo'),
      };
    });

    // Jorolava
    const jorolavaRows = subTables['jorolava_liste']?.get(submissionId) ?? [];
    const jorolava: FoncierJorolava[] = jorolavaRows.map((r): FoncierJorolava => ({
      kobo_parent_id:  submissionId,
      numero_jorolava: getNum(r, 'jl_num'),
      annee:           getNum(r, 'jl_annee'),
      reference:       get(r, 'jl_reference'),
      nom_inscrit:     get(r, 'jl_nom_inscrit'),
      photo_url:       get(r, 'jl_photo_URL', 'jl_photo'),
    }));

    // Photos terrain
    const photoRows = subTables['photos_terrain']?.get(submissionId) ?? [];
    const photos: FoncierPhoto[] = photoRows.map((r): FoncierPhoto => ({
      kobo_parent_id: submissionId,
      photo_url:      get(r, 'photo_terrain_URL', 'photo_url'),
    }));

    return {
      parcelle,
      constructions,
      detenteurs,
      documents,
      jorolava,
      photos,
      koboUuid: get(row as Row, '_uuid'),
      submittedAt: get(row as Row, '_submission_time'),
      warnings,
    };
  });
}

// ── Insertion Supabase ────────────────────────────────────────────────────────

async function insertFoncierResult(
  result: FoncierImportResult,
  forceUpdate: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const { parcelle } = result;

  // Payload sans kobo_submission_id (champ interne non en base)
  const { kobo_submission_id: _ks, ...parcellePayload } = parcelle;

  let parcelleId: string;

  if (forceUpdate && parcelle.kobo_uuid) {
    // Upsert par kobo_uuid
    const { data: existing } = await supabase
      .from('parcelles')
      .select('id')
      .eq('kobo_uuid', parcelle.kobo_uuid)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from('parcelles')
        .update({ ...parcellePayload, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) return { ok: false, error: `Parcelle màj : ${error.message}` };
      parcelleId = existing.id;
      // Supprimer les sous-tables pour les recréer
      await supabase.from('constructions_foncier').delete().eq('parcelle_id', parcelleId);
      await supabase.from('detenteurs_foncier').delete().eq('parcelle_id', parcelleId);
      await supabase.from('documents_foncier').delete().eq('parcelle_id', parcelleId);
      await supabase.from('jorolava_foncier').delete().eq('parcelle_id', parcelleId);
      await supabase.from('photos_terrain').delete().eq('parcelle_id', parcelleId);
    } else {
      const { data: newParcelle, error } = await supabase
        .from('parcelles')
        .insert({ ...parcellePayload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .select('id').single();
      if (error || !newParcelle) return { ok: false, error: `Parcelle insert : ${error?.message || 'Erreur inconnue'}` };
      parcelleId = newParcelle.id;
    }
  } else {
    const { data: newParcelle, error } = await supabase
      .from('parcelles')
      .insert({ ...parcellePayload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .select('id').single();
    if (error || !newParcelle) return { ok: false, error: `Parcelle : ${error?.message || 'Erreur inconnue'}` };
    parcelleId = newParcelle.id;
  }

  // Constructions
  if (result.constructions.length > 0) {
    const { error } = await supabase
      .from('constructions_foncier')
      .insert(result.constructions.map(c => ({ ...c, parcelle_id: parcelleId })));
    if (error) console.warn('[FANISA Foncier] Constructions:', error.message);
  }

  // Détenteurs
  if (result.detenteurs.length > 0) {
    const { error } = await supabase
      .from('detenteurs_foncier')
      .insert(result.detenteurs.map(d => ({ ...d, parcelle_id: parcelleId })));
    if (error) console.warn('[FANISA Foncier] Détenteurs:', error.message);
  }

  // Documents
  if (result.documents.length > 0) {
    const { error } = await supabase
      .from('documents_foncier')
      .insert(result.documents.map(d => ({ ...d, parcelle_id: parcelleId })));
    if (error) console.warn('[FANISA Foncier] Documents:', error.message);
  }

  // Jorolava
  if (result.jorolava.length > 0) {
    const { error } = await supabase
      .from('jorolava_foncier')
      .insert(result.jorolava.map(j => ({ ...j, parcelle_id: parcelleId })));
    if (error) console.warn('[FANISA Foncier] Jorolava:', error.message);
  }

  // Photos
  if (result.photos.length > 0) {
    const { error } = await supabase
      .from('photos_terrain')
      .insert(result.photos.map(p => ({ ...p, parcelle_id: parcelleId })));
    if (error) console.warn('[FANISA Foncier] Photos:', error.message);
  }

  // Log optionnel
  void supabase.from('logs').insert({
    date: new Date().toISOString(),
    utilisateur: 'Import Kobo Foncier',
    action: forceUpdate ? 'IMPORT_FONCIER_UPDATE' : 'IMPORT_FONCIER',
    details: `Parcelle ${parcelle.lot_id || parcelle.foncier_id || '?'} importée (UUID: ${result.koboUuid})`,
  });

  return { ok: true };
}

// ── Types état UI ─────────────────────────────────────────────────────────────

type Step = 'idle' | 'parsing' | 'preview' | 'importing' | 'done' | 'error';

interface ImportState {
  step: Step;
  results: FoncierImportResult[];
  duplicates: { item: FoncierImportResult; reason: string }[];
  imported: number;
  total: number;
  progress: number;
  warnings: string[];
  error?: string;
}

// ── Composant ─────────────────────────────────────────────────────────────────

interface Props {
  onImportDone?: () => void;
}

export default function KoboFoncierSyncModule({ onImportDone }: Props) {
  const [state, setState] = useState<ImportState>({
    step: 'idle', results: [], duplicates: [], imported: 0,
    total: 0, progress: 0, warnings: [],
  });
  const [forceUpdate, setForceUpdate] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [expandedWarnings, setExpandedWarnings] = useState(false);
  const [expandedDuplicates, setExpandedDuplicates] = useState(false);
  const [expandedParcelle, setExpandedParcelle] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Parsing ──────────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) {
      setState(s => ({ ...s, step: 'error', error: 'Veuillez sélectionner un fichier .xlsx exporté depuis KoboCollect.' }));
      return;
    }

    setState(s => ({
      ...s, step: 'parsing', results: [], duplicates: [],
      imported: 0, total: 0, progress: 0, warnings: [], error: undefined,
    }));

    try {
      const allResults = await parseFoncierXlsx(file);
      const allWarnings = allResults.flatMap(r => r.warnings);

      // Vérifier les doublons en base (par kobo_uuid)
      const uuids = allResults.map(r => r.koboUuid).filter(Boolean);
      const { data: existingParcelles } = await supabase
        .from('parcelles')
        .select('kobo_uuid, lot_id')
        .in('kobo_uuid', uuids.length > 0 ? uuids : ['__none__']);

      const existingUuids = new Set((existingParcelles || []).map((p: { kobo_uuid: string }) => p.kobo_uuid));

      const toInsert: FoncierImportResult[] = [];
      const duplicates: { item: FoncierImportResult; reason: string }[] = [];

      for (const r of allResults) {
        if (r.koboUuid && existingUuids.has(r.koboUuid)) {
          duplicates.push({ item: r, reason: `Parcelle déjà importée (UUID: ${r.koboUuid})` });
        } else {
          toInsert.push(r);
        }
      }

      setState(s => ({
        ...s, step: 'preview',
        results: toInsert,
        duplicates,
        total: allResults.length,
        warnings: allWarnings,
      }));
    } catch (e) {
      setState(s => ({
        ...s, step: 'error',
        error: `Erreur lecture XLSX : ${e instanceof Error ? e.message : String(e)}`,
      }));
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Import ────────────────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    const toProcess = forceUpdate
      ? [...state.results, ...state.duplicates.map(d => d.item)]
      : state.results;

    setState(s => ({ ...s, step: 'importing', progress: 0, total: toProcess.length }));

    let imported = 0;
    const errors: string[] = [];

    for (const r of toProcess) {
      const { ok, error } = await insertFoncierResult(r, forceUpdate);
      if (ok) {
        imported++;
      } else {
        errors.push(`Parcelle ${r.parcelle.lot_id || r.koboUuid} : ${error}`);
      }
      setState(s => ({ ...s, progress: imported }));
    }

    setState(s => ({
      ...s, step: 'done', imported,
      warnings: [...s.warnings, ...errors],
    }));

    if (imported > 0) onImportDone?.();
  }, [state.results, state.duplicates, forceUpdate, onImportDone]);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setState({ step: 'idle', results: [], duplicates: [], imported: 0, total: 0, progress: 0, warnings: [] });
    setForceUpdate(false);
    setExpandedParcelle(null);
  };

  const isLoading = state.step === 'parsing' || state.step === 'importing';

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* En-tête */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-3">
          <div className="bg-emerald-100 rounded-lg p-2 flex-shrink-0">
            <MapPin className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Import foncier — KoboToolbox</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Importez l'export XLSX du formulaire foncier FANISA (7 feuilles)
            </p>
          </div>
        </div>

        {/* Zone drag & drop */}
        {(state.step === 'idle' || state.step === 'error') && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`
              mt-5 cursor-pointer rounded-xl border-2 border-dashed p-8
              flex flex-col items-center gap-3 transition-colors
              ${dragOver
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
              }
            `}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="sr-only"
              onChange={handleInputChange}
            />
            <FileSpreadsheet className={`h-10 w-10 ${dragOver ? 'text-emerald-500' : 'text-slate-300'}`} />
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">
                Glissez ou cliquez pour sélectionner le fichier
              </p>
              <p className="text-xs text-slate-400 mt-1">
                FANISA__Formulaire_Foncier__…xlsx
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Upload className="h-3 w-3" />
              Fonctionne sans connexion internet
            </div>
          </div>
        )}

        {/* Info feuilles attendues */}
        <div className="mt-4 bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-700 mb-1.5">Feuilles lues dans le XLSX :</p>
          <div className="grid grid-cols-2 gap-1">
            {[
              ['Feuille principale', 'parcelles (1 ligne / parcelle)'],
              ['constructions', 'bâtiments sur la parcelle'],
              ['detenteurs', 'ayants-droit / détenteurs'],
              ['documents', 'pièces justificatives'],
              ['jorolava_liste', 'registre Jorolava'],
              ['photos_terrain', 'photos du terrain'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-1">
                <span className="font-mono text-indigo-700 font-medium">{k}</span>
                <span className="text-slate-400">— {v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Progression */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="h-4 w-4 text-emerald-600 animate-spin" />
            <span className="text-sm font-semibold text-slate-800">
              {state.step === 'parsing' && 'Lecture du fichier XLSX…'}
              {state.step === 'importing' && `Import en cours… ${state.progress}/${state.total}`}
            </span>
          </div>
          {state.total > 0 && (
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (state.progress / state.total) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Erreur */}
      {state.step === 'error' && state.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Erreur</p>
            <p className="text-xs text-red-700 mt-0.5">{state.error}</p>
          </div>
        </div>
      )}

      {/* Prévisualisation */}
      {state.step === 'preview' && (
        <div className="space-y-4">

          {/* Résumé chiffré */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total XLSX', value: state.total, color: 'text-slate-700', icon: FileSpreadsheet },
              { label: 'À importer', value: state.results.length, color: 'text-emerald-700', icon: MapPin },
              { label: 'Doublons', value: state.duplicates.length, color: 'text-orange-600', icon: RefreshCw },
              {
                label: 'Constructions',
                value: state.results.reduce((s, r) => s + r.constructions.length, 0),
                color: 'text-indigo-700',
                icon: Building2,
              },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Avertissements */}
          {state.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <button
                className="flex items-center gap-2 w-full text-left"
                onClick={() => setExpandedWarnings(p => !p)}
              >
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span className="text-sm font-semibold text-amber-800">
                  {state.warnings.length} avertissement{state.warnings.length > 1 ? 's' : ''}
                </span>
                {expandedWarnings
                  ? <ChevronDown className="h-4 w-4 text-amber-600 ml-auto" />
                  : <ChevronRight className="h-4 w-4 text-amber-600 ml-auto" />
                }
              </button>
              {expandedWarnings && (
                <ul className="mt-3 space-y-1">
                  {state.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-700 pl-6">• {w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Doublons */}
          {state.duplicates.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <button
                className="flex items-center gap-2 w-full text-left"
                onClick={() => setExpandedDuplicates(p => !p)}
              >
                <Info className="h-4 w-4 text-orange-600 flex-shrink-0" />
                <span className="text-sm font-semibold text-orange-800">
                  {state.duplicates.length} doublon{state.duplicates.length > 1 ? 's' : ''} ignoré{state.duplicates.length > 1 ? 's' : ''}
                </span>
                {expandedDuplicates
                  ? <ChevronDown className="h-4 w-4 text-orange-600 ml-auto" />
                  : <ChevronRight className="h-4 w-4 text-orange-600 ml-auto" />
                }
              </button>
              {expandedDuplicates && (
                <ul className="mt-3 space-y-1">
                  {state.duplicates.map(({ item, reason }, i) => (
                    <li key={i} className="text-xs text-orange-700 pl-6">
                      • {item.parcelle.lot_id || item.koboUuid} — {reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Aperçu des parcelles */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
              <Eye className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-800">
                Aperçu — {state.results.length} parcelle{state.results.length > 1 ? 's' : ''} à importer
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {state.results.map((r, i) => (
                <div key={i}>
                  {/* Ligne principale */}
                  <button
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 text-left"
                    onClick={() => setExpandedParcelle(expandedParcelle === i ? null : i)}
                  >
                    <MapPin className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-slate-800 font-mono">
                        {r.parcelle.lot_id || r.parcelle.foncier_id || '—'}
                      </span>
                      {r.parcelle.statut_propriete && (
                        <span className="ml-2 text-xs text-slate-400">{r.parcelle.statut_propriete}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {r.parcelle.superficie_declaree && (
                        <span className="text-xs text-slate-500">{r.parcelle.superficie_declaree} m²</span>
                      )}
                      {r.constructions.length > 0 && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Building2 className="h-3 w-3" />{r.constructions.length}
                        </span>
                      )}
                      {r.detenteurs.length > 0 && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Users className="h-3 w-3" />{r.detenteurs.length}
                        </span>
                      )}
                      {r.documents.length > 0 && (
                        <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <FileText className="h-3 w-3" />{r.documents.length}
                        </span>
                      )}
                      {r.photos.length > 0 && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Camera className="h-3 w-3" />{r.photos.length}
                        </span>
                      )}
                      {expandedParcelle === i
                        ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                      }
                    </div>
                  </button>

                  {/* Détail expandable */}
                  {expandedParcelle === i && (
                    <div className="px-6 pb-4 bg-slate-50 border-t border-slate-100 text-xs space-y-3">
                      {/* Infos parcelle */}
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 pt-3">
                        {[
                          ['Foncier ID', r.parcelle.foncier_id],
                          ['Nature terrain', r.parcelle.nature_terrain],
                          ['Origine droit', r.parcelle.origine_droit],
                          ['Superficie déclarée', r.parcelle.superficie_declaree ? `${r.parcelle.superficie_declaree} m²` : undefined],
                          ['Superficie estimée', r.parcelle.superficie_estimee ? `${r.parcelle.superficie_estimee} m²` : undefined],
                          ['Occupation', r.parcelle.occupation_terrain],
                          ['Agent', r.parcelle.code_agent],
                          ['Date collecte', r.parcelle.date_collecte],
                          ['Statut collecte', r.parcelle.statut_collecte],
                          ['GPS', r.parcelle.gps_lat ? `${r.parcelle.gps_lat?.toFixed(5)}, ${r.parcelle.gps_lng?.toFixed(5)}` : undefined],
                        ].filter(([, v]) => v).map(([label, value]) => (
                          <div key={label as string}>
                            <span className="text-slate-400">{label} : </span>
                            <span className="text-slate-700 font-medium">{value as string}</span>
                          </div>
                        ))}
                      </div>

                      {/* Constructions */}
                      {r.constructions.length > 0 && (
                        <div>
                          <p className="font-semibold text-slate-600 mb-1 flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" /> Constructions ({r.constructions.length})
                          </p>
                          <div className="space-y-1">
                            {r.constructions.map((c, ci) => (
                              <div key={ci} className="bg-white rounded px-3 py-1.5 border border-slate-200">
                                <span className="font-mono text-indigo-700">#{c.c_num ?? ci+1}</span>
                                {c.type_construction && <span className="ml-2 text-slate-500">{c.type_construction}</span>}
                                {c.etat && <span className="ml-2 text-slate-400">({c.etat})</span>}
                                {c.surface_m2 && <span className="ml-2">{c.surface_m2} m²</span>}
                                {c.proprio_nom && <span className="ml-2 text-slate-600">— {c.proprio_nom}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Détenteurs */}
                      {r.detenteurs.length > 0 && (
                        <div>
                          <p className="font-semibold text-slate-600 mb-1 flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" /> Détenteurs ({r.detenteurs.length})
                          </p>
                          <div className="space-y-1">
                            {r.detenteurs.map((d, di) => (
                              <div key={di} className="bg-white rounded px-3 py-1.5 border border-slate-200">
                                <span className="font-medium text-slate-800">{d.nom} {d.prenom}</span>
                                {d.lien_parcelle && <span className="ml-2 text-slate-400">{d.lien_parcelle}</span>}
                                {d.cin && <span className="ml-2 font-mono text-slate-500">CIN: {d.cin}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Documents */}
                      {r.documents.length > 0 && (
                        <div>
                          <p className="font-semibold text-slate-600 mb-1 flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" /> Documents ({r.documents.length})
                          </p>
                          <div className="space-y-1">
                            {r.documents.map((d, di) => (
                              <div key={di} className="bg-white rounded px-3 py-1.5 border border-slate-200">
                                <span className="text-violet-700 font-medium">{d.code_document}</span>
                                {d.libelle && <span className="ml-2 text-slate-500">{d.libelle}</span>}
                                {d.reference && <span className="ml-2 font-mono">{d.reference}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {r.warnings.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2">
                          {r.warnings.map((w, wi) => (
                            <p key={wi} className="text-amber-700">⚠ {w}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {state.results.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-slate-400">
                  Aucune nouvelle parcelle à importer.
                </div>
              )}
            </div>
          </div>

          {/* Option forcer mise à jour */}
          {state.duplicates.length > 0 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <input
                type="checkbox"
                checked={forceUpdate}
                onChange={e => setForceUpdate(e.target.checked)}
                className="rounded accent-amber-600"
              />
              <span className="text-amber-800 font-medium">
                Forcer la mise à jour des {state.duplicates.length} parcelle{state.duplicates.length > 1 ? 's' : ''} déjà existante{state.duplicates.length > 1 ? 's' : ''}
              </span>
              <span className="text-amber-600 text-xs">(écrase les données et recrée les sous-tables)</span>
            </label>
          )}

          {/* Boutons */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition"
            >
              Annuler
            </button>
            <button
              onClick={handleImport}
              disabled={state.results.length === 0 && !(forceUpdate && state.duplicates.length > 0)}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {forceUpdate && state.duplicates.length > 0
                ? `Confirmer l'import (${state.results.length + state.duplicates.length} parcelles)`
                : `Confirmer l'import (${state.results.length} parcelle${state.results.length > 1 ? 's' : ''})`
              }
            </button>
          </div>
        </div>
      )}

      {/* Succès */}
      {state.step === 'done' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 mb-1">Import terminé</h3>
          <p className="text-sm text-slate-600">
            <strong>{state.imported}</strong> parcelle{state.imported > 1 ? 's' : ''} importée{state.imported > 1 ? 's' : ''} avec succès
            {state.duplicates.length > 0 && !forceUpdate && `, ${state.duplicates.length} doublon${state.duplicates.length > 1 ? 's' : ''} ignoré${state.duplicates.length > 1 ? 's' : ''}`}
          </p>
          {state.warnings.filter(w => w.toLowerCase().includes('erreur') || w.includes('Parcelle ') && w.includes(' : ')).length > 0 && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-left">
              <p className="text-xs font-semibold text-red-800 mb-1">Erreurs lors de l'import :</p>
              <ul className="space-y-1">
                {state.warnings
                  .filter(w => w.toLowerCase().includes('erreur') || (w.includes('Parcelle ') && w.includes(' : ')))
                  .map((w, i) => (
                    <li key={i} className="text-xs text-red-700">• {w}</li>
                  ))
                }
              </ul>
            </div>
          )}
          <button
            onClick={handleReset}
            className="mt-4 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition"
          >
            Nouvel import
          </button>
        </div>
      )}
    </div>
  );
}
