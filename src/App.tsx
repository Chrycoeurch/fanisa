import React, { useState, useEffect } from 'react';
import { Habitant, HistoriqueLog, Transaction, Materiel, CotisationAdidy } from './types';
import { initialHabitants, initialLogs, FOKONTANY_LIST, SECTEUR_LIST, COMPULSORY_VACCINATIONS } from './seedData';
import { initialTransactions, initialMateriels, initialCotisations } from './financialAndMaterialSeedData';

// Component imports
import StatsView from './components/StatsView';
import ResidentCard from './components/ResidentCard';
import ResidentDetailModal from './components/ResidentDetailModal';
import ResidentForm from './components/ResidentForm';
import CertificateModal from './components/CertificateModal';
import DocumentGenerator from './components/DocumentGenerator';
import FinanceModule from './components/FinanceModule';
import MaterialsModule from './components/MaterialsModule';
import LandModule from './components/LandModule';

// Icon imports
import { 
  FolderLock, Users, HeartPulse, History, PlusCircle, Search, 
  Filter, RotateCcw, Download, Upload, AppWindow, ShieldCheck,
  Building, Contact, SlidersHorizontal, Save, Trash2, FileSignature, HelpCircle, GraduationCap,
  Landmark, Package
} from 'lucide-react';

export default function App() {
  const [habitants, setHabitants] = useState<Habitant[]>([]);
  const [logs, setLogs] = useState<HistoriqueLog[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [materiels, setMateriels] = useState<Materiel[]>([]);
  const [cotisations, setCotisations] = useState<CotisationAdidy[]>([]);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'directory' | 'documents' | 'statistics' | 'finances' | 'materials' | 'logs' | 'land'>('directory');

  // Directory filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Tous');
  const [sexeFilter, setSexeFilter] = useState<string>('Tous');
  const [fokontanyFilter, setFokontanyFilter] = useState<string>('Tous');
  const [householdFilter, setHouseholdFilter] = useState<string>('');
  const [healthAlertFilter, setHealthAlertFilter] = useState<boolean>(false);

  // Customizable advanced filters state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [minAge, setMinAge] = useState<number>(0);
  const [maxAge, setMaxAge] = useState<number>(100);
  const [educationFilter, setEducationFilter] = useState<string>('Tous');
  const [sectorFilter, setSectorFilter] = useState<string>('Tous');
  const [bloodFilter, setBloodFilter] = useState<string>('Tous');
  const [hasCinFilter, setHasCinFilter] = useState<string>('Tous'); // 'Tous' | 'Oui' | 'Non'
  const [householdRoleFilter, setHouseholdRoleFilter] = useState<string>('Tous'); // 'Tous' | 'Chef' | 'Membre'
  const [minIncome, setMinIncome] = useState<number>(0);
  const [vaccineFilter, setVaccineFilter] = useState<string>('Tous');

  // Saved customizable filter configurations
  const [savedPresets, setSavedPresets] = useState<{ id: string; name: string; filters: any }[]>([]);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [activePresetId, setActivePresetId] = useState<string>('');

  // Modals state
  const [selectedResident, setSelectedResident] = useState<Habitant | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formCurrentResident, setFormCurrentResident] = useState<Habitant | undefined>(undefined);
  const [isCertificateOpen, setIsCertificateOpen] = useState(false);
  const [certificateResident, setCertificateResident] = useState<Habitant | null>(null);

  // Search filter for history logs
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // 1. LocalStorage bootstrapping
  useEffect(() => {
    const savedHabitants = localStorage.getItem('fokontany_habitants');
    const savedLogs = localStorage.getItem('fokontany_logs');
    const savedPresetsStr = localStorage.getItem('fokontany_filter_presets');
    const savedTransactions = localStorage.getItem('fokontany_transactions');
    const savedMateriels = localStorage.getItem('fokontany_materiels');
    const savedCotisations = localStorage.getItem('fokontany_cotisations');

    if (savedHabitants) {
      setHabitants(JSON.parse(savedHabitants));
    } else {
      setHabitants(initialHabitants);
      localStorage.setItem('fokontany_habitants', JSON.stringify(initialHabitants));
    }

    if (savedLogs) {
      setLogs(JSON.parse(savedLogs));
    } else {
      setLogs(initialLogs);
      localStorage.setItem('fokontany_logs', JSON.stringify(initialLogs));
    }

    if (savedTransactions) {
      setTransactions(JSON.parse(savedTransactions));
    } else {
      setTransactions(initialTransactions);
      localStorage.setItem('fokontany_transactions', JSON.stringify(initialTransactions));
    }

    if (savedMateriels) {
      setMateriels(JSON.parse(savedMateriels));
    } else {
      setMateriels(initialMateriels);
      localStorage.setItem('fokontany_materiels', JSON.stringify(initialMateriels));
    }

    if (savedCotisations) {
      setCotisations(JSON.parse(savedCotisations));
    } else {
      setCotisations(initialCotisations);
      localStorage.setItem('fokontany_cotisations', JSON.stringify(initialCotisations));
    }

    if (savedPresetsStr) {
      setSavedPresets(JSON.parse(savedPresetsStr));
    }
  }, []);

  // Sync utilities
  const syncHabitants = (updated: Habitant[]) => {
    setHabitants(updated);
    localStorage.setItem('fokontany_habitants', JSON.stringify(updated));
  };

  const syncLogs = (updated: HistoriqueLog[]) => {
    setLogs(updated);
    localStorage.setItem('fokontany_logs', JSON.stringify(updated));
  };

  const syncTransactions = (updated: Transaction[]) => {
    setTransactions(updated);
    localStorage.setItem('fokontany_transactions', JSON.stringify(updated));
  };

  const syncMateriels = (updated: Materiel[]) => {
    setMateriels(updated);
    localStorage.setItem('fokontany_materiels', JSON.stringify(updated));
  };

  const syncCotisations = (updated: CotisationAdidy[]) => {
    setCotisations(updated);
    localStorage.setItem('fokontany_cotisations', JSON.stringify(updated));
  };

  // Helper to append a log automatically
  const addLog = (action: HistoriqueLog['action'], details: string, habitantId?: string) => {
    const newLog: HistoriqueLog = {
      id: `log-${Date.now()}`,
      date: new Date().toISOString(),
      utilisateur: 'Chef Fokontany (Admin)',
      action,
      details,
      habitantId
    };
    setLogs(prevLogs => {
      const updated = [newLog, ...prevLogs];
      localStorage.setItem('fokontany_logs', JSON.stringify(updated));
      return updated;
    });
  };

  // 2. Directory filter engine
  const filteredHabitants = habitants.filter(resident => {
    // Identity Search Query
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      resident.nom.toLowerCase().includes(searchLower) ||
      resident.prenom.toLowerCase().includes(searchLower) ||
      (resident.cin && resident.cin.includes(searchLower)) ||
      resident.id.toLowerCase().includes(searchLower) ||
      resident.famille.codeMenage.toLowerCase().includes(searchLower);

    // Status Filter
    const matchesStatus = statusFilter === 'Tous' || resident.statut === statusFilter;

    // Sexe Filter
    const matchesSexe = 
      sexeFilter === 'Tous' || 
      (sexeFilter === 'Homme' && resident.sexe === 'M') ||
      (sexeFilter === 'Femme' && resident.sexe === 'F');

    // Fokontany Filter
    const matchesFokontany = fokontanyFilter === 'Tous' || resident.residence.fokontany === fokontanyFilter;

    // Household (Ménage) Code Filter
    const matchesHousehold = !householdFilter.trim() || resident.famille.codeMenage.toUpperCase().includes(householdFilter.toUpperCase().trim());

    // Health alerts: Hypertension/Diabetes on Surveillance or Prioritaire
    const matchesHealthAlert = !healthAlertFilter || 
      resident.sante.hypertension === 'Prioritaire' || 
      resident.sante.diabete === 'Prioritaire' ||
      resident.sante.hypertension === 'Surveillance' || 
      resident.sante.diabete === 'Surveillance';

    // Min & Max Age Filter
    const calculateAge = (dateN: string) => {
      const birthday = new Date(dateN);
      const ageDifMs = Date.now() - birthday.getTime();
      const ageDate = new Date(ageDifMs);
      return Math.abs(ageDate.getUTCFullYear() - 1970);
    };
    const age = calculateAge(resident.dateNaissance);
    const matchesAge = age >= minAge && age <= maxAge;

    // Education Level Filter
    const matchesEducation = educationFilter === 'Tous' || resident.education.niveauEtude === educationFilter;

    // Professional Sector Filter
    const matchesSector = sectorFilter === 'Tous' || resident.economie.secteur === sectorFilter;

    // Blood Group Filter
    const matchesBlood = bloodFilter === 'Tous' || resident.sante.groupeSanguin === bloodFilter;

    // Has CIN registered Filter
    const matchesCin = hasCinFilter === 'Tous' || 
      (hasCinFilter === 'Oui' && !!resident.cin) || 
      (hasCinFilter === 'Non' && !resident.cin);

    // Household Family Role Filter
    const matchesHouseholdRole = householdRoleFilter === 'Tous' || 
      (householdRoleFilter === 'Chef' && resident.famille.isChefMenage) || 
      (householdRoleFilter === 'Membre' && !resident.famille.isChefMenage);

    // Minimum Estimated Income Filter
    const matchesIncome = (resident.economie.revenuEstime ?? 0) >= minIncome;

    // Vaccine Taken Filter
    const matchesVaccine = vaccineFilter === 'Tous' || resident.sante.vaccination.includes(vaccineFilter);

    return matchesSearch && matchesStatus && matchesSexe && matchesFokontany && 
           matchesHousehold && matchesHealthAlert && matchesAge && matchesEducation && 
           matchesSector && matchesBlood && matchesCin && matchesHouseholdRole && 
           matchesIncome && matchesVaccine;
  });

  // Preset management handlers
  const handleSavePreset = () => {
    if (!presetNameInput.trim()) return;
    const newPreset = {
      id: `preset-${Date.now()}`,
      name: presetNameInput,
      filters: {
        statusFilter,
        sexeFilter,
        fokontanyFilter,
        householdFilter,
        healthAlertFilter,
        minAge,
        maxAge,
        educationFilter,
        sectorFilter,
        bloodFilter,
        hasCinFilter,
        householdRoleFilter,
        minIncome,
        vaccineFilter
      }
    };
    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    localStorage.setItem('fokontany_filter_presets', JSON.stringify(updated));
    setPresetNameInput('');
    setActivePresetId(newPreset.id);
    addLog('Modification', `Filtre personnalisé sauvegardé sous le nom "${presetNameInput}".`);
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = savedPresets.find(p => p.id === presetId);
    if (!preset) return;
    setActivePresetId(presetId);
    
    setStatusFilter(preset.filters.statusFilter);
    setSexeFilter(preset.filters.sexeFilter);
    setFokontanyFilter(preset.filters.fokontanyFilter);
    setHouseholdFilter(preset.filters.householdFilter || '');
    setHealthAlertFilter(preset.filters.healthAlertFilter || false);
    
    setMinAge(preset.filters.minAge ?? 0);
    setMaxAge(preset.filters.maxAge ?? 100);
    setEducationFilter(preset.filters.educationFilter ?? 'Tous');
    setSectorFilter(preset.filters.sectorFilter ?? 'Tous');
    setBloodFilter(preset.filters.bloodFilter ?? 'Tous');
    setHasCinFilter(preset.filters.hasCinFilter ?? 'Tous');
    setHouseholdRoleFilter(preset.filters.householdRoleFilter ?? 'Tous');
    setMinIncome(preset.filters.minIncome ?? 0);
    setVaccineFilter(preset.filters.vaccineFilter ?? 'Tous');
    
    setShowAdvancedFilters(true);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetPreset = savedPresets.find(p => p.id === id);
    const updated = savedPresets.filter(p => p.id !== id);
    setSavedPresets(updated);
    localStorage.setItem('fokontany_filter_presets', JSON.stringify(updated));
    if (activePresetId === id) {
      setActivePresetId('');
    }
    if (targetPreset) {
      addLog('Modification', `Filtre personnalisé supprimé : "${targetPreset.name}".`);
    }
  };

  // 3. Operations: Create or Edit Resident
  const handleSaveResident = (editedHabitant: Habitant) => {
    const exists = habitants.some(h => h.id === editedHabitant.id);
    let updated: Habitant[];
    let actionType: HistoriqueLog['action'] = 'Création';
    let detailMsg = '';

    if (exists) {
      updated = habitants.map(h => h.id === editedHabitant.id ? editedHabitant : h);
      actionType = 'Modification';
      detailMsg = `Mise à jour de la fiche de ${editedHabitant.nom} ${editedHabitant.prenom} (${editedHabitant.id}).`;
      
      const oldVersion = habitants.find(h => h.id === editedHabitant.id);
      if (oldVersion && oldVersion.residence.adresse !== editedHabitant.residence.adresse) {
        actionType = 'Changement adresse';
        detailMsg = `Changement d'adresse enregistré pour ${editedHabitant.nom} ${editedHabitant.prenom}. Ancienne: ${oldVersion.residence.adresse} -> Nouvelle: ${editedHabitant.residence.adresse}.`;
      }
    } else {
      updated = [editedHabitant, ...habitants];
      actionType = 'Création';
      detailMsg = `Nouveau résident enregistré : ${editedHabitant.nom} ${editedHabitant.prenom} (${editedHabitant.id}), Fokontany: ${editedHabitant.residence.fokontany}.`;
    }

    // Bidirectional family relationships synchronization (Autolinks father, mother and spouse)
    const childId = editedHabitant.id;
    const { conjointId, pereId, mereId } = editedHabitant.famille;

    updated = updated.map(member => {
      let changed = false;
      const f = { ...member.famille };

      // 1. Sync Father relation
      if (pereId && member.id === pereId) {
        if (!f.enfantsIds.includes(childId)) {
          f.enfantsIds = [...f.enfantsIds, childId];
          changed = true;
        }
      }
      // 2. Sync Mother relation
      if (mereId && member.id === mereId) {
        if (!f.enfantsIds.includes(childId)) {
          f.enfantsIds = [...f.enfantsIds, childId];
          changed = true;
        }
      }
      // 3. Sync Spouse relation
      if (conjointId && member.id === conjointId) {
        if (f.conjointId !== childId) {
          f.conjointId = childId;
          changed = true;
        }
      }

      if (changed) {
        return { ...member, famille: f };
      }
      return member;
    });

    syncHabitants(updated);
    addLog(actionType, detailMsg);
    
    // Close form
    setIsFormOpen(false);
    setFormCurrentResident(undefined);
    
    // If we were editing the selected resident, update its details modal state too
    if (selectedResident && selectedResident.id === editedHabitant.id) {
      setSelectedResident(editedHabitant);
    }
  };

  // Add family member cohabitant with auto-pre-filled parameters
  const handleAddFamilyMember = (foyerReference: Habitant) => {
    const freshId = `IND-${Math.floor(10000 + Math.random() * 90000)}`;
    const template: Habitant = {
      id: freshId,
      nom: foyerReference.nom, // suggestion: same family name
      prenom: '',
      sexe: 'M',
      dateNaissance: '',
      lieuNaissance: foyerReference.residence.commune,
      statut: 'Actif',
      famille: {
        codeMenage: foyerReference.famille.codeMenage,
        isChefMenage: false,
        conjointId: '',
        pereId: foyerReference.sexe === 'M' ? foyerReference.id : undefined,
        mereId: foyerReference.sexe === 'F' ? foyerReference.id : undefined,
        enfantsIds: []
      },
      residence: {
        adresse: foyerReference.residence.adresse,
        fokontany: foyerReference.residence.fokontany,
        commune: foyerReference.residence.commune,
        district: foyerReference.residence.district,
        gps: foyerReference.residence.gps
      },
      education: {
        niveauEtude: 'Secondaire',
        competences: [],
        langues: ['Malagasy']
      },
      economie: {
        profession: '',
        secteur: 'Commerce & Artisanat'
      },
      sante: {
        groupeSanguin: 'O+',
        hypertension: 'Normal',
        diabete: 'Normal',
        vaccination: []
      }
    };

    setSelectedResident(null);
    setFormCurrentResident(template);
    setIsFormOpen(true);
    addLog('Modification', `Formulaire d'inscription ouvert pour un nouveau membre du foyer ${foyerReference.famille.codeMenage}.`);
  };

  // Quick state update (for instant Décès / Mutation / Déménagement from detail panel)
  const handleQuickStatusChange = (residentId: string, newStatus: Habitant['statut']) => {
    const resident = habitants.find(h => h.id === residentId);
    if (!resident) return;

    const updated = habitants.map(h => {
      if (h.id === residentId) {
        return { ...h, statut: newStatus };
      }
      return h;
    });

    let actionType: HistoriqueLog['action'] = 'Modification';
    let details = '';

    if (newStatus === 'Décédé') {
      actionType = 'Décès';
      details = `Déclaration de décès enregistrée pour ${resident.nom} ${resident.prenom} (${resident.id}).`;
    } else if (newStatus === 'Déménagé') {
      actionType = 'Déménagement';
      details = `Départ et mutation d'adresse hors Fokontany répertoriés pour ${resident.nom} ${resident.prenom} (${resident.id}).`;
    } else {
      actionType = 'Modification';
      details = `Ré-activation du statut de ${resident.nom} ${resident.prenom} (${resident.id}) vers "${newStatus}".`;
    }

    syncHabitants(updated);
    addLog(actionType, details);

    // Refresh modal
    const updatedResident = updated.find(h => h.id === residentId);
    if (updatedResident) {
      setSelectedResident(updatedResident);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('Tous');
    setSexeFilter('Tous');
    setFokontanyFilter('Tous');
    setHouseholdFilter('');
    setHealthAlertFilter(false);
    setMinAge(0);
    setMaxAge(100);
    setEducationFilter('Tous');
    setSectorFilter('Tous');
    setBloodFilter('Tous');
    setHasCinFilter('Tous');
    setHouseholdRoleFilter('Tous');
    setMinIncome(0);
    setVaccineFilter('Tous');
    setActivePresetId('');
  };

  // Database JSON Backup / Export
  const handleExportBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
      JSON.stringify({ habitants, logs }, null, 2)
    );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `registre_habitants_fokontany_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    addLog('Modification', 'Sauvegarde et export intégrale de la base de données du registre au format JSON.');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans selection:bg-indigo-505 selection:text-indigo-900">
      
      {/* Top Professional Header for Local Malagasy Administration */}
      <header id="main-fokontany-header" className="bg-white border-b border-slate-200 shadow-2xs py-4 px-6 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo Brand Panel with Flag representation color accents */}
          <div className="flex items-center space-x-3.5">
            <div className="bg-emerald-600 p-2.5 rounded-xl text-white shadow-xs shrink-0 flex items-center justify-center relative">
              {/* Flag vertical representation border */}
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-600 rounded-l-xl"></div>
              <FolderLock className="h-6 w-6 ml-1" />
            </div>
            
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[9px] bg-red-50 text-red-600 border border-red-100 rounded px-1.5 py-0.5 font-bold tracking-widest font-mono select-none uppercase">
                  Fokontany local ledger
                </span>
                <span className="text-[9px] bg-emerald-50 text-emerald-800 border border-emerald-100 rounded px-1.5 py-0.5 font-sans font-semibold inline-block select-none">
                  Antananarivo, MG
                </span>
              </div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight uppercase font-sans mt-0.5 flex items-center">
                <span>Registre des Habitants</span>
                <ShieldCheck className="h-4.5 w-4.5 text-indigo-600 ml-1.5" />
              </h1>
            </div>
          </div>

          {/* Action buttons section */}
          <div className="flex items-center space-x-2.5 flex-wrap">
            <button 
              onClick={() => {
                setFormCurrentResident(undefined);
                setIsFormOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-4 rounded-lg flex items-center space-x-1.5 shadow-2xs transition duration-150"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Inscrire un Habitant</span>
            </button>

            <button 
              onClick={handleExportBackup}
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold py-2 px-3.5 rounded-lg flex items-center space-x-1.5 shadow-3xs transition duration-150"
              title="Exporter les données"
            >
              <Download className="h-4 w-4 text-slate-550" />
              <span>Sauvegarder</span>
            </button>
          </div>

        </div>
      </header>

      {/* Primary Sub-Navigation Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-1 select-none overflow-x-auto">
        <nav className="max-w-7xl mx-auto flex space-x-6 min-w-max">
          <button
            onClick={() => setActiveTab('directory')}
            className={`py-3.5 text-xs font-semibold tracking-wide border-b-2 font-sans transition flex items-center ${
              activeTab === 'directory' 
                ? 'border-indigo-600 text-indigo-700 font-bold' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="h-4 w-4 mr-2" />
            Annuaire & Enquêtes ({habitants.length})
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`py-3.5 text-xs font-semibold tracking-wide border-b-2 font-sans transition flex items-center ${
              activeTab === 'documents' 
                ? 'border-indigo-600 text-indigo-700 font-bold' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSignature className="h-4 w-4 mr-2" />
            Générateur d'Actes & Docs
          </button>
          
          <button
            onClick={() => setActiveTab('statistics')}
            className={`py-3.5 text-xs font-semibold tracking-wide border-b-2 font-sans transition flex items-center ${
              activeTab === 'statistics' 
                ? 'border-indigo-600 text-indigo-700 font-bold' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HeartPulse className="h-4 w-4 mr-2" />
            Statistiques & Indicateurs
          </button>

          <button
            onClick={() => setActiveTab('finances')}
            className={`py-3.5 text-xs font-semibold tracking-wide border-b-2 font-sans transition flex items-center ${
              activeTab === 'finances' 
                ? 'border-indigo-600 text-indigo-700 font-bold' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Landmark className="h-4 w-4 mr-2" />
            Gestion Financière
          </button>

          <button
            onClick={() => setActiveTab('materials')}
            className={`py-3.5 text-xs font-semibold tracking-wide border-b-2 font-sans transition flex items-center ${
              activeTab === 'materials' 
                ? 'border-indigo-600 text-indigo-700 font-bold' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="h-4 w-4 mr-2" />
            Biens & Matériels
          </button>

          <button
            onClick={() => setActiveTab('land')}
            className={`py-3.5 text-xs font-semibold tracking-wide border-b-2 font-sans transition flex items-center ${
              activeTab === 'land' 
                ? 'border-indigo-600 text-indigo-700 font-bold' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building className="h-4 w-4 mr-2" />
            Foncier & Habitat
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3.5 text-xs font-semibold tracking-wide border-b-2 font-sans transition flex items-center ${
              activeTab === 'logs' 
                ? 'border-indigo-600 text-indigo-700 font-bold' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="h-4 w-4 mr-2" />
            Journal des Opérations ({logs.length})
          </button>
        </nav>
      </div>

      {/* Main Workspace Frame */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">

        {/* TAB 1: DIRECTORY VIEW (Search, filters and resident grid) */}
        {activeTab === 'directory' && (
          <div id="tab-directory-content" className="space-y-6 animate-fadeIn">
            {/* Filter Ledger console Box */}
            <div className="bg-white rounded-xl shadow-2xs border border-slate-200 p-5 space-y-4">
              
              <div className="flex flex-col lg:flex-row gap-3">
                {/* Search query input */}
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input 
                    type="text" 
                    placeholder="Rechercher par nom, prénom, CIN-ID, rattaché de ménage..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-10 pr-4 py-3.5 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-250 focus:border-indigo-500 rounded-lg placeholder-slate-400 outline-hidden font-sans transition text-slate-850"
                  />
                </div>

                {/* Quick household code filter */}
                <div className="relative w-full lg:w-48">
                  <input 
                    type="text" 
                    placeholder="Code ménage..."
                    value={householdFilter}
                    onChange={e => setHouseholdFilter(e.target.value)}
                    className="w-full text-xs pl-3 pr-8 py-3.5 bg-slate-50 border border-slate-250 focus:border-indigo-500 rounded-lg placeholder-slate-400 outline-hidden font-mono uppercase text-slate-850"
                  />
                  {householdFilter && (
                    <button 
                      onClick={() => setHouseholdFilter('')} 
                      className="absolute right-2.5 top-3.5 text-slate-400 hover:text-slate-600 font-bold text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* SAVED FILTER PRESETS CONTAINER */}
              <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-150 text-xs space-y-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-600 font-bold uppercase tracking-wider">
                    <Save className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Filtres Personnalisés Enregistrés</span>
                  </div>

                  {/* Preset Quick Saver */}
                  <div className="flex items-center space-x-1 w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder="Nommer ce filtre..."
                      value={presetNameInput}
                      onChange={e => setPresetNameInput(e.target.value)}
                      className="text-[11px] px-2 py-1 border border-slate-250 rounded bg-white font-sans focus:border-indigo-500 outline-hidden w-full sm:w-48 text-slate-800"
                    />
                    <button
                      onClick={handleSavePreset}
                      disabled={!presetNameInput.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 text-[11px] font-bold px-2.5 py-1 rounded transition duration-100 shrink-0"
                    >
                      Sauver
                    </button>
                  </div>
                </div>

                {/* Preset badges loop */}
                {savedPresets.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {savedPresets.map(preset => (
                      <div
                        key={preset.id}
                        onClick={() => handleApplyPreset(preset.id)}
                        className={`inline-flex items-center space-x-1.5 px-2 py-1 rounded border text-[11px] font-medium cursor-pointer select-none transition ${
                          activePresetId === preset.id
                            ? 'bg-indigo-600 text-white border-indigo-700 font-bold'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span>{preset.name}</span>
                        <button
                          onClick={(e) => handleDeletePreset(preset.id, e)}
                          className={`p-0.5 rounded-full ${activePresetId === preset.id ? 'hover:bg-indigo-700 text-indigo-200 hover:text-white' : 'hover:bg-slate-200 text-slate-400 hover:text-slate-600'}`}
                          title="Supprimer ce filtre"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic">Aucun filtre personnalisé de données en mémoire. Ajustez les critères ci-dessous et donnez-lui un nom pour l'enregistrer.</p>
                )}
              </div>

              {/* Filters selector grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-100">
                
                {/* Status selector */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Statut vital</span>
                  <select 
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setActivePresetId(''); }}
                    className="w-full border border-slate-200 bg-white rounded-lg p-2 text-slate-700 focus:border-indigo-550 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Tous">Tous les statuts</option>
                    <option value="Actif">Actif (Résidents)</option>
                    <option value="Décédé">Décédés (Défunt)</option>
                    <option value="Déménagé">Déménagés (Départ)</option>
                  </select>
                </div>

                {/* Sexe selector */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Genre</span>
                  <select 
                    value={sexeFilter}
                    onChange={e => { setSexeFilter(e.target.value); setActivePresetId(''); }}
                    className="w-full border border-slate-200 bg-white rounded-lg p-2 text-slate-700 focus:border-indigo-550 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Tous">Tous les Genres</option>
                    <option value="Homme">Hommes (M)</option>
                    <option value="Femme">Femmes (F)</option>
                  </select>
                </div>

                {/* Fokontany selector */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Fokontany d'habitation</span>
                  <select 
                    value={fokontanyFilter}
                    onChange={e => { setFokontanyFilter(e.target.value); setActivePresetId(''); }}
                    className="w-full border border-slate-200 bg-white rounded-lg p-2 text-slate-700 focus:border-indigo-550 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Tous">Tous les Fokontany</option>
                    {FOKONTANY_LIST.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                {/* Checkbox for health alert filters */}
                <div className="flex items-center justify-between pt-4 select-none">
                  <div className="flex items-center space-x-2">
                    <input 
                      type="checkbox"
                      id="healthAlert"
                      checked={healthAlertFilter}
                      onChange={e => { setHealthAlertFilter(e.target.checked); setActivePresetId(''); }}
                      className="rounded border-slate-300 text-indigo-650 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                    <label htmlFor="healthAlert" className="text-xs font-semibold text-slate-700 cursor-pointer block leading-tight">
                      Alerte pathologique (HT / Diabète)
                    </label>
                  </div>

                  {/* Toggle Advanced Button */}
                  <button
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1 transition shrink-0 ${
                      showAdvancedFilters 
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-250' 
                        : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                    title="Plus de filtres sur les données disponibles"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{showAdvancedFilters ? 'Fermer Options' : 'Options de Personnalisation'}</span>
                  </button>
                </div>

              </div>

              {/* ADVANCED CUSTOMIZABLE FILTERS ACCORDION */}
              {showAdvancedFilters && (
                <div id="advanced-filtres-panel" className="bg-indigo-50/20 p-4 border border-indigo-100 rounded-lg text-xs space-y-4 animate-slideDown">
                  <div className="flex items-center justify-between border-b border-indigo-100/40 pb-2">
                    <span className="font-extrabold text-indigo-900 uppercase tracking-wider text-[10px] flex items-center">
                      <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                      Critères de Personnalisation Supplémentaires
                    </span>
                    <button 
                      onClick={() => {
                        setMinAge(0);
                        setMaxAge(100);
                        setEducationFilter('Tous');
                        setSectorFilter('Tous');
                        setBloodFilter('Tous');
                        setHasCinFilter('Tous');
                        setHouseholdRoleFilter('Tous');
                        setMinIncome(0);
                        setVaccineFilter('Tous');
                        setActivePresetId('');
                      }}
                      className="text-indigo-700 hover:text-indigo-900 font-semibold text-[10px]"
                    >
                      Effacer options avancées
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Age Range Custom Input */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Tranche d'Âge ({minAge} - {maxAge} ans)</span>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="number"
                          placeholder="Min"
                          value={minAge}
                          min={0}
                          max={100}
                          onChange={e => { setMinAge(Math.max(0, parseInt(e.target.value) || 0)); setActivePresetId(''); }}
                          className="w-1/2 p-2 border border-slate-200 bg-white rounded text-[11px] focus:border-indigo-500"
                        />
                        <span className="text-slate-400">à</span>
                        <input 
                          type="number"
                          placeholder="Max"
                          value={maxAge}
                          min={0}
                          max={120}
                          onChange={e => { setMaxAge(Math.min(120, parseInt(e.target.value) || 100)); setActivePresetId(''); }}
                          className="w-1/2 p-2 border border-slate-200 bg-white rounded text-[11px] focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Education Level */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Niveau d'Études</span>
                      <select
                        value={educationFilter}
                        onChange={e => { setEducationFilter(e.target.value); setActivePresetId(''); }}
                        className="w-full border border-slate-200 bg-white rounded-lg p-2 text-slate-700 text-xs focus:border-indigo-500"
                      >
                        <option value="Tous">Tous niveaux d'études</option>
                        <option value="Non scolarisé">Non scolarisé (Zéro)</option>
                        <option value="Primaire">Primaire (EPP)</option>
                        <option value="Secondaire">Secondaire (Collège/Lycée)</option>
                        <option value="Universitaire">Universitaire (Bac+)</option>
                      </select>
                    </div>

                    {/* Secteur Économique */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-sans">Secteur Professionnel</span>
                      <select
                        value={sectorFilter}
                        onChange={e => { setSectorFilter(e.target.value); setActivePresetId(''); }}
                        className="w-full border border-slate-200 bg-white rounded-lg p-2 text-slate-700 text-xs focus:border-indigo-500"
                      >
                        <option value="Tous">Tous les secteurs</option>
                        {SECTEUR_LIST.map(sect => <option key={sect} value={sect}>{sect}</option>)}
                      </select>
                    </div>

                    {/* Groupe Sanguin */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Groupe Sanguin</span>
                      <select
                        value={bloodFilter}
                        onChange={e => { setBloodFilter(e.target.value); setActivePresetId(''); }}
                        className="w-full border border-slate-200 bg-white rounded-lg p-2 text-slate-700 text-xs focus:border-indigo-500"
                      >
                        <option value="Tous">Tous les groupes</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="Inconnu">Inconnu / Non déclaré</option>
                      </select>
                    </div>

                    {/* Titre de CIN enregistré */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Possession CIN</span>
                      <select
                        value={hasCinFilter}
                        onChange={e => { setHasCinFilter(e.target.value); setActivePresetId(''); }}
                        className="w-full border border-slate-200 bg-white rounded-lg p-2 text-slate-700 text-xs focus:border-indigo-500"
                      >
                        <option value="Tous">Tous (Avec ou Sans)</option>
                        <option value="Oui">Enregistré (Avec CIN)</option>
                        <option value="Non">Non enregistré (Sans CIN / Enfant)</option>
                      </select>
                    </div>

                    {/* Role dans le ménage */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Rôle Familier (Foyer)</span>
                      <select
                        value={householdRoleFilter}
                        onChange={e => { setHouseholdRoleFilter(e.target.value); setActivePresetId(''); }}
                        className="w-full border border-slate-200 bg-white rounded-lg p-2 text-slate-700 text-xs focus:border-indigo-500"
                      >
                        <option value="Tous">Tous les rôles</option>
                        <option value="Chef">Chef de Ménage uniquement</option>
                        <option value="Membre">Membres rattachés / Enfant</option>
                      </select>
                    </div>

                    {/* Seuil de Revenu Estimé */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Revenu Minimum (Ar)</span>
                      <input 
                        type="number"
                        placeholder="Ex: 500000"
                        value={minIncome}
                        min={0}
                        onChange={e => { setMinIncome(Math.max(0, parseInt(e.target.value) || 0)); setActivePresetId(''); }}
                        className="w-full p-2 border border-slate-200 bg-white rounded text-xs focus:border-indigo-500"
                      />
                    </div>

                    {/* Spécificité Vaccination */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Vaccination prise obligatoire</span>
                      <select
                        value={vaccineFilter}
                        onChange={e => { setVaccineFilter(e.target.value); setActivePresetId(''); }}
                        className="w-full border border-slate-200 bg-white rounded-lg p-2 text-slate-700 text-xs focus:border-indigo-500"
                      >
                        <option value="Tous">Toutes vaccinations confondues</option>
                        {COMPULSORY_VACCINATIONS.map(vac => <option key={vac} value={vac}>{vac}</option>)}
                      </select>
                    </div>

                  </div>
                </div>
              )}

              {/* Utility reset row */}
              <div className="flex items-center justify-between pt-1 text-[11px]">
                <p className="text-slate-500">
                  habitants filtrés : <strong className="font-mono text-indigo-600 bg-indigo-50/50 px-1 rounded">{filteredHabitants.length}</strong> sur <strong className="font-mono text-slate-700">{habitants.length}</strong> inscrits.
                </p>

                {(searchQuery || statusFilter !== 'Tous' || sexeFilter !== 'Tous' || fokontanyFilter !== 'Tous' || householdFilter || healthAlertFilter || minAge !== 0 || maxAge !== 100 || educationFilter !== 'Tous' || sectorFilter !== 'Tous' || bloodFilter !== 'Tous' || hasCinFilter !== 'Tous' || householdRoleFilter !== 'Tous' || minIncome !== 0 || vaccineFilter !== 'Tous') && (
                  <button 
                    onClick={handleResetFilters}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center space-x-1 border border-indigo-100 hover:border-indigo-200 rounded px-2 py-0.5"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Réinitialiser les filtres</span>
                  </button>
                )}
              </div>

            </div>

            {/* Resident GRID listings */}
            {filteredHabitants.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredHabitants.map(resident => (
                  <ResidentCard 
                    key={resident.id} 
                    resident={resident}
                    onSelect={(res) => setSelectedResident(res)} 
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white border rounded-xl py-16 text-center shadow-xs">
                <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-800">Aucun habitant ne correspond à vos filtres</p>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                  Modifiez votre requête de recherche ou retirez certains filtres d'état civil, Fokontany, ou d'alertes médicales pour élargir les résultats.
                </p>
                <button 
                  onClick={handleResetFilters} 
                  className="mt-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-4.5 py-1.5 rounded transition font-sans"
                >
                  Effacer tous les filtres
                </button>
              </div>
            )}

          </div>
        )}

        {/* TAB GENERATOR: ADMINISTRATIVE ACTS AND DOCUMENTS */}
        {activeTab === 'documents' && (
          <div id="tab-documents-content" className="animate-fadeIn">
            <DocumentGenerator 
              habitants={habitants} 
              onLoggedAction={(actionName, detailsMsg) => addLog(actionName, detailsMsg)} 
            />
          </div>
        )}

        {/* TAB 2: GENERAL GRAPH & ANALYTICS STATISTICS */}
        {activeTab === 'statistics' && (
          <div id="tab-statistics-content" className="animate-fadeIn">
            <StatsView habitants={habitants} />
          </div>
        )}

        {/* TAB 3: AUDIT HISTORY LOGS */}
        {activeTab === 'logs' && (
          <div id="tab-logs-content" className="space-y-6 animate-fadeIn">
            
            {/* History logs filter bar */}
            <div className="bg-white rounded-xl shadow-2xs border border-slate-200 p-5 flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                <input 
                  type="text" 
                  placeholder="Rechercher des actions, noms, numéros d'actes..."
                  value={logSearchQuery}
                  onChange={e => setLogSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-lg outline-hidden text-slate-800"
                />
              </div>

              <div className="text-xs text-slate-500 font-sans select-none">
                Période de rapport : <strong>Juin 2026</strong> (Sesssion numérisée active)
              </div>
            </div>

            {/* List logs table */}
            <div className="bg-white rounded-xl shadow-2xs border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 select-none">
                      <th className="p-3.5 font-semibold font-mono text-[10px] uppercase w-44">Date / Heure</th>
                      <th className="p-3.5 font-semibold font-mono text-[10px] uppercase w-40">Opérateur</th>
                      <th className="p-3.5 font-semibold font-mono text-[10px] uppercase w-40">Catégorie Action</th>
                      <th className="p-3.5 font-semibold font-mono text-[10px] uppercase">Détails d'opération</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                    {logs
                      .filter(log => {
                        const q = logSearchQuery.toLowerCase();
                        return (
                          log.action.toLowerCase().includes(q) ||
                          log.details.toLowerCase().includes(q) ||
                          log.utilisateur.toLowerCase().includes(q)
                        );
                      })
                      .map(log => {
                        const getActionBadgeClass = (act: HistoriqueLog['action']) => {
                          switch (act) {
                            case 'Création': return 'bg-emerald-50 text-emerald-800 border-emerald-100';
                            case 'Modification': return 'bg-blue-50 text-blue-800 border-blue-105';
                            case 'Certificat généré': return 'bg-indigo-50 text-indigo-800 border-indigo-100';
                            case 'Décès': return 'bg-slate-100 text-slate-800 border-slate-250';
                            case 'Changement adresse': return 'bg-purple-50 text-purple-800 border-purple-100';
                            case 'Finance': return 'bg-amber-50 text-amber-800 border-amber-200';
                            case 'Matériel': return 'bg-pink-50 text-pink-800 border-pink-200';
                            default: return 'bg-slate-100 text-slate-700 border-slate-200';
                          }
                        };

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition">
                            <td className="p-3.5 text-slate-500 whitespace-nowrap">
                              {new Date(log.date).toLocaleString('fr-FR')}
                            </td>
                            <td className="p-3.5 text-slate-800 font-sans font-semibold">
                              {log.utilisateur}
                            </td>
                            <td className="p-3.5">
                              <span className={`px-2 py-0.5 border text-[10px] rounded leading-none inline-block font-semibold ${getActionBadgeClass(log.action)}`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="p-3.5 text-slate-600 font-sans text-xs">
                              {log.details}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB: FINANCE REGISTRY AND REPORTS */}
        {activeTab === 'finances' && (
          <div id="tab-finances-content" className="animate-fadeIn">
            <FinanceModule 
              transactions={transactions}
              habitants={habitants}
              cotisations={cotisations}
              onAddTransaction={(newTx) => {
                const tx: Transaction = {
                  id: `tx-${Date.now()}`,
                  ...newTx
                };
                const updated = [tx, ...transactions];
                syncTransactions(updated);
                addLog('Finance', `Création d'une transaction de type ${tx.type === 'recette' ? 'Recette' : 'Dépense'} - Catégorie: ${tx.categorie} - Montant: ${tx.montant.toLocaleString('fr-FR')} Ar - Visa: ${tx.responsable}`);
              }}
              onDeleteTransaction={(id) => {
                const targetTx = transactions.find(t => t.id === id);
                const updated = transactions.filter(t => t.id !== id);
                syncTransactions(updated);
                if (targetTx) {
                  addLog('Finance', `Annulation de la transaction ${targetTx.id} (${targetTx.type === 'recette' ? 'Recette' : 'Dépense'} - Catégorie: ${targetTx.categorie} - Montant: ${targetTx.montant.toLocaleString('fr-FR')} Ar)`);
                }
              }}
              onAddCotisation={(newCot) => {
                const cot: CotisationAdidy = {
                  id: `cot-${Date.now()}`,
                  ...newCot
                };
                const updated = [cot, ...cotisations];
                syncCotisations(updated);
                addLog('Finance', `Paiement Adidy enregistré - Foyer: ${cot.codeMenage} - Mois: ${cot.mois}/2026 - Montant: ${cot.montant.toLocaleString('fr-FR')} Ar`);
                
                // Create an associated transaction in the ledger representing this revenue
                const tx: Transaction = {
                  id: `tx-cot-${Date.now()}`,
                  date: cot.datePaiement,
                  type: 'recette',
                  montant: cot.montant,
                  categorie: 'Dons & Cotisations',
                  description: `Cotisation mensuelle "Adidy" - Foyer: ${cot.codeMenage} - Réf: ${cot.recuNo}`,
                  responsable: cot.responsable
                };
                syncTransactions([tx, ...transactions]);
              }}
              onDeleteCotisation={(id) => {
                const target = cotisations.find(c => c.id === id);
                const updated = cotisations.filter(c => c.id !== id);
                syncCotisations(updated);
                if (target) {
                  addLog('Finance', `Annulation de cotisation Adidy - Foyer: ${target.codeMenage} - Mois: ${target.mois}/2026`);
                  // Also remove associated transactions
                  const txUpdated = transactions.filter(t => !t.description.includes(target.recuNo));
                  syncTransactions(txUpdated);
                }
              }}
            />
          </div>
        )}

        {/* TAB: MATERIALS INVENTORY AND LOANS */}
        {activeTab === 'materials' && (
          <div id="tab-materials-content" className="animate-fadeIn">
            <MaterialsModule 
              materiels={materiels}
              onAddMateriel={(newMat) => {
                const mat: Materiel = {
                  id: `mat-${Date.now()}`,
                  ...newMat
                };
                const updated = [...materiels, mat];
                syncMateriels(updated);
                addLog('Matériel', `Ajout de matériel au registre - Désignation: ${mat.nom} - Catégorie: ${mat.categorie} - Qté: ${mat.quantiteTotal}`);
              }}
              onUpdateMateriel={(updatedMat) => {
                const updated = materiels.map(m => m.id === updatedMat.id ? updatedMat : m);
                syncMateriels(updated);
                const oldMat = materiels.find(m => m.id === updatedMat.id);
                if (oldMat && oldMat.etat !== updatedMat.etat) {
                  addLog('Matériel', `Mise à jour d'état du matériel "${updatedMat.nom}" de "${oldMat.etat}" à "${updatedMat.etat}"`);
                } else {
                  addLog('Matériel', `Modification de stock du matériel "${updatedMat.nom}" (Disponible: ${updatedMat.quantiteDisponible}/${updatedMat.quantiteTotal})`);
                }
              }}
              onDeleteMateriel={(id) => {
                const targetMat = materiels.find(m => m.id === id);
                const updated = materiels.filter(m => m.id !== id);
                syncMateriels(updated);
                if (targetMat) {
                  addLog('Matériel', `Retrait du matériel "${targetMat.nom}" du patrimoine Fokontany`);
                }
              }}
            />
          </div>
        )}

        {/* TAB: FONCIER, CADASTRE & HABITAT */}
        {activeTab === 'land' && (
          <div id="tab-land-content" className="animate-fadeIn">
            <LandModule 
              allResidents={habitants} 
              onAddLog={addLog}
            />
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer id="app-general-footer" className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400 select-none">
        <p className="font-semibold text-slate-500 font-sans">REPUBLIQUE DE MADAGASCAR</p>
        <p className="mt-1 flex items-center justify-center space-x-1.5 font-mono text-[10px]">
          <span>Service d'enregistrement d'état civil numérisé du Fokontany</span>
          <span>•</span>
          <span>Version 1.2.0</span>
        </p>
      </footer>

      {/* 4. MODALS ORCHESTRATION */}

      {/* A. Resident details viewer modal */}
      {selectedResident && (
        <ResidentDetailModal 
          resident={selectedResident}
          allResidents={habitants}
          onClose={() => setSelectedResident(null)}
          onEdit={(res) => {
            setFormCurrentResident(res);
            setIsFormOpen(true);
          }}
          onGenerateCertificate={(res) => {
            setCertificateResident(res);
            setIsCertificateOpen(true);
          }}
          onNavigateToResident={(res) => {
            // Jump directly to that relative card profiles
            setSelectedResident(res);
          }}
          onQuickStatusChange={handleQuickStatusChange}
          onAddFamilyMember={handleAddFamilyMember}
          logs={logs}
        />
      )}

      {/* B. Resident creating / editing wizard */}
      {isFormOpen && (
        <ResidentForm 
          resident={formCurrentResident}
          allResidents={habitants}
          onClose={() => {
            setIsFormOpen(false);
            setFormCurrentResident(undefined);
          }}
          onSave={handleSaveResident}
        />
      )}

      {/* C. Printable administrative acts modal */}
      {isCertificateOpen && certificateResident && (
        <CertificateModal 
          resident={certificateResident}
          onClose={() => {
            setIsCertificateOpen(false);
            setCertificateResident(null);
          }}
          onLoggedAction={(act, msg) => {
            addLog(act, msg);
          }}
          onAddTransaction={(newTx) => {
            const tx: Transaction = {
              id: `tx-${Date.now()}`,
              ...newTx
            };
            const updated = [tx, ...transactions];
            syncTransactions(updated);
          }}
        />
      )}

    </div>
  );
}
