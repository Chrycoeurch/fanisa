/**
 * PresenceModule.tsx — Pointage de présence aux réunions & événements
 *
 * Workflow simplifié :
 *  1. Agent sélectionne une réunion/événement EN COURS depuis la liste (lecture seule)
 *  2. Scanne le QR carnet du ménage (ou saisie manuelle du code)
 *  3. Choisit le membre présent parmi les membres du foyer
 *  4. Enregistre la présence (max 1 membre par ménage par réunion)
 *
 * Sources de données :
 *  - reunions (réunions communautaires créées dans Vie Communautaire)
 *  - evenements (événements planifiés, même source que Réunions & Événements)
 *  - presences (enregistrements de pointage)
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { idValide, normaliserId } from '../lib/qrScanner';
import QrScannerModal from './QrScannerModal';
import {
  QrCode, Users, Calendar, CheckCircle2,
  Loader2, ChevronDown, ChevronUp, AlertTriangle, Search,
  MapPin, X, ClipboardList, Tag
} from 'lucide-react';

interface Props {
  agentNom?: string;
}

interface SessionPointage {
  id: string;
  titre: string;
  date: string;       // YYYY-MM-DD ou ISO
  lieu?: string;
  type?: string;
  source: 'reunion' | 'evenement';  // pour distinguer l'origine
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

// Couleur badge selon type
const typeBadgeColor = (type?: string): string => {
  const t = (type || '').toLowerCase();
  if (t.includes('assemblée')) return 'bg-indigo-100 text-indigo-700';
  if (t.includes('formation') || t.includes('sensibilisation')) return 'bg-teal-100 text-teal-700';
  if (t.includes('médiation')) return 'bg-amber-100 text-amber-700';
  if (t.includes('urgence') || t.includes('catastrophe')) return 'bg-red-100 text-red-700';
  if (t.includes('vaccination') || t.includes('distribution')) return 'bg-emerald-100 text-emerald-700';
  if (t.includes('culturelle') || t.includes('sportive')) return 'bg-violet-100 text-violet-700';
  return 'bg-slate-100 text-slate-600';
};

// ── Module principal ──────────────────────────────────────────────────────────

export default function PresenceModule({ agentNom = 'Agent Fokontany' }: Props) {
  // Liste sessions (reunions + evenements fusionnés)
  const [sessions, setSessions] = useState<SessionPointage[]>([]);
  const [sessionActive, setSessionActive] = useState<SessionPointage | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtreType, setFiltreType] = useState('');   // filtre sur la liste

  // Scan / Recherche
  const [scanInput, setScanInput] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Foyer trouvé
  const [foyer, setFoyer] = useState<FoyerInfo | null>(null);
  const [membres, setMembres] = useState<MembreInfo[]>([]);
  const [membreChoisi, setMembreChoisi] = useState<string>('');

  // Présences de la session active
  const [presences, setPresences] = useState<Presence[]>([]);
  const [loadingPresences, setLoadingPresences] = useState(false);
  const [showPresences, setShowPresences] = useState(false);

  // État
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [notes, setNotes] = useState('');

  // ── Chargement des sessions (reunions + evenements) ──────────
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    // Réunions (table reunions)
    const { data: reunionsData } = await supabase
      .from('reunions')
      .select('id, titre, date, lieu, type')
      .order('date', { ascending: false })
      .limit(50);

    // Événements planifiés ou en cours (table evenements)
    const { data: evenementsData } = await supabase
      .from('evenements')
      .select('id, titre, type, date_evenement, lieu, statut')
      .in('statut', ['Planifié', 'En cours'])
      .order('date_evenement', { ascending: false })
      .limit(50);

    const fromReunions: SessionPointage[] = (reunionsData || []).map((r: any) => ({
      id: r.id,
      titre: r.titre,
      date: r.date,
      lieu: r.lieu,
      type: r.type,
      source: 'reunion' as const,
    }));

    const fromEvenements: SessionPointage[] = (evenementsData || []).map((e: any) => ({
      id: e.id,
      titre: e.titre,
      date: e.date_evenement,
      lieu: e.lieu,
      type: e.type,
      source: 'evenement' as const,
    }));

    // Fusionner et trier par date desc
    const all = [...fromReunions, ...fromEvenements].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    setSessions(all);
    // Auto-sélectionner la plus récente
    if (all.length > 0 && !sessionActive) {
      setSessionActive(all[0]);
    }
    setLoading(false);
  };

  // ── Charger présences de la session active ───────────────────
  useEffect(() => {
    if (!sessionActive) return;
    loadPresences(sessionActive.id);
  }, [sessionActive]);

  const loadPresences = async (sessionId: string) => {
    setLoadingPresences(true);
    const { data } = await supabase
      .from('presences')
      .select('*')
      .eq('reunion_id', sessionId)
      .order('created_at', { ascending: false });
    setPresences(data || []);
    setLoadingPresences(false);
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

    const { data: foyerData, error: foyerErr } = await supabase
      .from('foyers')
      .select('id, code_menage, fokontany, adresse')
      .eq('code_menage', normalised)
      .single();

    if (foyerErr || !foyerData) {
      setSearchError(`Ménage introuvable : ${normalised}`);
      setSearching(false);
      return;
    }

    const { data: membresData } = await supabase
      .from('membres')
      .select('id, nom, prenom, is_chef, relation_chef')
      .eq('foyer_id', foyerData.id)
      .order('is_chef', { ascending: false });

    setFoyer(foyerData);
    setMembres(membresData || []);
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
    if (!sessionActive || !foyer || !membreChoisi) return;

    setSaving(true);
    setSuccessMsg('');

    const { data: existing } = await supabase
      .from('presences')
      .select('id')
      .eq('reunion_id', sessionActive.id)
      .eq('foyer_id', foyer.id)
      .single();

    if (existing) {
      setSearchError(`Le ménage ${foyer.code_menage} est déjà enregistré pour cette session.`);
      setSaving(false);
      return;
    }

    const membreInfo = membres.find(m => m.id === membreChoisi);
    const now = new Date().toISOString();

    const { error } = await supabase.from('presences').insert({
      reunion_id: sessionActive.id,
      foyer_id: foyer.id,
      menage_id: foyer.code_menage,
      membre_id: membreChoisi,
      agent: agentNom,
      notes: notes.trim() || null,
      created_at: now,
    });

    await supabase.from('logs').insert({
      date: now,
      utilisateur: agentNom,
      action: 'Présence',
      details: `Présence — Ménage ${foyer.code_menage} · ${membreInfo ? `${membreInfo.nom} ${membreInfo.prenom}` : ''} · Session : ${sessionActive.titre}`,
      foyer_id: foyer.id,
      membre_id: membreChoisi,
    });

    if (!error) {
      setSuccessMsg(`✓ Présence enregistrée — ${membreInfo ? `${membreInfo.nom} ${membreInfo.prenom}` : foyer.code_menage}`);
      await loadPresences(sessionActive.id);
      setTimeout(() => resetSearch(), 1500);
    } else {
      setSearchError(`Erreur : ${error.message}`);
    }

    setSaving(false);
  };

  const dejaPresent = foyer ? presences.some(p => p.foyer_id === foyer.id) : false;

  // Filtrage de la liste des sessions
  const typesDisponibles = [...new Set(sessions.map(s => s.type).filter(Boolean))];
  const sessionsFiltrees = sessions.filter(s => !filtreType || s.type === filtreType);

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Sélection session ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-600" />
            Sélectionner une réunion / événement
          </h2>
          <button
            onClick={loadSessions}
            title="Actualiser la liste"
            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115 0M20 15a9 9 0 01-15 0" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Filtre type */}
        {typesDisponibles.length > 1 && (
          <div className="flex items-center gap-2 mb-3">
            <Tag className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <select
              value={filtreType}
              onChange={e => setFiltreType(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-emerald-400"
            >
              <option value="">Tous les types</option>
              {typesDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="text-xs text-slate-400">{sessionsFiltrees.length} session{sessionsFiltrees.length > 1 ? 's' : ''}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" />Chargement…
          </div>
        ) : sessionsFiltrees.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
            {sessions.length === 0
              ? 'Aucune réunion ni événement planifié. Créez-en un dans l\'onglet « Réunions & Événements ».'
              : 'Aucune session correspondant au filtre.'}
          </div>
        ) : (
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {sessionsFiltrees.map(s => (
              <button
                key={`${s.source}-${s.id}`}
                onClick={() => { setSessionActive(s); resetSearch(); }}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition ${
                  sessionActive?.id === s.id && sessionActive?.source === s.source
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold truncate">{s.titre}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {s.type && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${typeBadgeColor(s.type)}`}>
                        {s.type}
                      </span>
                    )}
                    {sessionActive?.id === s.id && sessionActive?.source === s.source && (
                      <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">Active</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                  <span>{new Date(s.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  {s.lieu && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.lieu}</span>}
                  <span className="text-slate-300">
                    {s.source === 'evenement' ? '📅 Événement' : '🗓 Réunion'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Zone de scan / saisie ── */}
      {sessionActive && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <QrCode className="h-4 w-4 text-emerald-600" />
            Scanner ou saisir le code du ménage
            <span className="text-xs font-normal text-slate-400 ml-1">· {sessionActive.titre}</span>
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
                  searchError ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-emerald-400'
                }`}
                maxLength={20}
              />
            </div>
            <button
              onClick={() => setShowScanner(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition flex items-center gap-2"
              title="Scanner avec la caméra"
            >
              <QrCode className="h-4 w-4" />
              <span className="text-xs font-semibold hidden sm:inline">Caméra</span>
            </button>
            <button
              onClick={() => rechercherMenage(scanInput)}
              disabled={searching || !scanInput.trim()}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl transition text-xs font-semibold"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Chercher'}
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

          {/* Foyer trouvé */}
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
                    <AlertTriangle className="h-3.5 w-3.5" />Déjà pointé
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                    <CheckCircle2 className="h-3.5 w-3.5" />Ménage trouvé
                  </span>
                )}
              </div>

              {dejaPresent && (
                <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-800">
                  Ce ménage a déjà été pointé pour cette session. Un seul représentant par ménage est autorisé.
                </div>
              )}

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
                                ? 'border-emerald-300 bg-emerald-50'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="membre"
                              value={m.id}
                              checked={membreChoisi === m.id}
                              onChange={() => setMembreChoisi(m.id)}
                              className="accent-emerald-600"
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
                      className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-400"
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
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-2"
                    >
                      {saving
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <CheckCircle2 className="h-4 w-4" />
                      }
                      Valider la présence
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Liste des présences ── */}
      {sessionActive && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setShowPresences(!showPresences)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-bold text-slate-900">Présences pointées</span>
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {loadingPresences ? '…' : presences.length}
              </span>
            </div>
            {showPresences ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>

          {showPresences && (
            <div className="border-t border-slate-100">
              {loadingPresences ? (
                <div className="flex items-center gap-2 p-5 text-slate-400 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />Chargement…
                </div>
              ) : presences.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Aucune présence encore enregistrée pour cette session.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {presences.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-300 w-5 text-right">{presences.length - i}</span>
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

              {presences.length > 0 && (
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Total : <strong className="text-slate-800">{presences.length} ménage{presences.length > 1 ? 's' : ''}</strong>
                  </span>
                  <span className="text-xs text-emerald-600 font-semibold">{sessionActive.titre}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showScanner && (
        <QrScannerModal onResult={handleScanResult} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}
