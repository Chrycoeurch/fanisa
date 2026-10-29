/**
 * GestionUtilisateurs.tsx — Interface admin de gestion des comptes FANISA
 * Visible uniquement par le rôle 'chef'
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { hashMDP, Role, labelRole, couleurRole } from '../lib/auth';
import {
  Users, Plus, Edit2, Trash2, X, Save, Loader2,
  Eye, EyeOff, ShieldCheck, CheckCircle2, AlertTriangle,
  UserCheck, UserX, Key
} from 'lucide-react';

interface Utilisateur {
  id: string;
  nom_utilisateur: string;
  role: Role;
  nom_complet: string;
  actif: boolean;
  derniere_connexion?: string;
  created_at: string;
}

const ROLES: Role[] = ['chef', 'agent', 'secretaire', 'tresorier', 'superviseur'];

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  chef: 'Accès complet à tous les modules',
  agent: 'Foyers, Patrimoine, Foncier, Collecte, KoboSync',
  secretaire: 'Documents, Vie Communautaire, Matériels',
  tresorier: 'Finances et Caisse uniquement',
  superviseur: 'Lecture seule sur tous les modules',
};

// ── Formulaire création/édition ───────────────────────────────────────────────
function FormUtilisateur({
  utilisateur,
  onSave,
  onClose,
  currentUserId,
}: {
  utilisateur?: Utilisateur;
  onSave: () => void;
  onClose: () => void;
  currentUserId: string;
}) {
  const [nom, setNom] = useState(utilisateur?.nom_utilisateur || '');
  const [nomComplet, setNomComplet] = useState(utilisateur?.nom_complet || '');
  const [role, setRole] = useState<Role>(utilisateur?.role || 'agent');
  const [mdp, setMdp] = useState('');
  const [mdpConfirm, setMdpConfirm] = useState('');
  const [showMdp, setShowMdp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');

  const isEdit = !!utilisateur;

  const handleSubmit = async () => {
    setErreur('');

    if (!nom.trim()) { setErreur('Le nom d\'utilisateur est obligatoire.'); return; }
    if (!nomComplet.trim()) { setErreur('Le nom complet est obligatoire.'); return; }

    if (!isEdit || mdp) {
      if (!isEdit && !mdp) { setErreur('Le mot de passe est obligatoire.'); return; }
      if (mdp && mdp.length < 6) { setErreur('Le mot de passe doit contenir au moins 6 caractères.'); return; }
      if (mdp && mdp !== mdpConfirm) { setErreur('Les mots de passe ne correspondent pas.'); return; }
    }

    setSaving(true);

    const payload: any = {
      nom_utilisateur: nom.toLowerCase().trim(),
      nom_complet: nomComplet.trim(),
      role,
      updated_at: new Date().toISOString(),
    };

    if (mdp) {
      payload.mot_de_passe = await hashMDP(mdp);
    }

    if (isEdit) {
      const { error } = await supabase
        .from('utilisateurs')
        .update(payload)
        .eq('id', utilisateur.id);
      if (error) { setErreur(error.message); setSaving(false); return; }
    } else {
      payload.actif = true;
      payload.created_at = new Date().toISOString();
      const { error } = await supabase.from('utilisateurs').insert(payload);
      if (error) {
        setErreur(error.message.includes('unique') ? 'Ce nom d\'utilisateur est déjà pris.' : error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            {isEdit ? 'Modifier le compte' : 'Nouveau compte'}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Nom d'utilisateur */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Nom d'utilisateur *
            </label>
            <input
              autoFocus={!isEdit}
              value={nom}
              onChange={e => setNom(e.target.value.toLowerCase().replace(/\s/g, '_'))}
              placeholder="agent_saisie"
              disabled={isEdit && utilisateur?.id === currentUserId}
              className="w-full text-sm px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 font-mono disabled:bg-slate-50 disabled:text-slate-400"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">Minuscules et underscores uniquement. Utilisé pour se connecter.</p>
          </div>

          {/* Nom complet */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Nom complet *</label>
            <input
              value={nomComplet}
              onChange={e => setNomComplet(e.target.value)}
              placeholder="Jean RAKOTO"
              className="w-full text-sm px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-400"
            />
          </div>

          {/* Rôle */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Rôle *</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as Role)}
              className="w-full text-sm px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 bg-white"
            >
              {ROLES.map(r => <option key={r} value={r}>{labelRole(r)}</option>)}
            </select>
            <p className="text-[10px] text-slate-400 mt-0.5">{ROLE_DESCRIPTIONS[role]}</p>
          </div>

          {/* Mot de passe */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              {isEdit ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe *'}
            </label>
            <div className="relative">
              <input
                type={showMdp ? 'text' : 'password'}
                value={mdp}
                onChange={e => setMdp(e.target.value)}
                placeholder={isEdit ? '(inchangé)' : 'Minimum 6 caractères'}
                className="w-full text-sm pl-3 pr-10 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-400"
              />
              <button type="button" onClick={() => setShowMdp(v => !v)} className="absolute right-3 top-3 text-slate-400">
                {showMdp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirmation MDP */}
          {mdp && (
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Confirmer le mot de passe *</label>
              <input
                type={showMdp ? 'text' : 'password'}
                value={mdpConfirm}
                onChange={e => setMdpConfirm(e.target.value)}
                className={`w-full text-sm px-3 py-2.5 border rounded-xl outline-none focus:border-indigo-400 ${
                  mdpConfirm && mdp !== mdpConfirm ? 'border-red-400 bg-red-50' : 'border-slate-200'
                }`}
              />
              {mdpConfirm && mdp !== mdpConfirm && (
                <p className="text-[10px] text-red-600 mt-0.5">Les mots de passe ne correspondent pas.</p>
              )}
            </div>
          )}
        </div>

        {/* Erreur */}
        {erreur && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            {erreur}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 font-semibold hover:bg-slate-50">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEdit ? 'Enregistrer' : 'Créer le compte'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Module principal ──────────────────────────────────────────────────────────
export default function GestionUtilisateurs({ currentUserId }: { currentUserId: string }) {
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Utilisateur | undefined>();
  const [confirm, setConfirm] = useState<{ id: string; action: 'supprimer' | 'desactiver' | 'activer' } | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('utilisateurs')
      .select('id, nom_utilisateur, role, nom_complet, actif, derniere_connexion, created_at')
      .order('created_at', { ascending: true });
    setUtilisateurs((data || []) as Utilisateur[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAction = async () => {
    if (!confirm) return;
    const { id, action } = confirm;

    if (action === 'supprimer') {
      if (id === currentUserId) { setActionMsg('Vous ne pouvez pas supprimer votre propre compte.'); setConfirm(null); return; }
      await supabase.from('utilisateurs').delete().eq('id', id);
    } else {
      await supabase.from('utilisateurs').update({ actif: action === 'activer', updated_at: new Date().toISOString() }).eq('id', id);
    }
    setConfirm(null);
    await load();
  };

  const fmt = (d?: string) => d
    ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Jamais';

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            Gestion des utilisateurs
          </h2>
          <button
            onClick={() => { setEditing(undefined); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition"
          >
            <Plus className="h-3.5 w-3.5" />Nouveau compte
          </button>
        </div>
        <p className="text-xs text-slate-400">{utilisateurs.length} compte{utilisateurs.length > 1 ? 's' : ''} configuré{utilisateurs.length > 1 ? 's' : ''}</p>
      </div>

      {/* Message flash */}
      {actionMsg && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {actionMsg}
          <button onClick={() => setActionMsg('')} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-slate-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />Chargement…
          </div>
        ) : utilisateurs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
            Aucun compte configuré.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-3 text-left text-slate-500 font-semibold">Utilisateur</th>
                  <th className="p-3 text-left text-slate-500 font-semibold">Rôle</th>
                  <th className="p-3 text-left text-slate-500 font-semibold hidden md:table-cell">Dernière connexion</th>
                  <th className="p-3 text-center text-slate-500 font-semibold">Statut</th>
                  <th className="p-3 text-center text-slate-500 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {utilisateurs.map(u => (
                  <tr key={u.id} className={`hover:bg-slate-50 ${!u.actif ? 'opacity-50' : ''}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs flex-shrink-0">
                          {(u.nom_complet || u.nom_utilisateur).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{u.nom_complet || u.nom_utilisateur}</p>
                          <p className="text-slate-400 font-mono text-[10px]">{u.nom_utilisateur}</p>
                        </div>
                        {u.id === currentUserId && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-semibold">Vous</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${couleurRole(u.role)}`}>
                        {labelRole(u.role)}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5 hidden md:block">{ROLE_DESCRIPTIONS[u.role]}</p>
                    </td>
                    <td className="p-3 text-slate-500 hidden md:table-cell">{fmt(u.derniere_connexion)}</td>
                    <td className="p-3 text-center">
                      {u.actif
                        ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full"><CheckCircle2 className="h-3 w-3" />Actif</span>
                        : <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full"><UserX className="h-3 w-3" />Inactif</span>
                      }
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        {/* Modifier */}
                        <button
                          onClick={() => { setEditing(u); setShowForm(true); }}
                          title="Modifier"
                          className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600 transition"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        {/* Activer / Désactiver */}
                        {u.id !== currentUserId && (
                          <button
                            onClick={() => setConfirm({ id: u.id, action: u.actif ? 'desactiver' : 'activer' })}
                            title={u.actif ? 'Désactiver' : 'Activer'}
                            className="p-1.5 hover:bg-amber-50 rounded-lg text-slate-400 hover:text-amber-600 transition"
                          >
                            {u.actif ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                          </button>
                        )}
                        {/* Supprimer */}
                        {u.id !== currentUserId && (
                          <button
                            onClick={() => setConfirm({ id: u.id, action: 'supprimer' })}
                            title="Supprimer"
                            className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Légende des rôles */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
          <Key className="h-3.5 w-3.5" />Accès par rôle
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ROLES.map(r => (
            <div key={r} className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${couleurRole(r)}`}>
                {labelRole(r)}
              </span>
              <span className="text-xs text-slate-500">{ROLE_DESCRIPTIONS[r]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal formulaire */}
      {showForm && (
        <FormUtilisateur
          utilisateur={editing}
          onSave={() => { setShowForm(false); setEditing(undefined); load(); }}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
          currentUserId={currentUserId}
        />
      )}

      {/* Confirmation action */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {confirm.action === 'supprimer' ? 'Supprimer ce compte ?' : confirm.action === 'desactiver' ? 'Désactiver ce compte ?' : 'Réactiver ce compte ?'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {confirm.action === 'supprimer'
                    ? 'Cette action est irréversible.'
                    : confirm.action === 'desactiver'
                    ? 'L\'utilisateur ne pourra plus se connecter.'
                    : 'L\'utilisateur pourra à nouveau se connecter.'
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 font-semibold hover:bg-slate-50">
                Annuler
              </button>
              <button
                onClick={handleAction}
                className={`flex-1 py-2.5 text-white text-sm font-bold rounded-xl transition ${
                  confirm.action === 'supprimer' ? 'bg-red-600 hover:bg-red-700' :
                  confirm.action === 'desactiver' ? 'bg-amber-500 hover:bg-amber-600' :
                  'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
