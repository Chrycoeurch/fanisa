import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Foyer, Membre } from '../types';
import {
  Plus, Search, Edit2, Eye, Pause, Play, XCircle, Copy, Archive,
  Loader2, X, CheckCircle, AlertCircle, BarChart2, Wallet,
  Calendar, Filter, Users, TrendingUp, ChevronLeft, ChevronRight,
  FileText, Home, Baby, User
} from 'lucide-react';

interface Props { foyers: Foyer[]; membres: Membre[]; }

interface Campagne {
  id: string; code: string; nom: string; description: string | null;
  type_cotisation: string; type_autre: string | null;
  montant: number; paiement_obligatoire: boolean;
  calcul_montant: string;
  date_ouverture: string; date_cloture: string; date_limite_paiement: string;
  population: string; modes_paiement: string[];
  agent_responsable: string; observations: string | null;
  statut: string; nb_concernes: number; created_at: string;
}

interface CampagneMenage {
  id: string;
  campagne_id: string;
  foyer_id: string;
  montant_du: number;
  montant_paye: number;
  statut: string;
  nb_personnes_concernees: number;
  created_at: string;
}

const fmt = (n: number) => new Intl.NumberFormat('fr-MG').format(n) + ' Ar';
const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;

const TYPES = ['Annuelle', 'Mensuelle', 'Exceptionnelle', 'Solidarité', 'Travaux communautaires', 'Autre'];
const MODES = ['Espèces', 'Mobile Money', 'Virement bancaire', 'Autres'];
const STATUTS = ['Brouillon', 'Active', 'Suspendue', 'Clôturée', 'Archivée'];

// Paramètres de calcul du montant — détermine qui est compté dans chaque ménage
const CALCUL_OPTIONS = [
  { value: 'par_menage',    label: 'Par ménage (forfait)',         icon: '🏠', desc: 'Montant fixe par ménage, indépendamment du nombre de membres' },
  { value: 'par_membre',    label: 'Par membre (tous)',            icon: '👨‍👩‍👧', desc: 'Montant × nombre total de membres du ménage' },
  { value: 'par_adulte_18', label: 'Par adulte (18 ans et plus)', icon: '🧑', desc: 'Montant × nombre de membres âgés de 18 ans et plus' },
  { value: 'par_chef',      label: 'Par chef de ménage',          icon: '👤', desc: 'Montant fixe, ne compte que le chef de ménage' },
  { value: 'par_enfant',    label: 'Par enfant (moins de 18 ans)',icon: '👶', desc: 'Montant × nombre de membres de moins de 18 ans' },
];

const STATUT_STYLE: Record<string, string> = {
  'Brouillon':  'bg-slate-100 text-slate-600',
  'Active':     'bg-emerald-100 text-emerald-700',
  'Suspendue':  'bg-amber-100 text-amber-700',
  'Clôturée':   'bg-red-100 text-red-600',
  'Archivée':   'bg-slate-200 text-slate-500',
};

const STATUT_PAI: Record<string, string> = {
  'Payé':     'bg-emerald-100 text-emerald-700',
  'Partiel':  'bg-amber-100 text-amber-700',
  'Non payé': 'bg-red-100 text-red-500',
};

function genCode() {
  const y = new Date().getFullYear();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CAMP-${y}-${r}`;
}

// Calcule le montant dû et le nombre de personnes concernées pour un ménage donné
function calculerMontantMenage(foyer: Foyer, membres: Membre[], calcul: string, montantUnitaire: number): { montant: number; nb: number } {
  const membresFoyer = membres.filter(m => m.foyer_id === foyer.id);
  const today = new Date();
  let nb = 1;
  switch (calcul) {
    case 'par_menage': nb = 1; break;
    case 'par_membre': nb = membresFoyer.length || 1; break;
    case 'par_adulte_18':
      nb = membresFoyer.filter(m => {
        if (!m.date_naissance) return false;
        return today.getFullYear() - new Date(m.date_naissance).getFullYear() >= 18;
      }).length || 1;
      break;
    case 'par_chef': nb = 1; break;
    case 'par_enfant':
      nb = membresFoyer.filter(m => {
        if (!m.date_naissance) return false;
        return today.getFullYear() - new Date(m.date_naissance).getFullYear() < 18;
      }).length || 0;
      break;
  }
  return { montant: montantUnitaire * nb, nb };
}

// ── Formulaire de création/modification ─────────────────────────
const EMPTY_FORM = {
  nom: '', description: '', type_cotisation: 'Annuelle', type_autre: '',
  montant: '', calcul_montant: 'par_menage', paiement_obligatoire: true,
  date_ouverture: '', date_cloture: '', date_limite_paiement: '',
  modes_paiement: [] as string[],
  agent_responsable: '', observations: '',
};

function FormulaireModal({ campagne, foyers, membres, onClose, onSave }: {
  campagne?: Campagne; foyers: Foyer[]; membres: Membre[];
  onClose: () => void; onSave: () => void;
}) {
  const [form, setForm] = useState(campagne ? {
    nom: campagne.nom, description: campagne.description || '',
    type_cotisation: campagne.type_cotisation, type_autre: campagne.type_autre || '',
    montant: String(campagne.montant), calcul_montant: campagne.calcul_montant || 'par_menage',
    paiement_obligatoire: campagne.paiement_obligatoire,
    date_ouverture: campagne.date_ouverture, date_cloture: campagne.date_cloture,
    date_limite_paiement: campagne.date_limite_paiement,
    modes_paiement: campagne.modes_paiement,
    agent_responsable: campagne.agent_responsable, observations: campagne.observations || '',
  } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [erreurs, setErreurs] = useState<string[]>([]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleMode = (m: string) => set('modes_paiement', form.modes_paiement.includes(m) ? form.modes_paiement.filter((x: string) => x !== m) : [...form.modes_paiement, m]);

  // Prévisualisation du calcul
  const montantU = parseFloat(form.montant) || 0;
  const exempleCalc = foyers.length > 0 ? calculerMontantMenage(foyers[0], membres, form.calcul_montant, montantU) : { montant: 0, nb: 1 };
  const totalEstime = foyers.reduce((s, f) => s + calculerMontantMenage(f, membres, form.calcul_montant, montantU).montant, 0);

  const valider = () => {
    const e: string[] = [];
    if (!form.nom.trim()) e.push('Le nom de la campagne est obligatoire.');
    if (!form.montant || parseFloat(form.montant) <= 0) e.push('Le montant unitaire doit être supérieur à 0 Ar.');
    if (!form.date_ouverture) e.push('La date d\'ouverture est obligatoire.');
    if (!form.date_cloture) e.push('La date de clôture est obligatoire.');
    if (!form.date_limite_paiement) e.push('La date limite de paiement est obligatoire.');
    if (form.date_ouverture && form.date_cloture && form.date_ouverture > form.date_cloture) e.push('La date d\'ouverture doit être antérieure à la clôture.');
    if (form.date_limite_paiement && form.date_cloture && form.date_limite_paiement < form.date_cloture) e.push('La date limite ne peut pas être avant la clôture.');
    if (form.modes_paiement.length === 0) e.push('Choisissez au moins un mode de paiement.');
    if (!form.agent_responsable.trim()) e.push('Le responsable est obligatoire.');
    if (form.type_cotisation === 'Autre' && !form.type_autre.trim()) e.push('Précisez le type de cotisation.');
    setErreurs(e);
    return e.length === 0;
  };

  const handleSave = async () => {
    if (!valider()) return;
    setSaving(true);
    const montantU = parseFloat(form.montant);
    // Calculer nb_concernes = nombre de ménages ayant au moins 1 personne concernée
    const nbConcernes = foyers.filter(f => {
      const r = calculerMontantMenage(f, membres, form.calcul_montant, montantU);
      return r.nb > 0;
    }).length;
    const payload = {
      nom: form.nom.trim(), description: form.description.trim() || null,
      type_cotisation: form.type_cotisation,
      type_autre: form.type_cotisation === 'Autre' ? form.type_autre.trim() : null,
      montant: montantU, calcul_montant: form.calcul_montant,
      paiement_obligatoire: form.paiement_obligatoire,
      date_ouverture: form.date_ouverture, date_cloture: form.date_cloture,
      date_limite_paiement: form.date_limite_paiement,
      modes_paiement: form.modes_paiement,
      agent_responsable: form.agent_responsable.trim(),
      observations: form.observations.trim() || null,
      statut: campagne?.statut || 'Active',
      nb_concernes: nbConcernes,
      updated_at: new Date().toISOString(),
    };

    let campagneId = campagne?.id;
    if (campagne) {
      await supabase.from('campagnes_cotisation').update(payload).eq('id', campagne.id);
    } else {
      const { data } = await supabase.from('campagnes_cotisation').insert({ ...payload, code: genCode() }).select().single();
      campagneId = data?.id;
    }

    // Générer/mettre à jour les entrées campagne_menages pour chaque ménage concerné
    if (campagneId) {
      const rows = foyers
        .map(f => {
          const { montant, nb } = calculerMontantMenage(f, membres, form.calcul_montant, montantU);
          return nb > 0 ? { campagne_id: campagneId, foyer_id: f.id, montant_du: montant, montant_paye: 0, statut: 'Non payé', nb_personnes_concernees: nb } : null;
        })
        .filter(Boolean);
      // Upsert — met à jour montant_du si la campagne est modifiée
      await supabase.from('campagne_menages').upsert(rows as any[], { onConflict: 'campagne_id,foyer_id', ignoreDuplicates: false });
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
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1">Informations générales</h3>
            <input value={form.nom} onChange={e => set('nom', e.target.value)} placeholder="Nom de la campagne *" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
            <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Description (facultatif)" rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500 resize-none" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Type *</label>
                <select value={form.type_cotisation} onChange={e => set('type_cotisation', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-emerald-500">
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              {form.type_cotisation === 'Autre' && (
                <div><label className="text-xs text-slate-500 block mb-1">Préciser *</label>
                  <input value={form.type_autre} onChange={e => set('type_autre', e.target.value)} placeholder="Type..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
                </div>
              )}
            </div>
          </div>

          {/* Montant et calcul par ménage */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1">Montant & Calcul par ménage</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Montant unitaire (Ar) *</label>
                <input type="number" value={form.montant} onChange={e => set('montant', e.target.value)} placeholder="5000" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm self-end pb-2">
                <input type="checkbox" checked={form.paiement_obligatoire} onChange={e => set('paiement_obligatoire', e.target.checked)} className="accent-emerald-600 w-4 h-4" />
                Paiement obligatoire
              </label>
            </div>

            {/* Paramètre de calcul */}
            <div>
              <label className="text-xs text-slate-500 block mb-2">Calcul du montant par ménage *</label>
              <div className="space-y-2">
                {CALCUL_OPTIONS.map(opt => (
                  <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${form.calcul_montant === opt.value ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                    <input type="radio" name="calcul" value={opt.value} checked={form.calcul_montant === opt.value} onChange={() => set('calcul_montant', opt.value)} className="accent-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{opt.icon} {opt.label}</p>
                      <p className="text-xs text-slate-400">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Prévisualisation du calcul */}
            {montantU > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-indigo-700 uppercase">Prévisualisation</p>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Exemple (1er ménage du registre)</span>
                  <span className="font-bold text-indigo-700">{exempleCalc.nb} personne{exempleCalc.nb > 1 ? 's' : ''} × {fmt(montantU)} = <strong>{fmt(exempleCalc.montant)}</strong></span>
                </div>
                <div className="flex justify-between text-sm border-t border-indigo-200 pt-2">
                  <span className="font-bold text-slate-700">Total estimé ({foyers.length} ménages)</span>
                  <span className="font-black text-emerald-700 text-base">{fmt(totalEstime)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Période */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1">Période</h3>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-xs text-slate-500 block mb-1">Date d'ouverture *</label>
                <input type="date" value={form.date_ouverture} onChange={e => set('date_ouverture', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
              </div>
              <div><label className="text-xs text-slate-500 block mb-1">Date de clôture *</label>
                <input type="date" value={form.date_cloture} onChange={e => set('date_cloture', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
              </div>
              <div><label className="text-xs text-slate-500 block mb-1">Date limite paiement *</label>
                <input type="date" value={form.date_limite_paiement} onChange={e => set('date_limite_paiement', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
              </div>
            </div>
          </div>

          {/* Modes de paiement */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1">Modes de paiement *</h3>
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
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1">Responsable</h3>
            <input value={form.agent_responsable} onChange={e => set('agent_responsable', e.target.value)} placeholder="Nom de l'agent responsable *" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
            <textarea value={form.observations} onChange={e => set('observations', e.target.value)} placeholder="Observations / Notes internes (facultatif)" rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500 resize-none" />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-200 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {saving ? 'Enregistrement…' : campagne ? 'Enregistrer' : 'Créer la campagne'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vue détail campagne + historique suivi par ménage ───────────
function DetailCampagne({ campagne, foyers, membres, onClose }: {
  campagne: Campagne; foyers: Foyer[]; membres: Membre[]; onClose: () => void;
}) {
  const [menages, setMenages] = useState<CampagneMenage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE = 12;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('campagne_menages').select('*').eq('campagne_id', campagne.id).order('statut');
      setMenages((data || []) as CampagneMenage[]);
      setLoading(false);
    })();
  }, [campagne.id]);

  const filtres = menages.filter(m => {
    if (filtreStatut && m.statut !== filtreStatut) return false;
    if (search) {
      const foyer = foyers.find(f => f.id === m.foyer_id);
      const chef = membres.find(mb => mb.foyer_id === m.foyer_id && mb.is_chef);
      const q = search.toLowerCase();
      if (!(foyer?.code_menage.toLowerCase().includes(q) || `${chef?.nom} ${chef?.prenom}`.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtres.length / PAGE));
  const paginated = filtres.slice((page - 1) * PAGE, page * PAGE);

  const totalDu = menages.reduce((s, m) => s + m.montant_du, 0);
  const totalPaye = menages.reduce((s, m) => s + m.montant_paye, 0);
  const nbPayes = menages.filter(m => m.statut === 'Payé').length;
  const nbPartiels = menages.filter(m => m.statut === 'Partiel').length;
  const nbNonPayes = menages.filter(m => m.statut === 'Non payé').length;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[95vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">{campagne.nom}</h2>
            <p className="text-xs text-slate-400 font-mono">{campagne.code} · {campagne.type_cotisation} · {CALCUL_OPTIONS.find(o => o.value === campagne.calcul_montant)?.label}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_STYLE[campagne.statut]}`}>{campagne.statut}</span>
            <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
          </div>
        </div>

        {/* Cards résumé */}
        <div className="grid grid-cols-4 gap-3 p-4 border-b border-slate-100 shrink-0">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-400 font-bold uppercase">Total attendu</p>
            <p className="text-lg font-black text-slate-800">{fmt(totalDu)}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-600 font-bold uppercase">Encaissé</p>
            <p className="text-lg font-black text-emerald-700">{fmt(totalPaye)}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-xs text-red-500 font-bold uppercase">Solde restant</p>
            <p className="text-lg font-black text-red-600">{fmt(Math.max(0, totalDu - totalPaye))}</p>
          </div>
          <div className="bg-indigo-50 rounded-xl p-3 text-center">
            <p className="text-xs text-indigo-600 font-bold uppercase">Taux recouvrement</p>
            <p className="text-lg font-black text-indigo-700">{pct(totalPaye, totalDu)}%</p>
          </div>
        </div>

        {/* Badges statut */}
        <div className="flex gap-2 px-4 py-3 border-b border-slate-100 shrink-0 flex-wrap">
          {['', 'Payé', 'Partiel', 'Non payé'].map(s => (
            <button key={s} onClick={() => { setFiltreStatut(s); setPage(1); }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filtreStatut === s ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {s === '' ? `Tous (${menages.length})` : `${s} (${s === 'Payé' ? nbPayes : s === 'Partiel' ? nbPartiels : nbNonPayes})`}
            </button>
          ))}
          <div className="relative ml-auto">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Rechercher ménage..." className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-emerald-500" />
          </div>
        </div>

        {/* Tableau des ménages */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="text-center py-12"><Loader2 className="h-7 w-7 text-emerald-600 animate-spin mx-auto" /></div>
          ) : (
            <table className="w-full text-xs">
              <thead><tr className="bg-slate-50 border-b sticky top-0">
                <th className="p-3 text-left text-slate-500">Ménage</th>
                <th className="p-3 text-left text-slate-500">Chef de ménage</th>
                <th className="p-3 text-center text-slate-500">Personnes concernées</th>
                <th className="p-3 text-right text-slate-500">Montant dû</th>
                <th className="p-3 text-right text-slate-500">Montant payé</th>
                <th className="p-3 text-right text-slate-500">Solde</th>
                <th className="p-3 text-center text-slate-500">Statut</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map(m => {
                  const foyer = foyers.find(f => f.id === m.foyer_id);
                  const chef = membres.find(mb => mb.foyer_id === m.foyer_id && mb.is_chef);
                  const solde = m.montant_du - m.montant_paye;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-indigo-600 font-bold">{foyer?.code_menage || '—'}</td>
                      <td className="p-3 text-slate-700">{chef ? `${chef.nom} ${chef.prenom}` : '—'}</td>
                      <td className="p-3 text-center text-slate-500">{m.nb_personnes_concernees}</td>
                      <td className="p-3 text-right font-semibold text-slate-800">{fmt(m.montant_du)}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">{fmt(m.montant_paye)}</td>
                      <td className="p-3 text-right font-bold text-red-500">{solde > 0 ? fmt(solde) : <span className="text-emerald-500">✓</span>}</td>
                      <td className="p-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_PAI[m.statut] || 'bg-slate-100'}`}>{m.statut}</span>
                      </td>
                    </tr>
                  );
                })}
                {paginated.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-8">Aucun ménage trouvé</td></tr>}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50 shrink-0">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Précédent</button>
            <span className="text-xs text-slate-500">Page {page} / {totalPages} · {filtres.length} ménage{filtres.length > 1 ? 's' : ''}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-40">Suivant<ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modale paiement ─────────────────────────────────────────────
function ModalePaiement({ campagne, foyers, membres, onClose, onSent }: {
  campagne: Campagne; foyers: Foyer[]; membres: Membre[];
  onClose: () => void; onSent: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedFoyer, setSelectedFoyer] = useState<Foyer | null>(null);
  const [menageInfo, setMenageInfo] = useState<CampagneMenage | null>(null);
  const [montantSaisi, setMontantSaisi] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingMenage, setLoadingMenage] = useState(false);

  const resultats = (() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return foyers.filter(f => {
      const chef = membres.find(m => m.foyer_id === f.id && m.is_chef);
      return f.code_menage.toLowerCase().includes(q) || `${chef?.nom || ''} ${chef?.prenom || ''}`.toLowerCase().includes(q);
    }).slice(0, 8);
  })();

  const selectionnerFoyer = async (foyer: Foyer) => {
    setSelectedFoyer(foyer);
    setSearch('');
    setLoadingMenage(true);
    const { data } = await supabase.from('campagne_menages').select('*').eq('campagne_id', campagne.id).eq('foyer_id', foyer.id).single();
    setMenageInfo(data as CampagneMenage | null);
    if (data) setMontantSaisi(String(data.montant_du - data.montant_paye));
    setLoadingMenage(false);
  };

  const handleEnvoyer = async () => {
    if (!selectedFoyer || !menageInfo) return;
    const montant = parseFloat(montantSaisi);
    if (!montant || montant <= 0) { alert('Montant invalide.'); return; }
    const solde = menageInfo.montant_du - menageInfo.montant_paye;
    if (montant > solde) { alert(`Le montant ne peut pas dépasser le solde restant : ${fmt(solde)}.`); return; }
    setSubmitting(true);
    const chef = membres.find(m => m.foyer_id === selectedFoyer.id && m.is_chef);
    const nomPayeur = chef ? `${chef.nom} ${chef.prenom}` : selectedFoyer.code_menage;
    const estPartiel = montant < solde;
    await supabase.from('operations_caisse').insert({
      module_origine: 'Campagnes',
      type_prestation: campagne.nom,
      reference_document: campagne.code,
      foyer_id: selectedFoyer.id,
      membre_id: chef?.id || null,
      nom_beneficiaire: nomPayeur,
      montant, quantite: 1,
      statut: 'En attente de paiement',
      metadata: {
        campagne_id: campagne.id,
        campagne_menage_id: menageInfo.id,
        montant_total_du: menageInfo.montant_du,
        montant_deja_paye: menageInfo.montant_paye,
        solde_avant: solde,
        est_partiel: estPartiel,
      },
    });
    setSubmitting(false);
    onSent();
    alert(`✅ Envoyé à la Caisse pour ${nomPayeur}.\nMontant : ${fmt(montant)}${estPartiel ? ' (partiel — le solde restant ira en Créances après validation)' : ''}\n\nAllez dans Finances → Caisse pour valider.`);
  };

  const chef = selectedFoyer ? membres.find(m => m.foyer_id === selectedFoyer.id && m.is_chef) : null;
  const solde = menageInfo ? menageInfo.montant_du - menageInfo.montant_paye : 0;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Enregistrer un paiement</h2>
            <p className="text-xs text-emerald-600 font-semibold">{campagne.nom}</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>

        {/* Sélection foyer */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Ménage payeur *</label>
          {selectedFoyer ? (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
              <div>
                <p className="text-sm font-bold text-emerald-800">{chef ? `${chef.nom} ${chef.prenom}` : selectedFoyer.code_menage}</p>
                <p className="text-xs text-emerald-500 font-mono">{selectedFoyer.code_menage}</p>
              </div>
              <button onClick={() => { setSelectedFoyer(null); setMenageInfo(null); setMontantSaisi(''); }} className="text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom ou code ménage..." className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-emerald-500" />
              {search && resultats.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-30 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-52 overflow-y-auto">
                  {resultats.map(f => {
                    const c = membres.find(m => m.foyer_id === f.id && m.is_chef);
                    return (
                      <button key={f.id} onClick={() => selectionnerFoyer(f)} className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 border-b border-slate-50 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">{(c?.nom || f.code_menage).charAt(0)}</div>
                        <div><p className="text-sm font-semibold text-slate-800">{c ? `${c.nom} ${c.prenom}` : f.code_menage}</p><p className="text-xs text-slate-400 font-mono">{f.code_menage}</p></div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info ménage */}
        {loadingMenage && <div className="text-center py-2"><Loader2 className="h-5 w-5 text-emerald-600 animate-spin mx-auto" /></div>}

        {menageInfo && !loadingMenage && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Dû</p>
                <p className="text-sm font-black text-slate-800">{fmt(menageInfo.montant_du)}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-emerald-600 uppercase font-bold">Payé</p>
                <p className="text-sm font-black text-emerald-700">{fmt(menageInfo.montant_paye)}</p>
              </div>
              <div className={`rounded-lg p-2.5 text-center ${solde > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                <p className={`text-[10px] uppercase font-bold ${solde > 0 ? 'text-red-500' : 'text-emerald-600'}`}>Solde</p>
                <p className={`text-sm font-black ${solde > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{solde <= 0 ? '✓ Soldé' : fmt(solde)}</p>
              </div>
            </div>

            {solde <= 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-3 text-sm text-emerald-700 text-center font-semibold">✅ Ce ménage a déjà tout payé</div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Montant à encaisser (Ar) *</label>
                  <input type="number" value={montantSaisi} onChange={e => setMontantSaisi(e.target.value)} max={solde} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
                  {parseFloat(montantSaisi) < solde && parseFloat(montantSaisi) > 0 && (
                    <p className="text-[11px] text-amber-600 mt-1">⚠ Paiement partiel — le solde restant ({fmt(solde - parseFloat(montantSaisi))}) sera enregistré en Créances après validation en Caisse.</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600">Annuler</button>
                  <button onClick={handleEnvoyer} disabled={submitting} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                    {submitting ? 'Envoi…' : 'Envoyer à la Caisse'}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {!menageInfo && !loadingMenage && selectedFoyer && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">Ce ménage n'est pas inscrit dans cette campagne.</div>
        )}
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
  const [paiementCampagne, setPaiementCampagne] = useState<Campagne | null>(null);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtreSearch, setFiltreSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: camps } = await supabase.from('campagnes_cotisation').select('*').order('created_at', { ascending: false });
    setCampagnes((camps || []) as Campagne[]);
    if (camps && camps.length > 0) {
      const ids = camps.map((c: any) => c.id);
      const { data: menages } = await supabase.from('campagne_menages').select('campagne_id, montant_paye, statut').in('campagne_id', ids);
      const stats: Record<string, { nb: number; total: number }> = {};
      (menages || []).forEach((m: any) => {
        if (!stats[m.campagne_id]) stats[m.campagne_id] = { nb: 0, total: 0 };
        if (m.statut !== 'Non payé') stats[m.campagne_id].nb++;
        stats[m.campagne_id].total += m.montant_paye;
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
      montant: campagne.montant, calcul_montant: campagne.calcul_montant,
      paiement_obligatoire: campagne.paiement_obligatoire,
      date_ouverture: campagne.date_ouverture, date_cloture: campagne.date_cloture,
      date_limite_paiement: campagne.date_limite_paiement,
      modes_paiement: campagne.modes_paiement, agent_responsable: campagne.agent_responsable,
      observations: campagne.observations, statut: 'Brouillon', nb_concernes: campagne.nb_concernes,
    });
    await load();
    setActionLoading(null);
  };

  const campagnesFiltrees = campagnes.filter(c => {
    if (filtreStatut && c.statut !== filtreStatut) return false;
    if (filtreSearch && !c.nom.toLowerCase().includes(filtreSearch.toLowerCase()) && !c.code.toLowerCase().includes(filtreSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Filter className="h-3.5 w-3.5" />Filtres</h3>
            <button onClick={() => { setEditing(undefined); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition">
              <Plus className="h-4 w-4" />Nouvelle campagne
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="relative col-span-2">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input value={filtreSearch} onChange={e => setFiltreSearch(e.target.value)} placeholder="Rechercher par nom ou code..." className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-emerald-500" />
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
                <th className="p-3 text-left text-slate-500">Type · Calcul</th>
                <th className="p-3 text-right text-slate-500">Montant unitaire</th>
                <th className="p-3 text-left text-slate-500">Période</th>
                <th className="p-3 text-left text-slate-500">Responsable</th>
                <th className="p-3 text-center text-slate-500">Statut</th>
                <th className="p-3 text-center text-slate-500">Ménages</th>
                <th className="p-3 text-right text-slate-500">Attendu</th>
                <th className="p-3 text-right text-slate-500">Encaissé</th>
                <th className="p-3 text-center text-slate-500">Taux</th>
                <th className="p-3 text-center text-slate-500">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {campagnesFiltrees.map(c => {
                  const stats = paiementsStats[c.id] || { nb: 0, total: 0 };
                  const montantAttendu = c.montant * c.nb_concernes;
                  const taux = pct(stats.total, montantAttendu);
                  const peutModif = stats.nb === 0 && c.statut !== 'Clôturée' && c.statut !== 'Archivée';
                  const calcOpt = CALCUL_OPTIONS.find(o => o.value === c.calcul_montant);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <p className="font-semibold text-slate-800">{c.nom}</p>
                        <p className="text-slate-400 font-mono text-[10px]">{c.code}</p>
                      </td>
                      <td className="p-3 text-slate-500">
                        <p>{c.type_cotisation === 'Autre' ? c.type_autre : c.type_cotisation}</p>
                        <p className="text-[10px] text-slate-400">{calcOpt?.icon} {calcOpt?.label}</p>
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900">{fmt(c.montant)}</td>
                      <td className="p-3 text-slate-500">
                        <p>{new Date(c.date_ouverture).toLocaleDateString('fr-FR')} →</p>
                        <p>{new Date(c.date_cloture).toLocaleDateString('fr-FR')}</p>
                      </td>
                      <td className="p-3 text-slate-600">{c.agent_responsable}</td>
                      <td className="p-3 text-center"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_STYLE[c.statut] || 'bg-slate-100'}`}>{c.statut}</span></td>
                      <td className="p-3 text-center font-semibold text-slate-700">{c.nb_concernes}</td>
                      <td className="p-3 text-right text-slate-600">{fmt(montantAttendu)}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">{fmt(stats.total)}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <div className="w-10 bg-slate-100 rounded-full h-1.5"><div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, taux)}%` }} /></div>
                          <span className={`font-bold text-[10px] ${taux >= 100 ? 'text-emerald-600' : taux >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{taux}%</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-0.5 justify-center">
                          <button onClick={() => setViewCampagne(c)} title="Consulter / Historique" className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600"><Eye className="h-3.5 w-3.5" /></button>
                          {peutModif && <button onClick={() => { setEditing(c); setShowForm(true); }} title="Modifier" className="p-1.5 hover:bg-amber-50 rounded-lg text-slate-400 hover:text-amber-600"><Edit2 className="h-3.5 w-3.5" /></button>}
                          {c.statut === 'Active' && <button onClick={() => setPaiementCampagne(c)} title="Enregistrer un paiement" className="p-1.5 hover:bg-emerald-50 rounded-lg text-slate-400 hover:text-emerald-600"><Wallet className="h-3.5 w-3.5" /></button>}
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

      {showForm && <FormulaireModal campagne={editing} foyers={foyers} membres={membres} onClose={() => { setShowForm(false); setEditing(undefined); }} onSave={load} />}
      {viewCampagne && <DetailCampagne campagne={viewCampagne} foyers={foyers} membres={membres} onClose={() => setViewCampagne(null)} />}
      {paiementCampagne && <ModalePaiement campagne={paiementCampagne} foyers={foyers} membres={membres} onClose={() => setPaiementCampagne(null)} onSent={() => setPaiementCampagne(null)} />}
    </div>
  );
}
