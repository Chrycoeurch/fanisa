import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Foyer, Membre } from '../types';
import {
  Wallet, TrendingUp, TrendingDown, Receipt, Users,
  Settings, Save, Loader2, CheckCircle, AlertCircle,
  Gift, BarChart2, ChevronLeft, ChevronRight,
  Search, Calendar, Trash2, ArrowUpCircle, ArrowDownCircle, Filter
} from 'lucide-react';

interface Props { foyers: Foyer[]; membres: Membre[]; }

const fmt = (n: number) => new Intl.NumberFormat('fr-MG').format(n) + ' Ar';
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const ANNEE_COURANTE = new Date().getFullYear();
const MOIS_COURANT = new Date().getMonth() + 1;
const PAGE_SIZE = 10;

const DOCS_TARIFS = [
  { code: 'CR',  label: 'Certificat de Résidence',        key: 'tarif_cr'  },
  { code: 'CVI', label: 'Certificat de Vie Individuelle',  key: 'tarif_cvi' },
  { code: 'CVC', label: 'Certificat de Vie Collective',    key: 'tarif_cvc' },
  { code: 'CEL', label: 'Certificat de Célibat',           key: 'tarif_cel' },
  { code: 'BC',  label: 'Bonne Conduite',                  key: 'tarif_bc'  },
  { code: 'FAS', label: 'Attestation de Travail',          key: 'tarif_fas' },
  { code: 'FFD', label: 'Déclaration de Décès',            key: 'tarif_ffd' },
  { code: 'PCG', label: 'Prise en Charge et Garde',        key: 'tarif_pcg' },
  { code: 'CM',  label: 'Composition du Ménage',           key: 'tarif_cm'  },
  { code: 'FM',  label: 'Fiche Ménage',                    key: 'tarif_fm'  },
  { code: 'JOR', label: 'JOROLAVA',                        key: 'tarif_jor' },
  { code: 'COT', label: "Certificat d'Occupation Terrain", key: 'tarif_cot' },
  { code: 'ADF', label: 'Attestation Détention Foncière',  key: 'tarif_adf' },
  { code: 'APB', label: 'Attestation Propriété Bâtiment',  key: 'tarif_apb' },
  { code: 'AMV', label: 'Attestation Mise en Valeur',      key: 'tarif_amv' },
  { code: 'FP',  label: 'Fiche Parcellaire',               key: 'tarif_fp'  },
  { code: 'FB',  label: 'Fiche Bâtiment',                  key: 'tarif_fb'  },
  { code: 'DRF', label: 'Demande Régularisation Foncière', key: 'tarif_drf' },
  { code: 'IFT', label: 'Ticket IFT',                      key: 'tarif_ift' },
];

type SubMenu = 'dashboard' | 'cotisations' | 'historique' | 'depenses' | 'dons' | 'parametres';

export default function FinancesModule({ foyers, membres }: Props) {
  const [subMenu, setSubMenu] = useState<SubMenu>('dashboard');
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const [encaissements, setEncaissements] = useState<any[]>([]);
  const [cotisations, setCotisations] = useState<any[]>([]);
  const [depenses, setDepenses] = useState<any[]>([]);
  const [dons, setDons] = useState<any[]>([]);

  // Cotisations
  const [anneeSelCot, setAnneeSelCot] = useState(ANNEE_COURANTE);
  const [anneeInputCot, setAnneeInputCot] = useState(String(ANNEE_COURANTE));
  const [savingCot, setSavingCot] = useState<string | null>(null);
  const [searchCot, setSearchCot] = useState('');
  const [filtreCot, setFiltreCot] = useState<'tous' | 'payes' | 'non_payes'>('tous');

  // Historique
  const [pageEnc, setPageEnc] = useState(1);
  const [pageDep, setPageDep] = useState(1);
  const [dateDebutEnc, setDateDebutEnc] = useState('');
  const [dateFinEnc, setDateFinEnc] = useState('');
  const [dateDebutDep, setDateDebutDep] = useState('');
  const [dateFinDep, setDateFinDep] = useState('');

  // Dépenses
  const [newDep, setNewDep] = useState({ categorie: '', description: '', montant: '', beneficiaire: '' });
  const [savingDep, setSavingDep] = useState(false);
  const CATEGORIES_DEP = ['Fournitures administratives', 'Entretien des locaux', 'Sécurité', 'Carburant', 'Manifestations communautaires', 'Aides d\'urgence', 'Autres'];

  // Dons
  const [newDon, setNewDon] = useState({ source: '', description: '', montant: '', affectation: '' });
  const [savingDon, setSavingDon] = useState(false);
  const SOURCES_DON = ['Commune', 'District', 'Région', 'ONG', 'Association', 'Particulier', 'Autre'];

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [cfg, enc, cot, dep, don] = await Promise.all([
      supabase.from('config_finances').select('*').single(),
      supabase.from('encaissements').select('*').order('created_at', { ascending: false }),
      supabase.from('cotisations').select('*'),
      supabase.from('depenses').select('*').order('created_at', { ascending: false }),
      supabase.from('dons').select('*').order('date_reception', { ascending: false }),
    ]);
    setConfig(cfg.data || {});
    setEncaissements(enc.data || []);
    setCotisations(cot.data || []);
    setDepenses(dep.data || []);
    setDons(don.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Calculs ───────────────────────────────────────────────
  const totalRecettes  = encaissements.reduce((s, e) => s + (e.montant_total || 0), 0);
  const totalDep       = depenses.reduce((s, d) => s + (d.montant || 0), 0);
  const totalDons      = dons.filter(d => typeof d.montant === 'number').reduce((s, d) => s + (d.montant || 0), 0);
  const solde          = (config.solde_initial || 0) + totalRecettes + totalDons - totalDep;
  const today          = new Date().toISOString().split('T')[0];
  const recettesJour   = encaissements.filter(e => e.created_at?.startsWith(today)).reduce((s, e) => s + (e.montant_total || 0), 0);
  const depJour        = depenses.filter(d => d.created_at?.startsWith(today)).reduce((s, d) => s + (d.montant || 0), 0);

  // À jour = a payé le mois EN COURS de l'année en cours
  const periodeActuelle = `${MOIS[MOIS_COURANT - 1]} ${ANNEE_COURANTE}`;
  const foyersAJourSet  = new Set(cotisations.filter(c => c.periode === periodeActuelle && c.statut === 'À jour').map(c => c.foyer_id));
  const nbAJour         = foyersAJourSet.size;
  const nbEnRetard      = foyers.length - nbAJour;

  // Cotisations payées cette année (pour stats)
  const cotAnnee = cotisations.filter(c => c.periode?.includes(ANNEE_COURANTE.toString()) && c.statut === 'À jour');
  const totalCotAnnee = cotAnnee.reduce((s, c) => s + (c.montant_paye || 0), 0);

  // ── Grille cotisations ────────────────────────────────────
  const getCotStatut = (foyerId: string, moisNum: number) => {
    const periode = `${MOIS[moisNum - 1]} ${anneeSelCot}`;
    return cotisations.find(c => c.foyer_id === foyerId && c.periode === periode && c.statut === 'À jour')
      ? 'paye' : 'non_paye';
  };

  // Nombre de mois payés dans l'année sélectionnée pour un foyer
  const getNbPayesAnnee = (foyerId: string) =>
    MOIS.filter((_, mi) => getCotStatut(foyerId, mi + 1) === 'paye').length;

  // Reste à payer = mois passés + mois courant non payés × tarif
  const getResteAPayer = (foyerId: string) => {
    const tarifMois = config.cotisation_mensuelle || 5000;
    const moisPasses = anneeSelCot < ANNEE_COURANTE ? 12
      : anneeSelCot === ANNEE_COURANTE ? MOIS_COURANT
      : 0;
    const nonPayes = MOIS.slice(0, moisPasses).filter((_, mi) => getCotStatut(foyerId, mi + 1) === 'non_paye').length;
    return nonPayes * tarifMois;
  };

  // Filtre foyers selon filtreCot (basé sur mois courant)
  const foyersFiltreCot = foyers.filter(f => {
    if (filtreCot === 'payes')     return foyersAJourSet.has(f.id);
    if (filtreCot === 'non_payes') return !foyersAJourSet.has(f.id);
    return true;
  }).filter(f => {
    if (!searchCot) return true;
    const q = searchCot.toLowerCase();
    const chef = membres.find(m => m.foyer_id === f.id && m.is_chef);
    return f.code_menage.toLowerCase().includes(q) || (chef ? `${chef.nom} ${chef.prenom}`.toLowerCase().includes(q) : false);
  });

  const printRecuCot = (foyer: Foyer, moisNum: number, annee: number, montant: number, ref: string) => {
    const chef = membres.find(m => m.foyer_id === foyer.id && m.is_chef);
    const periode = `${MOIS[moisNum - 1]} ${annee}`;
    const w = window.open('', '_blank', 'width=400,height=500');
    if (!w) return;
    w.document.write(`<html><head><title>Reçu</title><style>body{font-family:monospace;font-size:12px;margin:20px;max-width:320px}.t{font-size:16px;font-weight:bold;text-align:center}.s{text-align:center;font-size:11px;margin-bottom:12px}hr{border:1px dashed #000;margin:8px 0}.r{display:flex;justify-content:space-between;margin:4px 0}.tot{font-weight:bold;font-size:14px;border-top:2px solid #000;padding-top:8px;margin-top:8px}.f{text-align:center;margin-top:16px;font-size:10px}</style></head><body>`);
    w.document.write(`<div class="t">FOKONTANY FANISA</div><div class="s">REÇU DE COTISATION</div><hr>`);
    w.document.write(`<div class="r"><span>Réf.:</span><span>${ref}</span></div>`);
    w.document.write(`<div class="r"><span>Date:</span><span>${new Date().toLocaleDateString('fr-FR')}</span></div>`);
    w.document.write(`<div class="r"><span>Ménage:</span><span>${foyer.code_menage}</span></div>`);
    if (chef) w.document.write(`<div class="r"><span>Chef:</span><span>${chef.nom} ${chef.prenom}</span></div>`);
    w.document.write(`<hr><div class="r"><span>Cotisation — ${periode}</span><span>${new Intl.NumberFormat('fr-MG').format(montant)} Ar</span></div>`);
    w.document.write(`<div class="tot"><div class="r"><span>TOTAL</span><span>${new Intl.NumberFormat('fr-MG').format(montant)} Ar</span></div></div>`);
    w.document.write(`<div class="f">Généré automatiquement par FANISA<br>Merci pour votre paiement</div></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const handleCocherCot = async (foyer: Foyer, moisNum: number) => {
    const periode = `${MOIS[moisNum - 1]} ${anneeSelCot}`;
    const key = `${foyer.id}-${periode}`;
    if (savingCot === key) return;
    setSavingCot(key);
    const montant = config.cotisation_mensuelle || 5000;
    const annee = new Date().getFullYear();
    const { data: last } = await supabase.from('encaissements').select('reference').like('reference', `${config.prefixe_recu || 'REC'}-${annee}-%`).order('created_at', { ascending: false }).limit(1);
    const num = last?.[0]?.reference ? parseInt(last[0].reference.split('-').pop() || '0') + 1 : 1;
    const ref = `${config.prefixe_recu || 'REC'}-${annee}-${String(num).padStart(4, '0')}`;
    const chef = membres.find(m => m.foyer_id === foyer.id && m.is_chef);
    const { data: enc } = await supabase.from('encaissements').insert({
      reference: ref, foyer_id: foyer.id,
      nom_beneficiaire: chef ? `${chef.nom} ${chef.prenom}` : foyer.code_menage,
      code_menage: foyer.code_menage, montant_total: montant,
      mode_paiement: 'Espèces', agent: 'Agent Fokontany',
    }).select().single();
    if (enc) {
      await supabase.from('encaissement_lignes').insert({ encaissement_id: enc.id, categorie: 'Cotisation', description: 'Cotisation Mensuelle', montant, periode });
      await supabase.from('cotisations').insert({ foyer_id: foyer.id, encaissement_id: enc.id, type_cotisation: 'Mensuelle', periode, montant_du: montant, montant_paye: montant, statut: 'À jour', date_paiement: new Date().toISOString() });
      printRecuCot(foyer, moisNum, anneeSelCot, montant, ref);
      await loadAll();
    }
    setSavingCot(null);
  };

  const handleDecocherCot = async (foyer: Foyer, moisNum: number) => {
    const periode = `${MOIS[moisNum - 1]} ${anneeSelCot}`;
    if (!confirm(`Annuler le paiement de ${periode} pour ${foyer.code_menage} ?`)) return;
    const cot = cotisations.find(c => c.foyer_id === foyer.id && c.periode === periode);
    if (cot?.encaissement_id) {
      await supabase.from('encaissement_lignes').delete().eq('encaissement_id', cot.encaissement_id);
      await supabase.from('encaissements').delete().eq('id', cot.encaissement_id);
    }
    await supabase.from('cotisations').delete().eq('foyer_id', foyer.id).eq('periode', periode);
    await loadAll();
  };

  // Supprimer encaissement/dépense
  const deleteEncaissement = async (id: string) => {
    if (!confirm('Supprimer cet encaissement ?')) return;
    await supabase.from('encaissement_lignes').delete().eq('encaissement_id', id);
    await supabase.from('cotisations').update({ encaissement_id: null }).eq('encaissement_id', id);
    await supabase.from('encaissements').delete().eq('id', id);
    await loadAll();
  };

  const deleteDepense = async (id: string) => {
    if (!confirm('Supprimer cette dépense ?')) return;
    await supabase.from('depenses').delete().eq('id', id);
    await loadAll();
  };

  // Historique filtré + paginé
  const filteredEnc = encaissements.filter(e => {
    if (dateDebutEnc && e.created_at < dateDebutEnc) return false;
    if (dateFinEnc && e.created_at > dateFinEnc + 'T23:59:59') return false;
    return true;
  });
  const filteredDep = depenses.filter(d => {
    if (dateDebutDep && d.created_at < dateDebutDep) return false;
    if (dateFinDep && d.created_at > dateFinDep + 'T23:59:59') return false;
    return true;
  });
  const encPage = filteredEnc.slice((pageEnc - 1) * PAGE_SIZE, pageEnc * PAGE_SIZE);
  const depPage = filteredDep.slice((pageDep - 1) * PAGE_SIZE, pageDep * PAGE_SIZE);
  const totalPagesEnc = Math.max(1, Math.ceil(filteredEnc.length / PAGE_SIZE));
  const totalPagesDep = Math.max(1, Math.ceil(filteredDep.length / PAGE_SIZE));

  const Pagination = ({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) =>
    total > 1 ? (
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
        <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Précédent</button>
        <span className="text-xs text-slate-500">Page {page} / {total}</span>
        <button onClick={() => onPage(Math.min(total, page + 1))} disabled={page === total} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-40">Suivant<ChevronRight className="h-4 w-4" /></button>
      </div>
    ) : null;

  const DateFilter = ({ debut, fin, onDebut, onFin, total, totalMontant, label }: any) => (
    <div className="flex items-center gap-3 flex-wrap bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 mb-3">
      <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
      <input type="date" value={debut} onChange={e => { onDebut(e.target.value); }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-400" />
      <span className="text-xs text-slate-400">→</span>
      <input type="date" value={fin} onChange={e => { onFin(e.target.value); }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-400" />
      {(debut || fin) && <button onClick={() => { onDebut(''); onFin(''); }} className="text-xs text-slate-400 hover:text-red-500 font-semibold">✕</button>}
      <span className="ml-auto text-xs text-slate-500"><strong>{total}</strong> {label} · <strong className="text-slate-800">{fmt(totalMontant)}</strong></span>
    </div>
  );

  const handleSaveDep = async () => {
    if (!newDep.categorie || !newDep.montant) { alert('Catégorie et montant requis.'); return; }
    setSavingDep(true);
    const annee = new Date().getFullYear();
    const { data: last } = await supabase.from('depenses').select('reference').like('reference', `DEP-${annee}-%`).order('created_at', { ascending: false }).limit(1);
    const num = last?.[0]?.reference ? parseInt(last[0].reference.split('-').pop() || '0') + 1 : 1;
    await supabase.from('depenses').insert({ ...newDep, reference: `DEP-${annee}-${String(num).padStart(4, '0')}`, montant: parseFloat(newDep.montant) });
    setNewDep({ categorie: '', description: '', montant: '', beneficiaire: '' });
    setSavingDep(false);
    loadAll();
  };

  const handleSaveDon = async () => {
    if (!newDon.source) { alert('Source requise.'); return; }
    setSavingDon(true);
    await supabase.from('dons').insert({ ...newDon, montant: newDon.montant ? parseFloat(newDon.montant) : null, type_don: 'Financier' });
    setNewDon({ source: '', description: '', montant: '', affectation: '' });
    setSavingDon(false);
    loadAll();
  };

  const MENUS: { key: SubMenu; label: string; icon: any }[] = [
    { key: 'dashboard',   label: 'Tableau de bord', icon: BarChart2 },
    { key: 'cotisations', label: 'Cotisations',     icon: Users },
    { key: 'historique',  label: 'Historique',      icon: Receipt },
    { key: 'depenses',    label: 'Dépenses',        icon: TrendingDown },
    { key: 'dons',        label: 'Dons',            icon: Gift },
    { key: 'parametres',  label: 'Paramètres',      icon: Settings },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-600 p-2.5 rounded-xl"><Wallet className="h-5 w-5 text-white" /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Finances & Cotisations</h2>
              <p className="text-xs text-slate-500">Gestion financière du Fokontany</p>
            </div>
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {MENUS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setSubMenu(key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${subMenu === key ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="text-center py-16"><Loader2 className="h-8 w-8 text-green-600 animate-spin mx-auto" /></div> : <>

      {/* ── TABLEAU DE BORD ── */}
      {subMenu === 'dashboard' && (
        <div className="space-y-4">
          {/* Solde — le plus important */}
          <div className={`rounded-2xl p-6 text-white flex items-center justify-between ${solde >= 0 ? 'bg-gradient-to-br from-emerald-600 to-emerald-700' : 'bg-gradient-to-br from-red-600 to-red-700'}`}>
            <div>
              <p className="text-xs opacity-70 font-bold uppercase tracking-widest mb-1">Solde de caisse</p>
              <p className="text-5xl font-black tracking-tight">{fmt(Math.abs(solde))}</p>
              <p className="text-sm opacity-70 mt-2">{solde >= 0 ? '✅ Excédentaire' : '⚠ Déficitaire'}</p>
            </div>
            <div className="text-right text-sm space-y-1 opacity-70">
              <p>Initial : {fmt(config.solde_initial || 0)}</p>
              <p>+ Recettes : {fmt(totalRecettes)}</p>
              <p>+ Dons : {fmt(totalDons)}</p>
              <p>− Dépenses : {fmt(totalDep)}</p>
            </div>
          </div>

          {/* Cards financières */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><ArrowUpCircle className="h-4 w-4 text-green-500" /><span className="text-xs font-bold text-slate-500 uppercase">Recettes du jour</span></div>
              <p className="text-xl font-black text-green-600">{fmt(recettesJour)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{new Date().toLocaleDateString('fr-FR')}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><ArrowDownCircle className="h-4 w-4 text-red-500" /><span className="text-xs font-bold text-slate-500 uppercase">Dépenses du jour</span></div>
              <p className="text-xl font-black text-red-600">{fmt(depJour)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{new Date().toLocaleDateString('fr-FR')}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-indigo-500" /><span className="text-xs font-bold text-slate-500 uppercase">Total recettes</span></div>
              <p className="text-xl font-black text-indigo-600">{fmt(totalRecettes)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{encaissements.length} encaissements</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><TrendingDown className="h-4 w-4 text-amber-500" /><span className="text-xs font-bold text-slate-500 uppercase">Total dépenses</span></div>
              <p className="text-xl font-black text-amber-600">{fmt(totalDep)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{depenses.length} dépenses</p>
            </div>
          </div>

          {/* Cards cotisations mois courant */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-5 flex items-center gap-4">
              <div className="bg-emerald-500 p-3 rounded-xl"><CheckCircle className="h-6 w-6 text-white" /></div>
              <div>
                <p className="text-3xl font-black text-emerald-700">{nbAJour}</p>
                <p className="text-sm font-bold text-emerald-600">Payé ce mois</p>
                <p className="text-xs text-emerald-500">{MOIS[MOIS_COURANT - 1]} {ANNEE_COURANTE}</p>
              </div>
            </div>
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5 flex items-center gap-4">
              <div className="bg-red-400 p-3 rounded-xl"><AlertCircle className="h-6 w-6 text-white" /></div>
              <div>
                <p className="text-3xl font-black text-red-600">{nbEnRetard}</p>
                <p className="text-sm font-bold text-red-500">Non payé ce mois</p>
                <p className="text-xs text-red-400">sur {foyers.length} ménages</p>
              </div>
            </div>
          </div>

          {/* Ménages non payés ce mois */}
          {nbEnRetard > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-red-600 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />Non payé — {MOIS[MOIS_COURANT - 1]} {ANNEE_COURANTE}
                </h3>
                <button onClick={() => { setFiltreCot('non_payes'); setAnneeSelCot(ANNEE_COURANTE); setSubMenu('cotisations'); }} className="text-xs text-green-600 font-semibold hover:underline">Gérer →</button>
              </div>
              <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto">
                {foyers.filter(f => !foyersAJourSet.has(f.id)).slice(0, 15).map(f => {
                  const chef = membres.find(m => m.foyer_id === f.id && m.is_chef);
                  return (
                    <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-red-50">
                      <span className="font-mono font-bold text-indigo-600 text-xs w-20 shrink-0">{f.code_menage}</span>
                      <span className="text-sm text-slate-700 flex-1">{chef ? `${chef.nom} ${chef.prenom}` : f.adresse || '—'}</span>
                      <span className="text-xs text-red-500 font-semibold shrink-0">{fmt(config.cotisation_mensuelle || 5000)}</span>
                    </div>
                  );
                })}
                {nbEnRetard > 15 && <p className="text-center text-xs text-slate-400 py-2">+{nbEnRetard - 15} autres</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── COTISATIONS ── */}
      {subMenu === 'cotisations' && (
        <div className="space-y-4">
          {/* Barre de contrôle */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
            {/* Sélecteur année libre */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Année :</span>
              <input
                type="number"
                value={anneeInputCot}
                onChange={e => setAnneeInputCot(e.target.value)}
                onBlur={() => {
                  const y = parseInt(anneeInputCot);
                  if (y >= 2020 && y <= 2099) setAnneeSelCot(y);
                  else setAnneeInputCot(String(anneeSelCot));
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const y = parseInt(anneeInputCot);
                    if (y >= 2020 && y <= 2099) setAnneeSelCot(y);
                  }
                }}
                className="w-20 border-2 border-green-400 rounded-lg px-2 py-1.5 text-sm font-bold text-center outline-none focus:border-green-600"
                min={2020} max={2099}
              />
              <div className="flex gap-1">
                <button onClick={() => { const y = anneeSelCot - 1; setAnneeSelCot(y); setAnneeInputCot(String(y)); }} className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold text-slate-600">‹</button>
                <button onClick={() => { setAnneeSelCot(ANNEE_COURANTE); setAnneeInputCot(String(ANNEE_COURANTE)); }} className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-600">Auj.</button>
                <button onClick={() => { const y = anneeSelCot + 1; setAnneeSelCot(y); setAnneeInputCot(String(y)); }} className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold text-slate-600">›</button>
              </div>
            </div>

            {/* Filtre payé / non payé */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              {([['tous', 'Tous', 'slate'], ['payes', '✅ Payé', 'green'], ['non_payes', '❌ Non payé', 'red']] as [string, string, string][]).map(([val, label, color]) => (
                <button key={val} onClick={() => setFiltreCot(val as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filtreCot === val
                    ? color === 'green' ? 'bg-emerald-600 text-white'
                    : color === 'red' ? 'bg-red-500 text-white'
                    : 'bg-white text-slate-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'}`}>
                  {label} {val === 'non_payes' ? `(${nbEnRetard})` : val === 'payes' ? `(${nbAJour})` : `(${foyers.length})`}
                </button>
              ))}
            </div>

            {/* Recherche */}
            <div className="flex-1 min-w-44 relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input value={searchCot} onChange={e => setSearchCot(e.target.value)} placeholder="Rechercher foyer..." className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-green-500" />
            </div>

            <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-emerald-500 inline-block" />Payé (clic = annuler)</span>
              <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-slate-100 border inline-block" />+ encaisser</span>
              <span className="font-bold text-slate-700">{fmt(config.cotisation_mensuelle || 5000)}/mois</span>
            </div>
          </div>

          {/* Grille */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-auto">
            <table className="w-full text-xs min-w-[1050px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-800">
                  <th className="p-3 text-left text-white sticky left-0 bg-slate-800 z-20 min-w-48">Ménage / Chef</th>
                  {MOIS.map((m, i) => (
                    <th key={m} className={`p-2 text-center text-white min-w-14 text-[11px] ${i + 1 === MOIS_COURANT && anneeSelCot === ANNEE_COURANTE ? 'text-emerald-300 bg-slate-700' : ''}`}>
                      {m.slice(0, 3)}{i + 1 === MOIS_COURANT && anneeSelCot === ANNEE_COURANTE ? '●' : ''}
                    </th>
                  ))}
                  <th className="p-2 text-center text-white min-w-16 text-[11px]">Payés</th>
                  <th className="p-2 text-center text-emerald-300 min-w-28 text-[11px]">Reste à payer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {foyersFiltreCot.length === 0 ? (
                  <tr><td colSpan={16} className="text-center text-slate-400 py-10">Aucun foyer {filtreCot === 'payes' ? 'payé' : filtreCot === 'non_payes' ? 'en retard' : ''}</td></tr>
                ) : foyersFiltreCot.map((foyer, fi) => {
                  const chef = membres.find(m => m.foyer_id === foyer.id && m.is_chef);
                  const nbPayes = getNbPayesAnnee(foyer.id);
                  const reste = getResteAPayer(foyer.id);
                  const estAJourCeMois = anneeSelCot === ANNEE_COURANTE && getCotStatut(foyer.id, MOIS_COURANT) === 'paye';
                  return (
                    <tr key={foyer.id} className={fi % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/40 hover:bg-slate-50'}>
                      <td className={`p-3 sticky left-0 z-10 border-r border-slate-100 ${fi % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-mono font-bold text-indigo-600 text-xs">{foyer.code_menage}</p>
                            <p className="text-slate-600 text-[11px] truncate">{chef ? `${chef.nom} ${chef.prenom}` : '—'}</p>
                          </div>
                          {anneeSelCot === ANNEE_COURANTE && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${estAJourCeMois ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                              {estAJourCeMois ? '✓' : '!'}
                            </span>
                          )}
                        </div>
                      </td>
                      {MOIS.map((moisNom, mi) => {
                        const moisNum = mi + 1;
                        const statut = getCotStatut(foyer.id, moisNum);
                        const key = `${foyer.id}-${moisNom} ${anneeSelCot}`;
                        const isSaving = savingCot === key;
                        const isFutur = anneeSelCot > ANNEE_COURANTE || (anneeSelCot === ANNEE_COURANTE && moisNum > MOIS_COURANT);
                        const isMoisCourant = anneeSelCot === ANNEE_COURANTE && moisNum === MOIS_COURANT;
                        return (
                          <td key={moisNom} className={`p-1 text-center ${isMoisCourant ? 'bg-emerald-50/60' : ''}`}>
                            {isFutur ? (
                              <span className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 inline-flex items-center justify-center text-slate-200 text-[10px]">—</span>
                            ) : isSaving ? (
                              <span className="w-8 h-8 rounded-lg bg-emerald-100 inline-flex items-center justify-center">
                                <Loader2 className="h-4 w-4 text-emerald-500 animate-spin" />
                              </span>
                            ) : statut === 'paye' ? (
                              <button onClick={() => handleDecocherCot(foyer, moisNum)} title="Annuler" className="w-8 h-8 rounded-lg bg-emerald-500 hover:bg-red-400 inline-flex items-center justify-center transition">
                                <CheckCircle className="h-4 w-4 text-white" />
                              </button>
                            ) : (
                              <button onClick={() => handleCocherCot(foyer, moisNum)} title="Encaisser" className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition border ${isMoisCourant ? 'bg-emerald-100 border-emerald-300 hover:bg-emerald-500 hover:border-emerald-500' : 'bg-slate-100 border-slate-200 hover:bg-emerald-100 hover:border-emerald-300'}`}>
                                <span className={`font-bold text-sm leading-none ${isMoisCourant ? 'text-emerald-600' : 'text-slate-400'}`}>+</span>
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-2 text-center">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${nbPayes === 12 ? 'bg-emerald-100 text-emerald-700' : nbPayes > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>{nbPayes}/12</span>
                      </td>
                      <td className="p-2 text-center">
                        {reste > 0 ? (
                          <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">{fmt(reste)}</span>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0">
                <tr className="bg-slate-700">
                  <td className="p-3 text-white font-bold text-xs sticky left-0 bg-slate-700">Total payés</td>
                  {MOIS.map((moisNom, mi) => {
                    const count = foyers.filter(f => getCotStatut(f.id, mi + 1) === 'paye').length;
                    return <td key={moisNom} className="p-2 text-center"><span className={`text-xs font-bold ${count > 0 ? 'text-emerald-300' : 'text-slate-500'}`}>{count}</span></td>;
                  })}
                  <td className="p-2 text-center text-emerald-300 font-bold text-xs">{nbAJour}/{foyers.length}</td>
                  <td className="p-2 text-center text-red-300 font-bold text-xs">{fmt(foyersCotAll => foyersCotAll)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── HISTORIQUE ── */}
      {subMenu === 'historique' && (
        <div className="space-y-5">
          {/* Encaissements */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-green-700 flex items-center gap-2 mb-3"><ArrowUpCircle className="h-4 w-4" />Encaissements ({encaissements.length})</h3>
              <DateFilter debut={dateDebutEnc} fin={dateFinEnc} onDebut={(v: string) => { setDateDebutEnc(v); setPageEnc(1); }} onFin={(v: string) => { setDateFinEnc(v); setPageEnc(1); }} total={filteredEnc.length} totalMontant={filteredEnc.reduce((s, e) => s + (e.montant_total || 0), 0)} label="encaissement(s)" />
            </div>
            <table className="w-full text-xs">
              <thead><tr className="bg-slate-50 border-b"><th className="p-3 text-left text-slate-500">Référence</th><th className="p-3 text-left text-slate-500">Ménage</th><th className="p-3 text-left text-slate-500">Bénéficiaire</th><th className="p-3 text-right text-slate-500">Montant</th><th className="p-3 text-left text-slate-500">Mode</th><th className="p-3 text-left text-slate-500">Date</th><th className="p-3 text-center text-slate-500">⋯</th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {encPage.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-green-600 font-semibold">{e.reference}</td>
                    <td className="p-3 font-mono text-indigo-600">{e.code_menage}</td>
                    <td className="p-3 text-slate-700">{e.nom_beneficiaire}</td>
                    <td className="p-3 text-right font-bold text-green-700">{fmt(e.montant_total)}</td>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${e.mode_paiement === 'Espèces' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{e.mode_paiement}</span></td>
                    <td className="p-3 text-slate-400">{new Date(e.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="p-3 text-center"><button onClick={() => deleteEncaissement(e.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 transition"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
                {encPage.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-8">Aucun encaissement</td></tr>}
              </tbody>
            </table>
            <Pagination page={pageEnc} total={totalPagesEnc} onPage={setPageEnc} />
          </div>

          {/* Dépenses */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-red-600 flex items-center gap-2 mb-3"><ArrowDownCircle className="h-4 w-4" />Dépenses ({depenses.length})</h3>
              <DateFilter debut={dateDebutDep} fin={dateFinDep} onDebut={(v: string) => { setDateDebutDep(v); setPageDep(1); }} onFin={(v: string) => { setDateFinDep(v); setPageDep(1); }} total={filteredDep.length} totalMontant={filteredDep.reduce((s, d) => s + (d.montant || 0), 0)} label="dépense(s)" />
            </div>
            <table className="w-full text-xs">
              <thead><tr className="bg-slate-50 border-b"><th className="p-3 text-left text-slate-500">Référence</th><th className="p-3 text-left text-slate-500">Catégorie</th><th className="p-3 text-left text-slate-500">Description</th><th className="p-3 text-left text-slate-500">Bénéficiaire</th><th className="p-3 text-right text-slate-500">Montant</th><th className="p-3 text-left text-slate-500">Date</th><th className="p-3 text-center text-slate-500">⋯</th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {depPage.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-red-500">{d.reference}</td>
                    <td className="p-3 text-slate-600">{d.categorie}</td>
                    <td className="p-3 text-slate-700">{d.description}</td>
                    <td className="p-3 text-slate-500">{d.beneficiaire}</td>
                    <td className="p-3 text-right font-bold text-red-700">{fmt(d.montant)}</td>
                    <td className="p-3 text-slate-400">{new Date(d.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="p-3 text-center"><button onClick={() => deleteDepense(d.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 transition"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
                {depPage.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-8">Aucune dépense</td></tr>}
              </tbody>
            </table>
            <Pagination page={pageDep} total={totalPagesDep} onPage={setPageDep} />
          </div>
        </div>
      )}

      {/* ── DÉPENSES (formulaire) ── */}
      {subMenu === 'depenses' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2"><ArrowDownCircle className="h-5 w-5 text-red-500" />Enregistrer une dépense</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Catégorie *</label>
              <select value={newDep.categorie} onChange={e => setNewDep(p => ({ ...p, categorie: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-red-400">
                <option value="">Choisir...</option>
                {CATEGORIES_DEP.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Montant (Ar) *</label>
              <input type="number" value={newDep.montant} onChange={e => setNewDep(p => ({ ...p, montant: e.target.value }))} placeholder="Ex: 25000" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-red-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Description</label>
              <input value={newDep.description} onChange={e => setNewDep(p => ({ ...p, description: e.target.value }))} placeholder="Détail de la dépense..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-red-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Bénéficiaire</label>
              <input value={newDep.beneficiaire} onChange={e => setNewDep(p => ({ ...p, beneficiaire: e.target.value }))} placeholder="Nom du bénéficiaire..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-red-400" />
            </div>
          </div>
          <button onClick={handleSaveDep} disabled={savingDep} className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
            {savingDep ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</> : <><Save className="h-4 w-4" />Enregistrer la dépense</>}
          </button>
          <p className="text-xs text-slate-400 text-center">La dépense sera visible dans l'onglet Historique</p>
        </div>
      )}

      {/* ── DONS ── */}
      {subMenu === 'dons' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-700">Enregistrer un don / subvention</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Source *</label>
                <select value={newDon.source} onChange={e => setNewDon(p => ({ ...p, source: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white outline-none">
                  <option value="">Choisir...</option>{SOURCES_DON.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Montant (Ar)</label>
                <input type="number" value={newDon.montant} onChange={e => setNewDon(p => ({ ...p, montant: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none" />
              </div>
              <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Description</label>
                <input value={newDon.description} onChange={e => setNewDon(p => ({ ...p, description: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none" />
              </div>
              <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Affectation</label>
                <input value={newDon.affectation} onChange={e => setNewDon(p => ({ ...p, affectation: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none" />
              </div>
            </div>
            <button onClick={handleSaveDon} disabled={savingDon} className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2">
              {savingDon ? <><Loader2 className="h-4 w-4 animate-spin" />…</> : <><Save className="h-4 w-4" />Enregistrer</>}
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">Dons ({dons.length})</h3>
              <span className="font-bold text-purple-600">{fmt(totalDons)}</span>
            </div>
            {dons.length === 0 ? <p className="text-center text-slate-400 py-8 text-sm">Aucun don.</p> : (
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-50 border-b"><th className="p-3 text-left text-slate-500">Source</th><th className="p-3 text-left text-slate-500">Description</th><th className="p-3 text-right text-slate-500">Montant</th><th className="p-3 text-left text-slate-500">Affectation</th><th className="p-3 text-left text-slate-500">Date</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {dons.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold">{d.source}</td>
                      <td className="p-3 text-slate-600">{d.description}</td>
                      <td className="p-3 text-right font-bold text-purple-700">{d.montant ? fmt(d.montant) : '—'}</td>
                      <td className="p-3 text-slate-500">{d.affectation || '—'}</td>
                      <td className="p-3 text-slate-400">{new Date(d.date_reception).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── PARAMÈTRES ── */}
      {subMenu === 'parametres' && (
        <div className="space-y-5">
          {/* Cotisations */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-700">💰 Cotisations</h3>
            <div className="grid grid-cols-3 gap-3">
              {[{k:'cotisation_mensuelle',l:'Mensuelle (Ar)'},{k:'cotisation_trimestrielle',l:'Trimestrielle (Ar)'},{k:'cotisation_annuelle',l:'Annuelle (Ar)'}].map(({k,l})=>(
                <div key={k}><label className="text-xs font-bold text-slate-500 uppercase block mb-1">{l}</label>
                  <input type="number" value={config[k]||''} onChange={e=>setConfig((p:any)=>({...p,[k]:parseFloat(e.target.value)}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-green-500" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Solde initial (Ar)</label>
                <input type="number" value={config.solde_initial||0} onChange={e=>setConfig((p:any)=>({...p,solde_initial:parseFloat(e.target.value)}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-green-500" />
              </div>
              <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Préfixe des reçus</label>
                <input value={config.prefixe_recu||'REC'} onChange={e=>setConfig((p:any)=>({...p,prefixe_recu:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none font-mono" />
              </div>
            </div>
          </div>

          {/* Tarifs des actes */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-700">📄 Tarifs des actes & documents</h3>
              <p className="text-xs text-slate-400 mt-0.5">Ces tarifs sont utilisés automatiquement lors de la génération des documents dans le module Actes.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {DOCS_TARIFS.map(d => (
                <div key={d.key} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    <span className="text-indigo-600 font-bold">[{d.code}]</span> {d.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={config[d.key] || ''}
                      onChange={e => setConfig((p: any) => ({ ...p, [d.key]: parseFloat(e.target.value) }))}
                      placeholder="2000"
                      className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-500 bg-white"
                    />
                    <span className="text-xs text-slate-400 shrink-0">Ar</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={async () => { await supabase.from('config_finances').update(config).eq('id', 1); alert('Configuration enregistrée !'); }} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
            <Save className="h-4 w-4" />Enregistrer toute la configuration
          </button>
        </div>
      )}
      </>}
    </div>
  );
}
