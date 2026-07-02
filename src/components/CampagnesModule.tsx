import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Foyer, Membre } from '../types';
import {
  Plus, Search, Edit2, Eye, Pause, Play, XCircle, Copy, Archive,
  Loader2, X, CheckCircle, AlertCircle, BarChart2, Users, Wallet,
  Calendar, ChevronDown, Filter, RotateCcw, TrendingUp, Banknote,
  Smartphone, CreditCard, FileText
} from 'lucide-react';

interface Props { foyers: Foyer[]; membres: Membre[]; }

interface Campagne {
  id: string; code: string; nom: string; description: string | null;
  type_cotisation: string; type_autre: string | null;
  montant: number; paiement_obligatoire: boolean;
  autoriser_partiel: boolean; nb_echeances_max: number | null;
  montant_min_versement: number | null;
  date_ouverture: string; date_cloture: string; date_limite_paiement: string;
  population: string; modes_paiement: string[];
  agent_responsable: string; observations: string | null;
  statut: string; nb_concernes: number; created_at: string;
}

const fmt = (n: number) => new Intl.NumberFormat('fr-MG').format(n) + ' Ar';
const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;

const TYPES = ['Annuelle', 'Mensuelle', 'Exceptionnelle', 'Solidarité', 'Travaux communautaires', 'Autre'];
const POPULATIONS = ['Tous les ménages', 'Tous les chefs de ménage', 'Tous les adultes', 'Catégorie spécifique', 'Sélection personnalisée'];
const MODES = ['Espèces', 'Mobile Money', 'Virement bancaire', 'Autres'];
const STATUTS = ['Brouillon', 'Active', 'Suspendue', 'Clôturée', 'Archivée'];

const STATUT_STYLE: Record<string, string> = {
  'Brouillon':  'bg-slate-100 text-slate-600',
  'Active':     'bg-emerald-100 text-emerald-700',
  'Suspendue':  'bg-amber-100 text-amber-700',
  'Clôturée':   'bg-red-100 text-red-600',
  'Archivée':   'bg-slate-200 text-slate-500',
};

const EMPTY_FORM = {
  nom: '', description: '', type_cotisation: 'Annuelle', type_autre: '',
  montant: '', paiement_obligatoire: true, autoriser_partiel: false,
  nb_echeances_max: '', montant_min_versement: '',
  date_ouverture: '', date_cloture: '', date_limite_paiement: '',
  population: '', modes_paiement: [] as string[],
  agent_responsable: '', observations: '',
};

function genCode() {
  const y = new Date().getFullYear();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CAMP-${y}-${r}`;
}

function nbConcernes(population: string, foyers: Foyer[], membres: Membre[]): number {
  if (population === 'Tous les ménages') return foyers.length;
  if (population === 'Tous les chefs de ménage') return membres.filter(m => m.is_chef).length;
  if (population === 'Tous les adultes') return membres.filter(m => {
    if (!m.date_naissance) return false;
    const age = new Date().getFullYear() - new Date(m.date_naissance).getFullYear();
    return age >= 18;
  }).length;
  return 0;
}

// ── Formulaire de création/modification ──────────────────────────
function FormulaireModal({ campagne, foyers, membres, onClose, onSave }: {
  campagne?: Campagne; foyers: Foyer[]; membres: Membre[];
  onClose: () => void; onSave: () => void;
}) {
  const [form, setForm] = useState(campagne ? {
    nom: campagne.nom, description: campagne.description || '',
    type_cotisation: campagne.type_cotisation, type_autre: campagne.type_autre || '',
    montant: String(campagne.montant), paiement_obligatoire: campagne.paiement_obligatoire,
    autoriser_partiel: campagne.autoriser_partiel,
    nb_echeances_max: campagne.nb_echeances_max ? String(campagne.nb_echeances_max) : '',
    montant_min_versement: campagne.montant_min_versement ? String(campagne.montant_min_versement) : '',
    date_ouverture: campagne.date_ouverture, date_cloture: campagne.date_cloture,
    date_limite_paiement: campagne.date_limite_paiement,
    population: campagne.population, modes_paiement: campagne.modes_paiement,
    agent_responsable: campagne.agent_responsable, observations: campagne.observations || '',
  } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [erreurs, setErreurs] = useState<string[]>([]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleMode = (m: string) => set('modes_paiement', form.modes_paiement.includes(m) ? form.modes_paiement.filter(x => x !== m) : [...form.modes_paiement, m]);

  const valider = () => {
    const e: string[] = [];
    if (!form.nom.trim()) e.push('Le nom de la campagne est obligatoire.');
    if (!form.montant || parseFloat(form.montant) <= 0) e.push('Le montant doit être supérieur à 0 Ar.');
    if (!form.date_ouverture) e.push('La date d\'ouverture est obligatoire.');
    if (!form.date_cloture) e.push('La date de clôture est obligatoire.');
    if (!form.date_limite_paiement) e.push('La date limite de paiement est obligatoire.');
    if (form.date_ouverture && form.date_cloture && form.date_ouverture > form.date_cloture) e.push('La date d\'ouverture doit être antérieure à la date de clôture.');
    if (form.date_limite_paiement && form.date_cloture && form.date_limite_paiement < form.date_cloture) e.push('La date limite de paiement ne peut pas être avant la date de clôture.');
    if (!form.population) e.push('Veuillez sélectionner la population concernée.');
    if (form.modes_paiement.length === 0) e.push('Veuillez choisir au moins un mode de paiement.');
    if (!form.agent_responsable.trim()) e.push('Le responsable de la campagne est obligatoire.');
    if (form.type_cotisation === 'Autre' && !form.type_autre.trim()) e.push('Veuillez préciser le type de cotisation.');
    setErreurs(e);
    return e.length === 0;
  };

  const handleSave = async () => {
    if (!valider()) return;
    setSaving(true);
    const nb = nbConcernes(form.population, foyers, membres);
    const payload = {
      nom: form.nom.trim(), description: form.description.trim() || null,
      type_cotisation: form.type_cotisation, type_autre: form.type_cotisation === 'Autre' ? form.type_autre.trim() : null,
      montant: parseFloat(form.montant), paiement_obligatoire: form.paiement_obligatoire,
      autoriser_partiel: form.autoriser_partiel,
      nb_echeances_max: form.autoriser_partiel && form.nb_echeances_max ? parseInt(form.nb_echeances_max) : null,
      montant_min_versement: form.autoriser_partiel && form.montant_min_versement ? parseFloat(form.montant_min_versement) : null,
      date_ouverture: form.date_ouverture, date_cloture: form.date_cloture,
      date_limite_paiement: form.date_limite_paiement,
      population: form.population, modes_paiement: form.modes_paiement,
      agent_responsable: form.agent_responsable.trim(),
      observations: form.observations.trim() || null,
      statut: campagne?.statut || 'Active', nb_concernes: nb,
      updated_at: new Date().toISOString(),
    };
    if (campagne) {
      await supabase.from('campagnes_cotisation').update(payload).eq('id', campagne.id);
    } else {
      await supabase.from('campagnes_cotisation').insert({ ...payload, code: genCode() });
    }
    setSaving(false);
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[95vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
          <h2 className="text-base font-bold text-slate-900">{campagne ? 'Modifier la campagne' : 'Nouvelle campagne de cotisation'}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {erreurs.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
              {erreurs.map((e, i) => <p key={i} className="text-xs text-red-600 flex items-start gap-1.5"><AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{e}</p>)}
            </div>
          )}

          {/* Informations générales */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Informations générales</h3>
            <input value={form.nom} onChange={e => set('nom', e.target.value)} placeholder="Nom de la campagne *" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
            <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Description (facultatif)" rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500 resize-none" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Type de cotisation *</label>
                <select value={form.type_cotisation} onChange={e => set('type_cotisation', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-emerald-500">
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              {form.type_cotisation === 'Autre' && (
                <div><label className="text-xs text-slate-500 block mb-1">Préciser *</label>
                  <input value={form.type_autre} onChange={e => set('type_autre', e.target.value)} placeholder="Type de cotisation..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
                </div>
              )}
            </div>
          </div>

          {/* Paramètres financiers */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Paramètres financiers</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-500 block mb-1">Montant (Ar) *</label>
                <input type="number" value={form.montant} onChange={e => set('montant', e.target.value)} placeholder="5000" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.paiement_obligatoire} onChange={e => set('paiement_obligatoire', e.target.checked)} className="accent-emerald-600 w-4 h-4" />
                Paiement obligatoire
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.autoriser_partiel} onChange={e => set('autoriser_partiel', e.target.checked)} className="accent-emerald-600 w-4 h-4" />
                Autoriser le paiement partiel
              </label>
            </div>
            {form.autoriser_partiel && (
              <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-3">
                <div><label className="text-xs text-slate-500 block mb-1">Nombre max d'échéances</label>
                  <input type="number" value={form.nb_echeances_max} onChange={e => set('nb_echeances_max', e.target.value)} placeholder="3" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
                <div><label className="text-xs text-slate-500 block mb-1">Montant minimum par versement (Ar)</label>
                  <input type="number" value={form.montant_min_versement} onChange={e => set('montant_min_versement', e.target.value)} placeholder="1000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
              </div>
            )}
          </div>

          {/* Période */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Période de la campagne</h3>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-xs text-slate-500 block mb-1">Date d'ouverture *</label>
                <input type="date" value={form.date_ouverture} onChange={e => set('date_ouverture', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
              </div>
              <div><label className="text-xs text-slate-500 block mb-1">Date de clôture *</label>
                <input type="date" value={form.date_cloture} onChange={e => set('date_cloture', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
              </div>
              <div><label className="text-xs text-slate-500 block mb-1">Date limite de paiement *</label>
                <input type="date" value={form.date_limite_paiement} onChange={e => set('date_limite_paiement', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
              </div>
            </div>
          </div>

          {/* Population */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Population concernée *</h3>
            <div className="grid grid-cols-2 gap-2">
              {POPULATIONS.map(p => (
                <button key={p} onClick={() => set('population', p)} className={`py-2.5 px-3 rounded-lg border text-xs font-semibold text-left transition ${form.population === p ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  {p}
                  {p === 'Tous les ménages' && <span className="ml-1 opacity-70">({foyers.length})</span>}
                  {p === 'Tous les chefs de ménage' && <span className="ml-1 opacity-70">({membres.filter(m => m.is_chef).length})</span>}
                  {p === 'Tous les adultes' && <span className="ml-1 opacity-70">({membres.filter(m => { if (!m.date_naissance) return false; return new Date().getFullYear() - new Date(m.date_naissance).getFullYear() >= 18; }).length})</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Modes de paiement */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Modes de paiement autorisés *</h3>
            <div className="flex flex-wrap gap-2">
              {MODES.map(m => (
                <label key={m} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${form.modes_paiement.includes(m) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                  <input type="checkbox" checked={form.modes_paiement.includes(m)} onChange={() => toggleMode(m)} className="hidden" />{m}
                </label>
              ))}
            </div>
          </div>

          {/* Responsable */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Responsable</h3>
            <input value={form.agent_responsable} onChange={e => set('agent_responsable', e.target.value)} placeholder="Agent responsable de la campagne *" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
            <textarea value={form.observations} onChange={e => set('observations', e.target.value)} placeholder="Observations / Notes internes (facultatif)" rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500 resize-none" />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-200 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {saving ? 'Enregistrement…' : campagne ? 'Enregistrer les modifications' : 'Créer la campagne'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────────
export default function CampagnesModule({ foyers, membres }: Props) {
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [paiementsStats, setPaiementsStats] = useState<Record<string, { nb: number; total: number }>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Campagne | undefined>();
  const [viewCampagne, setViewCampagne] = useState<Campagne | null>(null);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtreSearch, setFiltreSearch] = useState('');
  const [paiementCampagne, setPaiementCampagne] = useState<Campagne | null>(null);
  const [paiementFoyer, setPaiementFoyer] = useState<Foyer | null>(null);
  const [paiementMembre, setPaiementMembre] = useState<Membre | null>(null);
  const [paiementMontant, setPaiementMontant] = useState('');
  const [paiementSearch, setPaiementSearch] = useState('');
  const [paiementSubmitting, setPaiementSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: camps } = await supabase.from('campagnes_cotisation').select('*').order('created_at', { ascending: false });
    setCampagnes((camps || []) as Campagne[]);
    if (camps && camps.length > 0) {
      const ids = camps.map((c: any) => c.id);
      const { data: pays } = await supabase.from('paiements_campagne').select('campagne_id, montant').in('campagne_id', ids).eq('statut', 'Validé');
      const stats: Record<string, { nb: number; total: number }> = {};
      (pays || []).forEach((p: any) => {
        if (!stats[p.campagne_id]) stats[p.campagne_id] = { nb: 0, total: 0 };
        stats[p.campagne_id].nb++;
        stats[p.campagne_id].total += p.montant;
      });
      setPaiementsStats(stats);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const changerStatut = async (campagne: Campagne, statut: string) => {
    setActionLoading(campagne.id + statut);
    await supabase.from('campagnes_cotisation').update({ statut, updated_at: new Date().toISOString() }).eq('id', campagne.id);
    await load();
    setActionLoading(null);
  };

  const dupliquer = async (campagne: Campagne) => {
    setActionLoading(campagne.id + 'dup');
    await supabase.from('campagnes_cotisation').insert({
      code: genCode(), nom: campagne.nom + ' (copie)', description: campagne.description,
      type_cotisation: campagne.type_cotisation, type_autre: campagne.type_autre,
      montant: campagne.montant, paiement_obligatoire: campagne.paiement_obligatoire,
      autoriser_partiel: campagne.autoriser_partiel, nb_echeances_max: campagne.nb_echeances_max,
      montant_min_versement: campagne.montant_min_versement,
      date_ouverture: campagne.date_ouverture, date_cloture: campagne.date_cloture,
      date_limite_paiement: campagne.date_limite_paiement,
      population: campagne.population, modes_paiement: campagne.modes_paiement,
      agent_responsable: campagne.agent_responsable, observations: campagne.observations,
      statut: 'Brouillon', nb_concernes: campagne.nb_concernes,
    });
    await load();
    setActionLoading(null);
  };

  // ── Paiement via la Caisse ──────────────────────────────────────
  const [actionLoading, setActionLoadingState] = useState<string | null>(null);
  const setActionLoading = setActionLoadingState;

  const ouvrirPaiement = (c: Campagne) => {
    setPaiementCampagne(c);
    setPaiementFoyer(null);
    setPaiementMembre(null);
    setPaiementMontant(String(c.montant));
    setPaiementSearch('');
  };

  const envoyerPaiementCaisse = async () => {
    if (!paiementCampagne) return;
    const nomPayeur = paiementMembre
      ? `${paiementMembre.nom} ${paiementMembre.prenom}`
      : paiementFoyer
        ? (membres.find(m => m.foyer_id === paiementFoyer.id && m.is_chef)?.nom || paiementFoyer.code_menage)
        : '';
    if (!nomPayeur) { alert('Veuillez sélectionner un foyer ou un membre payeur.'); return; }
    const montant = parseFloat(paiementMontant);
    if (!montant || montant <= 0) { alert('Le montant doit être supérieur à 0.'); return; }
    if (!paiementCampagne.autoriser_partiel && montant !== paiementCampagne.montant) {
      alert(`Le paiement partiel n'est pas autorisé. Montant exact requis : ${fmt(paiementCampagne.montant)}.`); return;
    }
    if (montant > paiementCampagne.montant) {
      alert(`Le montant maximum est ${fmt(paiementCampagne.montant)}.`); return;
    }
    setPaiementSubmitting(true);
    const { error } = await supabase.from('operations_caisse').insert({
      module_origine: 'Campagnes',
      type_prestation: `${paiementCampagne.nom}`,
      reference_document: paiementCampagne.code,
      membre_id: paiementMembre?.id || null,
      foyer_id: paiementFoyer?.id || paiementMembre?.foyer_id || null,
      nom_beneficiaire: nomPayeur,
      montant: montant,
      quantite: 1,
      statut: 'En attente de paiement',
      metadata: {
        campagne_id: paiementCampagne.id,
        campagne_code: paiementCampagne.code,
        campagne_nom: paiementCampagne.nom,
        montant_total_campagne: paiementCampagne.montant,
        partiel: montant < paiementCampagne.montant,
      },
    });
    setPaiementSubmitting(false);
    if (error) { alert('Erreur lors de l\'envoi à la Caisse : ' + error.message); return; }
    setPaiementCampagne(null);
    alert(`✅ Envoyé à la Caisse pour ${nomPayeur}.\n\nRendez-vous dans Finances → Caisse pour valider le paiement.`);
  };

  // Résultats de recherche pour la modale paiement
  const paiementResultats = (() => {
    if (!paiementSearch.trim()) return [];
    const q = paiementSearch.toLowerCase();
    const res: { foyer?: Foyer; membre?: Membre; label: string; sub: string }[] = [];
    foyers.filter(f => {
      const chef = membres.find(m => m.foyer_id === f.id && m.is_chef);
      return f.code_menage.toLowerCase().includes(q) || `${chef?.nom} ${chef?.prenom}`.toLowerCase().includes(q);
    }).slice(0, 6).forEach(f => {
      const chef = membres.find(m => m.foyer_id === f.id && m.is_chef);
      res.push({ foyer: f, label: chef ? `${chef.nom} ${chef.prenom}` : f.code_menage, sub: f.code_menage });
    });
    membres.filter(m => `${m.nom} ${m.prenom}`.toLowerCase().includes(q) || (m.cin || '').toLowerCase().includes(q)).slice(0, 6).forEach(m => {
      const f = foyers.find(f => f.id === m.foyer_id);
      res.push({ membre: m, foyer: f, label: `${m.nom} ${m.prenom}`, sub: f?.code_menage || '' });
    });
    return res.slice(0, 8);
  })();

  const campagnesFiltrees = campagnes.filter(c => {
    if (filtreStatut && c.statut !== filtreStatut) return false;
    if (filtreSearch && !c.nom.toLowerCase().includes(filtreSearch.toLowerCase()) && !c.code.toLowerCase().includes(filtreSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* En-tête avec filtres + bouton */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Filter className="h-3.5 w-3.5" />Filtres</h3>
            <button onClick={() => { setEditing(undefined); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition">
              <Plus className="h-4 w-4" />Nouvelle campagne
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input value={filtreSearch} onChange={e => setFiltreSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-emerald-500" />
            </div>
            <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white outline-none focus:border-emerald-500">
              <option value="">Tous les statuts</option>
              {STATUTS.map(s => <option key={s}>{s}</option>)}
            </select>
            <div className="flex items-center justify-end text-xs text-slate-500 font-semibold">
              {campagnesFiltrees.length} campagne{campagnesFiltrees.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16"><Loader2 className="h-7 w-7 text-emerald-600 animate-spin mx-auto" /></div>
        ) : campagnesFiltrees.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <BarChart2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">Aucune campagne</p>
            <p className="text-xs mt-1">Créez votre première campagne de cotisation</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-slate-50 border-b">
                <th className="p-3 text-left text-slate-500">Nom / Code</th>
                <th className="p-3 text-left text-slate-500">Type</th>
                <th className="p-3 text-right text-slate-500">Montant</th>
                <th className="p-3 text-left text-slate-500">Ouverture</th>
                <th className="p-3 text-left text-slate-500">Clôture</th>
                <th className="p-3 text-left text-slate-500">Responsable</th>
                <th className="p-3 text-center text-slate-500">Statut</th>
                <th className="p-3 text-center text-slate-500">Concernés</th>
                <th className="p-3 text-center text-slate-500">Paiements</th>
                <th className="p-3 text-right text-slate-500">Attendu</th>
                <th className="p-3 text-right text-slate-500">Encaissé</th>
                <th className="p-3 text-right text-slate-500">Solde</th>
                <th className="p-3 text-center text-slate-500">Taux</th>
                <th className="p-3 text-center text-slate-500">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {campagnesFiltrees.map(c => {
                  const stats = paiementsStats[c.id] || { nb: 0, total: 0 };
                  const attendu = c.montant * c.nb_concernes;
                  const solde = attendu - stats.total;
                  const taux = pct(stats.total, attendu);
                  const peutModif = stats.nb === 0 && c.statut !== 'Clôturée' && c.statut !== 'Archivée';
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <p className="font-semibold text-slate-800">{c.nom}</p>
                        <p className="text-slate-400 font-mono text-[10px]">{c.code}</p>
                      </td>
                      <td className="p-3 text-slate-600">{c.type_cotisation === 'Autre' ? c.type_autre : c.type_cotisation}</td>
                      <td className="p-3 text-right font-bold text-slate-900">{fmt(c.montant)}</td>
                      <td className="p-3 text-slate-500">{new Date(c.date_ouverture).toLocaleDateString('fr-FR')}</td>
                      <td className="p-3 text-slate-500">{new Date(c.date_cloture).toLocaleDateString('fr-FR')}</td>
                      <td className="p-3 text-slate-600">{c.agent_responsable}</td>
                      <td className="p-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_STYLE[c.statut] || 'bg-slate-100'}`}>{c.statut}</span>
                      </td>
                      <td className="p-3 text-center font-semibold text-slate-700">{c.nb_concernes}</td>
                      <td className="p-3 text-center text-slate-500">{stats.nb}</td>
                      <td className="p-3 text-right text-slate-600">{fmt(attendu)}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">{fmt(stats.total)}</td>
                      <td className="p-3 text-right font-bold text-red-500">{fmt(Math.max(0, solde))}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <div className="w-12 bg-slate-100 rounded-full h-1.5"><div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, taux)}%` }} /></div>
                          <span className={`font-bold text-[10px] ${taux >= 100 ? 'text-emerald-600' : taux >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{taux}%</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 justify-center">
                          <button onClick={() => setViewCampagne(c)} title="Consulter" className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600"><Eye className="h-3.5 w-3.5" /></button>
                          {peutModif && <button onClick={() => { setEditing(c); setShowForm(true); }} title="Modifier" className="p-1.5 hover:bg-amber-50 rounded-lg text-slate-400 hover:text-amber-600"><Edit2 className="h-3.5 w-3.5" /></button>}
                          {c.statut === 'Active' && <button onClick={() => ouvrirPaiement(c)} title="Enregistrer un paiement" className="p-1.5 hover:bg-emerald-50 rounded-lg text-slate-400 hover:text-emerald-600"><Wallet className="h-3.5 w-3.5" /></button>}
                          {c.statut === 'Active' && <button onClick={() => changerStatut(c, 'Suspendue')} title="Suspendre" disabled={actionLoading !== null} className="p-1.5 hover:bg-amber-50 rounded-lg text-slate-400 hover:text-amber-600"><Pause className="h-3.5 w-3.5" /></button>}
                          {c.statut === 'Suspendue' && <button onClick={() => changerStatut(c, 'Active')} title="Réactiver" disabled={actionLoading !== null} className="p-1.5 hover:bg-emerald-50 rounded-lg text-slate-400 hover:text-emerald-600"><Play className="h-3.5 w-3.5" /></button>}
                          {c.statut === 'Brouillon' && <button onClick={() => changerStatut(c, 'Active')} title="Activer" disabled={actionLoading !== null} className="p-1.5 hover:bg-emerald-50 rounded-lg text-slate-400 hover:text-emerald-600"><Play className="h-3.5 w-3.5" /></button>}
                          {(c.statut === 'Active' || c.statut === 'Suspendue') && <button onClick={() => changerStatut(c, 'Clôturée')} title="Clôturer" disabled={actionLoading !== null} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500"><XCircle className="h-3.5 w-3.5" /></button>}
                          {c.statut === 'Clôturée' && <button onClick={() => changerStatut(c, 'Archivée')} title="Archiver" disabled={actionLoading !== null} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"><Archive className="h-3.5 w-3.5" /></button>}
                          <button onClick={() => dupliquer(c)} title="Dupliquer" disabled={actionLoading !== null} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"><Copy className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Paiement — envoie l'opération à la Caisse */}
      {paiementCampagne && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Enregistrer un paiement</h2>
                <p className="text-xs text-emerald-600 font-semibold">{paiementCampagne.nom}</p>
              </div>
              <button onClick={() => setPaiementCampagne(null)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs text-emerald-700 font-semibold">Montant de la campagne</span>
              <span className="text-lg font-black text-emerald-700">{fmt(paiementCampagne.montant)}</span>
            </div>

            {/* Recherche foyer/membre */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Foyer / Membre payeur *</label>
              {(paiementFoyer || paiementMembre) ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                  <span className="text-sm font-semibold text-emerald-800">
                    {paiementMembre ? `${paiementMembre.nom} ${paiementMembre.prenom}` : membres.find(m => m.foyer_id === paiementFoyer!.id && m.is_chef)?.nom || paiementFoyer!.code_menage}
                    <span className="text-xs text-emerald-500 ml-2 font-mono">{paiementFoyer?.code_menage || foyers.find(f => f.id === paiementMembre?.foyer_id)?.code_menage}</span>
                  </span>
                  <button onClick={() => { setPaiementFoyer(null); setPaiementMembre(null); setPaiementSearch(''); }} className="text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input value={paiementSearch} onChange={e => setPaiementSearch(e.target.value)} placeholder="Rechercher par nom, CIN ou code ménage..." className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-emerald-500" />
                  {paiementSearch && paiementResultats.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-30 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-52 overflow-y-auto">
                      {paiementResultats.map((r, i) => (
                        <button key={i} onClick={() => { if (r.membre) { setPaiementMembre(r.membre); setPaiementFoyer(foyers.find(f => f.id === r.membre!.foyer_id) || null); } else { setPaiementFoyer(r.foyer!); setPaiementMembre(null); } setPaiementSearch(''); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 border-b border-slate-50 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">{r.label.charAt(0)}</div>
                          <div><p className="text-sm font-semibold text-slate-800">{r.label}</p><p className="text-xs text-slate-400">{r.sub}</p></div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Montant */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
                Montant (Ar) *
                {paiementCampagne.autoriser_partiel && <span className="ml-2 text-purple-600 normal-case font-normal">· Paiement partiel autorisé</span>}
              </label>
              <input
                type="number"
                value={paiementMontant}
                onChange={e => setPaiementMontant(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                max={paiementCampagne.montant}
                readOnly={!paiementCampagne.autoriser_partiel}
              />
              {paiementCampagne.montant_min_versement && (
                <p className="text-[11px] text-slate-400 mt-1">Minimum par versement : {fmt(paiementCampagne.montant_min_versement)}</p>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
              ⚠ L'opération sera transmise à la <strong>Caisse</strong> pour encaissement. Rendez-vous dans <strong>Finances → Caisse</strong> pour valider le paiement et générer le reçu.
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setPaiementCampagne(null)} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600">Annuler</button>
              <button onClick={envoyerPaiementCaisse} disabled={paiementSubmitting} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2">
                {paiementSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                {paiementSubmitting ? 'Envoi…' : 'Envoyer à la Caisse'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Formulaire */}
      {showForm && (
        <FormulaireModal campagne={editing} foyers={foyers} membres={membres} onClose={() => { setShowForm(false); setEditing(undefined); }} onSave={load} />
      )}

      {/* Modal Consulter */}
      {viewCampagne && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">{viewCampagne.nom}</h2>
                <p className="text-xs text-slate-400 font-mono">{viewCampagne.code}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_STYLE[viewCampagne.statut]}`}>{viewCampagne.statut}</span>
                <button onClick={() => setViewCampagne(null)}><X className="h-5 w-5 text-slate-400" /></button>
              </div>
            </div>
            {[
              ['Type', viewCampagne.type_cotisation === 'Autre' ? viewCampagne.type_autre : viewCampagne.type_cotisation],
              ['Montant', fmt(viewCampagne.montant)],
              ['Paiement obligatoire', viewCampagne.paiement_obligatoire ? 'Oui' : 'Non'],
              ['Paiement partiel', viewCampagne.autoriser_partiel ? `Oui (max ${viewCampagne.nb_echeances_max || '?'} échéances)` : 'Non'],
              ['Date d\'ouverture', new Date(viewCampagne.date_ouverture).toLocaleDateString('fr-FR')],
              ['Date de clôture', new Date(viewCampagne.date_cloture).toLocaleDateString('fr-FR')],
              ['Date limite paiement', new Date(viewCampagne.date_limite_paiement).toLocaleDateString('fr-FR')],
              ['Population concernée', viewCampagne.population],
              ['Personnes concernées', String(viewCampagne.nb_concernes)],
              ['Modes de paiement', viewCampagne.modes_paiement.join(', ')],
              ['Agent responsable', viewCampagne.agent_responsable],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b border-slate-50 pb-2">
                <span className="text-slate-400">{k}</span>
                <span className="font-semibold text-slate-700 text-right max-w-[60%]">{v}</span>
              </div>
            ))}
            {viewCampagne.observations && (
              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">{viewCampagne.observations}</div>
            )}
            {(() => {
              const stats = paiementsStats[viewCampagne.id] || { nb: 0, total: 0 };
              const attendu = viewCampagne.montant * viewCampagne.nb_concernes;
              const taux = pct(stats.total, attendu);
              return (
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-emerald-600 font-bold">Encaissé</p>
                    <p className="text-sm font-black text-emerald-700">{fmt(stats.total)}</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-red-500 font-bold">Solde</p>
                    <p className="text-sm font-black text-red-600">{fmt(Math.max(0, attendu - stats.total))}</p>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-indigo-600 font-bold">Taux</p>
                    <p className="text-sm font-black text-indigo-700">{taux}%</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
