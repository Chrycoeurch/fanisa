/**
 * LoginScreen.tsx — Écran de connexion FANISA
 */

import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { ShieldCheck, Loader2, Eye, EyeOff, Lock, User } from 'lucide-react';

export default function LoginScreen() {
  const { login } = useAuth();
  const [nom, setNom] = useState('');
  const [mdp, setMdp] = useState('');
  const [showMdp, setShowMdp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim() || !mdp.trim()) return;
    setLoading(true);
    setErreur('');
    const err = await login(nom.trim(), mdp);
    if (err) setErreur(err);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 flex flex-col items-center justify-center p-4">

      {/* Logo / En-tête */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-lg mb-4">
          <ShieldCheck className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">FANISA</h1>
        <p className="text-sm text-slate-500 mt-1">Système de gestion du Fokontany</p>
      </div>

      {/* Carte de login */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <h2 className="text-base font-bold text-slate-800 mb-6">Connexion</h2>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Nom d'utilisateur */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Nom d'utilisateur
            </label>
            <div className="relative">
              <User className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                autoFocus
                value={nom}
                onChange={e => { setNom(e.target.value); setErreur(''); }}
                placeholder="chef"
                autoComplete="username"
                className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm outline-none transition ${
                  erreur ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-indigo-400'
                }`}
              />
            </div>
          </div>

          {/* Mot de passe */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type={showMdp ? 'text' : 'password'}
                value={mdp}
                onChange={e => { setMdp(e.target.value); setErreur(''); }}
                placeholder="••••••••"
                autoComplete="current-password"
                className={`w-full pl-9 pr-10 py-2.5 border rounded-xl text-sm outline-none transition ${
                  erreur ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-indigo-400'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowMdp(v => !v)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showMdp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Message d'erreur */}
          {erreur && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700 font-medium">
              {erreur}
            </div>
          )}

          {/* Bouton */}
          <button
            type="submit"
            disabled={loading || !nom.trim() || !mdp.trim()}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 mt-2"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" />Connexion…</>
              : 'Se connecter'
            }
          </button>
        </form>
      </div>

      {/* Note de bas de page */}
      <p className="mt-6 text-xs text-slate-400 text-center max-w-xs">
        Accès réservé aux agents autorisés du Fokontany.<br />
        En cas de problème de connexion, contactez le Chef Fokontany.
      </p>
    </div>
  );
}
