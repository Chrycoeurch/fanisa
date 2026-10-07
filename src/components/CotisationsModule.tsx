/**
 * CotisationsModule.tsx — Enregistrement des cotisations Fokontany
 *
 * Workflow :
 *   1. Scan QR ou saisie du numéro de carnet
 *   2. Affichage du chef de ménage pour confirmation
 *   3. Saisie du montant, période, date, agent
 *   4. Enregistrement dans Supabase (table cotisations)
 *   5. Historique des cotisations du ménage
 */

import React, { useState, useCallback } from 'react';
import {
  QrCode, CheckCircle, XCircle, Loader2, AlertTriangle,
  CreditCard, User, Calendar, Search, History, ChevronDown, ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { idValide, normaliserId } from '../lib/qrScanner';
import QrScannerModal from './QrScannerModal';
import type { Foyer, Membre } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Cotisation {
  id: string;
  foyer_id: string;
  menage_id: string;
  montant: number;
  periode: string;
  date_paiement: string;
  agent: string;
  notes?: string;
  created_at: string;
}

interface MenageFound {
  foyer: Foyer;
  chef: Membre | null;
  cotisations: Cotisation[];
}

// ── Composant ─────────────────────────────────────────────────────────────────

interface Props {
  agentNom?: string;
}

export default function CotisationsModule({ agentNom = '' }: Props) {
  const [showScanner, setShowScanner]   = useState(false);
  const [searchInput, setSearchInput]   = useState('');
  const [searching, setSearching]       = useState(false);
  const [searchError, setSearchError]   = useState('');
  const [menageFound, setMenageFound]   = useState<MenageFound | null>(null);

  // Formulaire cotisation
  const [montant, setMontant]         = useState('');
  const [periode, setPeriode]         = useState('');
  const [datePaiement, setDatePaiement] = useState(new Date().toISOString().slice(0, 10));
  const [agent, setAgent]             = useState(agentNom);
  const [notes, setNotes]             = useState('');
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [saveError, setSaveError]     = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // ── Recherche du ménage ────────────────────────────────────────────────────

  const rechercherMenage = useCallback(async (menageId: string) => {
    const id = normaliserId(menageId);
    if (!id) { setSearchError('Entrez un identifiant'); return; }
    if (!idValide(id)) { setSearchError(`Format invalide. Attendu : AMB-TRV-26-T-XXXXX`); return; }

    setSearching(true);
    setSearchError('');
    setMenageFound(null);
    setSaved(false);

    try {
      // Chercher le foyer
      const { data: foyerData, error: foyerErr } = await supabase
        .from('foyers')
        .select('*')
        .eq('code_menage', id)
        .maybeSingle();

      if (foyerErr) throw foyerErr;
      if (!foyerData) {
        setSearchError(`Ménage "${id}" introuvable dans FANISA. Vérifiez le numéro ou importez le ménage depuis Kobo.`);
        setSearching(false);
        return;
      }

      const foyer = foyerData as Foyer;

      // Chercher le chef de ménage
      const { data: chefData } = await supabase
        .from('membres')
        .select('*')
        .eq('foyer_id', foyer.id)
        .eq('is_chef', true)
        .maybeSingle();

      // Chercher l'historique des cotisations
      const { data: cotisData } = await supabase
        .from('cotisations')
        .select('*')
        .eq('foyer_id', foyer.id)
        .order('date_paiement', { ascending: false })
        .limit(20);

      setMenageFound({
        foyer,
        chef: chefData as Membre | null,
        cotisations: (cotisData || []) as Cotisation[],
      });
      setSearchInput(id);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  }, []);

  // ── Enregistrer la cotisation ──────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!menageFound) return;
    const montantNum = parseFloat(montant.replace(/\s/g, '').replace(',', '.'));
    if (isNaN(montantNum) || montantNum <= 0) { setSaveError('Montant invalide'); return; }
    if (!periode.trim()) { setSaveError('Période obligatoire (ex: 2026-T1, Janvier 2026)'); return; }
    if (!agent.trim()) { setSaveError('Nom de l\'agent obligatoire'); return; }

    setSaving(true);
    setSaveError('');

    try {
      const { error } = await supabase.from('cotisations').insert({
        foyer_id: menageFound.foyer.id,
        menage_id: menageFound.foyer.code_menage,
        montant: montantNum,
        periode: periode.trim(),
        date_paiement: datePaiement,
        agent: agent.trim(),
        notes: notes.trim() || null,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Log
      await supabase.from('logs').insert({
        date: new Date().toISOString(),
        utilisateur: agent.trim(),
        action: 'COTISATION',
        details: `Cotisation ${montantNum} Ar — ${periode} — ménage ${menageFound.foyer.code_menage}`,
        foyer_id: menageFound.foyer.id,
      });

      setSaved(true);
      setMontant('');
      setNotes('');

      // Rafraîchir l'historique
      const { data: newCotis } = await supabase
        .from('cotisations')
        .select('*')
        .eq('foyer_id', menageFound.foyer.id)
        .order('date_paiement', { ascending: false })
        .limit(20);

      setMenageFound(prev => prev ? { ...prev, cotisations: (newCotis || []) as Cotisation[] } : null);

    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [menageFound, montant, periode, datePaiement, agent, notes]);

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Scanner modal */}
      {showScanner && (
        <QrScannerModal
          onResult={(id) => rechercherMenage(id)}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* En-tête */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
          <CreditCard className="h-5 w-5 text-indigo-600" />
          Cotisations Fokontany
        </h2>
        <p className="text-xs text-slate-500">Scan du carnet ou saisie du numéro de ménage</p>

        {/* Barre de recherche */}
        <div className="mt-4 flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={searchInput}
              onChange={e => { setSearchInput(e.target.value.toUpperCase()); setSearchError(''); }}
              onKeyDown={e => e.key === 'Enter' && rechercherMenage(searchInput)}
              placeholder="AMB-TRV-26-T-XXXXX"
              className="w-full pl-9 pr-4 py-2.5 text-sm font-mono border border-slate-200 rounded-xl outline-none focus:border-indigo-400 transition"
              maxLength={20}
            />
          </div>
          <button
            onClick={() => setShowScanner(true)}
            className="px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition flex items-center gap-2"
            title="Scanner un QR code"
          >
            <QrCode className="h-4 w-4" />
            <span className="text-sm font-semibold hidden sm:inline">Scanner</span>
          </button>
          <button
            onClick={() => rechercherMenage(searchInput)}
            disabled={searching}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rechercher'}
          </button>
        </div>

        {searchError && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{searchError}</p>
          </div>
        )}
      </div>

      {/* Résultat trouvé */}
      {menageFound && (
        <>
          {/* Carte ménage */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <User className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-slate-900">{menageFound.foyer.code_menage}</span>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Ménage trouvé</span>
                </div>
                {menageFound.chef ? (
                  <p className="text-base font-semibold text-slate-800 mt-1">
                    {menageFound.chef.prenom} {menageFound.chef.nom}
                    <span className="ml-2 text-xs text-slate-400 font-normal">(chef de ménage)</span>
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 mt-1 italic">Chef de ménage non renseigné</p>
                )}
                <p className="text-xs text-slate-500 mt-0.5">{menageFound.foyer.adresse} · {menageFound.foyer.fokontany}</p>
                <p className="text-xs text-slate-400 mt-0.5">{menageFound.foyer.nombre_membres} membre(s)</p>
              </div>
            </div>
          </div>

          {/* Succès */}
          {saved && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-semibold text-emerald-800">Cotisation enregistrée avec succès !</p>
            </div>
          )}

          {/* Formulaire cotisation */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Nouvelle cotisation</h3>

            <div className="space-y-3">
              {/* Montant */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Montant (Ar) *</label>
                <input
                  type="number"
                  value={montant}
                  onChange={e => setMontant(e.target.value)}
                  placeholder="ex: 2000"
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-400 transition"
                />
              </div>

              {/* Période */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Période *</label>
                <input
                  value={periode}
                  onChange={e => setPeriode(e.target.value)}
                  placeholder="ex: 2026-T4, Octobre 2026, Annuel 2026"
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-400 transition"
                />
              </div>

              {/* Date + Agent côte à côte */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    <Calendar className="h-3 w-3 inline mr-1" />Date *
                  </label>
                  <input
                    type="date"
                    value={datePaiement}
                    onChange={e => setDatePaiement(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-400 transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">Agent *</label>
                  <input
                    value={agent}
                    onChange={e => setAgent(e.target.value)}
                    placeholder="Nom de l'agent"
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-400 transition"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Notes (optionnel)</label>
                <input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Remarques..."
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-400 transition"
                />
              </div>

              {saveError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{saveError}</p>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement…</>
                ) : (
                  <><CheckCircle className="h-4 w-4" /> Enregistrer la cotisation</>
                )}
              </button>
            </div>
          </div>

          {/* Historique */}
          {menageFound.cotisations.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                className="w-full flex items-center gap-2 p-4 text-left hover:bg-slate-50 transition"
                onClick={() => setShowHistory(p => !p)}
              >
                <History className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-800">
                  Historique ({menageFound.cotisations.length} cotisation{menageFound.cotisations.length > 1 ? 's' : ''})
                </span>
                {showHistory ? <ChevronDown className="h-4 w-4 text-slate-400 ml-auto" /> : <ChevronRight className="h-4 w-4 text-slate-400 ml-auto" />}
              </button>

              {showHistory && (
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {menageFound.cotisations.map(c => (
                    <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800">{c.periode}</p>
                        <p className="text-xs text-slate-500">{c.date_paiement} · {c.agent}</p>
                        {c.notes && <p className="text-xs text-slate-400 italic mt-0.5">{c.notes}</p>}
                      </div>
                      <span className="text-sm font-bold text-emerald-700 flex-shrink-0">
                        {c.montant.toLocaleString('fr-MG')} Ar
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Guide si rien */}
      {!menageFound && !searching && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
          <QrCode className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Scannez le QR code du carnet</p>
          <p className="text-xs text-slate-400 mt-1">
            ou tapez le numéro AMB-TRV-26-T-XXXXX dans la barre de recherche
          </p>
        </div>
      )}
    </div>
  );
}
