import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Foyer, Membre } from '../types';
import {
  Plus, Search, Edit2, Eye, Pause, Play, XCircle, Copy, Archive,
  Loader2, X, CheckCircle, AlertCircle, BarChart2, Wallet,
  Filter, ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react';

interface Props { foyers: Foyer[]; membres: Membre[]; }

interface Campagne {
  id: string; code: string; nom: string; description: string | null;
  type_cotisation: string; type_autre: string | null;
  montant: number; calcul_montant: string;
  date_debut: string; date_fin: string;
  date_fin_exception: string | null;
  statut: string; nb_concernes: number; created_at: string;
}

interface CampagneMenage {
  id: string; campagne_id: string; foyer_id: string;
  montant_du: number; montant_paye: number; statut: string;
  nb_personnes_concernees: number; updated_at: string;
}

const fmt = (n: number) => new Intl.NumberFormat('fr-MG').format(n) + ' Ar';
const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;

const TYPES = ['Annuelle', 'Mensuelle', 'Exceptionnelle', 'Solidarité', 'Travaux communautaires', 'Autre'];
const STATUTS = ['Brouillon', 'Active', 'Suspendue', 'Terminée', 'Archivée'];

const CALCUL_OPTIONS = [
  { value: 'par_menage',    label: 'Par ménage (forfait)',          icon: '🏠', desc: 'Montant fixe par ménage' },
  { value: 'par_membre',    label: 'Par membre (tous)',             icon: '👨‍👩‍👧', desc: 'Montant × nombre total de membres' },
  { value: 'par_adulte_18', label: 'Par adulte (18 ans et plus)',  icon: '🧑', desc: 'Montant × membres de 18 ans et plus' },
  { value: 'par_chef',      label: 'Par chef de ménage',           icon: '👤', desc: 'Montant fixe, compte uniquement le chef' },
  { value: 'par_enfant',    label: 'Par enfant (moins de 18 ans)', icon: '👶', desc: 'Montant × membres de moins de 18 ans' },
];

const STATUT_STYLE: Record<string, string> = {
  'Brouillon':  'bg-slate-100 text-slate-600',
  'Active':     'bg-emerald-100 text-emerald-700',
  'Suspendue':  'bg-amber-100 text-amber-700',
  'Terminée':   'bg-blue-100 text-blue-600',
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

// Calcule le montant dû et le nombre de personnes concernées pour un ménage
function calculerMontantMenage(foyer: Foyer, membres: Membre[], calcul: string, montantUnitaire: number) {
  const mf = membres.filter(m => m.foyer_id === foyer.id);
  const today = new Date();
  let nb = 1;
  switch (calcul) {
    case 'par_menage':    nb = 1; break;
    case 'par_membre':    nb = mf.length || 1; break;
    case 'par_adulte_18': nb = mf.filter(m => m.date_naissance && today.getFullYear() - new Date(m.date_naissance).getFullYear() >= 18).length || 1; break;
    case 'par_chef':      nb = 1; break;
    case 'par_enfant':    nb = mf.filter(m => m.date_naissance && today.getFullYear() - new Date(m.date_naissance).getFullYear() < 18).length || 0; break;
  }
  return { montant: montantUnitaire * nb, nb };
}

// Vérifie si une campagne est expirée et met à jour son statut si besoin
async function verifierEtMettreAJourStatut(campagne: Campagne) {
  const today = new Date().toISOString().split('T')[0];
  const dateFin = campagne.date_fin_exception || campagne.date_fin;
  if (campagne.statut === 'Active' && dateFin < today) {
    await supabase.from('campagnes_cotisation').update({ statut: 'Terminée', updated_at: new Date().toISOString() }).eq('id', campagne.id);
    return true;
  }
  return false;
}

// ── Formulaire simplifié ─────────────────────────────────────────
const EMPTY_FORM = {
  nom: '', description: '',
  type_cotisation: 'Annuelle', type_autre: '',
  montant: '', calcul_montant: 'par_menage',
  date_debut: '', date_fin: '',
};

function FormulaireModal({ campagne, foyers, membres, onClose, onSave, modeRelance }: {
  campagne?: Campagne; foyers: Foyer[]; membres: Membre[];
  onClose: () => void; onSave: () => void; modeRelance?: boolean;
}) {
  const [form, setForm] = useState(campagne ? {
    nom: campagne.nom, description: campagne.description || '',
    type_cotisation: campagne.type_cotisation, type_autre: campagne.type_autre || '',
    montant: String(campagne.montant), calcul_montant: campagne.calcul_montant || 'par_menage',
    date_debut: modeRelance ? new Date().toISOString().split('T')[0] : campagne.date_debut,
    date_fin: modeRelance ? '' : campagne.date_fin,
  } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [erreurs, setErreurs] = useState<string[]>([]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const montantU = parseFloat(form.montant) || 0;
  const totalEstime = foyers.reduce((s, f) => s + calculerMontantMenage(f, membres, form.calcul_montant, montantU).montant, 0);
  const exempleCalc = foyers.length > 0 ? calculerMontantMenage(foyers[0], membres, form.calcul_montant, montantU) : { montant: 0, nb: 1 };
  const nbConcernes = foyers.filter(f => calculerMontantMenage(f, membres, form.calcul_montant, montantU).nb > 0).length;

  const valider = () => {
    const e: string[] = [];
    if (!form.nom.trim()) e.push('Le nom est obligatoire.');
    if (!form.montant || parseFloat(form.montant) <= 0) e.push('Le montant doit être supérieur à 0 Ar.');
    if (!form.date_debut) e.push('La date de début est obligatoire.');
    if (!form.date_fin) e.push('La date de fin est obligatoire.');
    if (form.date_debut && form.date_fin && form.date_debut > form.date_fin) e.push('La date de début doit être avant la date de fin.');
    if (form.type_cotisation === 'Autre' && !form.type_autre.trim()) e.push('Précisez le type.');
    setErreurs(e);
    return e.length === 0;
  };

  const handleSave = async () => {
    if (!valider()) return;
    setSaving(true);
    const montantU = parseFloat(form.montant);

    if (modeRelance && campagne) {
      // Relance : on met juste à jour la date de fin exception et on réactive
      await supabase.from('campagnes_cotisation').update({
        statut: 'Active',
        date_fin_exception: form.date_fin,
        updated_at: new Date().toISOString(),
      }).eq('id', campagne.id);
    } else {
      const payload = {
        nom: form.nom.trim(), description: form.description.trim() || null,
        type_cotisation: form.type_cotisation,
        type_autre: form.type_cotisation === 'Autre' ? form.type_autre.trim() : null,
        montant: montantU, calcul_montant: form.calcul_montant,
        date_debut: form.date_debut, date_fin: form.date_fin,
        date_fin_exception: null,
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

      if (campagneId) {
        const rows = foyers
          .map(f => {
            const { montant, nb } = calculerMontantMenage(f, membres, form.calcul_montant, montantU);
            return nb > 0 ? { campagne_id: campagneId, foyer_id: f.id, montant_du: montant, montant_paye: 0, statut: 'Non payé', nb_personnes_concernees: nb } : null;
          })
          .filter(Boolean);
        await supabase.from('campagne_menages').upsert(rows as any[], { onConflict: 'campagne_id,foyer_id', ignoreDuplicates: false });
      }
    }

    setSaving(false);
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[95vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
          <h2 className="text-base font-bold text-slate-900">
            {modeRelance ? '🔄 Relancer la campagne' : campagne ? 'Modifier la campagne' : 'Nouvelle campagne'}
          </h2>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {erreurs.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
              {erreurs.map((e, i) => <p key={i} className="text-xs text-red-600 flex items-start gap-1.5"><AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{e}</p>)}
            </div>
          )}

          {modeRelance ? (
            /* Mode relance : uniquement la nouvelle date de fin */
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-bold text-blue-800">{campagne?.nom}</p>
                <p className="text-xs text-blue-600 mt-1">La date de début sera automatiquement fixée à aujourd'hui. Définissez la nouvelle date de fin.</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Nouvelle date de fin *</label>
                <input type="date" value={form.date_fin} onChange={e => set('date_fin', e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
              </div>
            </div>
          ) : (
            <>
              {/* Infos générales */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase border-b border-slate-100 pb-1">Informations générales</h3>
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
                      <input value={form.type_autre} onChange={e => set('type_autre', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
                    </div>
                  )}
                </div>
              </div>

              {/* Montant & Calcul */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase border-b border-slate-100 pb-1">Montant & Calcul par ménage</h3>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Montant unitaire (Ar) *</label>
                  <input type="number" value={form.montant} onChange={e => set('montant', e.target.value)} placeholder="5000" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
                </div>
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
                {montantU > 0 && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold text-indigo-700 uppercase">Prévisualisation</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Exemple (1er ménage)</span>
                      <span className="font-bold text-indigo-700">{exempleCalc.nb} × {fmt(montantU)} = {fmt(exempleCalc.montant)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-indigo-200 pt-2">
                      <span className="font-bold text-slate-700">Total estimé ({nbConcernes} ménages concernés)</span>
                      <span className="font-black text-emerald-700 text-base">{fmt(totalEstime)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Période */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase border-b border-slate-100 pb-1">Période</h3>
                <p className="text-xs text-slate-400">Si la date de fin est dépassée, la campagne passe automatiquement au statut <strong>Terminée</strong>. Elle peut être relancée à tout moment avec une nouvelle date de fin.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-slate-500 block mb-1">Date de début *</label>
                    <input type="date" value={form.date_debut} onChange={e => set('date_debut', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
                  </div>
                  <div><label className="text-xs text-slate-500 block mb-1">Date de fin *</label>
                    <input type="date" value={form.date_fin} onChange={e => set('date_fin', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-slate-200 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {saving ? 'Enregistrement…' : modeRelance ? 'Relancer' : campagne ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Détail + historique par ménage ───────────────────────────────
function DetailCampagne({ campagne, foyers, membres, onClose }: {
  campagne: Campagne; foyers: Foyer[]; membres: Membre[]; onClose: () => void;
}) {
  const [menages, setMenages] = useState<CampagneMenage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE = 15;

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
      if (!foyer?.code_menage.toLowerCase().includes(q) && !`${chef?.nom || ''} ${chef?.prenom || ''}`.toLowerCase().includes(q)) return false;
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

  const dateFin = campagne.date_fin_exception || campagne.date_fin;
  const calcOpt = CALCUL_OPTIONS.find(o => o.value === campagne.calcul_montant);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">{campagne.nom}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              <span className="font-mono">{campagne.code}</span>
              <span className="mx-2">·</span>{campagne.type_cotisation === 'Autre' ? campagne.type_autre : campagne.type_cotisation}
              <span className="mx-2">·</span>{calcOpt?.icon} {calcOpt?.label}
              <span className="mx-2">·</span>{fmt(campagne.montant)} unitaire
              <span className="mx-2">·</span>
              {new Date(campagne.date_debut).toLocaleDateString('fr-FR')} → {new Date(dateFin).toLocaleDateString('fr-FR')}
              {campagne.date_fin_exception && <span className="ml-1 text-amber-600 font-semibold">(prolongée)</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_STYLE[campagne.statut]}`}>{campagne.statut}</span>
            <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
          </div>
        </div>

        {/* Cards résumé */}
        <div className="grid grid-cols-5 gap-3 p-4 border-b border-slate-100 shrink-0">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Total attendu</p>
            <p className="text-base font-black text-slate-800">{fmt(totalDu)}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-emerald-600 font-bold uppercase">Encaissé</p>
            <p className="text-base font-black text-emerald-700">{fmt(totalPaye)}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-red-500 font-bold uppercase">Solde restant</p>
            <p className="text-base font-black text-red-600">{fmt(Math.max(0, totalDu - totalPaye))}</p>
          </div>
          <div className="bg-indigo-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-indigo-600 font-bold uppercase">Taux recouvrement</p>
            <p className="text-base font-black text-indigo-700">{pct(totalPaye, totalDu)}%</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Ménages</p>
            <p className="text-sm font-black text-slate-700">
              <span className="text-emerald-600">{nbPayes}</span>
              <span className="text-slate-300 mx-1">/</span>
              <span className="text-amber-500">{nbPartiels}</span>
              <span className="text-slate-300 mx-1">/</span>
              <span className="text-red-500">{nbNonPayes}</span>
            </p>
            <p className="text-[10px] text-slate-400">payé / partiel / non payé</p>
          </div>
        </div>

        {/* Filtres du tableau */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 shrink-0 flex-wrap">
          {['', 'Payé', 'Partiel', 'Non payé'].map(s => (
            <button key={s} onClick={() => { setFiltreStatut(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filtreStatut === s ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {s === '' ? `Tous (${menages.length})` : s === 'Payé' ? `✅ Payé (${nbPayes})` : s === 'Partiel' ? `🟡 Partiel (${nbPartiels})` : `❌ Non payé (${nbNonPayes})`}
            </button>
          ))}
          <div className="relative ml-auto">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Rechercher ménage..." className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-emerald-500" />
          </div>
        </div>

        {/* Tableau */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="text-center py-12"><Loader2 className="h-7 w-7 text-emerald-600 animate-spin mx-auto" /></div>
          ) : (
            <table className="w-full text-xs">
              <thead><tr className="bg-slate-50 border-b sticky top-0 z-10">
                <th className="p-3 text-left text-slate-500">Code ménage</th>
                <th className="p-3 text-left text-slate-500">Chef de ménage</th>
                <th className="p-3 text-center text-slate-500">Concernés</th>
                <th className="p-3 text-right text-slate-500">Montant dû</th>
                <th className="p-3 text-right text-slate-500">Montant payé</th>
                <th className="p-3 text-right text-slate-500">Solde</th>
                <th className="p-3 text-center text-slate-500">Statut</th>
                <th className="p-3 text-left text-slate-500">Dernière mise à jour</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map(m => {
                  const foyer = foyers.find(f => f.id === m.foyer_id);
                  const chef = membres.find(mb => mb.foyer_id === m.foyer_id && mb.is_chef);
                  const solde = m.montant_du - m.montant_paye;
                  return (
                    <tr key={m.id} className={`hover:bg-slate-50 ${m.statut === 'Payé' ? 'bg-emerald-50/30' : ''}`}>
                      <td className="p-3 font-mono text-indigo-600 font-bold">{foyer?.code_menage || '—'}</td>
                      <td className="p-3 text-slate-700">{chef ? `${chef.nom} ${chef.prenom}` : '—'}</td>
                      <td className="p-3 text-center text-slate-500">{m.nb_personnes_concernees}</td>
                      <td className="p-3 text-right font-semibold text-slate-800">{fmt(m.montant_du)}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">{m.montant_paye > 0 ? fmt(m.montant_paye) : '—'}</td>
                      <td className="p-3 text-right font-bold">
                        {solde <= 0 ? <span className="text-emerald-500">✓</span> : <span className="text-red-500">{fmt(solde)}</span>}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_PAI[m.statut] || 'bg-slate-100'}`}>{m.statut}</span>
                      </td>
                      <td className="p-3 text-slate-400">
                        {m.updated_at ? new Date(m.updated_at).toLocaleDateString('fr-FR') + ' ' + new Date(m.updated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  );
                })}
                {paginated.length === 0 && <tr><td colSpan={8} className="text-center text-slate-400 py-8">Aucun ménage trouvé</td></tr>}
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
function ModalePaiement({ campagne, foyers, membres, onClose }: {
  campagne: Campagne; foyers: Foyer[]; membres: Membre[];
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedFoyer, setSelectedFoyer] = useState<Foyer | null>(null);
  const [menageInfo, setMenageInfo] = useState<CampagneMenage | null>(null);
  const [montantSaisi, setMontantSaisi] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingMenage, setLoadingMenage] = useState(false);

  const resultats = search.trim() ? foyers.filter(f => {
    const chef = membres.find(m => m.foyer_id === f.id && m.is_chef);
    const q = search.toLowerCase();
    return f.code_menage.toLowerCase().includes(q) || `${chef?.nom || ''} ${chef?.prenom || ''}`.toLowerCase().includes(q);
  }).slice(0, 8) : [];

  const selectionnerFoyer = async (foyer: Foyer) => {
    setSelectedFoyer(foyer); setSearch(''); setLoadingMenage(true);
    const { data } = await supabase.from('campagne_menages').select('*').eq('campagne_id', campagne.id).eq('foyer_id', foyer.id).single();
    setMenageInfo(data as CampagneMenage | null);
    if (data) setMontantSaisi(String(Math.max(0, data.montant_du - data.montant_paye)));
    setLoadingMenage(false);
  };

  const handleEnvoyer = async () => {
    if (!selectedFoyer || !menageInfo) return;
    const montant = parseFloat(montantSaisi);
    const solde = menageInfo.montant_du - menageInfo.montant_paye;
    if (!montant || montant <= 0) { alert('Montant invalide.'); return; }
    if (montant > solde) { alert(`Montant maximum : ${fmt(solde)}.`); return; }
    setSubmitting(true);
    const chef = membres.find(m => m.foyer_id === selectedFoyer.id && m.is_chef);
    const nomPayeur = chef ? `${chef.nom} ${chef.prenom}` : selectedFoyer.code_menage;
    await supabase.from('operations_caisse').insert({
      module_origine: 'Campagnes',
      type_prestation: campagne.nom,
      reference_document: campagne.code,
      foyer_id: selectedFoyer.id, membre_id: chef?.id || null,
      nom_beneficiaire: nomPayeur, montant, quantite: 1,
      statut: 'En attente de paiement',
      metadata: {
        campagne_id: campagne.id, campagne_menage_id: menageInfo.id,
        campagne_nom: campagne.nom, montant_total_du: menageInfo.montant_du,
        montant_deja_paye: menageInfo.montant_paye, solde_avant: solde,
        est_partiel: montant < solde,
      },
    });
    setSubmitting(false);
    onClose();
    alert(`✅ Envoyé à la Caisse pour ${nomPayeur} — ${fmt(montant)}.\n${montant < solde ? `Paiement partiel — solde restant (${fmt(solde - montant)}) ira en Créances après validation.` : ''}\n\nAllez dans Finances → Caisse pour valider.`);
  };

  const chef = selectedFoyer ? membres.find(m => m.foyer_id === selectedFoyer.id && m.is_chef) : null;
  const solde = menageInfo ? menageInfo.montant_du - menageInfo.montant_paye : 0;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div><h2 className="text-base font-bold text-slate-900">Enregistrer un paiement</h2>
            <p className="text-xs text-emerald-600 font-semibold">{campagne.nom}</p></div>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>

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

        {loadingMenage && <div className="text-center py-2"><Loader2 className="h-5 w-5 text-emerald-600 animate-spin mx-auto" /></div>}

        {menageInfo && !loadingMenage && (
          solde <= 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-3 text-sm text-emerald-700 text-center font-semibold">✅ Ce ménage a déjà tout payé</div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-50 rounded-lg p-2.5 text-center"><p className="text-[10px] text-slate-400 uppercase font-bold">Dû</p><p className="text-sm font-black text-slate-800">{fmt(menageInfo.montant_du)}</p></div>
                <div className="bg-emerald-50 rounded-lg p-2.5 text-center"><p className="text-[10px] text-emerald-600 uppercase font-bold">Payé</p><p className="text-sm font-black text-emerald-700">{fmt(menageInfo.montant_paye)}</p></div>
                <div className="bg-red-50 rounded-lg p-2.5 text-center"><p className="text-[10px] text-red-500 uppercase font-bold">Solde</p><p className="text-sm font-black text-red-600">{fmt(solde)}</p></div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Montant à encaisser (Ar) *</label>
                <input type="number" value={montantSaisi} onChange={e => setMontantSaisi(e.target.value)} max={solde} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
                {parseFloat(montantSaisi) > 0 && parseFloat(montantSaisi) < solde && (
                  <p className="text-[11px] text-amber-600 mt-1">⚠ Paiement partiel — le solde restant ({fmt(solde - parseFloat(montantSaisi))}) ira en Créances après validation en Caisse.</p>
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
          )
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
  const [statsMap, setStatsMap] = useState<Record<string, { total: number; nbPayes: number; nbPartiels: number }>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Campagne | undefined>();
  const [relanceCampagne, setRelanceCampagne] = useState<Campagne | undefined>();
  const [viewCampagne, setViewCampagne] = useState<Campagne | null>(null);
  const [paiementCampagne, setPaiementCampagne] = useState<Campagne | null>(null);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtreSearch, setFiltreSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: camps } = await supabase.from('campagnes_cotisation').select('*').order('created_at', { ascending: false });
    if (!camps) { setLoading(false); return; }
    // Vérifier et mettre à jour les statuts expirés
    const today = new Date().toISOString().split('T')[0];
    for (const c of camps) {
      const dateFin = c.date_fin_exception || c.date_fin;
      if (c.statut === 'Active' && dateFin < today) {
        await supabase.from('campagnes_cotisation').update({ statut: 'Terminée', updated_at: new Date().toISOString() }).eq('id', c.id);
        c.statut = 'Terminée';
      }
    }
    setCampagnes(camps as Campagne[]);
    if (camps.length > 0) {
      const ids = camps.map((c: any) => c.id);
      const { data: menages } = await supabase.from('campagne_menages').select('campagne_id, montant_paye, statut').in('campagne_id', ids);
      const stats: Record<string, { total: number; nbPayes: number; nbPartiels: number }> = {};
      (menages || []).forEach((m: any) => {
        if (!stats[m.campagne_id]) stats[m.campagne_id] = { total: 0, nbPayes: 0, nbPartiels: 0 };
        stats[m.campagne_id].total += m.montant_paye;
        if (m.statut === 'Payé') stats[m.campagne_id].nbPayes++;
        if (m.statut === 'Partiel') stats[m.campagne_id].nbPartiels++;
      });
      setStatsMap(stats);
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

  const dupliquer = async (c: Campagne) => {
    setActionLoading(c.id + 'dup');
    await supabase.from('campagnes_cotisation').insert({
      code: genCode(), nom: c.nom + ' (copie)', description: c.description,
      type_cotisation: c.type_cotisation, type_autre: c.type_autre,
      montant: c.montant, calcul_montant: c.calcul_montant,
      date_debut: c.date_debut, date_fin: c.date_fin,
      statut: 'Brouillon', nb_concernes: c.nb_concernes,
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
                <th className="p-3 text-center text-slate-500">Statut</th>
                <th className="p-3 text-center text-slate-500">Ménages</th>
                <th className="p-3 text-right text-slate-500">Attendu</th>
                <th className="p-3 text-right text-slate-500">Encaissé</th>
                <th className="p-3 text-center text-slate-500">Taux</th>
                <th className="p-3 text-center text-slate-500">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {campagnesFiltrees.map(c => {
                  const stats = statsMap[c.id] || { total: 0, nbPayes: 0, nbPartiels: 0 };
                  const attendu = c.montant * c.nb_concernes;
                  const taux = pct(stats.total, attendu);
                  const peutModif = stats.nbPayes === 0 && stats.nbPartiels === 0 && c.statut !== 'Archivée';
                  const calcOpt = CALCUL_OPTIONS.find(o => o.value === c.calcul_montant);
                  const dateFin = c.date_fin_exception || c.date_fin;
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
                        <p>{new Date(c.date_debut).toLocaleDateString('fr-FR')} →</p>
                        <p className={dateFin < new Date().toISOString().split('T')[0] ? 'text-red-500 font-semibold' : ''}>
                          {new Date(dateFin).toLocaleDateString('fr-FR')}
                          {c.date_fin_exception && <span className="ml-1 text-amber-500 text-[10px]">↻</span>}
                        </p>
                      </td>
                      <td className="p-3 text-center"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_STYLE[c.statut] || 'bg-slate-100'}`}>{c.statut}</span></td>
                      <td className="p-3 text-center">
                        <span className="text-slate-700 font-semibold">{c.nb_concernes}</span>
                        <span className="text-slate-300 mx-1">·</span>
                        <span className="text-emerald-600">{stats.nbPayes}✓</span>
                        {stats.nbPartiels > 0 && <><span className="text-slate-300 mx-1">·</span><span className="text-amber-500">{stats.nbPartiels}~</span></>}
                      </td>
                      <td className="p-3 text-right text-slate-600">{fmt(attendu)}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">{fmt(stats.total)}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <div className="w-10 bg-slate-100 rounded-full h-1.5"><div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, taux)}%` }} /></div>
                          <span className={`font-bold text-[10px] ${taux >= 100 ? 'text-emerald-600' : taux >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{taux}%</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-0.5 justify-center">
                          <button onClick={() => setViewCampagne(c)} title="Voir le détail / Suivi par ménage" className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600"><Eye className="h-3.5 w-3.5" /></button>
                          {c.statut === 'Active' && <button onClick={() => setPaiementCampagne(c)} title="Enregistrer un paiement" className="p-1.5 hover:bg-emerald-50 rounded-lg text-slate-400 hover:text-emerald-600"><Wallet className="h-3.5 w-3.5" /></button>}
                          {peutModif && c.statut !== 'Terminée' && <button onClick={() => { setEditing(c); setShowForm(true); }} title="Modifier" className="p-1.5 hover:bg-amber-50 rounded-lg text-slate-400 hover:text-amber-600"><Edit2 className="h-3.5 w-3.5" /></button>}
                          {(c.statut === 'Terminée' || c.statut === 'Suspendue') && <button onClick={() => { setRelanceCampagne(c); setShowForm(true); }} title="Relancer" className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600"><RefreshCw className="h-3.5 w-3.5" /></button>}
                          {c.statut === 'Active' && <button onClick={() => changerStatut(c, 'Suspendue')} title="Suspendre" disabled={actionLoading !== null} className="p-1.5 hover:bg-amber-50 rounded-lg text-slate-400 hover:text-amber-600"><Pause className="h-3.5 w-3.5" /></button>}
                          {c.statut === 'Brouillon' && <button onClick={() => changerStatut(c, 'Active')} title="Activer" disabled={actionLoading !== null} className="p-1.5 hover:bg-emerald-50 rounded-lg text-slate-400 hover:text-emerald-600"><Play className="h-3.5 w-3.5" /></button>}
                          {(c.statut === 'Active' || c.statut === 'Suspendue') && <button onClick={() => changerStatut(c, 'Terminée')} title="Terminer" disabled={actionLoading !== null} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500"><XCircle className="h-3.5 w-3.5" /></button>}
                          {c.statut === 'Terminée' && <button onClick={() => changerStatut(c, 'Archivée')} title="Archiver" disabled={actionLoading !== null} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"><Archive className="h-3.5 w-3.5" /></button>}
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

      {showForm && <FormulaireModal campagne={relanceCampagne || editing} foyers={foyers} membres={membres} modeRelance={!!relanceCampagne} onClose={() => { setShowForm(false); setEditing(undefined); setRelanceCampagne(undefined); }} onSave={load} />}
      {viewCampagne && <DetailCampagne campagne={viewCampagne} foyers={foyers} membres={membres} onClose={() => setViewCampagne(null)} />}
      {paiementCampagne && <ModalePaiement campagne={paiementCampagne} foyers={foyers} membres={membres} onClose={() => setPaiementCampagne(null)} />}
    </div>
  );
}
