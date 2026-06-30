import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Foyer, Membre } from '../types';
import CaisseModule from './CaisseModule';
import {
  Wallet, TrendingUp, TrendingDown, Receipt, Users, Settings,
  Save, Loader2, CheckCircle, AlertCircle, Gift, BarChart2,
  ChevronLeft, ChevronRight, ChevronDown, Search, Calendar,
  Trash2, ArrowUpCircle, ArrowDownCircle, Clock, CreditCard
} from 'lucide-react';

interface Props { foyers: Foyer[]; membres: Membre[]; }

const fmt = (n: number) => new Intl.NumberFormat('fr-MG').format(Math.round(n)) + ' Ar';
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

type SubMenu = 'caisse' | 'cotisations' | 'historique' | 'depenses' | 'creances' | 'dons' | 'parametres';

export default function FinancesModule({ foyers, membres }: Props) {
  const [subMenu, setSubMenu] = useState<SubMenu>('caisse');
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const [transactionsCaisse, setTransactionsCaisse] = useState<any[]>([]);
  const [cotisations, setCotisations] = useState<any[]>([]);
  const [depenses, setDepenses] = useState<any[]>([]);
  const [creances, setCreances] = useState<any[]>([]);
  const [soldingId, setSoldingId] = useState<string | null>(null);
  const [dons, setDons] = useState<any[]>([]);

  // Dashboard filtre
  const [dashDebut, setDashDebut] = useState('');
  const [dashFin, setDashFin] = useState('');

  // Cotisations
  const [anneeSelCot, setAnneeSelCot] = useState(ANNEE_COURANTE);
  const [showAnneePicker, setShowAnneePicker] = useState(false);
  const [anneePickerBase, setAnneePickerBase] = useState(ANNEE_COURANTE - 3);
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
  const CATEGORIES_DEP = ['Fournitures administratives','Entretien des locaux','Sécurité','Carburant','Manifestations communautaires',"Aides d'urgence",'Autres'];

  // Dons
  const [newDon, setNewDon] = useState({ source: '', description: '', montant: '', affectation: '' });
  const [savingDon, setSavingDon] = useState(false);
  const SOURCES_DON = ['Commune','District','Région','ONG','Association','Particulier','Autre'];

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [cfg, tx, cot, dep, don, cre] = await Promise.all([
      supabase.from('config_finances').select('*').single(),
      supabase.from('transactions_caisse').select('*').order('created_at', { ascending: false }),
      supabase.from('cotisations').select('*'),
      supabase.from('depenses').select('*').order('created_at', { ascending: false }),
      supabase.from('dons').select('*').order('date_reception', { ascending: false }),
      supabase.from('creances').select('*').order('created_at', { ascending: false }),
    ]);
    setConfig(cfg.data || {});
    setTransactionsCaisse(tx.data || []);
    setCotisations(cot.data || []);
    setDepenses(dep.data || []);
    setDons(don.data || []);
    setCreances(cre.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!showAnneePicker) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-annee-picker]')) setShowAnneePicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAnneePicker]);

  // ── Calculs globaux ───────────────────────────────────────
  const transactionsValidees = transactionsCaisse.filter(t => t.statut === 'Validée');
  const totalRecettes = transactionsValidees.reduce((s, t) => s + (t.montant_total || 0), 0);
  const totalDep      = depenses.reduce((s, d) => s + (d.montant || 0), 0);
  const totalDons     = dons.reduce((s, d) => s + (typeof d.montant === 'number' ? d.montant : 0), 0);
  const solde         = (config.solde_initial || 0) + totalRecettes + totalDons - totalDep;

  const periodeActuelle = `${MOIS[MOIS_COURANT - 1]} ${ANNEE_COURANTE}`;
  const foyersAJourSet  = new Set(cotisations.filter(c => c.periode === periodeActuelle && c.statut === 'À jour').map(c => c.foyer_id));
  const nbAJour         = foyersAJourSet.size;
  const nbEnRetard      = foyers.length - nbAJour;

  // Total encaissé cotisations année courante
  const totalCotEncaisse = cotisations
    .filter(c => c.statut === 'À jour' && c.periode?.includes(String(ANNEE_COURANTE)))
    .reduce((s, c) => s + (c.montant_paye || 0), 0);
  // Total restant à payer (tous foyers, mois passés + courant non payés)
  const tarifMois = config.cotisation_mensuelle || 5000;
  const moisEcoules = MOIS_COURANT; // Jan=1 → Juin=6
  const totalCotDu = foyers.length * moisEcoules * tarifMois;
  const totalCotReste = Math.max(0, totalCotDu - totalCotEncaisse);

  // ── Calculs dashboard filtrés ─────────────────────────────
  const encFiltresDash = transactionsValidees.filter(t => {
    if (dashDebut && t.created_at < dashDebut) return false;
    if (dashFin && t.created_at > dashFin + 'T23:59:59') return false;
    return true;
  });
  const depFiltresDash = depenses.filter(d => {
    if (dashDebut && d.created_at < dashDebut) return false;
    if (dashFin && d.created_at > dashFin + 'T23:59:59') return false;
    return true;
  });
  const donsFiltresDash = dons.filter(d => {
    if (dashDebut && d.date_reception < dashDebut) return false;
    if (dashFin && d.date_reception > dashFin + 'T23:59:59') return false;
    return true;
  });
  const recettesFiltrees = encFiltresDash.reduce((s, t) => s + (t.montant_total || 0), 0);
  const depFiltrees      = depFiltresDash.reduce((s, d) => s + (d.montant || 0), 0);
  const donsMontant      = donsFiltresDash.reduce((s, d) => s + (typeof d.montant === 'number' ? d.montant : 0), 0);
  const hasFiltres       = !!(dashDebut || dashFin);
  const soldePeriode     = recettesFiltrees + donsMontant - depFiltrees;
  const labelPeriode     = hasFiltres
    ? `${dashDebut ? new Date(dashDebut + 'T00:00:00').toLocaleDateString('fr-FR') : '…'} → ${dashFin ? new Date(dashFin + 'T00:00:00').toLocaleDateString('fr-FR') : '…'}`
    : 'Toutes périodes';

  // ── Grille cotisations ────────────────────────────────────
  const getCotStatut = (foyerId: string, moisNum: number): 'paye' | 'en_attente' | 'non_paye' => {
    const periode = `${MOIS[moisNum - 1]} ${anneeSelCot}`;
    const cot = cotisations.find(c => c.foyer_id === foyerId && c.periode === periode);
    if (!cot) return 'non_paye';
    if (cot.statut === 'À jour') return 'paye';
    if (cot.statut === 'En attente de paiement') return 'en_attente';
    return 'non_paye';
  };

  const getNbPayesAnnee = (foyerId: string) =>
    MOIS.filter((_, mi) => getCotStatut(foyerId, mi + 1) === 'paye').length;

  const getResteAPayer = (foyerId: string) => {
    const tarifMois = config.cotisation_mensuelle || 5000;
    const moisPasses = anneeSelCot < ANNEE_COURANTE ? 12 : anneeSelCot === ANNEE_COURANTE ? MOIS_COURANT : 0;
    const nonPayes = MOIS.slice(0, moisPasses).filter((_, mi) => getCotStatut(foyerId, mi + 1) === 'non_paye').length;
    return nonPayes * tarifMois;
  };

  const foyersFiltreCot = foyers.filter(f => {
    if (filtreCot === 'payes') return foyersAJourSet.has(f.id);
    if (filtreCot === 'non_payes') return !foyersAJourSet.has(f.id);
    return true;
  }).filter(f => {
    if (!searchCot) return true;
    const q = searchCot.toLowerCase();
    const chef = membres.find(m => m.foyer_id === f.id && m.is_chef);
    return f.code_menage.toLowerCase().includes(q) || (chef ? `${chef.nom} ${chef.prenom}`.toLowerCase().includes(q) : false);
  });

  // Note : l'impression du reçu de cotisation se fait désormais exclusivement
  // via le module Caisse au moment de la validation du paiement (source unique).

  const handleCocherCot = async (foyer: Foyer, moisNum: number) => {
    const periode = `${MOIS[moisNum - 1]} ${anneeSelCot}`;
    const key = `${foyer.id}-${periode}`;
    if (savingCot === key) return;
    setSavingCot(key);
    const montant = config.cotisation_mensuelle || 5000;
    const chef = membres.find(m => m.foyer_id === foyer.id && m.is_chef);
    // Envoyer l'opération en attente à la Caisse — le paiement réel se valide dans le module Caisse
    await supabase.from('operations_caisse').insert({
      module_origine: 'Cotisations',
      type_prestation: `Cotisation Mensuelle — ${periode}`,
      reference_document: null,
      foyer_id: foyer.id,
      nom_beneficiaire: chef ? `${chef.nom} ${chef.prenom}` : foyer.code_menage,
      montant,
      quantite: 1,
      statut: 'En attente de paiement',
      metadata: { periode, type_cotisation: 'Mensuelle' },
    });
    // Marquer comme "en attente" dans la grille (statut intermédiaire visuel)
    await supabase.from('cotisations').insert({ foyer_id: foyer.id, type_cotisation: 'Mensuelle', periode, montant_du: montant, montant_paye: 0, statut: 'En attente de paiement' });
    await loadAll();
    setSavingCot(null);

  };

  const handleDecocherCot = async (foyer: Foyer, moisNum: number) => {
    const periode = `${MOIS[moisNum - 1]} ${anneeSelCot}`;
    const cot = cotisations.find(c => c.foyer_id === foyer.id && c.periode === periode);
    const estPaye = cot?.statut === 'À jour';
    if (estPaye) {
      alert('Cette cotisation a déjà été validée par la Caisse. Pour l\'annuler, utilisez l\'annulation de transaction depuis l\'onglet Caisse → Historique.');
      return;
    }
    if (!confirm(`Retirer la cotisation ${periode} de la file d'attente de paiement ?`)) return;
    // Supprimer l'opération en attente liée à cette cotisation (jamais encore payée)
    await supabase.from('operations_caisse')
      .delete()
      .eq('foyer_id', foyer.id)
      .eq('module_origine', 'Cotisations')
      .eq('statut', 'En attente de paiement')
      .contains('metadata', { periode });
    await supabase.from('cotisations').delete().eq('foyer_id', foyer.id).eq('periode', periode);
    await loadAll();
  };

  const deleteDepense = async (id: string) => {
    if (!confirm('Supprimer cette dépense ?')) return;
    await supabase.from('depenses').delete().eq('id', id);
    await loadAll();
  };

  // ── Historique filtré + paginé ────────────────────────────
  const filteredEnc = transactionsValidees.filter(t => {
    if (dateDebutEnc && t.created_at < dateDebutEnc) return false;
    if (dateFinEnc && t.created_at > dateFinEnc + 'T23:59:59') return false;
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

  const Pagination = ({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) =>
    total > 1 ? (
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
        <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Précédent</button>
        <span className="text-xs text-slate-500">Page {page} / {total}</span>
        <button onClick={() => onPage(Math.min(total, page + 1))} disabled={page === total} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-40">Suivant<ChevronRight className="h-4 w-4" /></button>
      </div>
    ) : null;

  const DateFilter = ({ debut, fin, onDebut, onFin, total, totalMontant, label }: { debut: string; fin: string; onDebut: (v: string) => void; onFin: (v: string) => void; total: number; totalMontant: number; label: string }) => (
    <div className="flex items-center gap-3 flex-wrap bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 mb-3">
      <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
      <input type="date" value={debut} onChange={e => onDebut(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-400" />
      <span className="text-xs text-slate-400">→</span>
      <input type="date" value={fin} onChange={e => onFin(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-400" />
      {(debut || fin) && <button onClick={() => { onDebut(''); onFin(''); }} className="text-xs text-slate-400 hover:text-red-500 font-semibold">✕</button>}
      <span className="ml-auto text-xs text-slate-500"><strong>{total}</strong> {label} · <strong className="text-slate-800">{fmt(totalMontant)}</strong></span>
    </div>
  );

  const MENUS: { key: SubMenu; label: string; icon: any }[] = [
    { key: 'caisse',      label: 'Caisse',          icon: Wallet },
    { key: 'cotisations', label: 'Cotisations',     icon: Users },
    { key: 'historique',  label: 'Historique',      icon: Receipt },
    { key: 'depenses',    label: 'Dépenses',        icon: TrendingDown },
    { key: 'creances',    label: 'Créances',        icon: CreditCard },
    { key: 'dons',        label: 'Dons',            icon: Gift },
    { key: 'parametres',  label: 'Paramètres',      icon: Settings },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-green-600 p-2.5 rounded-xl"><Wallet className="h-5 w-5 text-white" /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Finances & Cotisations</h2>
            <p className="text-xs text-slate-500">Gestion financière du Fokontany</p>
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

      {loading ? (
        <div className="text-center py-16"><Loader2 className="h-8 w-8 text-green-600 animate-spin mx-auto" /></div>
      ) : (
        <div>

          {/* ── TABLEAU DE BORD ── */}
      {/* ── CAISSE ── */}
      {subMenu === 'caisse' && (
        <CaisseModule foyers={foyers} membres={membres} onDataChange={loadAll} />
      )}


          {/* ── COTISATIONS ── */}
          {subMenu === 'cotisations' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
                {/* Sélecteur année popup */}
                <div className="relative" data-annee-picker>
                  <button onClick={() => setShowAnneePicker(!showAnneePicker)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm transition">
                    <Calendar className="h-4 w-4 opacity-70" />
                    {anneeSelCot}
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  </button>
                  {showAnneePicker && (
                    <div className="absolute top-full left-0 mt-2 z-30 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 w-56">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Sélectionner l'année</p>
                      <div className="flex items-center justify-between mb-2">
                        <button onClick={e => { e.stopPropagation(); setAnneePickerBase(b => b - 12); }} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 font-bold text-sm">‹‹</button>
                        <button onClick={e => { e.stopPropagation(); setAnneePickerBase(b => b - 3); }} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 font-bold text-sm">‹</button>
                        <span className="text-xs text-slate-400 font-semibold">{anneePickerBase}–{anneePickerBase + 11}</span>
                        <button onClick={e => { e.stopPropagation(); setAnneePickerBase(b => b + 3); }} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 font-bold text-sm">›</button>
                        <button onClick={e => { e.stopPropagation(); setAnneePickerBase(b => b + 12); }} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 font-bold text-sm">››</button>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {Array.from({ length: 12 }, (_, i) => anneePickerBase + i).map(y => (
                          <button key={y} onClick={() => { setAnneeSelCot(y); setShowAnneePicker(false); }}
                            className={`py-2 rounded-lg text-sm font-bold transition ${y === anneeSelCot ? 'bg-green-600 text-white' : y === ANNEE_COURANTE ? 'bg-slate-100 text-green-700 border border-green-300' : 'hover:bg-slate-100 text-slate-700'}`}>
                            {y}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Filtre payé/non payé */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                  {([['tous', 'Tous', ''], ['payes', '✅ Payé', 'green'], ['non_payes', '❌ Non payé', 'red']] as [string, string, string][]).map(([val, label, color]) => (
                    <button key={val} onClick={() => setFiltreCot(val as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filtreCot === val ? color === 'green' ? 'bg-emerald-600 text-white' : color === 'red' ? 'bg-red-500 text-white' : 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
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
                  <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-emerald-500 inline-block" />Payé</span>
                  <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-amber-400 inline-block" />En attente (Caisse)</span>
                  <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-slate-100 border inline-block" />+ envoyer en Caisse</span>
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
                      <tr><td colSpan={16} className="text-center text-slate-400 py-10">Aucun foyer</td></tr>
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
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${estAJourCeMois ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>{estAJourCeMois ? '✓' : '!'}</span>
                              )}
                            </div>
                          </td>
                          {MOIS.map((moisNom, mi) => {
                            const moisNum = mi + 1;
                            const statut = getCotStatut(foyer.id, moisNum);
                            const key = `${foyer.id}-${moisNom} ${anneeSelCot}`;
                            const isSaving = savingCot === key;
                            const isFutur = (() => {
                          if (anneeSelCot > ANNEE_COURANTE) return true;
                          if (anneeSelCot < ANNEE_COURANTE) return false;
                          // Même année : mois futur bloqué SAUF si le mois précédent est payé
                          if (moisNum <= MOIS_COURANT) return false; // mois passé ou courant = toujours actif
                          // Mois futur : actif uniquement si tous les mois de MOIS_COURANT à moisNum-1 sont payés
                          for (let m = MOIS_COURANT; m < moisNum; m++) {
                            if (getCotStatut(foyer.id, m) !== 'paye') return true; // bloqué
                          }
                          return false; // débloqué car mois précédents payés
                        })();
                            const isMoisCourant = anneeSelCot === ANNEE_COURANTE && moisNum === MOIS_COURANT;
                            return (
                              <td key={moisNom} className={`p-1 text-center ${isMoisCourant ? 'bg-emerald-50/60' : ''}`}>
                                {isFutur ? (
                                  <span className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 inline-flex items-center justify-center text-slate-200 text-[10px]">—</span>
                                ) : isSaving ? (
                                  <span className="w-8 h-8 rounded-lg bg-emerald-100 inline-flex items-center justify-center"><Loader2 className="h-4 w-4 text-emerald-500 animate-spin" /></span>
                                ) : statut === 'paye' ? (
                                  <button onClick={() => handleDecocherCot(foyer, moisNum)} title="Payé — clic pour annuler" className="w-8 h-8 rounded-lg bg-emerald-500 hover:bg-red-400 inline-flex items-center justify-center transition">
                                    <CheckCircle className="h-4 w-4 text-white" />
                                  </button>
                                ) : statut === 'en_attente' ? (
                                  <button onClick={() => handleDecocherCot(foyer, moisNum)} title="En attente de paiement en Caisse — clic pour retirer" className="w-8 h-8 rounded-lg bg-amber-400 hover:bg-red-400 inline-flex items-center justify-center transition">
                                    <Clock className="h-4 w-4 text-white" />
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
                      <td className="p-2 text-center text-red-300 font-bold text-xs">{fmt(foyers.reduce((s, f) => s + getResteAPayer(f.id), 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── HISTORIQUE ── */}
          {subMenu === 'historique' && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-green-700 flex items-center gap-2 mb-3"><ArrowUpCircle className="h-4 w-4" />Encaissements ({transactionsValidees.length})</h3>
                  <p className="text-[11px] text-slate-400 mb-3">Source unique : transactions validées par la Caisse. Pour annuler un encaissement, utilisez l'onglet Caisse → Historique.</p>
                  <DateFilter debut={dateDebutEnc} fin={dateFinEnc} onDebut={v => { setDateDebutEnc(v); setPageEnc(1); }} onFin={v => { setDateFinEnc(v); setPageEnc(1); }} total={filteredEnc.length} totalMontant={filteredEnc.reduce((s, t) => s + (t.montant_total || 0), 0)} label="encaissement(s)" />
                </div>
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50 border-b"><th className="p-3 text-left text-slate-500">N° Reçu</th><th className="p-3 text-left text-slate-500">Usager</th><th className="p-3 text-right text-slate-500">Montant</th><th className="p-3 text-left text-slate-500">Mode</th><th className="p-3 text-left text-slate-500">Agent</th><th className="p-3 text-left text-slate-500">Date</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {encPage.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-green-600 font-semibold">{t.numero_recu}</td>
                        <td className="p-3 text-slate-700">{t.nom_usager}</td>
                        <td className="p-3 text-right font-bold text-green-700">{fmt(t.montant_total)}</td>
                        <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${t.mode_paiement === 'Espèces' ? 'bg-green-100 text-green-700' : t.mode_paiement === 'Mobile Money' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{t.mode_paiement}</span></td>
                        <td className="p-3 text-slate-500">{t.agent}</td>
                        <td className="p-3 text-slate-400">{new Date(t.created_at).toLocaleDateString('fr-FR')}</td>
                      </tr>
                    ))}
                    {encPage.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-8">Aucun encaissement</td></tr>}
                  </tbody>
                </table>
                <Pagination page={pageEnc} total={totalPagesEnc} onPage={setPageEnc} />
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-red-600 flex items-center gap-2 mb-3"><ArrowDownCircle className="h-4 w-4" />Dépenses ({depenses.length})</h3>
                  <DateFilter debut={dateDebutDep} fin={dateFinDep} onDebut={v => { setDateDebutDep(v); setPageDep(1); }} onFin={v => { setDateFinDep(v); setPageDep(1); }} total={filteredDep.length} totalMontant={filteredDep.reduce((s, d) => s + (d.montant || 0), 0)} label="dépense(s)" />
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
                  <input value={newDep.description} onChange={e => setNewDep(p => ({ ...p, description: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Bénéficiaire</label>
                  <input value={newDep.beneficiaire} onChange={e => setNewDep(p => ({ ...p, beneficiaire: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none" />
                </div>
              </div>
              <button onClick={handleSaveDep} disabled={savingDep} className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
                {savingDep ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</> : <><Save className="h-4 w-4" />Enregistrer la dépense</>}
              </button>
              <p className="text-xs text-slate-400 text-center">La dépense sera visible dans l'onglet Historique</p>
            </div>
          )}

          {/* ── CRÉANCES ── */}
          {subMenu === 'creances' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-purple-600 uppercase mb-1">Créances non soldées</p>
                  <p className="text-2xl font-black text-purple-700">{fmt(creances.filter(c => c.statut === 'Non soldée').reduce((s, c) => s + c.montant, 0))}</p>
                  <p className="text-xs text-purple-400 mt-1">{creances.filter(c => c.statut === 'Non soldée').length} créance(s)</p>
                </div>
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Créances soldées</p>
                  <p className="text-2xl font-black text-emerald-700">{fmt(creances.filter(c => c.statut === 'Soldée').reduce((s, c) => s + c.montant, 0))}</p>
                  <p className="text-xs text-emerald-400 mt-1">{creances.filter(c => c.statut === 'Soldée').length} créance(s)</p>
                </div>
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-red-600 uppercase mb-1">En retard</p>
                  <p className="text-2xl font-black text-red-700">{creances.filter(c => c.statut === 'Non soldée' && c.date_limite && c.date_limite < new Date().toISOString().split('T')[0]).length}</p>
                  <p className="text-xs text-red-400 mt-1">date limite dépassée</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><CreditCard className="h-4 w-4 text-purple-600" />Liste des créances</h3>
                </div>
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50 border-b">
                    <th className="p-3 text-left text-slate-500">Débiteur</th>
                    <th className="p-3 text-left text-slate-500">Motif</th>
                    <th className="p-3 text-right text-slate-500">Montant</th>
                    <th className="p-3 text-left text-slate-500">Date limite</th>
                    <th className="p-3 text-left text-slate-500">Responsable</th>
                    <th className="p-3 text-center text-slate-500">Statut</th>
                    <th className="p-3 text-center text-slate-500">⋯</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {creances.map(c => {
                      const enRetard = c.statut === 'Non soldée' && c.date_limite && c.date_limite < new Date().toISOString().split('T')[0];
                      return (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="p-3 font-semibold text-slate-700">{c.nom_debiteur}</td>
                          <td className="p-3 text-slate-500">{c.motif}</td>
                          <td className="p-3 text-right font-bold text-purple-700">{fmt(c.montant)}</td>
                          <td className={`p-3 ${enRetard ? 'text-red-600 font-bold' : 'text-slate-500'}`}>{c.date_limite ? new Date(c.date_limite).toLocaleDateString('fr-FR') : '-'}</td>
                          <td className="p-3 text-slate-400">{c.responsable}</td>
                          <td className="p-3 text-center">
                            {c.statut === 'Soldée' ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Soldée</span> : enRetard ? <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">En retard</span> : <span className="text-[10px] font-bold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">Non soldée</span>}
                          </td>
                          <td className="p-3 text-center">
                            {c.statut === 'Non soldée' && (
                              <button onClick={async () => { setSoldingId(c.id); await supabase.from('creances').update({ statut: 'Soldée', date_soldee: new Date().toISOString() }).eq('id', c.id); setSoldingId(null); loadAll(); }} disabled={soldingId === c.id} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg">
                                {soldingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Solder'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {creances.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-10">Aucune créance enregistrée</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── DONS ── */}
          {subMenu === 'dons' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-700">Enregistrer un don / subvention</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Source *</label>
                    <select value={newDon.source} onChange={e => setNewDon(p => ({ ...p, source: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white outline-none">
                      <option value="">Choisir...</option>
                      {SOURCES_DON.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Montant (Ar)</label>
                    <input type="number" value={newDon.montant} onChange={e => setNewDon(p => ({ ...p, montant: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Description</label>
                    <input value={newDon.description} onChange={e => setNewDon(p => ({ ...p, description: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Affectation</label>
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
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-700">💰 Cotisations & Général</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[{k:'cotisation_mensuelle',l:'Mensuelle (Ar)'},{k:'cotisation_trimestrielle',l:'Trimestrielle (Ar)'},{k:'cotisation_annuelle',l:'Annuelle (Ar)'}].map(({k,l})=>(
                    <div key={k}>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{l}</label>
                      <input type="number" value={config[k]||''} onChange={e=>setConfig((p:any)=>({...p,[k]:parseFloat(e.target.value)}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-green-500" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Solde initial (Ar)</label>
                    <input type="number" value={config.solde_initial||0} onChange={e=>setConfig((p:any)=>({...p,solde_initial:parseFloat(e.target.value)}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-green-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Préfixe des reçus</label>
                    <input value={config.prefixe_recu||'REC'} onChange={e=>setConfig((p:any)=>({...p,prefixe_recu:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none font-mono" />
                  </div>
                </div>
              </div>

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
                        <input type="number" value={config[d.key]||''} onChange={e=>setConfig((p:any)=>({...p,[d.key]:parseFloat(e.target.value)}))} placeholder="2000" className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-500 bg-white" />
                        <span className="text-xs text-slate-400 shrink-0">Ar</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={async()=>{await supabase.from('config_finances').update(config).eq('id',1);alert('Configuration enregistrée !');}} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
                <Save className="h-4 w-4" />Enregistrer toute la configuration
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
