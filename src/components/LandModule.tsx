import React, { useState, useMemo } from 'react';
import { LotFoncier, TransfertOrigine, Habitant } from '../types';
import { 
  MapPin, Landmark, Calendar, Trash2, Edit2, PlusCircle, 
  FileText, ArrowRight, ShieldAlert, Search, Users, 
  AlertCircle, DollarSign, FileClock, ClipboardList, Info, HelpCircle
} from 'lucide-react';

interface LandModuleProps {
  allResidents: Habitant[];
  onAddLog: (action: 'Foncier' | 'Succession', details: string, habitantId?: string) => void;
}

const initialLands: LotFoncier[] = [
  {
    id: 'lot-1',
    numeroLot: 'LOT 24 Bis',
    titreFoncier: 'T-10254-UA',
    cadastreRef: 'SEC-A-012',
    superficie: 320,
    adresse: 'Ambohitantely Nord, Rue de l\'Église',
    statutOccupant: 'Propriétaire',
    occupantsMenageCode: 'MEN-001',
    typeUsage: 'Habitation',
    notes: 'Maison familiale en briques cuites traditionnelles, R+1 en bon état général.',
    historiqueSuccessions: [
      {
        id: 'trans-1',
        date: '2012-05-14',
        typeTransfert: 'Achat',
        description: 'Vente à l\'amiable du terrain non bâti devant notaire agréé.',
        montantTransaction: 4500000,
        ancienProprietaire: 'RAKOTOMALALA Henri',
        nouveauProprietaire: 'ANDRIANARIVO Solo',
        piecesJustificatives: 'Acte authentique Nº 142/2012-Not'
      },
      {
        id: 'trans-2',
        date: '2024-03-10',
        typeTransfert: 'Succession',
        description: 'Droits de succession attribués par dévoluton légitime suite au décès du chef de foyer principal.',
        ancienProprietaire: 'ANDRIANARIVO Solo',
        nouveauProprietaire: 'ANDRIANARIVO Lala (Fils aîné)',
        piecesJustificatives: 'Acte de notoriété d\'hérédité Nº 35/2024-FOK'
      }
    ]
  },
  {
    id: 'lot-2',
    numeroLot: 'LOT 105',
    titreFoncier: 'T-8521-IND',
    cadastreRef: 'SEC-B-045',
    superficie: 1250,
    adresse: 'Ambohitantely Ouest, Secteur Maraîcher',
    statutOccupant: 'Locataire',
    occupantsMenageCode: 'MEN-002',
    typeUsage: 'Agricole',
    notes: 'Parcelle hydro-agricole cultivable louée pour la production de riz et maraîchage.',
    historiqueSuccessions: [
      {
        id: 'trans-3',
        date: '2018-09-01',
        typeTransfert: 'Don',
        description: 'Donation de la parcelle agricole pour exploitation communautaire locale.',
        ancienProprietaire: 'RANARIVELO Pierre',
        nouveauProprietaire: 'RASOLOFO Jean-Luc',
        piecesJustificatives: 'Lettre de donation enregistrée municipal d\'Ambohitantely'
      }
    ]
  },
  {
    id: 'lot-3',
    numeroLot: 'LOT 89',
    titreFoncier: undefined,
    cadastreRef: 'SEC-C-190',
    superficie: 410,
    adresse: 'Ambohitantely Est, Lot 89',
    statutOccupant: 'Litigieux',
    occupantsMenageCode: 'MEN-003',
    typeUsage: 'Mixte',
    notes: 'Différend de bornage en cours avec le propriétaire du lot adjacent. Arbitrage en attente auprès du Comité local.',
    historiqueSuccessions: [
      {
        id: 'trans-4',
        date: '2021-11-20',
        typeTransfert: 'Partage',
        description: 'Partage successoral à l\'issue d\'un arbitrage familial épineux.',
        ancienProprietaire: 'Indivis RALAIVOAVY',
        nouveauProprietaire: 'RALAIVOAVY Martial & RALAIVOAVY Sylvain',
        piecesJustificatives: 'Cahier des charges de partage indivisaire mineur'
      }
    ]
  }
];

export default function LandModule({ allResidents, onAddLog }: LandModuleProps) {
  // Local persistent state for lands
  const [lands, setLands] = useState<LotFoncier[]>(() => {
    const saved = localStorage.getItem('fokontany_lands');
    return saved ? JSON.parse(saved) : initialLands;
  });

  const saveLands = (updated: LotFoncier[]) => {
    setLands(updated);
    localStorage.setItem('fokontany_lands', JSON.stringify(updated));
  };

  // Selection states
  const [selectedLandId, setSelectedLandId] = useState<string | null>(() => {
    const saved = localStorage.getItem('fokontany_lands');
    const parsed = saved ? JSON.parse(saved) : initialLands;
    return parsed.length > 0 ? parsed[0].id : null;
  });

  const selectedLand = lands.find(l => l.id === selectedLandId);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'Tous' | 'Habitation' | 'Commercial' | 'Agricole' | 'Mixte'>('Tous');
  const [occupFilter, setOccupFilter] = useState<'Tous' | 'Propriétaire' | 'Locataire' | 'Occupant à titre gratuit' | 'Indivis Civils' | 'Litigieux'>('Tous');

  // Land form dialog and state
  const [isLandFormOpen, setIsLandFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formId, setFormId] = useState('');
  const [formNumLot, setFormNumLot] = useState('');
  const [formTitre, setFormTitre] = useState('');
  const [formCadastre, setFormCadastre] = useState('');
  const [formSuperficie, setFormSuperficie] = useState('');
  const [formAdresse, setFormAdresse] = useState('');
  const [formStatutOccup, setFormStatutOccup] = useState<LotFoncier['statutOccupant']>('Propriétaire');
  const [formMenageCode, setFormMenageCode] = useState('');
  const [formUsage, setFormUsage] = useState<LotFoncier['typeUsage']>('Habitation');
  const [formNotes, setFormNotes] = useState('');

  // Succession form dialog state
  const [isSuccessionFormOpen, setIsSuccessionFormOpen] = useState(false);
  const [succType, setSuccType] = useState<TransfertOrigine['typeTransfert']>('Achat');
  const [succDate, setSuccDate] = useState(new Date().toISOString().split('T')[0]);
  const [succDesc, setSuccDesc] = useState('');
  const [succMontant, setSuccMontant] = useState('');
  const [succAncien, setSuccAncien] = useState('');
  const [succNouveau, setSuccNouveau] = useState('');
  const [succPiece, setSuccPiece] = useState('');

  // Search filter
  const filteredLands = useMemo(() => {
    return lands.filter(land => {
      const matchSearch = 
        land.numeroLot.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (land.titreFoncier && land.titreFoncier.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (land.cadastreRef && land.cadastreRef.toLowerCase().includes(searchQuery.toLowerCase())) ||
        land.adresse.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (land.occupantsMenageCode && land.occupantsMenageCode.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchType = typeFilter === 'Tous' || land.typeUsage === typeFilter;
      const matchOccup = occupFilter === 'Tous' || land.statutOccupant === occupFilter;

      return matchSearch && matchType && matchOccup;
    });
  }, [lands, searchQuery, typeFilter, occupFilter]);

  // Load residents in the current households linked with selected land
  const linkedResidents = useMemo(() => {
    if (!selectedLand || !selectedLand.occupantsMenageCode) return [];
    return allResidents.filter(r => r.famille.codeMenage === selectedLand.occupantsMenageCode);
  }, [allResidents, selectedLand]);

  // Open Add Land plot Form
  const handleOpenAddLand = () => {
    setIsEditMode(false);
    setFormId(`lot-${Date.now()}`);
    setFormNumLot('');
    setFormTitre('');
    setFormCadastre('');
    setFormSuperficie('');
    setFormAdresse('');
    setFormStatutOccup('Propriétaire');
    setFormMenageCode('');
    setFormUsage('Habitation');
    setFormNotes('');
    setIsLandFormOpen(true);
  };

  // Open Edit Land plot Form
  const handleOpenEditLand = (lot: LotFoncier) => {
    setIsEditMode(true);
    setFormId(lot.id);
    setFormNumLot(lot.numeroLot);
    setFormTitre(lot.titreFoncier || '');
    setFormCadastre(lot.cadastreRef || '');
    setFormSuperficie(lot.superficie.toString());
    setFormAdresse(lot.adresse);
    setFormStatutOccup(lot.statutOccupant);
    setFormMenageCode(lot.occupantsMenageCode || '');
    setFormUsage(lot.typeUsage);
    setFormNotes(lot.notes || '');
    setIsLandFormOpen(true);
  };

  // Submit Land Plot Form
  const handleSubmitLand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNumLot.trim() || !formAdresse.trim() || !formSuperficie.trim()) {
      alert("Le numéro du Lot, l'adresse, et la superficie sont requis.");
      return;
    }

    const valueSuperficie = Number(formSuperficie);
    if (isNaN(valueSuperficie) || valueSuperficie <= 0) {
      alert("Veuillez saisir une superficie numérique valide supérieure à zéro.");
      return;
    }

    if (isEditMode) {
      const updated = lands.map(l => {
        if (l.id === formId) {
          return {
            ...l,
            numeroLot: formNumLot.trim(),
            titreFoncier: formTitre.trim() || undefined,
            cadastreRef: formCadastre.trim() || undefined,
            superficie: valueSuperficie,
            adresse: formAdresse.trim(),
            statutOccupant: formStatutOccup,
            occupantsMenageCode: formMenageCode.trim().toUpperCase() || undefined,
            typeUsage: formUsage,
            notes: formNotes.trim() || undefined
          };
        }
        return l;
      });
      saveLands(updated);
      onAddLog('Foncier', `Mise à jour du lot foncier ${formNumLot} (${formAdresse})`);
    } else {
      const newLot: LotFoncier = {
        id: formId,
        numeroLot: formNumLot.trim(),
        titreFoncier: formTitre.trim() || undefined,
        cadastreRef: formCadastre.trim() || undefined,
        superficie: valueSuperficie,
        adresse: formAdresse.trim(),
        statutOccupant: formStatutOccup,
        occupantsMenageCode: formMenageCode.trim().toUpperCase() || undefined,
        typeUsage: formUsage,
        notes: formNotes.trim() || undefined,
        historiqueSuccessions: []
      };
      const updated = [...lands, newLot];
      saveLands(updated);
      setSelectedLandId(newLot.id);
      onAddLog('Foncier', `Création d'une nouvelle parcelle foncière : Lot ${formNumLot} - ${formAdresse}`);
    }
    setIsLandFormOpen(false);
  };

  // Delete Land Plot
  const handleDeleteLand = (id: string, name: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement le lot ${name} ?`)) {
      const updated = lands.filter(l => l.id !== id);
      saveLands(updated);
      onAddLog('Foncier', `Suppression définitive de la parcelle foncière : ${name}`);
      if (selectedLandId === id) {
        setSelectedLandId(updated.length > 0 ? updated[0].id : null);
      }
    }
  };

  // Submit Succession Log transaction
  const handleSubmitSuccession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!succNouveau.trim() || !succDesc.trim() || !succDate) {
      alert("La description, le nouveau titulaire légal et la date sont requis.");
      return;
    }

    const newEvent: TransfertOrigine = {
      id: `succ-${Date.now()}`,
      date: succDate,
      typeTransfert: succType,
      description: succDesc.trim(),
      montantTransaction: succMontant ? Number(succMontant) : undefined,
      ancienProprietaire: succAncien.trim() || undefined,
      nouveauProprietaire: succNouveau.trim(),
      piecesJustificatives: succPiece.trim() || undefined
    };

    if (selectedLand) {
      const updated = lands.map(l => {
        if (l.id === selectedLand.id) {
          return {
            ...l,
            historiqueSuccessions: [newEvent, ...(l.historiqueSuccessions || [])]
          };
        }
        return l;
      });
      saveLands(updated);

      // Attempt to link log with codeMenage if possible
      let matchedResidentId: string | undefined = undefined;
      // Tracing if the new proprietor matches any client name
      const queryName = succNouveau.toLowerCase();
      const match = allResidents.find(r => 
        queryName.includes(r.nom.toLowerCase()) || 
        queryName.includes(r.prenom.toLowerCase())
      );
      if (match) {
        matchedResidentId = match.id;
      }

      onAddLog('Succession', `Historisation de mutation foncière [${succType}] sur Lot ${selectedLand.numeroLot}. Nouveau titulaire : ${succNouveau}`, matchedResidentId);
      
      // Reset fields
      setIsSuccessionFormOpen(false);
      setSuccDesc('');
      setSuccMontant('');
      setSuccAncien('');
      setSuccNouveau('');
      setSuccPiece('');
    }
  };

  // Delete Succession transaction log
  const handleDeleteSuccession = (succId: string) => {
    if (!selectedLand) return;
    if (window.confirm("Voulez-vous supprimer cet événement de l'historique d'acquisition/succession ?")) {
      const updated = lands.map(l => {
        if (l.id === selectedLand.id) {
          return {
            ...l,
            historiqueSuccessions: l.historiqueSuccessions.filter(s => s.id !== succId)
          };
        }
        return l;
      });
      saveLands(updated);
      onAddLog('Succession', `Suppression d'une étape de succession sur Lot ${selectedLand.numeroLot}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Module Title Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-indigo-700">
            <Landmark className="h-5 w-5" />
            <h1 className="font-sans font-bold text-lg tracking-tight select-none">Foncier, Cadastre & Habitat du Fokontany</h1>
          </div>
          <p className="text-slate-450 font-sans text-xs mt-1 leading-normal">
            Gestion du cadastre local, statut légal des occupants de parcelles, traçabilité historique des origines de propriété et successions de lots territoriaux.
          </p>
        </div>
        <button
          onClick={handleOpenAddLand}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-bold text-xs p-2.5 px-4 rounded-xl shadow-3xs transition duration-150 flex items-center justify-center space-x-1 shrink-0 select-none cursor-pointer"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Nouvelle Parcelle</span>
        </button>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Search Filters & Parcels list */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs space-y-3">
            <span className="text-[10px] font-sans font-bold text-slate-500 uppercase tracking-widest block pb-1 border-b border-slate-100">Recherche & Filtres Parcelles</span>
            
            {/* Search Box */}
            <div className="relative">
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Nº de lot, Titre, adresse, code ménage..."
                className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 pl-8 bg-slate-50/50 focus:bg-white text-slate-800 focus:outline-hidden"
              />
              <Search className="absolute left-2.5 top-3 h-4 w-4 text-slate-450" />
            </div>

            {/* Grid Selectors for Filter */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-sans">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-400 block">Usage Terrain</label>
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value as any)}
                  className="w-full border border-slate-200 rounded p-1.5 bg-slate-50 font-medium cursor-pointer"
                >
                  <option value="Tous">Tous les usages</option>
                  <option value="Habitation">Habitation</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Agricole">Agricole</option>
                  <option value="Mixte">Mixte / Autre</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-400 block">Statut occupant</label>
                <select
                  value={occupFilter}
                  onChange={e => setOccupFilter(e.target.value as any)}
                  className="w-full border border-slate-200 rounded p-1.5 bg-slate-50 font-medium cursor-pointer"
                >
                  <option value="Tous">Tous statuts</option>
                  <option value="Propriétaire">Propriétaire</option>
                  <option value="Locataire">Locataire</option>
                  <option value="Occupant à titre gratuit">À titre gratuit</option>
                  <option value="Indivis Civils">Indivis Civils</option>
                  <option value="Litigieux">Litigieux</option>
                </select>
              </div>
            </div>
          </div>

          {/* Land plots List cards */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredLands.length > 0 ? (
              filteredLands.map((land) => {
                const isActive = land.id === selectedLandId;
                return (
                  <div
                    key={land.id}
                    onClick={() => setSelectedLandId(land.id)}
                    className={`border rounded-xl p-4 transition-all duration-150 cursor-pointer select-none text-left relative overflow-hidden ${
                      isActive 
                        ? 'bg-indigo-50/40 border-indigo-250 shadow-3xs ring-1 ring-indigo-200' 
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-3xs'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1 font-sans">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-extrabold text-[13px] text-slate-900 uppercase">{land.numeroLot}</span>
                          <span className={`text-[8.5px] font-bold font-mono tracking-wider p-0.5 px-1.5 rounded uppercase ${
                            land.typeUsage === 'Habitation' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            land.typeUsage === 'Agricole' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                            land.typeUsage === 'Commercial' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {land.typeUsage}
                          </span>
                        </div>
                        <div className="flex items-center text-[10.5px] text-slate-450">
                          <MapPin className="h-3 w-3 mr-1 shrink-0" />
                          <span className="truncate">{land.adresse}</span>
                        </div>
                      </div>

                      {/* Status indicator badge */}
                      <span className={`text-[9.5px] font-sans font-bold rounded-lg px-2 py-0.5 border font-mono ${
                        land.statutOccupant === 'Propriétaire' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                        land.statutOccupant === 'Locataire' ? 'bg-indigo-50 border-indigo-200 text-indigo-800' :
                        land.statutOccupant === 'Litigieux' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                        'bg-slate-50 border-slate-200 text-slate-750'
                      }`}>
                        {land.statutOccupant}
                      </span>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10.5px] text-slate-450 font-mono">
                      <span>Sup: <strong>{land.superficie.toLocaleString('fr-FR')} m²</strong></span>
                      {land.titreFoncier ? (
                        <span className="text-slate-500 font-sans text-[10px]">Titre: <strong className="font-mono">{land.titreFoncier}</strong></span>
                      ) : (
                        <span className="text-amber-600 font-sans italic text-[9.5px]">Non Titré (Bornage Cadastral)</span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                <AlertCircle className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-450 text-sm font-sans italic">Aucun lot foncier trouvé.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Parcel Details, Land occupants list, Succession Ledger */}
        <div className="grid lg:col-span-7 gap-6">
          
          {selectedLand ? (
            <div className="space-y-6">
              
              {/* Plot Details Card */}
              <div className="bg-white border border-slate-250 rounded-2xl p-6 shadow-3xs text-left relative space-y-4">
                <div className="flex justify-between items-start gap-4 pb-2 border-b border-slate-100">
                  <div>
                    <h2 className="text-xs font-black font-mono text-indigo-600 uppercase tracking-widest">INFOS TITULAIRES & PARCELLE</h2>
                    <h3 className="font-sans font-black text-xl text-slate-900 mt-1 uppercase flex items-center">
                      {selectedLand.numeroLot}
                    </h3>
                  </div>
                  
                  {/* Edit & delete buttons */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleOpenEditLand(selectedLand)}
                      className="p-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-lg transition"
                      title="Modifier les coordonnées cadastrales"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteLand(selectedLand.id, selectedLand.numeroLot)}
                      className="p-2 border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition"
                      title="Supprimer cette parcelle"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Primary properties specs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50/50 border border-slate-100 p-3 rounded-xl select-none">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block font-sans">Cadastre</span>
                    <strong className="text-xs font-mono text-slate-800">{selectedLand.cadastreRef || 'Non référencé'}</strong>
                  </div>
                  <div className="bg-slate-50/50 border border-slate-100 p-3 rounded-xl select-none">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block font-sans">Titre Foncier Actuel</span>
                    <strong className="text-xs font-mono text-indigo-700">{selectedLand.titreFoncier || 'Néant / Cadastral'}</strong>
                  </div>
                  <div className="bg-slate-50/50 border border-slate-100 p-3 rounded-xl select-none">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block font-sans">Superficie Terrestre</span>
                    <strong className="text-xs font-mono text-slate-800 font-extrabold">{selectedLand.superficie.toLocaleString('fr-FR')} m²</strong>
                  </div>
                  <div className="bg-slate-50/50 border border-slate-100 p-3 rounded-xl select-none">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block font-sans">Usage Économique</span>
                    <strong className="text-xs font-sans text-slate-850 font-black">{selectedLand.typeUsage}</strong>
                  </div>
                </div>

                <div className="space-y-1 font-sans">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Adresse de Localisation Civile</span>
                  <p className="text-xs text-slate-800 font-medium">{selectedLand.adresse}</p>
                </div>

                {selectedLand.notes && (
                  <div className="bg-indigo-50/15 border border-indigo-100/50 rounded-xl p-3 text-xs text-indigo-900 italic font-sans flex items-start space-x-2">
                    <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                    <span>{selectedLand.notes}</span>
                  </div>
                )}
              </div>

              {/* Occupants & Household list section */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs text-left space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div>
                    <h2 className="text-xs font-extrabold font-mono text-indigo-600 uppercase tracking-widest">OCCUPANTS & HABITANTS (STATUT MENSUEL)</h2>
                    <p className="text-[10px] text-slate-450 font-sans mt-0.5">Statut de l'occupant principal : <strong>{selectedLand.statutOccupant}</strong></p>
                  </div>
                  {selectedLand.occupantsMenageCode && (
                    <span className="text-[10px] font-mono bg-indigo-50 border border-indigo-150 text-indigo-700 font-extrabold p-1 px-2 rounded-lg">
                      Foyer : {selectedLand.occupantsMenageCode}
                    </span>
                  )}
                </div>

                {selectedLand.occupantsMenageCode ? (
                  <div className="space-y-3">
                    {linkedResidents.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {linkedResidents.map(resident => (
                          <div 
                            key={resident.id}
                            className="flex items-center space-x-3 p-3 border border-slate-150 bg-slate-50/30 rounded-xl"
                          >
                            <div className="h-9 w-9 bg-slate-200 rounded-full flex items-center justify-center shrink-0 border border-slate-300 font-sans font-bold text-slate-650 text-xs">
                              {resident.photoUrl ? (
                                <img src={resident.photoUrl} alt={resident.nom} className="h-full w-full rounded-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <span>{resident.nom.charAt(0)}{resident.prenom.charAt(0)}</span>
                              )}
                            </div>
                            <div className="truncate font-sans leading-snug">
                              <span className="text-[11.5px] font-extrabold text-slate-900 block truncate leading-none uppercase">
                                {resident.nom} {resident.prenom}
                              </span>
                              <span className="text-[9px] font-mono text-slate-450 font-bold">
                                {resident.famille.isChefMenage ? '👑 Chef de Ménage' : 'Membre du foyer'}
                              </span>
                              {resident.telephone && (
                                <span className="text-[8px] text-slate-400 block">{resident.telephone}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs">
                        <Users className="h-5 w-5 text-slate-400 mx-auto mb-1.5" />
                        <span className="text-slate-450 italic font-sans block leading-normal">
                          Le code ménage rattaché <strong className="font-mono text-indigo-600 bg-indigo-50 px-1 rounded">{selectedLand.occupantsMenageCode}</strong> n'a actuellement aucun habitant enregistré dans la base Fokontany.
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs space-y-1">
                    <HelpCircle className="h-5 w-5 text-slate-400 mx-auto" />
                    <span className="text-slate-450 italic font-sans block">Aucun code de ménage n'est rattaché à ce lot foncier.</span>
                    <button 
                      onClick={() => handleOpenEditLand(selectedLand)}
                      className="text-indigo-600 hover:text-indigo-800 font-bold text-[10px] underline cursor-pointer"
                    >
                      Bâtir un lien avec un foyer de ménage
                    </button>
                  </div>
                )}
              </div>

              {/* Origines et Succession Ledger */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs text-left space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div>
                    <h2 className="text-xs font-extrabold font-mono text-indigo-600 uppercase tracking-widest flex items-center">
                      <FileClock className="h-4 w-4 mr-1 text-indigo-500" />
                      ORIGINES ET HISTORIQUE SUCCESSIONS DE PROPRIÉTÉ
                    </h2>
                    <p className="text-[10px] text-slate-450 font-sans mt-0.5">Chronologie d'acquisition légale des droits réels fonciers sur ce lot.</p>
                  </div>
                  <button
                    onClick={() => {
                      setSuccDate(new Date().toISOString().split('T')[0]);
                      setSuccDesc('');
                      setSuccMontant('');
                      setSuccAncien('');
                      setSuccNouveau('');
                      setSuccPiece('');
                      setIsSuccessionFormOpen(true);
                    }}
                    className="p-1 px-2.5 border border-indigo-200 hover:border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg font-sans text-[10px] transition cursor-pointer select-none"
                  >
                    Historiser une mutation
                  </button>
                </div>

                {selectedLand.historiqueSuccessions && selectedLand.historiqueSuccessions.length > 0 ? (
                  <div className="space-y-4 pr-1 relative pl-2">
                    
                    {/* Vertical timeline bar decorative */}
                    <div className="absolute left-4 top-2 bottom-4 w-0.5 bg-slate-100" />

                    {selectedLand.historiqueSuccessions.map((succ) => (
                      <div key={succ.id} className="relative pl-7 group">
                        
                        {/* Bullet circle indicator */}
                        <div className="absolute left-2 top-1.5 h-4.5 w-4.5 rounded-full bg-slate-50 border-2 border-indigo-500 group-hover:bg-indigo-50 transition-all duration-150 flex items-center justify-center -translate-x-1.5">
                          <span className="text-[7px] font-sans font-black text-indigo-700 leading-none">
                            {succ.typeTransfert.charAt(0)}
                          </span>
                        </div>

                        {/* Card wrapper */}
                        <div className="bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2.5 relative transition">
                          
                          {/* Delete transaction log */}
                          <button
                            onClick={() => handleDeleteSuccession(succ.id)}
                            className="absolute right-2 top-2 p-1 text-slate-350 hover:text-rose-600 rounded-md transition opacity-0 group-hover:opacity-100"
                            title="Supprimer cette mutation de l'historique"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          
                          <div className="flex justify-between items-start text-[10.5px]">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-extrabold text-indigo-900 font-sans tracking-tight bg-indigo-50/80 px-1.5 py-0.5 border border-indigo-100 rounded text-[9.5px]">
                                {succ.typeTransfert}
                              </span>
                              <span className="text-slate-400 font-mono text-[9px]">
                                {new Date(succ.date).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                            {succ.montantTransaction ? (
                              <span className="font-mono font-bold text-emerald-850 shrink-0 text-[10px]">
                                {succ.montantTransaction.toLocaleString('fr-FR')} Ar
                              </span>
                            ) : null}
                          </div>

                          <p className="text-[11.5px] text-slate-705 leading-relaxed font-sans font-medium">{succ.description}</p>

                          {/* Actors and title deeds info */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono pt-2 border-t border-slate-100 text-slate-500 leading-normal">
                            <div>
                              <span className="text-[7.5px] font-bold font-sans uppercase text-slate-400 block mb-0.5">PROPRIÉTAIRE INITIAL</span>
                              <span className="text-slate-750 font-bold text-[9.5px] uppercase font-sans block">{succ.ancienProprietaire || 'Néant / Premier acquéreur'}</span>
                            </div>
                            <div>
                              <span className="text-[7.5px] font-bold font-sans uppercase text-slate-400 block mb-0.5">NOUVEAU TITULAIRE</span>
                              <span className="text-slate-850 font-bold text-[9.5px] uppercase font-sans block text-indigo-900">{succ.nouveauProprietaire}</span>
                            </div>
                          </div>

                          {succ.piecesJustificatives && (
                            <div className="pt-1 flex items-center text-[9px] text-slate-400 font-mono space-x-1">
                              <FileText className="h-3 w-3 text-slate-400" />
                              <span className="underline decoration-dotted">{succ.piecesJustificatives}</span>
                            </div>
                          )}

                        </div>
                      </div>
                    ))}

                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50/50 rounded-2xl border border-slate-205">
                    <FileClock className="h-6 w-6 text-slate-400 mx-auto mb-1.5" />
                    <p className="text-slate-450 font-sans font-medium text-xs">Aucune transaction ou acte successoral historisé.</p>
                    <p className="text-[9.5px] text-slate-400 font-sans italic mt-1 leading-snug">Ajoutez les origines de propriété, les actes de vente officiels ou d'hérédité pour tracer le lot.</p>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-white border border-slate-150 rounded-2xl p-12 text-center select-none shadow-3xs flex flex-col justify-center items-center py-24">
              <Landmark className="h-10 w-10 text-indigo-305 mb-2.5" />
              <h3 className="font-sans font-extrabold text-sm text-slate-700 leading-none">Aucun lot cadastral sélectionné</h3>
              <p className="text-slate-450 text-xs font-sans mt-1">Créez ou sélectionnez une parcelle territoriale dans le volet latéral pour inspecter sa succession.</p>
            </div>
          )}

        </div>

      </div>

      {/* -------------------- POPUP DIALOGS -------------------- */}
      
      {/* 1. Lot Foncier Form Modal (Add / Edit) */}
      {isLandFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-lg w-full shadow-2xl animate-scaleUp text-left space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-sans font-extrabold text-sm uppercase text-slate-850 tracking-wider">
                {isEditMode ? 'Modifier les coordonnées cadastrales' : 'Enregistrer une nouvelle parcelle foncière'}
              </h3>
              <button 
                onClick={() => setIsLandFormOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitLand} className="space-y-4 font-sans text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Né de Lot / Désignation <span className="text-red-500">*</span></label>
                  <input 
                    type="text"
                    value={formNumLot}
                    onChange={e => setFormNumLot(e.target.value)}
                    placeholder="ex: LOT 34 Ter"
                    className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Titre Foncier (Optionnel)</label>
                  <input 
                    type="text"
                    value={formTitre}
                    onChange={e => setFormTitre(e.target.value)}
                    placeholder="ex: T-12450-UA"
                    className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Section Cadastrale (Ref)</label>
                  <input 
                    type="text"
                    value={formCadastre}
                    onChange={e => setFormCadastre(e.target.value)}
                    placeholder="ex: SEC-C-45"
                    className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Superficie Terrestre (m²) <span className="text-red-500">*</span></label>
                  <input 
                    type="number"
                    value={formSuperficie}
                    onChange={e => setFormSuperficie(e.target.value)}
                    placeholder="ex: 450"
                    className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Adresse de Localisation Générale <span className="text-red-500">*</span></label>
                <input 
                  type="text"
                  value={formAdresse}
                  onChange={e => setFormAdresse(e.target.value)}
                  placeholder="ex: Ambohitantely, Lot 34 Ter"
                  className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Statut Occupant Local</label>
                  <select 
                    value={formStatutOccup}
                    onChange={e => setFormStatutOccup(e.target.value as any)}
                    className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800 cursor-pointer"
                  >
                    <option value="Propriétaire">Propriétaire résident</option>
                    <option value="Locataire">Locataire du lot</option>
                    <option value="Occupant à titre gratuit">Occupant à titre gratuit</option>
                    <option value="Indivis Civils">Indivis Civils</option>
                    <option value="Litigieux">Contestation / Litigieux</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Usage Légal lot</label>
                  <select 
                    value={formUsage}
                    onChange={e => setFormUsage(e.target.value as any)}
                    className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800 cursor-pointer"
                  >
                    <option value="Habitation">Habitation</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Agricole">Agricole</option>
                    <option value="Mixte">Mixte / Autre</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Code de Ménage (Liaison Foyer, ex: MEN-001)</label>
                <input 
                  type="text"
                  value={formMenageCode}
                  onChange={e => setFormMenageCode(e.target.value)}
                  placeholder="Désignation de code ménage de l'occupant principal"
                  className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800 font-mono uppercase"
                />
                <span className="text-[9px] text-slate-400 font-sans italic block pt-0.5">Permet d'extraire automatiquement l'arbre généalogique familial vivant sur le terrain.</span>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Commentaires et Notes physiques</label>
                <textarea 
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="État du bâti, contraintes de servitudes, détails d'accès urbain..."
                  rows={2}
                  className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsLandFormOpen(false)}
                  className="p-2 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="p-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-bold text-white transition"
                >
                  {isEditMode ? 'Enregistrer les modifications' : 'Vérifier & Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Succession Ledger Entry Form Modal */}
      {isSuccessionFormOpen && selectedLand && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-lg w-full shadow-2xl animate-scaleUp text-left space-y-4 font-sans">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-sans font-extrabold text-xs uppercase tracking-wider text-slate-550 leading-none">Historique Origines foncières</h3>
                <h4 className="font-sans font-black text-sm text-slate-900 mt-1">MUTATION / SUCCESSION : LOT {selectedLand.numeroLot}</h4>
              </div>
              <button 
                onClick={() => setIsSuccessionFormOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitSuccession} className="space-y-4 font-sans text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Nature de la mutation <span className="text-red-500">*</span></label>
                  <select 
                    value={succType}
                    onChange={e => setSuccType(e.target.value as any)}
                    className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800 cursor-pointer"
                  >
                    <option value="Achat">Achat / Cession commerciale</option>
                    <option value="Succession">Succession / Héritage naturel</option>
                    <option value="Don">Donation unilatérale</option>
                    <option value="Partage">Partage divisionnaire</option>
                    <option value="Mutation">Mutation administrative d'office</option>
                    <option value="Autre">Autre procédure</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Date d'effet officielle <span className="text-red-500">*</span></label>
                  <input 
                    type="date"
                    value={succDate}
                    onChange={e => setSuccDate(e.target.value)}
                    className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Ancien Propriétaire / Partageant</label>
                  <input 
                    type="text"
                    value={succAncien}
                    onChange={e => setSuccAncien(e.target.value)}
                    placeholder="Nom complet (ex: RASOLO Georges)"
                    className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Nouveau Propriétaire / Héritier <span className="text-red-500">*</span></label>
                  <input 
                    type="text"
                    value={succNouveau}
                    onChange={e => setSuccNouveau(e.target.value)}
                    placeholder="Nom complet (ex: RASOLO Jean)"
                    className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Prix de Transaction (Ariary, optionnel)</label>
                  <input 
                    type="number"
                    value={succMontant}
                    onChange={e => setSuccMontant(e.target.value)}
                    placeholder="ex: 15000000"
                    className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Acte Réf & Pièce Justificative</label>
                  <input 
                    type="text"
                    value={succPiece}
                    onChange={e => setSuccPiece(e.target.value)}
                    placeholder="ex: Certificat d'hérédité Nº 12/FOK"
                    className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Résumé explicatif et commentaires <span className="text-red-500">*</span></label>
                <textarea 
                  value={succDesc}
                  onChange={e => setSuccDesc(e.target.value)}
                  placeholder="Précisez les circonstances de transfert de propriété, les témoins, la délibération du conseil du Fokontany..."
                  rows={3}
                  className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800"
                  required
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSuccessionFormOpen(false)}
                  className="p-2 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="p-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-bold text-white transition"
                >
                  Ajouter à l'Historique Cadastral
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
