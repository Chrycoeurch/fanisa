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

/**
 * En production (Cloudflare Pages), les appels API passent par le proxy Worker
 * /api/kobo/* pour contourner le blocage CORS de kf.kobotoolbox.org.
 *
 * En développement local (vite dev), on peut appeler l'API directement
 * car le serveur de dev Vite peut configurer un proxy, ou utiliser le Worker local.
 */
const _env: any = (import.meta as any).env || {}; // eslint-disable-line @typescript-eslint/no-explicit-any

// En production : utiliser le proxy CF Pages Function (/api/kobo)
// En dev local : appel direct à kf.kobotoolbox.org (nécessite VITE_KOBO_TOKEN dans .env)
const isDev = _env.DEV === true;

export const KOBO_BASE_URL = isDev
  ? 'https://kf.kobotoolbox.org'
  : '';  // URL relative → proxy CF Pages

// Le token est utilisé en dev local seulement (en prod c'est le Worker qui l'injecte)
export const KOBO_TOKEN = (_env.VITE_KOBO_TOKEN as string) || '';

// UIDs des formulaires FANISA — valeurs par défaut hardcodées pour la prod
// (les vars d'env sont prioritaires si définies dans CF Pages)
export const KOBO_UID_MENAGE  =
  (_env.VITE_KOBO_UID_MENAGE  as string) || 'atpiJo8M47xUFCXQV6sJ5V';
export const KOBO_UID_FONCIER =
  (_env.VITE_KOBO_UID_FONCIER as string) || 'avqLd5dBt4dryES5ZjnBAs';

/**
 * Construit l'URL de l'endpoint Kobo.
 * - Dev : https://kf.kobotoolbox.org/api/v2/...
 * - Prod : /api/kobo/... (proxy CF Worker)
 */
function koboUrl(path: string): string {
  if (isDev) {
    return `https://kf.kobotoolbox.org/api/v2/${path}`;
  }
  return `/api/kobo/${path}`;
}

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
  // En dev local : on envoie le token directement
  // En prod : le Worker CF injecte le token côté serveur, pas besoin de l'envoyer depuis le navigateur
  if (isDev) {
    if (!KOBO_TOKEN) throw new KoboApiError('VITE_KOBO_TOKEN non configuré dans .env');
    return {
      'Authorization': `Token ${KOBO_TOKEN}`,
      'Content-Type': 'application/json',
    };
  }
  // En prod on passe juste le Content-Type (le proxy ajoute Authorization)
  return { 'Content-Type': 'application/json' };
}

// ── Récupérer toutes les soumissions d'un formulaire (avec pagination) ────────

export async function fetchKoboSubmissions(
  assetUid: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<KoboSubmission[]> {
  if (!assetUid) throw new KoboApiError('UID du formulaire Kobo manquant');

  const all: KoboSubmission[] = [];
  let url: string | null = koboUrl(`assets/${assetUid}/data/?format=json&limit=100`);

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
    // Convertir l'URL de pagination vers le proxy en prod
    if (data.next && !isDev) {
      const nextPath = data.next.replace('https://kf.kobotoolbox.org/api/v2/', '');
      url = `/api/kobo/${nextPath}`;
    } else {
      url = data.next;
    }
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
    koboUrl(`assets/${assetUid}/?format=json`),
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
    const url = koboUrl('me/');
    const res = await fetch(url, { headers: koboHeaders() });
    if (!res.ok) {
      // Essayer de récupérer le message d'erreur JSON du proxy
      let detail = '';
      try {
        const body = await res.json();
        detail = body?.targetUrl ? ` (→ ${body.targetUrl})` : (body?.error || '');
      } catch {
        detail = await res.text().catch(() => '');
      }
      return { ok: false, error: `HTTP ${res.status}${detail ? ' — ' + detail : ''}` };
    }
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
    koboUrl('assets/?format=json&asset_type=survey&limit=50'),
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
