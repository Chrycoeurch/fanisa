/**
 * KoboSyncModule.tsx — Interface d'import KoboToolbox vers FANISA
 *
 * Permet d'importer les soumissions des formulaires Kobo (ménage + foncier)
 * vers la base de données Supabase FANISA.
 */

import React, { useState, useCallback } from 'react';
import {
  RefreshCw, CheckCircle, AlertTriangle, XCircle, ChevronDown,
  ChevronRight, Wifi, WifiOff, Download, Eye, Loader2,
  Users, Home, MapPin, Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  fetchKoboSubmissions, fetchKoboAssetInfo, testKoboConnection,
  fetchKoboAssets, KOBO_UID_MENAGE, KOBO_UID_FONCIER, KoboSubmission
} from '../lib/koboApi';
import {
  mapKoboMenage, mapKoboFoncier, deduplicateKoboResults,
  KoboImportResult, KoboFoncierResult
} from '../lib/koboMapping';

// ── Types UI ──────────────────────────────────────────────────────────────────

type SyncStep = 'idle' | 'testing' | 'fetching' | 'preview' | 'importing' | 'done' | 'error';
type FormType = 'menage' | 'foncier';

interface ImportState {
  step: SyncStep;
  progress: number;
  total: number;
  error?: string;
  results: KoboImportResult[];
  foncierResults: KoboFoncierResult[];
  duplicates: { item: KoboImportResult; reason: string }[];
  imported: number;
  warnings: string[];
}

// ── Composant principal ───────────────────────────────────────────────────────

interface Props {
  onImportDone?: () => void;
}

export default function KoboSyncModule({ onImportDone }: Props) {
  const [connStatus, setConnStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [connUser, setConnUser] = useState('');
  const [formType, setFormType] = useState<FormType>('menage');
  const [customUid, setCustomUid] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [state, setState] = useState<ImportState>({
    step: 'idle', progress: 0, total: 0,
    results: [], foncierResults: [], duplicates: [], imported: 0, warnings: [],
  });
  const [expandedWarnings, setExpandedWarnings] = useState(false);
  const [expandedDuplicates, setExpandedDuplicates] = useState(false);

  // ── Tester la connexion ───────────────────────────────────────────────────

  const handleTestConnection = useCallback(async () => {
    setState(s => ({ ...s, step: 'testing', error: undefined }));
    const result = await testKoboConnection();
    if (result.ok) {
      setConnStatus('ok');
      setConnUser(result.username || '');
      setState(s => ({ ...s, step: 'idle' }));
    } else {
      setConnStatus('error');
      setState(s => ({ ...s, step: 'error', error: `Connexion échouée : ${result.error}` }));
    }
  }, []);

  // ── Lancer l'import ───────────────────────────────────────────────────────

  const handleFetch = useCallback(async () => {
    setState(s => ({
      ...s, step: 'fetching', progress: 0, total: 0,
      results: [], foncierResults: [], duplicates: [], imported: 0, warnings: [], error: undefined,
    }));

    try {
      const uid = customUid.trim() || (formType === 'menage' ? KOBO_UID_MENAGE : KOBO_UID_FONCIER);
      if (!uid) {
        setState(s => ({ ...s, step: 'error', error: 'UID du formulaire Kobo non configuré. Ajoutez VITE_KOBO_UID_MENAGE ou VITE_KOBO_UID_FONCIER dans votre .env' }));
        return;
      }

      const submissions: KoboSubmission[] = await fetchKoboSubmissions(uid, (loaded, total) => {
        setState(s => ({ ...s, progress: loaded, total }));
      });

      if (formType === 'menage') {
        // Transformer
        const allResults = submissions.map((row, i) => mapKoboMenage(row, i));
        const allWarnings = allResults.flatMap(r => r.warnings);

        // Récupérer les codes existants pour dédoublonnage
        const { data: existing } = await supabase
          .from('foyers')
          .select('code_menage')
          .not('code_menage', 'is', null);

        const existingCodes = new Set((existing || []).map((f: { code_menage: string }) => f.code_menage));
        const { toInsert, duplicates } = deduplicateKoboResults(allResults, existingCodes);

        setState(s => ({
          ...s, step: 'preview',
          results: toInsert,
          duplicates,
          warnings: allWarnings,
          total: submissions.length,
        }));
      } else {
        const allFoncier = submissions.map(row => mapKoboFoncier(row));
        const allWarnings = allFoncier.flatMap(r => r.warnings);
        setState(s => ({
          ...s, step: 'preview',
          foncierResults: allFoncier,
          warnings: allWarnings,
          total: submissions.length,
        }));
      }
    } catch (e) {
      setState(s => ({
        ...s, step: 'error',
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }, [formType, customUid]);

  // ── Confirmer l'import ────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    if (formType !== 'menage') {
      setState(s => ({ ...s, step: 'error', error: 'Import foncier : fonctionnalité à venir (besoin des tables parcelles).' }));
      return;
    }

    setState(s => ({ ...s, step: 'importing', progress: 0, total: state.results.length }));
    let imported = 0;
    const errors: string[] = [];

    for (const r of state.results) {
      try {
        // 1. Insérer le foyer
        const { data: foyer, error: foyerErr } = await supabase
          .from('foyers')
          .insert({
            ...r.foyer,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (foyerErr || !foyer) {
          errors.push(`Foyer ${r.foyer.code_menage} : ${foyerErr?.message || 'Erreur inconnue'}`);
          continue;
        }

        // 2. Insérer les membres
        for (const m of r.membres) {
          const { error: membreErr } = await supabase
            .from('membres')
            .insert({
              ...m,
              foyer_id: foyer.id,
              created_at: new Date().toISOString(),
            });
          if (membreErr) {
            errors.push(`Membre ${m.nom} (${r.foyer.code_menage}) : ${membreErr.message}`);
          }
        }

        // 3. Log Kobo sync
        await supabase.from('logs').insert({
          date: new Date().toISOString(),
          utilisateur: 'Import Kobo',
          action: 'IMPORT_KOBO',
          details: `Ménage importé depuis KoboToolbox (UUID: ${r.koboUuid})`,
          foyer_id: foyer.id,
        });

        imported++;
        setState(s => ({ ...s, progress: imported }));
      } catch (e) {
        errors.push(`Erreur inattendue : ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    setState(s => ({
      ...s, step: 'done', imported,
      warnings: [...s.warnings, ...errors],
    }));

    if (imported > 0) onImportDone?.();
  }, [state.results, formType, onImportDone]);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setState({ step: 'idle', progress: 0, total: 0, results: [], foncierResults: [], duplicates: [], imported: 0, warnings: [] });
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────

  const isLoading = state.step === 'fetching' || state.step === 'importing' || state.step === 'testing';

  return (
    <div className="space-y-5">

      {/* En-tête */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-indigo-600" />
              Synchronisation KoboToolbox
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Importez les soumissions de vos formulaires Kobo vers FANISA
            </p>
          </div>

          {/* Statut connexion */}
          <div className="flex items-center gap-2">
            {connStatus === 'ok' && (
              <span className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full">
                <Wifi className="h-3.5 w-3.5" />
                Connecté {connUser && `· ${connUser}`}
              </span>
            )}
            {connStatus === 'error' && (
              <span className="flex items-center gap-1.5 text-xs bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-full">
                <WifiOff className="h-3.5 w-3.5" />
                Connexion échouée
              </span>
            )}
            {connStatus === 'unknown' && (
              <span className="flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full">
                <Info className="h-3.5 w-3.5" />
                Non testé
              </span>
            )}
            <button
              onClick={handleTestConnection}
              disabled={isLoading}
              className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition disabled:opacity-50"
            >
              {state.step === 'testing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Tester'}
            </button>
          </div>
        </div>

        {/* Configuration */}
        <div className="mt-5 space-y-3">
          {/* Type de formulaire */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-2 block">Formulaire à importer</label>
            <div className="flex gap-2">
              {[
                { id: 'menage', label: 'Ménages', icon: Home, uid: KOBO_UID_MENAGE, desc: 'fanisa_formulaire_a' },
                { id: 'foncier', label: 'Foncier', icon: MapPin, uid: KOBO_UID_FONCIER, desc: 'fanisa_foncier' },
              ].map(({ id, label, icon: Icon, uid, desc }) => (
                <button
                  key={id}
                  onClick={() => setFormType(id as FormType)}
                  className={`flex-1 flex items-center gap-2 p-3 border rounded-lg text-xs transition ${
                    formType === id
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold">{label}</div>
                    <div className="opacity-60">{uid ? desc : '⚠ UID manquant'}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Options avancées */}
          <button
            className="text-xs text-slate-500 flex items-center gap-1 hover:text-slate-700"
            onClick={() => setShowAdvanced(p => !p)}
          >
            {showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Options avancées
          </button>
          {showAdvanced && (
            <div className="pt-2 space-y-2">
              <label className="text-xs font-semibold text-slate-700">UID personnalisé (override)</label>
              <input
                value={customUid}
                onChange={e => setCustomUid(e.target.value)}
                placeholder="ex: aBcDeF1234567890"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-400 font-mono"
              />
              <p className="text-xs text-slate-400">
                L'UID se trouve dans l'URL de votre formulaire Kobo :
                kf.kobotoolbox.org/#/forms/<strong>UID</strong>/
              </p>
            </div>
          )}
        </div>

        {/* Action principale */}
        {(state.step === 'idle' || state.step === 'error') && (
          <button
            onClick={handleFetch}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition"
          >
            <Download className="h-4 w-4" />
            Récupérer les soumissions Kobo
          </button>
        )}
      </div>

      {/* Progress bar */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="h-4 w-4 text-indigo-600 animate-spin" />
            <span className="text-sm font-semibold text-slate-800">
              {state.step === 'testing' && 'Test de connexion…'}
              {state.step === 'fetching' && `Téléchargement… ${state.progress}/${state.total || '?'}`}
              {state.step === 'importing' && `Import en cours… ${state.progress}/${state.total}`}
            </span>
          </div>
          {state.total > 0 && (
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all"
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
            {state.error.includes('VITE_KOBO') && (
              <div className="mt-3 bg-red-100 rounded-lg p-3 font-mono text-xs text-red-900">
                <p className="mb-1 font-sans font-semibold">Ajoutez dans votre .env :</p>
                <p>VITE_KOBO_TOKEN=votre_token_kobo</p>
                <p>VITE_KOBO_UID_MENAGE=uid_formulaire_menage</p>
                <p>VITE_KOBO_UID_FONCIER=uid_formulaire_foncier</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prévisualisation */}
      {state.step === 'preview' && formType === 'menage' && (
        <div className="space-y-4">
          {/* Résumé */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Soumissions Kobo', value: state.total, color: 'text-slate-700' },
              { label: 'À importer', value: state.results.length, color: 'text-emerald-700' },
              { label: 'Doublons ignorés', value: state.duplicates.length, color: 'text-orange-600' },
              { label: 'Membres total', value: state.results.reduce((s, r) => s + r.membres.length, 0), color: 'text-indigo-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-slate-500 mt-1">{label}</div>
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
                {expandedWarnings ? <ChevronDown className="h-4 w-4 text-amber-600 ml-auto" /> : <ChevronRight className="h-4 w-4 text-amber-600 ml-auto" />}
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
                {expandedDuplicates ? <ChevronDown className="h-4 w-4 text-orange-600 ml-auto" /> : <ChevronRight className="h-4 w-4 text-orange-600 ml-auto" />}
              </button>
              {expandedDuplicates && (
                <ul className="mt-3 space-y-1">
                  {state.duplicates.map(({ item, reason }, i) => (
                    <li key={i} className="text-xs text-orange-700 pl-6">
                      • {item.foyer.code_menage || item.koboUuid} — {reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Aperçu des ménages */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
              <Eye className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-800">
                Aperçu — {state.results.length} ménage{state.results.length > 1 ? 's' : ''} à importer
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {state.results.slice(0, 50).map((r, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  <Home className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-slate-800 font-mono">{r.foyer.code_menage}</span>
                    <span className="text-xs text-slate-500 ml-2">{r.foyer.adresse}</span>
                  </div>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full flex-shrink-0">
                    <Users className="h-3 w-3 inline mr-1" />{r.membres.length}
                  </span>
                </div>
              ))}
              {state.results.length > 50 && (
                <div className="px-4 py-3 text-xs text-slate-400 text-center">
                  … et {state.results.length - 50} autres
                </div>
              )}
            </div>
          </div>

          {/* Boutons confirmation */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition"
            >
              Annuler
            </button>
            <button
              onClick={handleImport}
              disabled={state.results.length === 0}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmer l'import ({state.results.length} ménages)
            </button>
          </div>
        </div>
      )}

      {/* Preview foncier */}
      {state.step === 'preview' && formType === 'foncier' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold">{state.foncierResults.length} parcelle{state.foncierResults.length > 1 ? 's' : ''} récupérée{state.foncierResults.length > 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {state.foncierResults.map((r, i) => (
                <div key={i} className="py-2.5 flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-500 w-8">{i+1}.</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-slate-800">{r.parcelle.numero_lot || '—'}</span>
                    <span className="text-xs text-slate-500 ml-2">{r.parcelle.adresse || r.parcelle.fokontany}</span>
                  </div>
                  {r.parcelle.superficie && (
                    <span className="text-xs text-slate-600 flex-shrink-0">{r.parcelle.superficie} m²</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 inline mr-2 text-amber-600" />
            L'import foncier est en cours de développement. La table <code>parcelles</code> doit être créée dans Supabase.
          </div>
          <button onClick={handleReset} className="w-full py-2.5 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition">
            Retour
          </button>
        </div>
      )}

      {/* Succès */}
      {state.step === 'done' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 mb-1">Import terminé</h3>
          <p className="text-sm text-slate-600">
            <strong>{state.imported}</strong> ménage{state.imported > 1 ? 's' : ''} importé{state.imported > 1 ? 's' : ''} avec succès
            {state.duplicates.length > 0 && `, ${state.duplicates.length} doublon${state.duplicates.length > 1 ? 's' : ''} ignoré${state.duplicates.length > 1 ? 's' : ''}`}
          </p>
          {state.warnings.filter(w => w.includes('Erreur') || w.includes('erreur')).length > 0 && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-left">
              <p className="text-xs font-semibold text-red-800 mb-1">Erreurs lors de l'import :</p>
              <ul className="space-y-1">
                {state.warnings.filter(w => w.includes('Erreur') || w.includes('erreur')).map((w, i) => (
                  <li key={i} className="text-xs text-red-700">• {w}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            onClick={handleReset}
            className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition"
          >
            Nouvel import
          </button>
        </div>
      )}

      {/* Guide configuration */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" /> Configuration requise
        </h4>
        <div className="font-mono text-xs text-slate-600 space-y-0.5 bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-slate-400"># Fichier .env à la racine du projet</p>
          <p>VITE_KOBO_TOKEN=<span className="text-indigo-600">votre_token_api_kobo</span></p>
          <p>VITE_KOBO_UID_MENAGE=<span className="text-indigo-600">uid_fanisa_formulaire_a</span></p>
          <p>VITE_KOBO_UID_FONCIER=<span className="text-indigo-600">uid_fanisa_foncier</span></p>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Token API : compte KoboToolbox → Paramètres → Sécurité → Générer un token API
        </p>
      </div>
    </div>
  );
}
