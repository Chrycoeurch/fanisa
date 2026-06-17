import React, { useState } from 'react';
import { Materiel } from '../types';
import { 
  Package, Wrench, Shield, CheckCircle, AlertTriangle, 
  Search, Plus, X, Calendar, MapPin, User, Tag, 
  HelpCircle, Trash2, ArrowRightLeft, Landmark
} from 'lucide-react';

interface MaterialsModuleProps {
  materiels: Materiel[];
  onAddMateriel: (newMat: Omit<Materiel, 'id'>) => void;
  onUpdateMateriel: (updatedMat: Materiel) => void;
  onDeleteMateriel: (id: string) => void;
  habitantsList?: { id: string; nom: string; prenom: string }[];
}

interface LoanRecord {
  id: string;
  materielId: string;
  borrowerName: string;
  dateEmprunt: string;
  dateRetourPrevue: string;
  quantite: number;
  statut: 'En cours' | 'Retourné';
}

export default function MaterialsModule({
  materiels,
  onAddMateriel,
  onUpdateMateriel,
  onDeleteMateriel,
  habitantsList = []
}: MaterialsModuleProps) {
  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterEtat, setFilterEtat] = useState<string>('all');
  
  // New asset form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formNom, setFormNom] = useState('');
  const [formCategorie, setFormCategorie] = useState<Materiel['categorie']>('Mobilier');
  const [formQtyTotal, setFormQtyTotal] = useState<number>(1);
  const [formEtat, setFormEtat] = useState<Materiel['etat']>('Excellent');
  const [formValeur, setFormValeur] = useState<number>(0);
  const [formResponsable, setFormResponsable] = useState('Secrétaire Fokontany');
  const [formStockage, setFormStockage] = useState('Grande salle du Fokontany');

  // Loans tracker mock persistent state inside component local storage
  const [loans, setLoans] = useState<LoanRecord[]>(() => {
    const saved = localStorage.getItem('fokontany_loans');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'loan-001',
        materielId: 'mat-001', // Chaises en plastique
        borrowerName: 'RABE (Ménage MEN-001)',
        dateEmprunt: '2026-06-12',
        dateRetourPrevue: '2026-06-18',
        quantite: 10,
        statut: 'En cours'
      },
      {
        id: 'loan-002',
        materielId: 'mat-003', // Megaphone
        borrowerName: 'RAKOTO (Comité Quartier)',
        dateEmprunt: '2026-06-14',
        dateRetourPrevue: '2026-06-16',
        quantite: 1,
        statut: 'Retourné'
      }
    ];
  });

  const syncLoans = (updated: LoanRecord[]) => {
    setLoans(updated);
    localStorage.setItem('fokontany_loans', JSON.stringify(updated));
  };

  // Loan Form State
  const [isLoanOpen, setIsLoanOpen] = useState(false);
  const [selectedMatForLoan, setSelectedMatForLoan] = useState<Materiel | null>(null);
  const [loanQty, setLoanQty] = useState(1);
  const [loanBorrower, setLoanBorrower] = useState('');
  const [loanReturnDate, setLoanReturnDate] = useState('');

  // Computations
  const totalQuantity = materiels.reduce((sum, m) => sum + m.quantiteTotal, 0);
  const availableQuantity = materiels.reduce((sum, m) => sum + m.quantiteDisponible, 0);
  const totalDamagedItems = materiels.filter(m => m.etat === 'En panne' || m.etat === 'Détérioré').length;
  const totalAssetsValue = materiels.reduce((sum, m) => sum + (m.valeurEstimee || 0), 0);

  // Filters items
  const filteredMateriels = materiels.filter(m => {
    const matchesCategory = filterCategory === 'all' || m.categorie === filterCategory;
    const matchesEtat = filterEtat === 'all' || m.etat === filterEtat;
    const matchesSearch = m.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          m.responsable.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          m.lieuStockage.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesEtat && matchesSearch;
  });

  const handleCreateAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNom.trim()) {
      alert("Le nom de l'équipement est requis.");
      return;
    }
    if (formQtyTotal <= 0) {
      alert("La quantité doit être supérieure à zéro.");
      return;
    }

    onAddMateriel({
      nom: formNom,
      categorie: formCategorie,
      quantiteTotal: formQtyTotal,
      quantiteDisponible: formQtyTotal, // Initial available is equals to total
      etat: formEtat,
      dateAcquisition: new Date().toISOString().split('T')[0],
      valeurEstimee: formValeur,
      responsable: formResponsable,
      lieuStockage: formStockage
    });

    setIsFormOpen(false);
    // Reset Form
    setFormNom('');
    setFormQtyTotal(1);
    setFormValeur(0);
  };

  // Handle reporting a broken status on equipment
  const handleQuickStatusChange = (materiel: Materiel, newEtat: Materiel['etat']) => {
    const updated = {
      ...materiel,
      etat: newEtat
    };
    onUpdateMateriel(updated);
  };

  // Handle Loans & Hire Out
  const handleOpenLoanDialog = (mat: Materiel) => {
    setSelectedMatForLoan(mat);
    setLoanQty(1);
    setLoanBorrower('');
    // default tomorrow as return date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    setLoanReturnDate(tomorrow.toISOString().split('T')[0]);
    setIsLoanOpen(true);
  };

  const handleRegisterLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatForLoan) return;
    if (loanQty <= 0 || loanQty > selectedMatForLoan.quantiteDisponible) {
      alert(`La quantité à emprunter doit être comprise entre 1 et ${selectedMatForLoan.quantiteDisponible}`);
      return;
    }
    if (!loanBorrower.trim()) {
      alert("Le nom de l'emprunteur est requis.");
      return;
    }

    // Decrement available quantity in original material
    const updatedMaterial: Materiel = {
      ...selectedMatForLoan,
      quantiteDisponible: selectedMatForLoan.quantiteDisponible - loanQty
    };
    onUpdateMateriel(updatedMaterial);

    // Register active loan record
    const newLoan: LoanRecord = {
      id: `loan-${Date.now()}`,
      materielId: selectedMatForLoan.id,
      borrowerName: loanBorrower,
      dateEmprunt: new Date().toISOString().split('T')[0],
      dateRetourPrevue: loanReturnDate,
      quantite: loanQty,
      statut: 'En cours'
    };

    syncLoans([...loans, newLoan]);
    setIsLoanOpen(false);
    setSelectedMatForLoan(null);
  };

  const handleReturnLoan = (loan: LoanRecord) => {
    const mat = materiels.find(m => m.id === loan.materielId);
    if (!mat) {
      alert("Matériel introuvable.");
      return;
    }

    // Increment back quantity of available
    const updatedMaterial: Materiel = {
      ...mat,
      quantiteDisponible: Math.min(mat.quantiteTotal, mat.quantiteDisponible + loan.quantite)
    };
    onUpdateMateriel(updatedMaterial);

    // Set loan as returned
    const updatedLoans = loans.map(l => {
      if (l.id === loan.id) return { ...l, statut: 'Retourné' as const };
      return l;
    });
    syncLoans(updatedLoans);
  };

  const handleDeleteLoanRecord = (id: string) => {
    if (confirm("Supprimer l'archivage de ce prêt de matériel ?")) {
      syncLoans(loans.filter(l => l.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. SECTOR METRICS MODULES */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Metric 1: Total catalog items */}
        <div className="p-4 bg-white border border-slate-205 rounded-xl shadow-3xs flex items-center space-x-3.5">
          <div className="w-10 h-10 bg-indigo-50 border border-indigo-150 rounded-lg flex items-center justify-center shrink-0 text-indigo-700 font-bold">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Volume Équipements</span>
            <div className="flex items-baseline space-x-1">
              <strong className="text-lg font-black text-slate-900 leading-none">{totalQuantity}</strong>
              <span className="text-[10px] text-slate-500">unités recensées</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Available Stock */}
        <div className="p-4 bg-white border border-slate-205 rounded-xl shadow-3xs flex items-center space-x-3.5">
          <div className="w-10 h-10 bg-emerald-50 border border-emerald-150 rounded-lg flex items-center justify-center shrink-0 text-emerald-700">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Disponibles Stocks</span>
            <div className="flex items-baseline space-x-1">
              <strong className="text-lg font-black text-emerald-800 leading-none">{availableQuantity}</strong>
              <span className="text-[10px] text-slate-500">en réserve locale</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Broken Equipment and repairs needed */}
        <div className="p-4 bg-white border border-slate-205 rounded-xl shadow-3xs flex items-center space-x-3.5">
          <div className="w-10 h-10 bg-amber-50 border border-amber-150 rounded-lg flex items-center justify-center shrink-0 text-amber-700">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Avaries / En maintenance</span>
            <div className="flex items-baseline space-x-1">
              <strong className="text-lg font-black text-amber-800 leading-none">{totalDamagedItems}</strong>
              <span className="text-[10px] text-slate-500">postes d'assistance</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Asset monetary Value */}
        <div className="p-4 bg-gradient-to-br from-indigo-950 to-slate-900 border border-slate-800 rounded-xl shadow-3xs flex items-center space-x-3.5 text-white">
          <div className="w-10 h-10 bg-indigo-900/50 border border-indigo-700/50 rounded-lg flex items-center justify-center shrink-0 text-indigo-300">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-indigo-300 block font-mono">Valeur Globale Estimée</span>
            <div className="flex items-baseline space-x-1">
              <strong className="text-sm font-black font-mono leading-none">{totalAssetsValue.toLocaleString('fr-FR')}</strong>
              <span className="text-[9px] uppercase font-semibold text-indigo-300">Ariary</span>
            </div>
          </div>
        </div>

      </div>

      {/* 2. EQUIPMENT MATRIX CATALOG */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* MAIN EQUIPMENT INVENTORY TABLE */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          
          {/* Filtering row */}
          <div className="p-4 bg-slate-50 border-b border-slate-150 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-indigo-600" />
              <h3 className="font-sans font-bold text-slate-900 text-xs uppercase tracking-wider">
                Registre Général des Équipements Communs
              </h3>
            </div>

            <button
              onClick={() => setIsFormOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span>Inscrire un Matériel</span>
            </button>
          </div>

          <div className="p-3 border-b border-slate-100 flex flex-wrap gap-2 items-center justify-between">
            {/* search and categories */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input 
                type="text"
                placeholder="Rechercher mobilier, mégaphone, responsable..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 outline-hidden"
              />
            </div>

            <div className="flex gap-1.5">
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="text-xs border border-slate-200 bg-white rounded-md p-1 font-medium"
              >
                <option value="all">Toutes Catégories</option>
                <option value="Mobilier">Mobilier</option>
                <option value="Informatique">Informatique</option>
                <option value="Logistique">Logistique</option>
                <option value="Événementiel">Événementiel</option>
                <option value="Sécurité">Sécurité</option>
                <option value="Autre">Autre</option>
              </select>

              <select
                value={filterEtat}
                onChange={e => setFilterEtat(e.target.value)}
                className="text-xs border border-slate-200 bg-white rounded-md p-1 font-medium"
              >
                <option value="all">Tous États</option>
                <option value="Excellent">Excellent</option>
                <option value="Bon">Bon</option>
                <option value="Moyen">Moyen</option>
                <option value="Détérioré">Détérioré</option>
                <option value="En panne">En panne</option>
              </select>
            </div>
          </div>

          {/* Table List of equipment */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-150 text-slate-450 uppercase font-mono text-[9px]">
                  <th className="p-3">Désignation</th>
                  <th className="p-3">Catégorie</th>
                  <th className="p-3 text-center">Quantité (Dispo / Total)</th>
                  <th className="p-3">État actuel</th>
                  <th className="p-3">Lieu Stockage</th>
                  <th className="p-3">Responsable</th>
                  <th className="p-3 text-right">Valeur (Ar)</th>
                  <th className="p-2 w-28 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans text-slate-755">
                {filteredMateriels.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                      Aucun équipement enregistré d'après vos critères de recherche.
                    </td>
                  </tr>
                ) : (
                  filteredMateriels.map(mat => {
                    const getEtatColor = (et: Materiel['etat']) => {
                      switch (et) {
                        case 'Excellent': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
                        case 'Bon': return 'bg-cyan-50 text-cyan-800 border-cyan-250';
                        case 'Moyen': return 'bg-blue-50 text-blue-800 border-blue-200';
                        case 'Détérioré': return 'bg-amber-50 text-amber-800 border-amber-200';
                        case 'En panne': return 'bg-rose-50 text-rose-800 border-rose-200';
                        default: return 'bg-slate-50 text-slate-700';
                      }
                    };

                    return (
                      <tr key={mat.id} className="hover:bg-slate-50/40 transition">
                        <td className="p-3 font-semibold text-slate-900 block pt-4">
                          {mat.nom}
                        </td>
                        <td className="p-3 text-slate-500">
                          <span className="bg-slate-100 border p-0.5 px-2 rounded-sm text-[10px] font-bold text-slate-600">
                            {mat.categorie}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono">
                          <span className={`font-bold ${mat.quantiteDisponible === 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                            {mat.quantiteDisponible}
                          </span> 
                          <span className="text-slate-400 font-normal"> / {mat.quantiteTotal}</span>
                        </td>
                        <td className="p-3">
                          <select
                            value={mat.etat}
                            onChange={e => handleQuickStatusChange(mat, e.target.value as any)}
                            className={`p-1 px-1.5 border hover:border-slate-400 rounded-sm text-[10px] font-extrabold ${getEtatColor(mat.etat)}`}
                          >
                            <option value="Excellent">Excellent</option>
                            <option value="Bon">Bon</option>
                            <option value="Moyen">Moyen</option>
                            <option value="Détérioré">Détérioré</option>
                            <option value="En panne">En panne</option>
                          </select>
                        </td>
                        <td className="p-3 text-[11px] text-slate-600">
                          <div className="flex items-center">
                            <MapPin className="h-3 w-3 mr-1 text-slate-400 shrink-0" />
                            <span className="truncate">{mat.lieuStockage}</span>
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-slate-700">
                          {mat.responsable}
                        </td>
                        <td className="p-3 font-mono text-right font-medium text-slate-800">
                          {mat.valeurEstimee ? mat.valeurEstimee.toLocaleString('fr-FR') : '0'} Ar
                        </td>
                        <td className="p-2">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => handleOpenLoanDialog(mat)}
                              disabled={mat.quantiteDisponible <= 0}
                              className="text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 px-2 py-1 rounded-sm disabled:bg-slate-50 disabled:border-slate-100 disabled:text-slate-400 cursor-pointer disabled:cursor-not-allowed"
                              title="Prêter cet équipement"
                            >
                              Prêter
                            </button>
                            <button
                              onClick={() => {
                                if (confirm("Supprimer définitivement cet équipement du registre Fokontany ?")) {
                                  onDeleteMateriel(mat.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="Supprimer la fiche matériel"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

        {/* SIDEBAR: LOAN AND HIRE CITIZENS STATUS LIST */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden flex flex-col">
          
          <div className="p-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ArrowRightLeft className="h-4 w-4 text-emerald-600" />
              <h3 className="font-sans font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                Registre Prêts & Emprunts Actifs
              </h3>
            </div>
            <span className="bg-emerald-100 text-emerald-800 font-mono text-[10px] px-2 py-0.5 rounded-full font-bold">
              {loans.filter(l => l.statut === 'En cours').length} actifs
            </span>
          </div>

          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            <p className="text-[11px] text-slate-400 italic">
              Registre pour tracer les biens municipaux (chaises, mégaphones, bâches pour événements) accordés en prêt temporaire gratuit aux habitants.
            </p>

            <div className="divide-y divide-slate-150">
              {loans.length === 0 ? (
                <div className="text-center py-8 text-slate-400 italic text-[11px]">
                  Aucun prêt actif enregistré dans le fokontany.
                </div>
              ) : (
                loans.map(loan => {
                  const targetMat = materiels.find(m => m.id === loan.materielId);
                  const isReturned = loan.statut === 'Retourné';

                  return (
                    <div key={loan.id} className="py-3 text-xs space-y-1.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <strong className="text-slate-900 font-semibold">{loan.borrowerName}</strong>
                          <span className="text-[10px] text-slate-400 block">
                            Bien : {targetMat ? targetMat.nom : 'Inconnu'} • Quantité : <strong className="font-mono text-indigo-700">{loan.quantite}</strong>
                          </span>
                        </div>
                        <span className={`text-[9px] font-black font-mono uppercase px-1.5 py-0.5 rounded ${
                          isReturned 
                            ? 'bg-slate-100 text-slate-600' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isReturned ? 'RECONSTITUÉ' : 'EN COURS'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          Restitution : {new Date(loan.dateRetourPrevue).toLocaleDateString('fr-FR')}
                        </span>

                        {!isReturned ? (
                          <button
                            onClick={() => handleReturnLoan(loan)}
                            className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-150 px-2 py-0.5 rounded-sm transition"
                          >
                            ✓ Rapprocher (Retour)
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDeleteLoanRecord(loan.id)}
                            className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition"
                            title="Effacer l'historique"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

      {/* 3. NEW ASSET INLINE REGISTRATION PROCESS POPUP */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-200 overflow-hidden shadow-2xl animate-scaleUp">
            
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-950 uppercase text-xs tracking-wider">
                Inscrire un Équipement au Patrimoine Fokontany
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="p-5 space-y-4 text-xs">
              
              <div className="space-y-1">
                <label className="text-slate-500 uppercase tracking-wide font-black text-[10px]">Désignation / Nom du matériel</label>
                <input
                  type="text"
                  required
                  value={formNom}
                  onChange={e => setFormNom(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 focus:bg-white text-slate-900 border border-slate-205 rounded-lg focus:border-indigo-500 text-sm"
                  placeholder="Ex: Mégaphone rechargeable, Chaises vertes..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-500 uppercase tracking-wide font-black text-[10px]">Catégories de biens</label>
                  <select
                    value={formCategorie}
                    onChange={e => setFormCategorie(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-205 rounded-lg focus:border-indigo-500"
                  >
                    <option value="Mobilier">Mobilier Fokontany</option>
                    <option value="Informatique">Matériel Informatique</option>
                    <option value="Logistique">Service Logistique général</option>
                    <option value="Événementiel">Kit Événementiel public</option>
                    <option value="Sécurité">Sécurité & Vigilance quartier</option>
                    <option value="Autre">Autre catégorie</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 uppercase tracking-wide font-black text-[10px]">Quantité Acquise</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formQtyTotal}
                    onChange={e => setFormQtyTotal(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2 bg-slate-50 focus:bg-white border border-slate-205 rounded-lg focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-500 uppercase tracking-wide font-black text-[10px]">État de conservation</label>
                  <select
                    value={formEtat}
                    onChange={e => setFormEtat(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-205 rounded-lg focus:border-indigo-500"
                  >
                    <option value="Excellent">Excellent</option>
                    <option value="Bon">Bon</option>
                    <option value="Moyen">Moyen</option>
                    <option value="Détérioré">Détérioré / Abimé</option>
                    <option value="En panne">En panne / À réparer</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 uppercase tracking-wide font-black text-[10px]">Valeur unitaire estimée (Ar)</label>
                  <input
                    type="number"
                    min={0}
                    value={formValeur || ''}
                    onChange={e => setFormValeur(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full p-2 bg-slate-50 focus:bg-white border border-slate-205 rounded-lg focus:border-indigo-500 font-mono"
                    placeholder="Ex: 150000"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 uppercase tracking-wide font-black text-[10px]">Lieu de Stockage officiel</label>
                <input
                  type="text"
                  required
                  value={formStockage}
                  onChange={e => setFormStockage(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-250 rounded-lg text-slate-800"
                  placeholder="Ex: Grand placard du Fokontany..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 uppercase tracking-wide font-black text-[10px]">Responsable du visa gardien</label>
                <input
                  type="text"
                  required
                  value={formResponsable}
                  onChange={e => setFormResponsable(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-250 rounded-lg text-slate-800"
                  placeholder="Ex: Secrétaire Fokontany"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition"
                >
                  Déclarer cet équipement
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* 4. LOAN BOOKING DIALOG FOR A DÉSIGNATED ASSET */}
      {isLoanOpen && selectedMatForLoan && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm border border-slate-200 overflow-hidden shadow-2xl animate-scaleUp">
            
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-950 uppercase text-xs tracking-wider">
                Accorder un prêt de matériel
              </h3>
              <button onClick={() => { setIsLoanOpen(false); setSelectedMatForLoan(null); }} className="text-slate-400 hover:text-slate-600 font-bold">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterLoan} className="p-5 space-y-4 text-xs">
              
              <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-lg text-slate-950 space-y-1">
                <span className="text-[10px] uppercase text-indigo-700 tracking-wider block font-bold">ÉQUIPEMENT SÉLECTIONNÉ :</span>
                <p className="font-semibold text-xs font-sans text-indigo-950">{selectedMatForLoan.nom}</p>
                <p className="font-mono text-[10px]">Quantité utilisable disponible : <strong className="text-indigo-800 font-extrabold">{selectedMatForLoan.quantiteDisponible}</strong> unités</p>
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 uppercase tracking-wide font-black text-[10px]">Quantité à prêter</label>
                <input
                  type="number"
                  min={1}
                  max={selectedMatForLoan.quantiteDisponible}
                  required
                  value={loanQty}
                  onChange={e => setLoanQty(Math.min(selectedMatForLoan.quantiteDisponible, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full p-2 bg-slate-50 text-slate-900 border border-slate-205 focus:border-indigo-500 focus:bg-white rounded-lg text-sm font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 uppercase tracking-wide font-black text-[10px]">Bénéficiaire / Habitant Emprunteur (Réf)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: RAMANANJARA Jean (Volontaire quartier)"
                  value={loanBorrower}
                  onChange={e => setLoanBorrower(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 text-slate-900 border border-slate-205 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 uppercase tracking-wide font-black text-[10px]">Date de Retour Prévue</label>
                <input
                  type="date"
                  required
                  value={loanReturnDate}
                  onChange={e => setLoanReturnDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-205 rounded-lg text-xs font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => { setIsLoanOpen(false); setSelectedMatForLoan(null); }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition"
                >
                  Confirmer le prêt
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
