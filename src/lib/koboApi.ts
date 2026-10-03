/**
 * koboApi.ts — Client API KoboToolbox pour FANISA
 *
 * Utilise l'API REST de KoboToolbox (kf.kobotoolbox.org) pour récupérer
 * les soumissions des formulaires Kobo et les importer dans Supabase.
 *
 * Config requise dans .env :
 *   VITE_KOBO_TOKEN=<votre token Bearer>
 *   VITE_KOBO_UID_MENAGE=<uid du formulaire fanisa_formulaire_a>
 *   VITE_KOBO_UID_FONCIER=<uid du formulaire fanisa_foncier>
 */

export const KOBO_BASE_URL = 'https://kf.kobotoolbox.org';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env: any = (import.meta as any).env || {};
export const KOBO_TOKEN       = (_env.VITE_KOBO_TOKEN       as string) || '';
export const KOBO_UID_MENAGE  = (_env.VITE_KOBO_UID_MENAGE  as string) || '';
export const KOBO_UID_FONCIER = (_env.VITE_KOBO_UID_FONCIER as string) || '';

// ── Types bruts retournés par l'API Kobo ──────────────────────────────────────

export interface KoboSubmission {
  _id: number;
  _uuid: string;
  _submission_time: string;
  _submitted_by?: string | null;
  [key: string]: unknown; // Tous les champs du formulaire
}

export interface KoboApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: KoboSubmission[];
}

// ── Erreur typée ──────────────────────────────────────────────────────────────

export class KoboApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'KoboApiError';
  }
}

// ── Utilitaires headers ───────────────────────────────────────────────────────

function koboHeaders(): HeadersInit {
  if (!KOBO_TOKEN) throw new KoboApiError('VITE_KOBO_TOKEN non configuré');
  return {
    'Authorization': `Token ${KOBO_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

// ── Récupérer toutes les soumissions d'un formulaire (avec pagination) ────────

export async function fetchKoboSubmissions(
  assetUid: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<KoboSubmission[]> {
  if (!assetUid) throw new KoboApiError('UID du formulaire Kobo manquant');

  const all: KoboSubmission[] = [];
  let url: string | null =
    `${KOBO_BASE_URL}/api/v2/assets/${assetUid}/data/?format=json&limit=100`;

  while (url) {
    const res = await fetch(url, { headers: koboHeaders() });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new KoboApiError(
        `Erreur API Kobo ${res.status}: ${text || res.statusText}`,
        res.status
      );
    }
    const data: KoboApiResponse = await res.json();
    all.push(...data.results);
    onProgress?.(all.length, data.count);
    url = data.next;
  }

  return all;
}

// ── Récupérer les métadonnées d'un formulaire (nom, champs) ──────────────────

export interface KoboAssetInfo {
  uid: string;
  name: string;
  date_modified: string;
  deployment__submission_count: number;
  content?: { survey?: KoboSurveyField[] };
}

export interface KoboSurveyField {
  type: string;
  name: string;
  label?: string | string[];
  required?: boolean;
  hint?: string | string[];
}

export async function fetchKoboAssetInfo(assetUid: string): Promise<KoboAssetInfo> {
  if (!assetUid) throw new KoboApiError('UID du formulaire Kobo manquant');

  const res = await fetch(
    `${KOBO_BASE_URL}/api/v2/assets/${assetUid}/?format=json`,
    { headers: koboHeaders() }
  );
  if (!res.ok) {
    throw new KoboApiError(
      `Erreur API Kobo ${res.status}: ${res.statusText}`,
      res.status
    );
  }
  return res.json();
}

// ── Tester la connexion (valider le token) ────────────────────────────────────

export async function testKoboConnection(): Promise<{ ok: boolean; username?: string; error?: string }> {
  try {
    const res = await fetch(`${KOBO_BASE_URL}/api/v2/me/`, { headers: koboHeaders() });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, username: data.username };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Récupérer la liste des formulaires disponibles ────────────────────────────

export interface KoboAssetSummary {
  uid: string;
  name: string;
  deployment__submission_count: number;
  date_modified: string;
}

export async function fetchKoboAssets(): Promise<KoboAssetSummary[]> {
  const res = await fetch(
    `${KOBO_BASE_URL}/api/v2/assets/?format=json&asset_type=survey&limit=50`,
    { headers: koboHeaders() }
  );
  if (!res.ok) throw new KoboApiError(`Erreur API Kobo ${res.status}`, res.status);
  const data = await res.json();
  return (data.results || []).map((a: KoboAssetSummary) => ({
    uid: a.uid,
    name: a.name,
    deployment__submission_count: a.deployment__submission_count ?? 0,
    date_modified: a.date_modified,
  }));
}
