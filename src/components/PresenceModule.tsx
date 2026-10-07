/**
 * PresenceModule.tsx — Module Présence aux réunions pour FANISA
 *
 * Workflow :
 *  1. Agent sélectionne ou crée une réunion
 *  2. Scanne le QR carnet du ménage (ou saisie manuelle)
 *  3. Choisit le membre présent parmi les membres du foyer
 *  4. Enregistre la présence (max 1 membre par ménage par réunion)
 *
 * Tables Supabase :
 *  - reunions (id, titre, date, lieu, type, created_at)
 *  - presences (id, reunion_id, foyer_id, menage_id, membre_id, agent, notes, created_at)
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { idValide, normaliserId } from '../lib/qrScanner';
import QrScannerModal from './QrScannerModal';
import {
  QrCode, Users, Calendar, Plus, CheckCircle2, XCircle,
  Loader2, ChevronDown, ChevronUp, AlertTriangle, Search,
  MapPin, Edit3, X, ClipboardList
} from 'lucide-react';

interface Props {
  agentNom?: string;
}

interface Reunion {
  id: string;
  titre: string;
  date: string;
  lieu?: string;
  type?: string;
  created_at: string;
}

interface Presence {
  id: string;
  reunion_id: string;
  foyer_id: string;
  menage_id: string;
  membre_id?: string;
  agent?: string;
  notes?: string;
  created_at: string;
  // Joints
  membre_nom?: string;
  membre_prenom?: string;
}

interface FoyerInfo {
  id: string;
  code_menage: string;
  fokontany?: string;
  adresse?: string;
}

interface MembreInfo {
  id: string;
  nom: string;
  prenom: string;
  is_chef: boolean;
  relation_chef?: string;
}

// ── Formulaire de création de réunion ────────────────────────────────────────

function ReunionForm({ onSave, onClose }: { onSave: (r: Partial<Reunion>) => void; onClose: () => void }) {
  const today = new Date().toISOString().split('T')[0];
  const [titre, setTitre] = useState('');
  const [date, setDate] = useState(today);
  const [lieu, setLieu] = useState('');
  const [type, setType] = useState('Assemblée générale');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!titre.trim()) return;
    setSaving(true);
    await onSave({ titre: titre.trim(), date, lieu: lieu.trim() || undefined, type });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Nouvelle réunion</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Titre *</label>
            <input
              autoFocus
              value={titre}
              onChange={e => setTitre(e.target.value)}
              placeholder="Assemblée générale Octobre 2026"
              className="w-full text-sm px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Date *</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full text-sm px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full text-sm px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 bg-white"
              >
                <option>Assemblée générale</option>
                <option>Réunion ordinaire</option>
                <option>Réunion extraordinaire</option>
                <option>Formation</option>
                <option>Sensibilisation</option>
                <option>Autre</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Lieu</label>
            <input
              value={lieu}
              onChange={e => setLieu(e.target.value)}
              placeholder="Salle communautaire Amboriala…"
              className="w-full text-sm px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 font-semibold hover:bg-slate-50 transition">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!titre.trim() || saving}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Module principal ──────────────────────────────────────────────────────────

export default function PresenceModule({ agentNom = 'Agent Fokontany' }: Props) {
  // Réunions
  const [reunions, setReunions] = useState<Reunion[]>([]);
  const [reunionActive, setReunionActive] = useState<Reunion | null>(null);
  const [showReunionForm, setShowReunionForm] = useState(false);
  const [loadingReunions, setLoadingReunions] = useState(true);

  // Scan / Recherche
  const [scanInput, setScanInput] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Foyer trouvé
  const [foyer, setFoyer] = useState<FoyerInfo | null>(null);
  const [membres, setMembres] = useState<MembreInfo[]>([]);
  const [membreChoisi, setMembreChoisi] = useState<string>('');

  // Présences de la réunion active
  const [presences, setPresences] = useState<Presence[]>([]);
  const [loadingPresences, setLoadingPresences] = useState(false);

  // État
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [notes, setNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // ── Chargement des réunions ──────────────────────────────────
  useEffect(() => {
    loadReunions();
  }, []);

  const loadReunions = async () => {
    setLoadingReunions(true);
    const { data } = await supabase
      .from('reunions')
      .select('*')
      .order('date', { ascending: false })
      .limit(30);
    setReunions(data || []);
    if (data && data.length > 0 && !reunionActive) {
      setReunionActive(data[0]);
    }
    setLoadingReunions(false);
  };

  // ── Charger présences de la réunion active ───────────────────
  useEffect(() => {
    if (!reunionActive) return;
    loadPresences(reunionActive.id);
  }, [reunionActive]);

  const loadPresences = async (reunionId: string) => {
    setLoadingPresences(true);
    const { data } = await supabase
      .from('presences')
      .select('*')
      .eq('reunion_id', reunionId)
      .order('created_at', { ascending: false });
    setPresences(data || []);
    setLoadingPresences(false);
  };

  // ── Créer réunion ────────────────────────────────────────────
  const handleCreateReunion = async (partial: Partial<Reunion>) => {
    const { data, error } = await supabase
      .from('reunions')
      .insert({ ...partial, created_at: new Date().toISOString() })
      .select()
      .single();
    if (!error && data) {
      setReunions(prev => [data, ...prev]);
      setReunionActive(data);
      setShowReunionForm(false);
      resetSearch();
    }
  };

  // ── Rechercher le ménage ─────────────────────────────────────
  const rechercherMenage = async (id: string) => {
    const normalised = normaliserId(id);
    if (!idValide(normalised)) {
      setSearchError(`Format invalide : ${id}. Attendu AMB-TRV-26-T-XXXXX`);
      return;
    }

    setSearching(true);
    setSearchError('');
    setFoyer(null);
    setMembres([]);
    setMembreChoisi('');
    setSuccessMsg('');

    // Chercher le foyer
    const { data: foyerData, error: foyerErr } = await supabase
      .from('foyers')
      .select('id, code_menage, fokontany, adresse')
      .eq('code_menage', normalised)
      .single();

    if (foyerErr || !foyerData) {
      setSearchError(`Ménage introuvable : ${normalised}. Vérifiez l'identifiant ou synchronisez KoboToolbox.`);
      setSearching(false);
      return;
    }

    // Membres du foyer
    const { data: membresData } = await supabase
      .from('membres')
      .select('id, nom, prenom, is_chef, relation_chef')
      .eq('foyer_id', foyerData.id)
      .order('is_chef', { ascending: false });

    setFoyer(foyerData);
    setMembres(membresData || []);
    // Pré-sélectionner le chef
    const chef = (membresData || []).find((m: MembreInfo) => m.is_chef);
    setMembreChoisi(chef?.id || (membresData?.[0]?.id ?? ''));
    setSearching(false);
  };

  const handleScanResult = (menageId: string) => {
    setScanInput(menageId);
    rechercherMenage(menageId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') rechercherMenage(scanInput);
  };

  const resetSearch = () => {
    setScanInput('');
    setFoyer(null);
    setMembres([]);
    setMembreChoisi('');
    setSearchError('');
    setSuccessMsg('');
    setNotes('');
  };

  // ── Enregistrer présence ─────────────────────────────────────
  const handleEnregistrer = async () => {
    if (!reunionActive || !foyer || !membreChoisi) return;

    setSaving(true);
    setSuccessMsg('');

    // Vérifier si ce ménage est déjà enregistré pour cette réunion
    const { data: existing } = await supabase
      .from('presences')
      .select('id')
      .eq('reunion_id', reunionActive.id)
      .eq('foyer_id', foyer.id)
      .single();

    if (existing) {
      setSearchError(`Le ménage ${foyer.code_menage} est déjà enregistré pour cette réunion.`);
      setSaving(false);
      return;
    }

    const membreInfo = membres.find(m => m.id === membreChoisi);
    const now = new Date().toISOString();

    const { error } = await supabase.from('presences').insert({
      reunion_id: reunionActive.id,
      foyer_id: foyer.id,
      menage_id: foyer.code_menage,
      membre_id: membreChoisi,
      agent: agentNom,
      notes: notes.trim() || null,
      created_at: now,
    });

    // Log
    await supabase.from('logs').insert({
      date: now,
      utilisateur: agentNom,
      action: 'Présence',
      details: `Présence enregistrée — Ménage ${foyer.code_menage} · ${membreInfo ? `${membreInfo.nom} ${membreInfo.prenom}` : ''} · Réunion : ${reunionActive.titre}`,
      foyer_id: foyer.id,
      membre_id: membreChoisi,
    });

    if (!error) {
      setSuccessMsg(`✓ Présence enregistrée — ${membreInfo ? `${membreInfo.nom} ${membreInfo.prenom}` : foyer.code_menage}`);
      await loadPresences(reunionActive.id);
      // Reset pour le ménage suivant
      setTimeout(() => {
        resetSearch();
      }, 1500);
    } else {
      setSearchError(`Erreur : ${error.message}`);
    }

    setSaving(false);
  };

  // ── Vérifier si le ménage courant est déjà présent ──────────
  const dejaPresent = foyer
    ? presences.some(p => p.foyer_id === foyer.id)
    : false;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Sélection réunion ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-indigo-600" />
            Réunion active
          </h2>
          <button
            onClick={() => setShowReunionForm(true)}
            className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-semibold transition"
          >
            <Plus className="h-3.5 w-3.5" />Nouvelle réunion
          </button>
        </div>

        {loadingReunions ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />Chargement…
          </div>
        ) : reunions.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
            Aucune réunion. Créez-en une pour commencer.
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {reunions.map(r => (
              <button
                key={r.id}
                onClick={() => { setReunionActive(r); resetSearch(); }}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition ${
                  reunionActive?.id === r.id
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{r.titre}</span>
                  {reunionActive?.id === r.id && (
                    <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">Active</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                  <span>{new Date(r.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  {r.lieu && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{r.lieu}</span>}
                  {r.type && <span className="text-indigo-500 font-medium">{r.type}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Scan + saisie ── */}
      {reunionActive && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <QrCode className="h-4 w-4 text-indigo-600" />
            Scanner le carnet du ménage
            <span className="text-xs font-normal text-slate-400 ml-1">· {reunionActive.titre}</span>
          </h2>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                value={scanInput}
                onChange={e => { setScanInput(e.target.value.toUpperCase()); setSearchError(''); }}
                onKeyDown={handleKeyDown}
                placeholder="AMB-TRV-26-T-XXXXX"
                className={`w-full font-mono text-sm pl-10 pr-4 py-2.5 border rounded-xl outline-none transition ${
                  searchError ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-indigo-400'
                }`}
                maxLength={20}
              />
            </div>
            <button
              onClick={() => setShowScanner(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition flex items-center gap-2"
              title="Scanner avec la caméra"
            >
              <QrCode className="h-4 w-4" />
              <span className="text-xs font-semibold hidden sm:inline">Caméra</span>
            </button>
            <button
              onClick={() => rechercherMenage(scanInput)}
              disabled={searching}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl transition text-xs font-semibold"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rechercher'}
            </button>
          </div>

          {/* Erreur */}
          {searchError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{searchError}</span>
            </div>
          )}

          {/* Succès */}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {successMsg}
            </div>
          )}

          {/* Résultat — foyer trouvé */}
          {foyer && !successMsg && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">

              {/* En-tête foyer */}
              <div className={`px-4 py-3 flex items-center justify-between ${dejaPresent ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                <div>
                  <p className="text-xs font-bold text-slate-800 font-mono">{foyer.code_menage}</p>
                  <p className="text-xs text-slate-500">{foyer.fokontany}{foyer.adresse ? ` · ${foyer.adresse}` : ''}</p>
                </div>
                {dejaPresent ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg">
                    <AlertTriangle className="h-3.5 w-3.5" />Déjà enregistré
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                    <CheckCircle2 className="h-3.5 w-3.5" />Ménage trouvé
                  </span>
                )}
              </div>

              {/* Déjà présent — avertissement */}
              {dejaPresent && (
                <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-800">
                  Ce ménage a déjà été enregistré pour cette réunion. Un seul représentant par ménage est autorisé.
                </div>
              )}

              {/* Choix membre + Notes (masqué si déjà présent) */}
              {!dejaPresent && (
                <div className="p-4 space-y-3">
                  {membres.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">Aucun membre enregistré pour ce ménage.</p>
                  ) : (
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-2">
                        <Users className="h-3.5 w-3.5 inline mr-1" />
                        Membre présent *
                      </label>
                      <div className="space-y-1.5">
                        {membres.map(m => (
                          <label
                            key={m.id}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition ${
                              membreChoisi === m.id
                                ? 'border-indigo-300 bg-indigo-50'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="membre"
                              value={m.id}
                              checked={membreChoisi === m.id}
                              onChange={() => setMembreChoisi(m.id)}
                              className="accent-indigo-600"
                            />
                            <span className="text-sm font-semibold text-slate-800">{m.nom} {m.prenom}</span>
                            <span className="text-xs text-slate-400 ml-auto">
                              {m.is_chef ? '👑 Chef de ménage' : (m.relation_chef || 'Membre')}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Notes (optionnel)</label>
                    <input
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Représentant désigné, absent excusé…"
                      className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-400"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={resetSearch}
                      className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 font-semibold hover:bg-slate-50 transition flex items-center justify-center gap-2"
                    >
                      <X className="h-4 w-4" />Annuler
                    </button>
                    <button
                      onClick={handleEnregistrer}
                      disabled={saving || !membreChoisi || membres.length === 0}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-2"
                    >
                      {saving
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <CheckCircle2 className="h-4 w-4" />
                      }
                      Enregistrer la présence
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Liste des présences ── */}
      {reunionActive && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-bold text-slate-900">Présences enregistrées</span>
              <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {loadingPresences ? '…' : presences.length}
              </span>
            </div>
            {showHistory ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>

          {showHistory && (
            <div className="border-t border-slate-100">
              {loadingPresences ? (
                <div className="flex items-center gap-2 p-5 text-slate-400 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />Chargement…
                </div>
              ) : presences.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Aucune présence enregistrée pour cette réunion.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {presences.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-400 w-6 text-right">{presences.length - i}</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-800 font-mono">{p.menage_id}</p>
                          {p.notes && <p className="text-xs text-slate-400 italic">{p.notes}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">
                          {new Date(p.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {p.agent && <p className="text-xs text-slate-400">{p.agent}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Résumé */}
              {presences.length > 0 && (
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Total : <strong className="text-slate-800">{presences.length} ménage{presences.length > 1 ? 's' : ''}</strong>
                  </span>
                  <span className="text-xs text-indigo-600 font-semibold">
                    {reunionActive.titre}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showReunionForm && (
        <ReunionForm onSave={handleCreateReunion} onClose={() => setShowReunionForm(false)} />
      )}
      {showScanner && (
        <QrScannerModal onResult={handleScanResult} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}
