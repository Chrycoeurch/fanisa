/**
 * auth.ts — Authentification FANISA
 * Hash SHA-256 côté client + vérification contre la table utilisateurs Supabase
 */

import { supabase } from './supabase';

export type Role = 'chef' | 'agent' | 'secretaire' | 'tresorier' | 'superviseur';

export interface UtilisateurConnecte {
  id: string;
  nom_utilisateur: string;
  nom_complet: string;
  role: Role;
}

// ── Hash SHA-256 (Web Crypto API) ─────────────────────────────────────────────
export async function hashMDP(mdp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(mdp);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Login ─────────────────────────────────────────────────────────────────────
export async function login(
  nomUtilisateur: string,
  motDePasse: string
): Promise<{ user: UtilisateurConnecte | null; erreur: string | null }> {
  const hash = await hashMDP(motDePasse);

  const { data, error } = await supabase
    .from('utilisateurs')
    .select('id, nom_utilisateur, nom_complet, role, actif')
    .eq('nom_utilisateur', nomUtilisateur.toLowerCase().trim())
    .eq('mot_de_passe', hash)
    .single();

  if (error || !data) {
    return { user: null, erreur: 'Nom d\'utilisateur ou mot de passe incorrect.' };
  }

  if (!data.actif) {
    return { user: null, erreur: 'Ce compte est désactivé. Contactez le Chef Fokontany.' };
  }

  // Mettre à jour la dernière connexion
  await supabase
    .from('utilisateurs')
    .update({ derniere_connexion: new Date().toISOString() })
    .eq('id', data.id);

  const user: UtilisateurConnecte = {
    id: data.id,
    nom_utilisateur: data.nom_utilisateur,
    nom_complet: data.nom_complet || data.nom_utilisateur,
    role: data.role as Role,
  };

  // Persister en sessionStorage (survit au reload, pas à la fermeture d'onglet)
  try { sessionStorage.setItem('fanisa_user', JSON.stringify(user)); } catch (_) {}

  return { user, erreur: null };
}

// ── Logout ────────────────────────────────────────────────────────────────────
export function logout() {
  try { sessionStorage.removeItem('fanisa_user'); } catch (_) {}
}

// ── Restaurer session ─────────────────────────────────────────────────────────
export function restaurerSession(): UtilisateurConnecte | null {
  try {
    const raw = sessionStorage.getItem('fanisa_user');
    if (!raw) return null;
    return JSON.parse(raw) as UtilisateurConnecte;
  } catch (_) {
    return null;
  }
}

// ── Permissions par rôle ───────────────────────────────────────────────────────
export interface Permissions {
  // Modules principaux
  annuaire: boolean;      // Foyers, Membres
  documents: boolean;
  statistics: boolean;
  craad: boolean;
  vie_comm: boolean;
  finances: boolean;
  materials: boolean;
  patrimoine: boolean;
  land: boolean;          // Foncier
  collecte: boolean;
  kobo: boolean;
  logs: boolean;

  // Actions
  peutEcrire: boolean;    // false = superviseur (lecture seule)
  peutGererUsers: boolean; // true = chef uniquement
}

export function getPermissions(role: Role): Permissions {
  const base: Permissions = {
    annuaire: false, documents: false, statistics: false, craad: false,
    vie_comm: false, finances: false, materials: false, patrimoine: false,
    land: false, collecte: false, kobo: false, logs: false,
    peutEcrire: true, peutGererUsers: false,
  };

  switch (role) {
    case 'chef':
      return {
        ...base,
        annuaire: true, documents: true, statistics: true, craad: true,
        vie_comm: true, finances: true, materials: true, patrimoine: true,
        land: true, collecte: true, kobo: true, logs: true,
        peutEcrire: true, peutGererUsers: true,
      };

    case 'agent':
      return {
        ...base,
        annuaire: true, patrimoine: true, land: true,
        collecte: true, kobo: true, statistics: true,
        peutEcrire: true,
      };

    case 'secretaire':
      return {
        ...base,
        documents: true, vie_comm: true, materials: true,
        statistics: true,
        peutEcrire: true,
      };

    case 'tresorier':
      return {
        ...base,
        finances: true, statistics: true,
        peutEcrire: true,
      };

    case 'superviseur':
      return {
        ...base,
        annuaire: true, documents: true, statistics: true, craad: true,
        vie_comm: true, finances: true, materials: true, patrimoine: true,
        land: true, collecte: true, logs: true,
        peutEcrire: false,  // lecture seule
      };

    default:
      return base;
  }
}

// ── Label lisible du rôle ─────────────────────────────────────────────────────
export function labelRole(role: Role): string {
  const labels: Record<Role, string> = {
    chef: 'Chef Fokontany',
    agent: 'Agent de saisie',
    secretaire: 'Secrétaire',
    tresorier: 'Trésorier',
    superviseur: 'Superviseur',
  };
  return labels[role] || role;
}

// ── Couleur badge du rôle ─────────────────────────────────────────────────────
export function couleurRole(role: Role): string {
  const colors: Record<Role, string> = {
    chef: 'bg-indigo-100 text-indigo-700',
    agent: 'bg-emerald-100 text-emerald-700',
    secretaire: 'bg-violet-100 text-violet-700',
    tresorier: 'bg-amber-100 text-amber-700',
    superviseur: 'bg-slate-100 text-slate-600',
  };
  return colors[role] || 'bg-slate-100 text-slate-600';
}
