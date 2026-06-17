import React, { useState, useMemo } from 'react';
import { Transaction, Habitant, CotisationAdidy } from '../types';
import { 
  TrendingUp, TrendingDown, Landmark, Plus, FileText, 
  Trash2, Search, Filter, Printer, Calendar, ShieldCheck, 
  X, Info, AlertCircle, RefreshCw, Users, Check, Clock, PlusCircle, Coins, FileCheck
} from 'lucide-react';

interface FinanceModuleProps {
  transactions: Transaction[];
  habitants: Habitant[];
  cotisations: CotisationAdidy[];
  onAddTransaction: (newTx: Omit<Transaction, 'id'>) => void;
  onDeleteTransaction: (id: string) => void;
  onAddCotisation: (newCot: Omit<CotisationAdidy, 'id'>) => void;
  onDeleteCotisation: (id: string) => void;
}

export default function FinanceModule({
  transactions,
  habitants,
  cotisations,
  onAddTransaction,
  onDeleteTransaction,
  onAddCotisation,
  onDeleteCotisation
}: FinanceModuleProps) {
  // Filters state
  const [filterType, setFilterType] = useState<'all' | 'recette' | 'depense'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Adidy specific states
  const [subTab, setSubTab] = useState<'treasury' | 'adidy'>('treasury');
  const [adidySearchQuery, setAdidySearchQuery] = useState('');
  const [selectedFoyerCode, setSelectedFoyerCode] = useState<string | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payFoyerCode, setPayFoyerCode] = useState<string>('');
  const [payMonth, setPayMonth] = useState<number>(new Date().getMonth() + 1);
  const [payAmount, setPayAmount] = useState<number>(5000);
  const [payPayerId, setPayPayerId] = useState<string>('');
  const [payResponsable, setPayResponsable] = useState<string>('Secrétaire Fokontany');
  
  // Printable receipt state for Adidy
  const [printableReceipt, setPrintableReceipt] = useState<CotisationAdidy | null>(null);

  // Group habitants by codeMenage
  const foyers = useMemo(() => {
    const map: { [code: string]: Habitant[] } = {};
    habitants.forEach(h => {
      if (h.statut !== 'Actif') return;
      const code = h.famille.codeMenage || 'SANS-CODE';
      if (!map[code]) map[code] = [];
      map[code].push(h);
    });
    
    return Object.entries(map).map(([code, members]) => {
      const chef = members.find(m => m.famille.isChefMenage) || members[0];
      return {
        code,
        members,
        chefName: chef ? `${chef.nom} ${chef.prenom}` : 'Sans chef enregistré',
        adresse: chef ? chef.residence.adresse : 'Adresse inconnue',
        fokontany: chef ? chef.residence.fokontany : ''
      };
    }).filter(f => f.code !== 'SANS-CODE');
  }, [habitants]);

  // Filter foyers based on search query
  const filteredFoyers = useMemo(() => {
    const q = adidySearchQuery.toLowerCase();
    if (!q) return foyers;
    return foyers.filter(f => 
      f.code.toLowerCase().includes(q) || 
      f.chefName.toLowerCase().includes(q) || 
      f.adresse.toLowerCase().includes(q)
    );
  }, [foyers, adidySearchQuery]);

  // Months name array for render
  const MONTHS_MALAGASY = [
    { num: 1, short: 'Jan', name: 'Janvier' },
    { num: 2, short: 'Fév', name: 'Février' },
    { num: 3, short: 'Mar', name: 'Mars' },
    { num: 4, short: 'Avr', name: 'Avril' },
    { num: 5, short: 'Mai', name: 'Mai' },
    { num: 6, short: 'Juin', name: 'Juin' },
    { num: 7, short: 'Juil', name: 'Juillet' },
    { num: 8, short: 'Août', name: 'Août' },
    { num: 9, short: 'Sept', name: 'Septembre' },
    { num: 10, short: 'Oct', name: 'Octobre' },
    { num: 11, short: 'Nov', name: 'Novembre' },
    { num: 12, short: 'Déc', name: 'Décembre' }
  ];
  
  // Transaction Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formType, setFormType] = useState<'recette' | 'depense'>('recette');
  const [formMontant, setFormMontant] = useState<number>(0);
  const [formCategorie, setFormCategorie] = useState<Transaction['categorie']>('Droits administratifs');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formResponsable, setFormResponsable] = useState<string>('Chef Fokontany (Admin)');
  const [formJustificatif, setFormJustificatif] = useState<string>('');

  // Report modal state
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportQuarter, setReportQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Annuel'>('Annuel');

  // Compute stats
  const totalRevenues = transactions
    .filter(t => t.type === 'recette')
    .reduce((sum, t) => sum + t.montant, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'depense')
    .reduce((sum, t) => sum + t.montant, 0);

  const netBalance = totalRevenues - totalExpenses;

  // Filter list
  const filteredTxs = transactions.filter(t => {
    const matchesType = filterType === 'all' || t.type === filterType;
    const matchesCategory = filterCategory === 'all' || t.categorie === filterCategory;
    const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.responsable.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.categorie.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (t.justificatifRef && t.justificatifRef.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesType && matchesCategory && matchesSearch;
  });

  // Unique categories in transactions
  const categories: Transaction['categorie'][] = [
    'Subvention', 'Droits administratifs', 'Dons & Cotisations', 
    'Taxes locales', 'Achat matériel', 'Fournitures', 
    'Entretien', 'Social', 'Événements', 'Autre'
  ];

  // Distribution by category for chart
  const categoryStats = categories.map(cat => {
    const amount = transactions
      .filter(t => t.categorie === cat)
      .reduce((sum, t) => sum + (t.type === 'recette' ? t.montant : -t.montant), 0);
    const positiveAmount = transactions
      .filter(t => t.categorie === cat)
      .reduce((sum, t) => sum + t.montant, 0);

    return { name: cat, amount, positiveAmount };
  }).filter(c => c.positiveAmount > 0);

  const handleOpenForm = (type: 'recette' | 'depense') => {
    setFormType(type);
    setFormCategorie(type === 'recette' ? 'Droits administratifs' : 'Fournitures');
    setFormMontant(0);
    setFormDescription('');
    setFormJustificatif('');
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formMontant <= 0) {
      alert("Le montant doit être supérieur à zéro");
      return;
    }
    if (!formDescription.trim()) {
      alert("La description est obligatoire");
      return;
    }

    onAddTransaction({
      date: new Date().toISOString(),
      type: formType,
      montant: formMontant,
      categorie: formCategorie,
      description: formDescription,
      responsable: formResponsable,
      justificatifRef: formJustificatif.trim() ? formJustificatif : undefined
    });

    setIsFormOpen(false);
  };

  return (
    <div className="space-y-6">

      {/* Tabs Switcher for subTab selection */}
      <div className="flex border-b border-slate-200 mb-6 bg-slate-50 p-1 rounded-xl select-none max-w-md">
        <button
          onClick={() => setSubTab('treasury')}
          className={`flex-1 py-2 px-4 rounded-lg text-xs font-sans font-bold tracking-wide transition flex items-center justify-center ${
            subTab === 'treasury'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-slate-550 hover:text-slate-800'
          }`}
        >
          <Landmark className="h-3.5 w-3.5 mr-1.5" />
          Budget & Ledger Général
        </button>
        <button
          onClick={() => setSubTab('adidy')}
          className={`flex-1 py-2 px-4 rounded-lg text-xs font-sans font-bold tracking-wide transition flex items-center justify-center ${
            subTab === 'adidy'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-slate-550 hover:text-slate-800'
          }`}
        >
          <Users className="h-3.5 w-3.5 mr-1.5" />
          Adidy (Suivi Cotisations)
        </button>
      </div>

      {subTab === 'treasury' ? (
        <>
          {/* 1. TOP METRICS LAYER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Treasury Reserve Box */}
        <div id="finance-stat-card-treasury" className="p-5 bg-gradient-to-br from-indigo-900 to-slate-900 text-white border border-indigo-950 rounded-2xl shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono tracking-widest text-indigo-300 uppercase block font-bold">Trésorerie Fokontany (Solde)</span>
            <p className="text-2xl font-black font-mono tracking-tight text-white leading-none">
              {netBalance.toLocaleString('fr-FR')} <span className="text-xs font-sans text-indigo-300 uppercase font-extrabold">Ariary</span>
            </p>
            <span className="text-[10px] text-indigo-200 block mt-1">Disponibles en banque et caisse locale</span>
          </div>
          <div className="w-12 h-12 bg-indigo-800/40 border border-indigo-700/50 rounded-xl flex items-center justify-center shadow-lg shrink-0 text-indigo-300">
            <Landmark className="h-6 w-6" />
          </div>
        </div>

        {/* Total Revenues */}
        <div id="finance-stat-card-revenues" className="p-5 bg-white border border-slate-205 rounded-2xl shadow-3xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase block font-bold">Total Recettes cumulées</span>
            <p className="text-xl font-black font-mono tracking-tight text-emerald-800 leading-none">
              + {totalRevenues.toLocaleString('fr-FR')} <span className="text-xs font-sans text-slate-400 uppercase">Ar</span>
            </p>
            <span className="text-[10px] text-emerald-600 font-sans block mt-1 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              Entrées financières globales
            </span>
          </div>
          <div className="w-12 h-12 bg-emerald-50 border border-emerald-150 rounded-xl flex items-center justify-center shrink-0 text-emerald-700">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        {/* Total Expenses */}
        <div id="finance-stat-card-expenses" className="p-5 bg-white border border-slate-205 rounded-2xl shadow-3xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase block font-bold">Total Dépenses engagées</span>
            <p className="text-xl font-black font-mono tracking-tight text-rose-800 leading-none">
              - {totalExpenses.toLocaleString('fr-FR')} <span className="text-xs font-sans text-slate-400 uppercase">Ar</span>
            </p>
            <span className="text-[10px] text-rose-600 font-sans block mt-1 flex items-center">
              <TrendingDown className="h-3 w-3 mr-1" />
              Frais administratifs et sociaux
            </span>
          </div>
          <div className="w-12 h-12 bg-rose-50 border border-rose-150 rounded-xl flex items-center justify-center shrink-0 text-rose-700">
            <TrendingDown className="h-6 w-6" />
          </div>
        </div>

      </div>

      {/* 2. DYNAMIC VISUAL CHART REGISTRATION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT CHART - Revenue / Expense Proportions */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-3xs space-y-4">
          <div>
            <h3 className="font-sans font-bold text-slate-900 text-sm">Ratio Recettes / Dépenses</h3>
            <p className="text-[11px] text-slate-400">Équilibre budgétaire général de l'exercice en cours</p>
          </div>

          <div className="flex flex-col items-center justify-center py-4 relative">
            {/* SVG Visual Circle representing balance proportion */}
            {totalRevenues === 0 && totalExpenses === 0 ? (
              <div className="text-xs text-slate-400 italic">Aucune donnée financière disponible.</div>
            ) : (
              <>
                <svg className="w-32 h-32 transform -rotate-90">
                  {/* Background Circle */}
                  <circle cx="64" cy="64" r="54" className="stroke-slate-100 fill-none" strokeWidth="12" />
                  {/* Revenue Segment */}
                  <circle 
                    cx="64" 
                    cy="64" 
                    r="54" 
                    className="stroke-emerald-500 fill-none transition-all duration-500" 
                    strokeWidth="12" 
                    strokeDasharray={`${2 * Math.PI * 54}`}
                    strokeDashoffset={`${2 * Math.PI * 54 * (1 - totalRevenues / (totalRevenues + totalExpenses))}`}
                  />
                  {/* Expense Segment starting where revenue ends */}
                  <circle 
                    cx="64" 
                    cy="64" 
                    r="54" 
                    className="stroke-rose-500 fill-none transition-all duration-500" 
                    strokeWidth="12" 
                    strokeDasharray={`${2 * Math.PI * 54}`}
                    style={{
                      strokeDashoffset: 2 * Math.PI * 54 * (1 - totalExpenses / (totalRevenues + totalExpenses)),
                      transform: `rotate(${360 * (totalRevenues / (totalRevenues + totalExpenses))}deg)`,
                      transformOrigin: '64px 64px'
                    }}
                  />
                </svg>

                {/* Balance Summary Absolute overlay inside ring */}
                <div className="absolute text-center">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Excédent</span>
                  <span className="text-xs font-black font-mono text-indigo-900 leading-none">
                    {Math.round((netBalance / (totalRevenues || 1)) * 100)} %
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Color Indicators Legend */}
          <div className="grid grid-cols-2 gap-4 text-xs pt-2">
            <div className="p-2.5 bg-emerald-50/50 rounded-lg border border-emerald-100 flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></div>
              <div>
                <span className="text-slate-500 block text-[10px]">Part Recettes</span>
                <strong className="font-mono text-emerald-800">{totalRevenues > 0 ? Math.round((totalRevenues / (totalRevenues + totalExpenses)) * 100) : 0}%</strong>
              </div>
            </div>
            <div className="p-2.5 bg-rose-50/50 rounded-lg border border-rose-100 flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></div>
              <div>
                <span className="text-slate-500 block text-[10px]">Part Dépenses</span>
                <strong className="font-mono text-rose-800">{totalExpenses > 0 ? Math.round((totalExpenses / (totalRevenues + totalExpenses)) * 100) : 0}%</strong>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT CHART - Category Allocation breakdown */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-3xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-sans font-bold text-slate-900 text-sm">Volume Absolu par Catégorie</h3>
              <p className="text-[11px] text-slate-400">Total cumulé et impacts financiers enregistrés par poste d'activité</p>
            </div>
            <button
              onClick={() => setIsReportOpen(true)}
              className="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center transition"
            >
              <Printer className="h-3.5 w-3.5 mr-1.5 text-indigo-500" />
              <span>Générer Rapport Fokontany</span>
            </button>
          </div>

          {/* SVG/Tailwind Category Bar listings */}
          <div className="space-y-3 pt-2">
            {categoryStats.length === 0 ? (
              <div className="text-xs text-slate-400 italic text-center py-6">Aucune transaction passée.</div>
            ) : (
              categoryStats.map(stat => {
                const maxVal = Math.max(...categoryStats.map(s => s.positiveAmount));
                const limitPct = Math.round((stat.positiveAmount / (maxVal || 1)) * 100);
                const isNetPositive = stat.amount >= 0;

                return (
                  <div key={stat.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 font-sans">{stat.name}</span>
                      <strong className={`font-mono ${isNetPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {isNetPositive ? '+' : ''}{stat.amount.toLocaleString('fr-FR')} Ar
                      </strong>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${isNetPositive ? 'bg-emerald-500' : 'bg-rose-500'}`}
                        style={{ width: `${limitPct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* 3. TRANSATION LISTS TABLE & SEARCH ACTION CONTROL */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        
        {/* Table header bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-150 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="font-sans font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              Enregistrements Comptables Recensés
            </h3>
            <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
              {filteredTxs.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Search query field */}
            <div className="relative flex-1 md:w-60 md:flex-none">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input 
                type="text"
                placeholder="Chercher par description, visa..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 bg-white rounded-lg focus:border-indigo-500 outline-hidden"
              />
            </div>

            {/* Type selector */}
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              className="text-xs border border-slate-200 bg-white rounded-lg p-1.5 font-medium"
            >
              <option value="all">Tous flux</option>
              <option value="recette">Incomes (Recette)</option>
              <option value="depense">Expenses (Dépense)</option>
            </select>

            {/* Category selector */}
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="text-xs border border-slate-200 bg-white rounded-lg p-1.5 font-medium"
            >
              <option value="all">Toutes catégories</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>

            {/* Main triggers */}
            <button
              onClick={() => handleOpenForm('recette')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span>+ Entrée</span>
            </button>
            
            <button
              onClick={() => handleOpenForm('depense')}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span>- Sortie</span>
            </button>

          </div>
        </div>

        {/* Core Table List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-150 text-slate-450 uppercase font-mono text-[9px]">
                <th className="p-3 w-32">Date / Heure</th>
                <th className="p-3 w-28">Type</th>
                <th className="p-3 w-40">Catégorie</th>
                <th className="p-3">Détails de la transaction</th>
                <th className="p-3 w-36">Visa Responsable</th>
                <th className="p-3 w-32">Justificatif</th>
                <th className="p-3 w-32 text-right">Montant (Ariary)</th>
                <th className="p-2 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
              {filteredTxs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                    Aucune fiche comptable correspondante.
                  </td>
                </tr>
              ) : (
                filteredTxs.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/30 transition">
                    <td className="p-3 text-slate-450 font-mono text-[10px]">
                      {new Date(tx.date).toLocaleDateString('fr-FR')} à {new Date(tx.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        tx.type === 'recette' 
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' 
                          : 'bg-rose-50 text-rose-800 border border-rose-100'
                      }`}>
                        {tx.type === 'recette' ? 'RECETTE' : 'DÉPENSE'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-slate-800">{tx.categorie}</span>
                    </td>
                    <td className="p-3 text-slate-650 leading-relaxed max-w-sm">
                      {tx.description}
                    </td>
                    <td className="p-3 font-semibold text-slate-900 flex items-center space-x-1 py-4">
                      <span>{tx.responsable}</span>
                    </td>
                    <td className="p-3 font-mono text-slate-500">
                      {tx.justificatifRef ? (
                        <span className="bg-slate-100 border border-slate-200 p-0.5 px-1.5 rounded text-[10px]">
                          {tx.justificatifRef}
                        </span>
                      ) : (
                        <span className="italic text-slate-400 text-[10px]">- Aucun -</span>
                      )}
                    </td>
                    <td className={`p-3 font-mono font-bold text-right text-sm whitespace-nowrap ${
                      tx.type === 'recette' ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {tx.type === 'recette' ? '+' : '-'} {tx.montant.toLocaleString('fr-FR')} Ar
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => {
                          if (confirm("Supprimer cette transaction de la comptabilité Fokontany ?")) {
                            onDeleteTransaction(tx.id);
                          }
                        }}
                        className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition"
                        title="Annuler cette écriture"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. TRANSACTION MAKER POPUP (INLINE modal) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-200 overflow-hidden shadow-2xl animate-scaleUp">
            
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-950 uppercase text-xs tracking-wider font-sans">
                {formType === 'recette' ? '🖋️ Enregistrer une Recette' : '🖋️ Enregistrer une Dépense'}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              
              {/* Type toggle */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-150">
                <button
                  type="button"
                  onClick={() => { setFormType('recette'); setFormCategorie('Droits administratifs'); }}
                  className={`py-1.5 rounded-md font-bold text-center transition ${
                    formType === 'recette' ? 'bg-white text-emerald-800 shadow-2xs border border-emerald-100' : 'text-slate-500'
                  }`}
                >
                  Recette
                </button>
                <button
                  type="button"
                  onClick={() => { setFormType('depense'); setFormCategorie('Fournitures'); }}
                  className={`py-1.5 rounded-md font-bold text-center transition ${
                    formType === 'depense' ? 'bg-white text-rose-800 shadow-2xs border border-rose-100' : 'text-slate-500'
                  }`}
                >
                  Dépense
                </button>
              </div>

              {/* Amount Ariary input */}
              <div className="space-y-1">
                <label className="text-slate-500 uppercase tracking-wide font-black text-[10px]">Montant de l'opération (Ariary)</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    required
                    value={formMontant || ''}
                    name="montant"
                    onChange={e => setFormMontant(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full p-2.5 pl-3 pr-14 font-mono font-bold bg-slate-50 focus:bg-white text-slate-900 border border-slate-205 focus:border-indigo-500 rounded-lg text-sm"
                    placeholder="Ex: 500000"
                  />
                  <span className="absolute right-3 top-3.5 text-slate-400 font-bold text-[10px] uppercase pointer-events-none">ARIARY</span>
                </div>
              </div>

              {/* Category selection */}
              <div className="space-y-1">
                <label className="text-slate-500 uppercase tracking-wide font-black text-[10px]">Catégorie Budgétaire</label>
                <select
                  value={formCategorie}
                  onChange={e => setFormCategorie(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-205 rounded-lg focus:border-indigo-500"
                >
                  {formType === 'recette' ? (
                    <>
                      <option value="Subvention">Subvention Publique</option>
                      <option value="Droits administratifs">Droits de Secrétariat / Actes</option>
                      <option value="Dons & Cotisations">Donations et Cotisations Habitants</option>
                      <option value="Taxes locales">Taxes locales / Droits de place</option>
                      <option value="Autre">Autre recette exceptionnelle</option>
                    </>
                  ) : (
                    <>
                      <option value="Achat matériel">Achat de Matériel</option>
                      <option value="Fournitures">Fournitures administratives & Encre</option>
                      <option value="Entretien">Maintenance et Entretien communal</option>
                      <option value="Social">Aide Sociale directe aux résidents</option>
                      <option value="Événements">Festivités de quartier / Préparations</option>
                      <option value="Autre">Autre dépense diverse</option>
                    </>
                  )}
                </select>
              </div>

              {/* Description field */}
              <div className="space-y-1">
                <label className="text-slate-500 uppercase tracking-wide font-black text-[10px]">Description & Motif de l'écriture</label>
                <textarea
                  required
                  rows={3}
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 focus:bg-white border border-slate-205 rounded-lg focus:border-indigo-500"
                  placeholder="Ex: Achat de riz de secours pour les personnes sinistrées..."
                />
              </div>

              {/* Responsable & Justificatif */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-500 uppercase tracking-wide font-black text-[10px]">Commanditaire (Visa)</label>
                  <input
                    type="text"
                    required
                    value={formResponsable || ''}
                    onChange={e => setFormResponsable(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-205 rounded-lg"
                    placeholder="Chef Fokontany"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 uppercase tracking-wide font-black text-[10px]">Numéro Pièce / Justificatif</label>
                  <input
                    type="text"
                    value={formJustificatif || ''}
                    onChange={e => setFormJustificatif(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-205 rounded-lg font-mono placeholder-slate-300"
                    placeholder="Ex: FACT-105"
                  />
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg font-semibold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-white font-bold rounded-lg transition ${
                    formType === 'recette' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Enregistrer l'opération
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* 5. OFFICIAL MUNICIPAL FINANCIAL REPORT DIALOG (Standard A4 printable) */}
      {isReportOpen && (
        <div id="financial-report-overlay" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header controls inside report */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Landmark className="h-5 w-5 text-indigo-600" />
                <h2 className="text-sm font-bold uppercase text-slate-800 font-sans tracking-tight">
                  Générateur du Rapport Budgétaire Conforme
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                {/* Quarter selector */}
                <select
                  value={reportQuarter}
                  onChange={e => setReportQuarter(e.target.value as any)}
                  className="text-xs border border-indigo-200 bg-white text-indigo-800 rounded-lg p-1 px-2.5 font-bold focus:outline-hidden"
                >
                  <option value="Q1">Premier Trimestre (Q1)</option>
                  <option value="Q2">Deuxième Trimestre (Q2)</option>
                  <option value="Q3">Troisième Trimestre (Q3)</option>
                  <option value="Q4">Quatrième Trimestre (Q4)</option>
                  <option value="Annuel">Rapport d'Exercice Annuel Globale</option>
                </select>

                <button
                  onClick={() => window.print()}
                  className="p-1 px-3 hover:bg-slate-200 text-indigo-600 hover:text-indigo-800 rounded-lg text-xs font-sans font-bold transition flex items-center border border-indigo-200"
                >
                  <Printer className="h-3.5 w-3.5 mr-1" />
                  <span>Imprimer A4 officiel</span>
                </button>

                <button 
                  onClick={() => setIsReportOpen(false)}
                  className="p-1 px-2.5 hover:bg-slate-205 text-slate-400 hover:text-slate-600 rounded-lg text-xs transition border"
                >
                  <span>Fermer (ESC)</span>
                </button>
              </div>
            </div>

            {/* Document body formatted specifically for print styling */}
            <div className="p-8 overflow-y-auto flex-1 space-y-6 bg-white font-serif max-w-3xl mx-auto border-x border-slate-200 selection:bg-slate-100 italic-quotes">
              
              {/* official state stamp */}
              <div className="border border-double border-slate-800 p-4 text-center text-xs space-y-1 bg-white">
                <h3 className="font-sans font-bold uppercase tracking-widest text-xs text-slate-950">REPOBLIKAN'I MADAGASIKARA</h3>
                <p className="italic text-[9px]">"Fitiavana - Tanindrazana - Fandrosoana"</p>
                <div className="w-16 h-0.5 bg-slate-800 mx-auto my-1"></div>
                <p className="font-sans font-bold uppercase text-[10px] text-slate-800">COMMUNE URBAINE D'ANTANANARIVO</p>
                <p className="font-sans text-[10px]">FOKONTANY DE LA ZONE CENTRALE : AMBOHITANTELY</p>
                <p className="text-[9px] font-mono text-slate-500">EXERCICE BUDGÉTAIRE : JUIN 2026</p>
              </div>

              {/* Title and date */}
              <div className="text-center py-2">
                <h1 className="text-base font-bold font-sans uppercase underline tracking-wide text-slate-900">
                  RAPPORT DES COMPTES ET DE TRÉSORERIE DU FOKONTANY - {reportQuarter.toUpperCase()}
                </h1>
                <p className="text-[9px] font-mono mt-1 text-slate-500">Issued digitally chronogoraphy code: MGA-REP-FK-899120</p>
              </div>

              {/* Report Summary paragraph */}
              <p className="text-xs text-slate-800 leading-relaxed indent-8">
                Le présent document dresse le bilan financier officiel de la caisse d'aide publique et des contributions du Fokontany pour la période indiquée. Toutes les opérations ont été dûment enregistrées, avec validation administrative et conservation physique des pièces justificatives correspondantes aux écritures comptables certifiées ci-après :
              </p>

              {/* Aggregate metrics box */}
              <div className="border border-slate-600 rounded-sm text-xs grid grid-cols-3 divide-x divide-slate-600 font-sans">
                <div className="p-2.5 text-center bg-emerald-50/20">
                  <span className="text-[8.5px] uppercase text-slate-500 block font-bold leading-none mb-1">Total Recettes</span>
                  <strong className="text-emerald-800 font-mono text-xs font-bold">+{totalRevenues.toLocaleString('fr-FR')} Ar</strong>
                </div>
                <div className="p-2.5 text-center bg-rose-50/20">
                  <span className="text-[8.5px] uppercase text-slate-500 block font-bold leading-none mb-1">Total Dépenses</span>
                  <strong className="text-rose-800 font-mono text-xs font-bold">-{totalExpenses.toLocaleString('fr-FR')} Ar</strong>
                </div>
                <div className="p-2.5 text-center bg-indigo-50/20">
                  <span className="text-[8.5px] uppercase text-indigo-900 block font-bold leading-none mb-1">Solde Disponible</span>
                  <strong className="text-indigo-950 font-mono text-xs font-black">{netBalance.toLocaleString('fr-FR')} Ar</strong>
                </div>
              </div>

              {/* Category summary matrix in tables */}
              <div className="space-y-2">
                <h4 className="font-sans font-bold text-slate-900 text-[10px] uppercase tracking-wider underline">I. SYNTHÈSE ANALYTIQUE DES REVENUS ET CHARGES PAR NATURE</h4>
                <table className="w-full text-left text-xs font-sans border border-slate-400">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-400 text-[9px] font-bold text-slate-700">
                      <th className="p-1.5 pl-3">Poste budgétaire délibéré</th>
                      <th className="p-1.5 w-44">Flux de caisse</th>
                      <th className="p-1.5 w-44 text-right pr-3">Balance cumulée (Ar)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {categories.map(cat => {
                      const amount = transactions
                        .filter(t => t.categorie === cat)
                        .reduce((sum, t) => sum + (t.type === 'recette' ? t.montant : -t.montant), 0);
                      const hasActivity = transactions.some(t => t.categorie === cat);

                      if (!hasActivity) return null;

                      return (
                        <tr key={cat} className="hover:bg-slate-50">
                          <td className="p-1.5 pl-3 font-semibold text-slate-800">{cat}</td>
                          <td className="p-1.5 text-slate-500 uppercase text-[9px] font-mono">
                            {amount >= 0 ? 'Excédentaire (In)' : 'Déficitaire (Out)'}
                          </td>
                          <td className={`p-1.5 text-right font-mono pr-3 font-bold ${amount >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                            {amount.toLocaleString('fr-FR')} Ar
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Transactions details listing inside report */}
              <div className="space-y-2 pt-2">
                <h4 className="font-sans font-bold text-slate-900 text-[10px] uppercase tracking-wider underline">II. LIVRE BANQUE - EXTRAIT CHRONOLOGIQUE DES OPÉRATIONS COMPTABLES</h4>
                <table className="w-full text-left text-[11px] font-sans border border-slate-300 divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-[8.5px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="p-1.5 pl-2">Date</th>
                      <th className="p-1.5">Description</th>
                      <th className="p-1.5">Réf / Pièce</th>
                      <th className="p-1.5 text-right pr-2">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-650">
                    {transactions.map(tx => (
                      <tr key={tx.id}>
                        <td className="p-1.5 pl-2 font-mono text-[9px]">{new Date(tx.date).toLocaleDateString('fr-FR')}</td>
                        <td className="p-1.5 font-sans leading-tight">
                          <span className="font-bold text-slate-900 mr-1">[{tx.type === 'recette' ? 'IN' : 'OUT'}]</span>
                          {tx.description}
                        </td>
                        <td className="p-1.5 font-mono text-[9.5px]">{tx.justificatifRef || '-'}</td>
                        <td className={`p-1.5 text-right font-mono font-bold pr-2 ${tx.type === 'recette' ? 'text-emerald-800' : 'text-rose-800'}`}>
                          {tx.type === 'recette' ? '+' : '-'} {tx.montant.toLocaleString('fr-FR')} Ar
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* State seals and visa signatures */}
              <div className="pt-8 grid grid-cols-2 text-center text-xs gap-6 font-sans">
                <div className="space-y-1">
                  <p className="font-bold uppercase tracking-wider text-slate-600">Le Trésorier du Comité</p>
                  <div className="h-12"></div>
                  <p className="italic text-[9px] text-slate-400">Signature manuscrite requise</p>
                </div>
                <div className="space-y-1">
                  <p className="font-bold uppercase tracking-wide text-indigo-900">Le Chef Fokontany d'Ambohitantely</p>
                  <div className="h-12"></div>
                  <p className="font-bold underline text-indigo-700 font-mono text-[8.5px]">Sceau d'Approbation Administrative municipal appliqué</p>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}
        </>
      ) : (
        <div id="adidy-tab-container" className="space-y-6 animate-fadeIn">
          
          {/* Adidy Metrics cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-3xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase block font-bold">Total Cotisations Recouvrées (Adidy)</span>
                <p className="text-xl font-black font-mono tracking-tight text-indigo-900 leading-none">
                  {foyers.reduce((sum, f) => {
                    const familyCots = cotisations.filter(c => c.codeMenage === f.code);
                    return sum + familyCots.reduce((s, c) => s + c.montant, 0);
                  }, 0).toLocaleString('fr-FR')} <span className="text-xs font-sans text-slate-400 uppercase">Ar</span>
                </p>
                <span className="text-[10px] text-slate-505 block mt-1">Total récolté pour le fonctionnement civique</span>
              </div>
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center shrink-0 text-indigo-700">
                <Coins className="h-5 h-5" />
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-3xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase block font-bold">Paiement Récent (Ce Mois-ci)</span>
                <p className="text-xl font-black font-mono tracking-tight text-emerald-800 leading-none">
                  {cotisations.filter(c => c.mois === (new Date().getMonth() + 1) && c.annee === 2026).reduce((sum, c) => sum + c.montant, 0).toLocaleString('fr-FR')} <span className="text-xs font-sans text-slate-405 uppercase font-sans">Ar</span>
                </p>
                <span className="text-[10px] text-emerald-600 block mt-1 flex items-center font-bold">
                  <Check className="h-3 w-3 mr-1" />
                  {cotisations.filter(c => c.mois === (new Date().getMonth() + 1) && c.annee === 2026).length} Foyers réglés
                </span>
              </div>
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center shrink-0 text-emerald-700">
                <FileCheck className="h-5 w-5" />
              </div>
            </div>

            <div className="p-5 bg-slate-900 text-white rounded-2xl shadow-md flex items-center justify-between border border-slate-950">
              <div className="space-y-1">
                <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase block font-bold">Foyers Recensés en Règle</span>
                <p className="text-xl font-black font-mono tracking-tight leading-none text-white whitespace-nowrap">
                  {foyers.filter(f => cotisations.some(c => c.codeMenage === f.code && c.annee === 2026)).length} / {foyers.length} <span className="text-xs text-indigo-300 font-bold uppercase">Ménages</span>
                </p>
                <span className="text-[10px] text-indigo-300 font-semibold block mt-1">Taux global de civisme local</span>
              </div>
              <div className="w-12 h-12 bg-slate-800 border border-slate-700/50 rounded-xl flex items-center justify-center shrink-0 text-indigo-400">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Controls & Search */}
          <div className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96 select-none">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-405" />
              <input 
                type="text" 
                placeholder="Rechercher un Foyer (MEN-XXX, Nom, Adresse...)" 
                value={adidySearchQuery}
                onChange={(e) => setAdidySearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-xs w-full bg-slate-50 focus:bg-white focus:outline-hidden focus:border-indigo-505 font-sans transition duration-150"
              />
            </div>
            
            <button 
              onClick={() => {
                setPayFoyerCode(foyers[0]?.code || '');
                setIsPayModalOpen(true);
              }}
              className="w-full md:w-auto bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-4 rounded-lg flex items-center justify-center space-x-1.5 transition leading-none shadow-3xs cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Saisir un Paiement Adidy</span>
            </button>
          </div>

          {/* Household Grid Checklist Matrix */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-3xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-250 flex items-center justify-between select-none">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest font-sans">Matrice de Suivi des Cotisations Annuelles (Exercice 2026)</h3>
              <p className="text-[10px] text-slate-400 font-sans uppercase">Aide: vert = payé, cercle = en attente</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-[10px] font-bold text-slate-505 uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-sans font-extrabold text-xs">Foyer & Chef de Ménage</th>
                    <th className="p-4 font-sans font-extrabold hidden md:table-cell text-xs">Adresse du Foyer</th>
                    <th className="p-4 font-sans font-extrabold text-center text-xs">Grille Mensuelle (Adidy)</th>
                    <th className="p-4 font-sans font-extrabold text-center text-xs">Filtre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {filteredFoyers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 py-12 text-center text-slate-400 font-sans italic">Aucun ménage enregistré ne correspond à vos critères.</td>
                    </tr>
                  ) : (
                    filteredFoyers.map(foyer => {
                      return (
                        <tr key={foyer.code} className="hover:bg-slate-50/50 transition duration-75">
                          {/* Family details */}
                          <td className="p-4">
                            <div className="flex items-start space-x-3">
                              <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-700 font-black font-sans text-xs flex items-center justify-center border border-indigo-100 shrink-0">
                                {foyer.code.replace('MEN-', '')}
                              </div>
                              <div className="space-y-0.5">
                                <p className="font-bold text-slate-900 font-sans hover:text-indigo-600 cursor-pointer" onClick={() => setSelectedFoyerCode(foyer.code)}>Famille {foyer.chefName}</p>
                                <div className="text-[10px] font-mono text-slate-450 flex flex-wrap items-center gap-1.5">
                                  <span className="font-bold border border-slate-200 rounded px-1 text-[9px] uppercase font-sans">Code Foyer: {foyer.code}</span>
                                  <span>{foyer.members.length} {foyer.members.length > 1 ? 'membres actifs' : 'membre unique'}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          
                          {/* Address details */}
                          <td className="p-4 hidden md:table-cell">
                            <p className="text-slate-655 font-sans text-xs leading-relaxed">{foyer.adresse}</p>
                            <p className="text-[9.5px] font-mono text-slate-400 uppercase font-bold">{foyer.fokontany}</p>
                          </td>

                          {/* Matrix Months */}
                          <td className="p-4">
                            <div className="flex items-center justify-center space-x-1 sm:space-x-1.5">
                              {MONTHS_MALAGASY.map(m => {
                                const hasPaid = cotisations.find(c => c.codeMenage === foyer.code && c.mois === m.num && c.annee === 2026);
                                return (
                                  <div 
                                    key={m.num} 
                                    title={`${m.name} 2026: ${hasPaid ? `Payé (${hasPaid.montant.toLocaleString('fr-FR')} Ar, Réf: ${hasPaid.recuNo})` : 'Dû (Non payé)'}`}
                                    onClick={() => {
                                      if (hasPaid) {
                                        setPrintableReceipt(hasPaid);
                                      } else {
                                        setPayFoyerCode(foyer.code);
                                        setPayMonth(m.num);
                                        setIsPayModalOpen(true);
                                      }
                                    }}
                                    className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md flex flex-col items-center justify-center text-[8.5px] font-bold cursor-pointer border select-none transition-all duration-100 ${
                                      hasPaid 
                                        ? 'bg-emerald-500 border-emerald-600 text-white shadow-3xs scale-102 hover:bg-emerald-600' 
                                        : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-500 hover:border-slate-300'
                                    }`}
                                  >
                                    <span>{m.short[0]}</span>
                                    {hasPaid && <Check className="h-1.5 w-1.5 text-white/90 stroke-[4px]" />}
                                  </div>
                                );
                              })}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <button 
                                onClick={() => setSelectedFoyerCode(foyer.code)}
                                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-705 text-[10px] font-sans font-bold py-1.5 px-2.5 rounded-md transition cursor-pointer"
                              >
                                Fiche Foyer
                              </button>
                              <button 
                                onClick={() => {
                                  setPayFoyerCode(foyer.code);
                                  setIsPayModalOpen(true);
                                }}
                                className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-705 text-[10px] font-sans font-bold py-1.5 px-2.5 rounded-md transition cursor-pointer"
                              >
                                Enregistrer
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* EXPLANATORY CARD */}
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex items-start space-x-3 text-xs leading-relaxed text-indigo-950 font-sans shadow-3xs">
            <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-indigo-900">Fonctionnement du Droit Locatif :</p>
              <p>L’Adidy Fokontany correspond au droit d'entretien et de bon fonctionnement dû par chaque ménage de notre circonscription. Le budget aide à la conciliation sociale locale, au maintien d’équipements, et à l'échelonnement d'aides sociales d’urgence.</p>
            </div>
          </div>

          {/* DETAIL MODAL FOR SELECTED FOYER */}
          {selectedFoyerCode && (() => {
            const foyer = foyers.find(f => f.code === selectedFoyerCode);
            if (!foyer) return null;
            const familyCotisations = cotisations.filter(c => c.codeMenage === selectedFoyerCode).sort((a,b) => b.mois - a.mois);
            
            return (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                  
                  {/* Header */}
                  <div className="bg-indigo-900 text-white p-5 flex justify-between items-center select-none">
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono tracking-widest text-indigo-200 uppercase font-bold">Fiche Analytique Foyer</span>
                      <h3 className="text-base font-black font-sans leading-none">Famille {foyer.chefName}</h3>
                    </div>
                    <button onClick={() => setSelectedFoyerCode(null)} className="p-1 rounded-full text-indigo-205 hover:bg-indigo-850 text-indigo-200">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Body scroll */}
                  <div className="p-6 overflow-y-auto space-y-6">
                    
                    {/* Identification block */}
                    <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 border border-slate-150 rounded-xl p-4 font-sans">
                      <div>
                        <span className="text-slate-400 block uppercase font-mono tracking-wider text-[9px] font-bold">Code de Recensement</span>
                        <strong className="text-slate-800">{foyer.code}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase font-mono tracking-wider text-[9px] font-bold">Chef de Ménage responsable</span>
                        <strong className="text-slate-800">{foyer.chefName}</strong>
                      </div>
                      <div className="col-span-2 border-t border-slate-200/50 pt-2">
                        <span className="text-slate-400 block uppercase font-mono tracking-wider text-[9px] font-bold">Résidence habituelle</span>
                        <strong className="text-slate-800">{foyer.adresse} ({foyer.fokontany})</strong>
                      </div>
                    </div>

                    {/* Members List Section */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-sans select-none">Composition du Foyer ({foyer.members.length} membres)</h4>
                      <div className="border border-slate-150 rounded-xl divide-y divide-slate-150 overflow-hidden shadow-3xs">
                        {foyer.members.map(m => (
                          <div key={m.id} className="p-3 bg-white hover:bg-slate-50 transition text-xs flex justify-between items-center font-sans">
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-850 flex items-center">
                                {m.nom} {m.prenom} 
                                {m.famille.isChefMenage && (
                                  <span className="ml-1.5 px-1.5 py-0.2 bg-indigo-50 border border-indigo-200 text-indigo-700 uppercase text-[8px] font-black rounded block">Chef</span>
                                )}
                              </p>
                              <p className="text-[10px] text-slate-400 font-medium">Profession: {m.economie.profession || 'Sans emploi spécialisé'} • Né le {new Date(m.dateNaissance).toLocaleDateString('fr-FR')}</p>
                            </div>
                            <span className="text-[10.5px] font-mono font-bold text-slate-500 bg-slate-100 rounded border border-slate-200/60 px-1.5 py-0.5 block shrink-0">
                              {m.cin ? `CIN: ${m.cin.substring(0,3)}...` : 'Mineurs / Sans CIN'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Payment Checklist List & Receipt */}
                    <div className="space-y-2 select-none">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">Historique des Cotisations Mensuelles</h4>
                      <div className="border border-slate-155 rounded-xl overflow-hidden divide-y divide-slate-150 shadow-3xs">
                        {familyCotisations.length === 0 ? (
                          <div className="p-6 text-center text-slate-405 italic bg-white">Aucune cotisation enregistrée pour l'exercice en cours.</div>
                        ) : (
                          familyCotisations.map(c => {
                            const monthObj = MONTHS_MALAGASY.find(m => m.num === c.mois);
                            return (
                              <div key={c.id} className="p-3.5 bg-white hover:bg-slate-50/50 transition flex items-center justify-between text-xs">
                                <div className="flex items-center space-x-3">
                                  <div className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-150 flex items-center justify-center text-emerald-800 shrink-0">
                                    <Check className="h-4 w-4 stroke-[3px]" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-850">Mois de {monthObj?.name} 2026</p>
                                    <p className="text-[10px] text-slate-400">Réglé le {new Date(c.datePaiement).toLocaleDateString('fr-FR')} • Reçu: {c.recuNo}</p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-mono font-extrabold text-emerald-800 mr-2">{c.montant.toLocaleString('fr-FR')} Ar</span>
                                  <button
                                    onClick={() => setPrintableReceipt(c)}
                                    className="p-1 px-2 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 font-sans text-indigo-705 text-[10px] font-bold rounded-md transition shrink-0 cursor-pointer"
                                  >
                                    Reçu de Caisse
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Voulez-vous vraiment annuler le versement ${c.recuNo} ?`)) {
                                        onDeleteCotisation(c.id);
                                      }
                                    }}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded shrink-0 cursor-pointer"
                                    title="Annuler le paiement"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Footer */}
                  <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between gap-3">
                    <button
                      onClick={() => {
                        setPayFoyerCode(foyer.code);
                        setIsPayModalOpen(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center space-x-1.5 transition whitespace-nowrap cursor-pointer shadow-3xs"
                    >
                      <PlusCircle className="h-4 w-4" />
                      <span>Saisir une mensualité</span>
                    </button>
                    <button
                      onClick={() => setSelectedFoyerCode(null)}
                      className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold py-2 px-4 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                    >
                      Fermer la Fiche
                    </button>
                  </div>

                </div>
              </div>
            );
          })()}

          {/* RECORD PAYMENT MODAL */}
          {isPayModalOpen && (() => {
            const f = foyers.find(codeObj => codeObj.code === payFoyerCode);
            return (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
                <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-slate-200 overflow-hidden">
                  
                  {/* Header */}
                  <div className="bg-indigo-900 text-white p-5 flex justify-between items-center">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono tracking-widest text-indigo-200 uppercase font-black">Encaissement Trésorerie</span>
                      <h3 className="text-sm font-bold font-sans leading-none mt-1">Cotisation Commune "Adidy"</h3>
                    </div>
                    <button onClick={() => { setIsPayModalOpen(false); }} className="text-indigo-200 hover:bg-indigo-850 p-1 rounded-full cursor-pointer">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Form Body */}
                  <div className="p-6 space-y-4 text-xs font-sans">
                    
                    {/* Household selector */}
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-450 block">Sélectionner Foyer (Fokontany)</label>
                      <select 
                        value={payFoyerCode}
                        onChange={(e) => {
                          setPayFoyerCode(e.target.value);
                          setPayPayerId('');
                        }}
                        className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:outline-hidden focus:border-indigo-500 font-sans"
                      >
                        {foyers.map(f => (
                          <option key={f.code} value={f.code}>[{f.code}] FAMILLE {f.chefName}</option>
                        ))}
                      </select>
                    </div>

                    {/* Member payer selector */}
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-455 block">Bénéficiaire / Membre Payeur</label>
                      <select 
                        value={payPayerId}
                        onChange={(e) => setPayPayerId(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:outline-hidden focus:border-indigo-500"
                      >
                        <option value="">-- Foyer Global (Tête de Famille) --</option>
                        {f?.members.map(member => (
                          <option key={member.id} value={member.id}>{member.nom} {member.prenom}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Month Selector */}
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-slate-450 block">Mois Concerné</label>
                        <select 
                          value={payMonth}
                          onChange={(e) => setPayMonth(Number(e.target.value))}
                          className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:outline-hidden focus:border-indigo-500"
                        >
                          {MONTHS_MALAGASY.map(m => (
                            <option key={m.num} value={m.num}>{m.name} 2026</option>
                          ))}
                        </select>
                      </div>

                      {/* Amount Input */}
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-slate-450 block">Montant Adidy (Ariary)</label>
                        <input 
                          type="number" 
                          value={payAmount}
                          step="1000"
                          min="1000"
                          onChange={(e) => setPayAmount(Number(e.target.value))}
                          className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:outline-hidden focus:border-indigo-500 font-mono text-right"
                        />
                      </div>
                    </div>

                    {/* Responsable */}
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-450 block">Visa / Signature Administrateur Fokontany</label>
                      <input 
                        type="text" 
                        value={payResponsable}
                        onChange={(e) => setPayResponsable(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:outline-hidden focus:border-indigo-550"
                      />
                    </div>

                    <div className="text-[10px] p-3 border border-indigo-150 bg-indigo-50/40 text-indigo-850 rounded-lg leading-relaxed mt-2 animate-fadeIn">
                      <p>💡 <strong>Note d'impact budgétaire:</strong> La validation de cette cotisation génère un reçu fiscal numérique, enregistre une recette de caisse et régularise l'état civique de la famille <strong>{payFoyerCode}</strong>.</p>
                    </div>

                  </div>

                  {/* Actions */}
                  <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end space-x-2">
                    <button
                      onClick={() => setIsPayModalOpen(false)}
                      className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold py-2 px-4 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => {
                        const recNum = `REC-ADIDY-26-${Math.floor(1000 + Math.random() * 9000)}`;
                        onAddCotisation({
                          codeMenage: payFoyerCode,
                          habitantId: payPayerId || undefined,
                          annee: 2026,
                          mois: payMonth,
                          montant: payAmount,
                          datePaiement: new Date().toISOString(),
                          responsable: payResponsable,
                          recuNo: recNum
                        });
                        setIsPayModalOpen(false);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-4 rounded-lg shadow-xs transition cursor-pointer"
                    >
                      Enregistrer et émettre le Reçu
                    </button>
                  </div>

                </div>
              </div>
            );
          })()}

          {/* ADIDY PRINTABLE RECEIPT MODAL */}
          {printableReceipt && (() => {
            const foyer = foyers.find(f => f.code === printableReceipt.codeMenage);
            const payerName = printableReceipt.habitantId 
              ? foyer?.members.find(m => m.id === printableReceipt.habitantId) ? `${foyer.members.find(m => m.id === printableReceipt.habitantId)?.nom} ${foyer.members.find(m => m.id === printableReceipt.habitantId)?.prenom}` : foyer?.chefName
              : 'Cotisation Globale Ménage';
            const monthName = MONTHS_MALAGASY.find(m => m.num === printableReceipt.mois)?.name;

            return (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
                  
                  {/* Header tools */}
                  <div className="bg-slate-100 px-5 py-3 border-b border-slate-200 flex justify-between items-center select-none shrink-0 font-sans">
                    <span className="text-xs font-bold text-slate-700 font-sans block">Reçu de Caisse Numérique (Adidy Fokontany)</span>
                    <div className="flex space-x-1">
                      <button 
                        onClick={() => {
                          const originalTitle = document.title;
                          document.title = `RECU-ADIDY-${printableReceipt.recuNo}`;
                          window.print();
                          document.title = originalTitle;
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 font-sans text-white text-[11px] font-bold py-1.5 px-3 rounded-lg transition flex items-center shrink-0 cursor-pointer"
                      >
                        <Printer className="h-3.5 w-3.5 mr-1" /> Imprimer
                      </button>
                      <button onClick={() => setPrintableReceipt(null)} className="p-1 rounded-full text-slate-400 hover:bg-slate-200 shrink-0 cursor-pointer">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Printable layout */}
                  <div className="p-8 text-slate-900 font-sans leading-relaxed overflow-y-auto relative border-b border-slate-100" id="adidy-receipt-printable-body">
                    
                    {/* Header stamps */}
                    <div className="flex justify-between items-start text-[10px] font-sans pb-4 border-b border-slate-200 font-medium">
                      <div>
                        <p className="font-extrabold uppercase text-slate-800">REPOBLIKAN'I MADAGASIKARA</p>
                        <p className="italic text-[8px] text-slate-500 font-sans mt-0.5">"Fitiavana - Tanindrazana - Fandrosoana"</p>
                        <p className="mt-1 text-indigo-900 font-bold uppercase font-sans">FOKONTANY AMBOHITANTELY • COMMUNE URBAN ANTANANARIVO</p>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-[11px] text-slate-850">REÇU ADIDY FOKONTANY</p>
                        <p className="text-[10px] font-mono font-black text-indigo-700">Réf: {printableReceipt.recuNo}</p>
                      </div>
                    </div>

                    <h2 className="text-center text-sm uppercase underline underline-offset-4 tracking-widest font-black py-4 font-sans text-indigo-950">
                      REÇU DE DROITS ET ADIDY CIVIQUE
                    </h2>

                    {/* Receipt variables */}
                    <div className="text-xs font-mono space-y-2 pt-2 border-l-2 border-indigo-650 pl-4 bg-slate-50/50 p-3 rounded-r-lg">
                      <p className="flex justify-between">
                        <span className="text-slate-450 uppercase font-sans font-bold text-[9px]">Foyer de Cotisation:</span>
                        <strong className="text-slate-900 text-xs font-sans uppercase">FAMILLE {foyer?.chefName} ({printableReceipt.codeMenage})</strong>
                      </p>
                      <p className="flex justify-between border-t border-slate-205/65 pt-1.5">
                        <span className="text-slate-450 uppercase font-sans font-bold text-[9px]">Secteur / Adresse:</span>
                        <span className="font-sans text-xs text-slate-800">{foyer?.adresse}</span>
                      </p>
                      <p className="flex justify-between border-t border-slate-205/65 pt-1.5">
                        <span className="text-slate-450 uppercase font-sans font-bold text-[9px]">Titulaire du versement:</span>
                        <span className="font-sans text-xs text-slate-800">{payerName}</span>
                      </p>
                      <p className="flex justify-between border-t border-slate-205/65 pt-1.5">
                        <span className="text-slate-450 uppercase font-sans font-bold text-[9px]">Objet du règlement:</span>
                        <span className="font-sans text-xs text-slate-800 font-medium">Contribution Civique Annuelle d'Amélioration Sociale</span>
                      </p>
                      <p className="flex justify-between border-t border-slate-205/65 pt-1.5">
                        <span className="text-slate-450 uppercase font-sans font-bold text-[9px]">Mois Régularisé:</span>
                        <strong className="text-xs font-sans text-indigo-950">Mois de {monthName} {printableReceipt.annee}</strong>
                      </p>
                      <p className="flex justify-between border-t border-slate-205/65 pt-1.5">
                        <span className="text-slate-450 uppercase font-sans font-bold text-[9px]">Date d'encaissement:</span>
                        <span className="font-sans text-xs text-slate-800">{new Date(printableReceipt.datePaiement).toLocaleDateString('fr-FR')} • {new Date(printableReceipt.datePaiement).toLocaleTimeString('fr-FR')}</span>
                      </p>
                    </div>

                    {/* Large amount label */}
                    <div className="my-6 p-4 rounded-xl bg-slate-50 text-center border-2 border-dashed border-slate-250 select-none">
                      <span className="text-[10px] font-sans text-slate-400 block font-bold uppercase tracking-wider">MONTANT REÇU À LA CAISSE</span>
                      <strong className="text-xl font-bold font-mono text-indigo-900 tracking-wide block mt-1">
                        {printableReceipt.montant.toLocaleString('fr-FR')} Ar
                      </strong>
                      <span className="text-[9.5px] font-sans text-slate-450 block mt-0.5">(Cinq Mille Ariary net et non-substituable)</span>
                    </div>

                    {/* Seal design */}
                    <div className="flex justify-between items-center text-[10px] font-sans pt-4 border-t border-slate-150 select-none">
                      <div className="relative w-16 h-16 border border-dashed border-red-500 rounded-full flex items-center justify-center text-center text-[6px] font-bold text-red-500/80 uppercase">
                        Sceau d'État Caisse
                      </div>
                      <div className="text-right space-y-1">
                        <p>Fait à Ambohitantely, le {new Date(printableReceipt.datePaiement).toLocaleDateString('fr-FR')}</p>
                        <p className="font-sans font-bold uppercase text-[9px] text-slate-700">Le Trésorier du Fokontany :</p>
                        <p className="font-mono text-indigo-900 italic font-bold text-[9.5px]">{printableReceipt.responsable}</p>
                      </div>
                    </div>

                  </div>

                  {/* Close footer */}
                  <div className="p-4 bg-slate-50 border-t border-slate-100 text-right shrink-0">
                    <button
                      onClick={() => setPrintableReceipt(null)}
                      className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold py-2 px-4 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                    >
                      Fermer l'aperçu
                    </button>
                  </div>

                </div>
              </div>
            );
          })()}

        </div>
      )}

    </div>
  );
}
