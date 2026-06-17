import React, { useState, useEffect } from 'react';
import { Habitant, HistoriqueLog, Transaction, Materiel, CotisationAdidy } from './types';
import { initialHabitants, initialLogs, FOKONTANY_LIST, SECTEUR_LIST, COMPULSORY_VACCINATIONS } from './seedData';
import { initialTransactions, initialMateriels, initialCotisations } from './financialAndMaterialSeedData';
import { supabase, dbGet, dbSet, KEYS } from './lib/supabase';

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

import { 
  FolderLock, Users, HeartPulse, History, PlusCircle, Search, 
  Filter, RotateCcw, Download, Upload, AppWindow, ShieldCheck,
  Building, Contact, SlidersHorizontal, Save, Trash2, FileSignature, HelpCircle, GraduationCap,
  Landmark, Package, Loader2
} from 'lucide-react';

export default function App() {
  const [habitants, setHabitants] = useState<Habitant[]>([]);
  const [logs, setLogs] = useState<HistoriqueLog[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [materiels, setMateriels] = useState<Materiel[]>([]);
  const [cotisations, setCotisations] = useState<CotisationAdidy[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'directory' | 'documents' | 'statistics' | 'finances' | 'materials' | 'logs' | 'land'>('directory');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Tous');
  const [sexeFilter, setSexeFilter] = useState<string>('Tous');
  const [fokontanyFilter, setFokontanyFilter] = useState<string>('Tous');
  const [householdFilter, setHouseholdFilter] = useState<string>('');
  const [healthAlertFilter, setHealthAlertFilter] = useState<boolean>(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [minAge, setMinAge] = useState<number>(0);
  const [maxAge, setMaxAge] = useState<number>(100);
  const [educationFilter, setEducationFilter] = useState<string>('Tous');
  const [sectorFilter, setSectorFilter] = useState<string>('Tous');
  const [bloodFilter, setBloodFilter] = useState<string>('Tous');
  const [hasCinFilter, setHasCinFilter] = useState<string>('Tous');
  const [householdRoleFilter, setHouseholdRoleFilter] = useState<string>('Tous');
  const [minIncome, setMinIncome] = useState<number>(0);
  const [vaccineFilter, setVaccineFilter] = useState<string>('Tous');
  const [savedPresets, setSavedPresets] = useState<{ id: string; name: string; filters: any }[]>([]);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [activePresetId, setActivePresetId] = useState<string>('');
  const [selectedResident, setSelectedResident] = useState<Habitant | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formCurrentResident, setFormCurrentResident] = useState<Habitant | undefined>(undefined);
  const [isCertificateOpen, setIsCertificateOpen] = useState(false);
  const [certificateResident, setCertificateResident] = useState<Habitant | null>(null);
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // ── CHARGEMENT DEPUIS SUPABASE ──────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      const [h, l, t, m, c, p] = await Promise.all([
        dbGet<Habitant[]>(KEYS.habitants),
        dbGet<HistoriqueLog[]>(KEYS.logs),
        dbGet<Transaction[]>(KEYS.transactions),
        dbGet<Materiel[]>(KEYS.materiels),
        dbGet<CotisationAdidy[]>(KEYS.cotisations),
        dbGet<any[]>(KEYS.presets),
      ]);
      setHabitants(h ?? initialHabitants);
      setLogs(l ?? initialLogs);
      setTransactions(t ?? initialTransactions);
      setMateriels(m ?? initialMateriels);
      setCotisations(c ?? initialCotisations);
      setSavedPresets(p ?? []);
      // Initialiser si vide
      if (!h) await dbSet(KEYS.habitants, initialHabitants);
      if (!l) await dbSet(KEYS.logs, initialLogs);
      if (!t) await dbSet(KEYS.transactions, initialTransactions);
      if (!m) await dbSet(KEYS.materiels, initialMateriels);
      if (!c) await dbSet(KEYS.cotisations, initialCotisations);
      setLoading(false);
    }
    load();
  }, []);

  // ── SYNC SUPABASE ───────────────────────────────────────────
  const syncHabitants = async (updated: Habitant[]) => {
    setHabitants(updated);
    await dbSet(KEYS.habitants, updated);
  };
  const syncLogs = async (updated: HistoriqueLog[]) => {
    setLogs(updated);
    await dbSet(KEYS.logs, updated);
  };
  const syncTransactions = async (updated: Transaction[]) => {
    setTransactions(updated);
    await dbSet(KEYS.transactions, updated);
  };
  const syncMateriels = async (updated: Materiel[]) => {
    setMateriels(updated);
    await dbSet(KEYS.materiels, updated);
  };
  const syncCotisations = async (updated: CotisationAdidy[]) => {
    setCotisations(updated);
    await dbSet(KEYS.cotisations, updated);
  };

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
      dbSet(KEYS.logs, updated);
      return updated;
    });
  };

  const filteredHabitants = habitants.filter(resident => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      resident.nom.toLowerCase().includes(searchLower) ||
      resident.prenom.toLowerCase().includes(searchLower) ||
      (resident.cin && resident.cin.includes(searchLower)) ||
      resident.id.toLowerCase().includes(searchLower) ||
      resident.famille.codeMenage.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === 'Tous' || resident.statut === statusFilter;
    const matchesSexe = sexeFilter === 'Tous' || (sexeFilter === 'Homme' && resident.sexe === 'M') || (sexeFilter === 'Femme' && resident.sexe === 'F');
    const matchesFokontany = fokontanyFilter === 'Tous' || resident.residence.fokontany === fokontanyFilter;
    const matchesHousehold = !householdFilter.trim() || resident.famille.codeMenage.toUpperCase().includes(householdFilter.toUpperCase().trim());
    const matchesHealthAlert = !healthAlertFilter || resident.sante.hypertension === 'Prioritaire' || resident.sante.diabete === 'Prioritaire' || resident.sante.hypertension === 'Surveillance' || resident.sante.diabete === 'Surveillance';
    const calculateAge = (dateN: string) => { const b = new Date(dateN); return Math.abs(new Date(Date.now() - b.getTime()).getUTCFullYear() - 1970); };
    const age = calculateAge(resident.dateNaissance);
    const matchesAge = age >= minAge && age <= maxAge;
    const matchesEducation = educationFilter === 'Tous' || resident.education.niveauEtude === educationFilter;
    const matchesSector = sectorFilter === 'Tous' || resident.economie.secteur === sectorFilter;
    const matchesBlood = bloodFilter === 'Tous' || resident.sante.groupeSanguin === bloodFilter;
    const matchesCin = hasCinFilter === 'Tous' || (hasCinFilter === 'Oui' && !!resident.cin) || (hasCinFilter === 'Non' && !resident.cin);
    const matchesHouseholdRole = householdRoleFilter === 'Tous' || (householdRoleFilter === 'Chef' && resident.famille.isChefMenage) || (householdRoleFilter === 'Membre' && !resident.famille.isChefMenage);
    const matchesIncome = (resident.economie.revenuEstime ?? 0) >= minIncome;
    const matchesVaccine = vaccineFilter === 'Tous' || resident.sante.vaccination.includes(vaccineFilter);
    return matchesSearch && matchesStatus && matchesSexe && matchesFokontany && matchesHousehold && matchesHealthAlert && matchesAge && matchesEducation && matchesSector && matchesBlood && matchesCin && matchesHouseholdRole && matchesIncome && matchesVaccine;
  });

  const handleSavePreset = async () => {
    if (!presetNameInput.trim()) return;
    const newPreset = { id: `preset-${Date.now()}`, name: presetNameInput, filters: { statusFilter, sexeFilter, fokontanyFilter, householdFilter, healthAlertFilter, minAge, maxAge, educationFilter, sectorFilter, bloodFilter, hasCinFilter, householdRoleFilter, minIncome, vaccineFilter } };
    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    await dbSet(KEYS.presets, updated);
    setPresetNameInput('');
    setActivePresetId(newPreset.id);
    addLog('Modification', `Filtre personnalisé sauvegardé : "${presetNameInput}".`);
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = savedPresets.find(p => p.id === presetId);
    if (!preset) return;
    setActivePresetId(presetId);
    setStatusFilter(preset.filters.statusFilter); setSexeFilter(preset.filters.sexeFilter); setFokontanyFilter(preset.filters.fokontanyFilter); setHouseholdFilter(preset.filters.householdFilter || ''); setHealthAlertFilter(preset.filters.healthAlertFilter || false);
    setMinAge(preset.filters.minAge ?? 0); setMaxAge(preset.filters.maxAge ?? 100); setEducationFilter(preset.filters.educationFilter ?? 'Tous'); setSectorFilter(preset.filters.sectorFilter ?? 'Tous'); setBloodFilter(preset.filters.bloodFilter ?? 'Tous'); setHasCinFilter(preset.filters.hasCinFilter ?? 'Tous'); setHouseholdRoleFilter(preset.filters.householdRoleFilter ?? 'Tous'); setMinIncome(preset.filters.minIncome ?? 0); setVaccineFilter(preset.filters.vaccineFilter ?? 'Tous');
    setShowAdvancedFilters(true);
  };

  const handleDeletePreset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = savedPresets.find(p => p.id === id);
    const updated = savedPresets.filter(p => p.id !== id);
    setSavedPresets(updated);
    await dbSet(KEYS.presets, updated);
    if (activePresetId === id) setActivePresetId('');
    if (target) addLog('Modification', `Filtre supprimé : "${target.name}".`);
  };

  const handleSaveResident = async (editedHabitant: Habitant) => {
    const exists = habitants.some(h => h.id === editedHabitant.id);
    let updated: Habitant[];
    let actionType: HistoriqueLog['action'] = 'Création';
    let detailMsg = '';
    if (exists) {
      updated = habitants.map(h => h.id === editedHabitant.id ? editedHabitant : h);
      actionType = 'Modification';
      detailMsg = `Mise à jour de ${editedHabitant.nom} ${editedHabitant.prenom}.`;
      const old = habitants.find(h => h.id === editedHabitant.id);
      if (old && old.residence.adresse !== editedHabitant.residence.adresse) { actionType = 'Changement adresse'; detailMsg = `Changement d'adresse pour ${editedHabitant.nom} ${editedHabitant.prenom}.`; }
    } else {
      updated = [editedHabitant, ...habitants];
      actionType = 'Création';
      detailMsg = `Nouveau résident : ${editedHabitant.nom} ${editedHabitant.prenom} (${editedHabitant.id}).`;
    }
    const { conjointId, pereId, mereId } = editedHabitant.famille;
    const childId = editedHabitant.id;
    updated = updated.map(member => {
      let changed = false; const f = { ...member.famille };
      if (pereId && member.id === pereId && !f.enfantsIds.includes(childId)) { f.enfantsIds = [...f.enfantsIds, childId]; changed = true; }
      if (mereId && member.id === mereId && !f.enfantsIds.includes(childId)) { f.enfantsIds = [...f.enfantsIds, childId]; changed = true; }
      if (conjointId && member.id === conjointId && f.conjointId !== childId) { f.conjointId = childId; changed = true; }
      return changed ? { ...member, famille: f } : member;
    });
    await syncHabitants(updated);
    addLog(actionType, detailMsg);
    setIsFormOpen(false); setFormCurrentResident(undefined);
    if (selectedResident?.id === editedHabitant.id) setSelectedResident(editedHabitant);
  };

  const handleAddFamilyMember = (foyerRef: Habitant) => {
    const freshId = `IND-${Math.floor(10000 + Math.random() * 90000)}`;
    const template: Habitant = { id: freshId, nom: foyerRef.nom, prenom: '', sexe: 'M', dateNaissance: '', lieuNaissance: foyerRef.residence.commune, statut: 'Actif', famille: { codeMenage: foyerRef.famille.codeMenage, isChefMenage: false, conjointId: '', pereId: foyerRef.sexe === 'M' ? foyerRef.id : undefined, mereId: foyerRef.sexe === 'F' ? foyerRef.id : undefined, enfantsIds: [] }, residence: { adresse: foyerRef.residence.adresse, fokontany: foyerRef.residence.fokontany, commune: foyerRef.residence.commune, district: foyerRef.residence.district, gps: foyerRef.residence.gps }, education: { niveauEtude: 'Secondaire', competences: [], langues: ['Malagasy'] }, economie: { profession: '', secteur: 'Commerce & Artisanat' }, sante: { groupeSanguin: 'O+', hypertension: 'Normal', diabete: 'Normal', vaccination: [] } };
    setSelectedResident(null); setFormCurrentResident(template); setIsFormOpen(true);
    addLog('Modification', `Formulaire ouvert pour nouveau membre du foyer ${foyerRef.famille.codeMenage}.`);
  };

  const handleQuickStatusChange = async (residentId: string, newStatus: Habitant['statut']) => {
    const resident = habitants.find(h => h.id === residentId);
    if (!resident) return;
    const updated = habitants.map(h => h.id === residentId ? { ...h, statut: newStatus } : h);
    let actionType: HistoriqueLog['action'] = 'Modification';
    let details = '';
    if (newStatus === 'Décédé') { actionType = 'Décès'; details = `Décès déclaré pour ${resident.nom} ${resident.prenom}.`; }
    else if (newStatus === 'Déménagé') { actionType = 'Déménagement'; details = `Déménagement enregistré pour ${resident.nom} ${resident.prenom}.`; }
    else { details = `Réactivation de ${resident.nom} ${resident.prenom}.`; }
    await syncHabitants(updated);
    addLog(actionType, details);
    const updatedResident = updated.find(h => h.id === residentId);
    if (updatedResident) setSelectedResident(updatedResident);
  };

  const handleResetFilters = () => { setSearchQuery(''); setStatusFilter('Tous'); setSexeFilter('Tous'); setFokontanyFilter('Tous'); setHouseholdFilter(''); setHealthAlertFilter(false); setMinAge(0); setMaxAge(100); setEducationFilter('Tous'); setSectorFilter('Tous'); setBloodFilter('Tous'); setHasCinFilter('Tous'); setHouseholdRoleFilter('Tous'); setMinIncome(0); setVaccineFilter('Tous'); setActivePresetId(''); };

  const handleExportBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ habitants, logs }, null, 2));
    const a = document.createElement('a'); a.setAttribute("href", dataStr); a.setAttribute("download", `registre_backup_${new Date().toISOString().split('T')[0]}.json`); document.body.appendChild(a); a.click(); a.remove();
    addLog('Modification', 'Export JSON de la base de données.');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Chargement du registre…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans selection:bg-indigo-505 selection:text-indigo-900">
      
      <header id="main-fokontany-header" className="bg-white border-b border-slate-200 shadow-2xs py-4 px-6 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="bg-emerald-600 p-2.5 rounded-xl text-white shadow-xs shrink-0 flex items-center justify-center relative">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-600 rounded-l-xl"></div>
              <FolderLock className="h-6 w-6 ml-1" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[9px] bg-red-50 text-red-600 border border-red-100 rounded px-1.5 py-0.5 font-bold tracking-widest font-mono select-none uppercase">Fokontany local ledger</span>
                <span className="text-[9px] bg-emerald-50 text-emerald-800 border border-emerald-100 rounded px-1.5 py-0.5 font-sans font-semibold inline-block select-none">Toamasina, MG</span>
              </div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight uppercase font-sans mt-0.5 flex items-center">
                <span>Registre des Habitants</span>
                <ShieldCheck className="h-4.5 w-4.5 text-indigo-600 ml-1.5" />
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-2.5 flex-wrap">
            <button onClick={() => { setFormCurrentResident(undefined); setIsFormOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-4 rounded-lg flex items-center space-x-1.5 shadow-2xs transition duration-150">
              <PlusCircle className="h-4 w-4" /><span>Inscrire un Habitant</span>
            </button>
            <button onClick={handleExportBackup} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold py-2 px-3.5 rounded-lg flex items-center space-x-1.5 shadow-3xs transition duration-150">
              <Download className="h-4 w-4 text-slate-550" /><span>Sauvegarder</span>
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 px-6 py-1 select-none overflow-x-auto">
        <nav className="max-w-7xl mx-auto flex space-x-6 min-w-max">
          {[
            { key: 'directory', icon: Users, label: `Annuaire & Enquêtes (${habitants.length})` },
            { key: 'documents', icon: FileSignature, label: "Générateur d'Actes & Docs" },
            { key: 'statistics', icon: HeartPulse, label: 'Statistiques & Indicateurs' },
            { key: 'finances', icon: Landmark, label: 'Gestion Financière' },
            { key: 'materials', icon: Package, label: 'Biens & Matériels' },
            { key: 'land', icon: Building, label: 'Foncier & Habitat' },
            { key: 'logs', icon: History, label: `Journal des Opérations (${logs.length})` },
          ].map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setActiveTab(key as any)} className={`py-3.5 text-xs font-semibold tracking-wide border-b-2 font-sans transition flex items-center ${activeTab === key ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              <Icon className="h-4 w-4 mr-2" />{label}
            </button>
          ))}
        </nav>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">

        {activeTab === 'directory' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xs border border-slate-200 p-5 space-y-4">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input type="text" placeholder="Rechercher par nom, prénom, CIN-ID, code ménage..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full text-xs pl-10 pr-4 py-3.5 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-250 focus:border-indigo-500 rounded-lg placeholder-slate-400 outline-hidden font-sans transition text-slate-850" />
                </div>
                <div className="relative w-full lg:w-48">
                  <input type="text" placeholder="Code ménage..." value={householdFilter} onChange={e => setHouseholdFilter(e.target.value)} className="w-full text-xs pl-3 pr-8 py-3.5 bg-slate-50 border border-slate-250 focus:border-indigo-500 rounded-lg placeholder-slate-400 outline-hidden font-mono uppercase text-slate-850" />
                  {householdFilter && <button onClick={() => setHouseholdFilter('')} className="absolute right-2.5 top-3.5 text-slate-400 hover:text-slate-600 font-bold text-xs">×</button>}
                </div>
              </div>

              <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-150 text-xs space-y-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-600 font-bold uppercase tracking-wider"><Save className="h-3.5 w-3.5 text-indigo-600" /><span>Filtres Personnalisés</span></div>
                  <div className="flex items-center space-x-1 w-full sm:w-auto">
                    <input type="text" placeholder="Nommer ce filtre..." value={presetNameInput} onChange={e => setPresetNameInput(e.target.value)} className="text-[11px] px-2 py-1 border border-slate-250 rounded bg-white font-sans focus:border-indigo-500 outline-hidden w-full sm:w-48 text-slate-800" />
                    <button onClick={handleSavePreset} disabled={!presetNameInput.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 text-[11px] font-bold px-2.5 py-1 rounded transition shrink-0">Sauver</button>
                  </div>
                </div>
                {savedPresets.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {savedPresets.map(preset => (
                      <div key={preset.id} onClick={() => handleApplyPreset(preset.id)} className={`inline-flex items-center space-x-1.5 px-2 py-1 rounded border text-[11px] font-medium cursor-pointer select-none transition ${activePresetId === preset.id ? 'bg-indigo-600 text-white border-indigo-700 font-bold' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'}`}>
                        <span>{preset.name}</span>
                        <button onClick={(e) => handleDeletePreset(preset.id, e)} className={`p-0.5 rounded-full ${activePresetId === preset.id ? 'hover:bg-indigo-700 text-indigo-200' : 'hover:bg-slate-200 text-slate-400'}`}><Trash2 className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-[10px] text-slate-400 italic">Aucun filtre enregistré.</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-100">
                <div className="space-y-1"><span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Statut vital</span><select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setActivePresetId(''); }} className="w-full border border-slate-200 bg-white rounded-lg p-2 text-slate-700"><option value="Tous">Tous</option><option value="Actif">Actif</option><option value="Décédé">Décédé</option><option value="Déménagé">Déménagé</option></select></div>
                <div className="space-y-1"><span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Genre</span><select value={sexeFilter} onChange={e => { setSexeFilter(e.target.value); setActivePresetId(''); }} className="w-full border border-slate-200 bg-white rounded-lg p-2 text-slate-700"><option value="Tous">Tous</option><option value="Homme">Hommes</option><option value="Femme">Femmes</option></select></div>
                <div className="space-y-1"><span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Fokontany</span><select value={fokontanyFilter} onChange={e => { setFokontanyFilter(e.target.value); setActivePresetId(''); }} className="w-full border border-slate-200 bg-white rounded-lg p-2 text-slate-700"><option value="Tous">Tous</option>{FOKONTANY_LIST.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                <div className="flex items-center justify-between pt-4 select-none">
                  <div className="flex items-center space-x-2"><input type="checkbox" id="healthAlert" checked={healthAlertFilter} onChange={e => { setHealthAlertFilter(e.target.checked); setActivePresetId(''); }} className="rounded border-slate-300 text-indigo-650 h-4 w-4 cursor-pointer" /><label htmlFor="healthAlert" className="text-xs font-semibold text-slate-700 cursor-pointer">Alerte HT / Diabète</label></div>
                  <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1 transition shrink-0 ${showAdvancedFilters ? 'bg-indigo-50 text-indigo-700 border-indigo-250' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'}`}><SlidersHorizontal className="h-3.5 w-3.5" /><span className="hidden sm:inline">{showAdvancedFilters ? 'Fermer' : 'Avancé'}</span></button>
                </div>
              </div>

              {showAdvancedFilters && (
                <div className="bg-indigo-50/20 p-4 border border-indigo-100 rounded-lg text-xs space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1"><span className="text-[10px] font-bold text-slate-500 uppercase block">Âge ({minAge}-{maxAge})</span><div className="flex items-center space-x-2"><input type="number" value={minAge} min={0} max={100} onChange={e => { setMinAge(Math.max(0, parseInt(e.target.value)||0)); setActivePresetId(''); }} className="w-1/2 p-2 border border-slate-200 bg-white rounded text-[11px]" /><span className="text-slate-400">à</span><input type="number" value={maxAge} min={0} max={120} onChange={e => { setMaxAge(Math.min(120, parseInt(e.target.value)||100)); setActivePresetId(''); }} className="w-1/2 p-2 border border-slate-200 bg-white rounded text-[11px]" /></div></div>
                    <div className="space-y-1"><span className="text-[10px] font-bold text-slate-500 uppercase block">Études</span><select value={educationFilter} onChange={e => { setEducationFilter(e.target.value); setActivePresetId(''); }} className="w-full border border-slate-200 bg-white rounded-lg p-2 text-slate-700 text-xs"><option value="Tous">Tous</option><option value="Non scolarisé">Non scolarisé</option><option value="Primaire">Primaire</option><option value="Secondaire">Secondaire</option><option value="Universitaire">Universitaire</option></select></div>
                    <div className="space-y-1"><span className="text-[10px] font-bold text-slate-500 uppercase block">Secteur</span><select value={sectorFilter} onChange={e => { setSectorFilter(e.target.value); setActivePresetId(''); }} className="w-full border border-slate-200 bg-white rounded-lg p-2 text-slate-700 text-xs"><option value="Tous">Tous</option>{SECTEUR_LIST.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    <div className="space-y-1"><span className="text-[10px] font-bold text-slate-500 uppercase block">Groupe sanguin</span><select value={bloodFilter} onChange={e => { setBloodFilter(e.target.value); setActivePresetId(''); }} className="w-full border border-slate-200 bg-white rounded-lg p-2 text-slate-700 text-xs"><option value="Tous">Tous</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                    <div className="space-y-1"><span className="text-[10px] font-bold text-slate-500 uppercase block">CIN</span><select value={hasCinFilter} onChange={e => { setHasCinFilter(e.target.value); setActivePresetId(''); }} className="w-full border border-slate-200 bg-white rounded-lg p-2 text-slate-700 text-xs"><option value="Tous">Tous</option><option value="Oui">Avec CIN</option><option value="Non">Sans CIN</option></select></div>
                    <div className="space-y-1"><span className="text-[10px] font-bold text-slate-500 uppercase block">Rôle foyer</span><select value={householdRoleFilter} onChange={e => { setHouseholdRoleFilter(e.target.value); setActivePresetId(''); }} className="w-full border border-slate-200 bg-white rounded-lg p-2 text-slate-700 text-xs"><option value="Tous">Tous</option><option value="Chef">Chef de ménage</option><option value="Membre">Membre</option></select></div>
                    <div className="space-y-1"><span className="text-[10px] font-bold text-slate-500 uppercase block">Revenu min (Ar)</span><input type="number" value={minIncome} min={0} onChange={e => { setMinIncome(Math.max(0, parseInt(e.target.value)||0)); setActivePresetId(''); }} className="w-full p-2 border border-slate-200 bg-white rounded text-xs" /></div>
                    <div className="space-y-1"><span className="text-[10px] font-bold text-slate-500 uppercase block">Vaccination</span><select value={vaccineFilter} onChange={e => { setVaccineFilter(e.target.value); setActivePresetId(''); }} className="w-full border border-slate-200 bg-white rounded-lg p-2 text-slate-700 text-xs"><option value="Tous">Tous</option>{COMPULSORY_VACCINATIONS.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 text-[11px]">
                <p className="text-slate-500">Filtrés : <strong className="font-mono text-indigo-600 bg-indigo-50/50 px-1 rounded">{filteredHabitants.length}</strong> / <strong className="font-mono text-slate-700">{habitants.length}</strong></p>
                {(searchQuery || statusFilter !== 'Tous' || sexeFilter !== 'Tous' || fokontanyFilter !== 'Tous' || householdFilter || healthAlertFilter) && (
                  <button onClick={handleResetFilters} className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center space-x-1 border border-indigo-100 rounded px-2 py-0.5"><RotateCcw className="h-3 w-3" /><span>Réinitialiser</span></button>
                )}
              </div>
            </div>

            {filteredHabitants.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredHabitants.map(resident => <ResidentCard key={resident.id} resident={resident} onSelect={(res) => setSelectedResident(res)} />)}
              </div>
            ) : (
              <div className="bg-white border rounded-xl py-16 text-center shadow-xs">
                <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-800">Aucun habitant ne correspond à vos filtres</p>
                <button onClick={handleResetFilters} className="mt-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-4.5 py-1.5 rounded transition">Effacer les filtres</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && <div className="animate-fadeIn"><DocumentGenerator habitants={habitants} onLoggedAction={(a, d) => addLog(a, d)} /></div>}
        {activeTab === 'statistics' && <div className="animate-fadeIn"><StatsView habitants={habitants} /></div>}

        {activeTab === 'logs' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xs border border-slate-200 p-5 flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-96"><Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" /><input type="text" placeholder="Rechercher dans le journal..." value={logSearchQuery} onChange={e => setLogSearchQuery(e.target.value)} className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-hidden text-slate-800" /></div>
            </div>
            <div className="bg-white rounded-xl shadow-2xs border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead><tr className="bg-slate-50 border-b border-slate-150 text-slate-500 select-none"><th className="p-3.5 font-semibold font-mono text-[10px] uppercase w-44">Date</th><th className="p-3.5 font-semibold font-mono text-[10px] uppercase w-40">Opérateur</th><th className="p-3.5 font-semibold font-mono text-[10px] uppercase w-40">Action</th><th className="p-3.5 font-semibold font-mono text-[10px] uppercase">Détails</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                    {logs.filter(log => { const q = logSearchQuery.toLowerCase(); return log.action.toLowerCase().includes(q) || log.details.toLowerCase().includes(q) || log.utilisateur.toLowerCase().includes(q); }).map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition">
                        <td className="p-3.5 text-slate-500 whitespace-nowrap">{new Date(log.date).toLocaleString('fr-FR')}</td>
                        <td className="p-3.5 text-slate-800 font-sans font-semibold">{log.utilisateur}</td>
                        <td className="p-3.5"><span className="px-2 py-0.5 border text-[10px] rounded leading-none inline-block font-semibold bg-slate-100 text-slate-700 border-slate-200">{log.action}</span></td>
                        <td className="p-3.5 text-slate-600 font-sans text-xs">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'finances' && (
          <div className="animate-fadeIn">
            <FinanceModule transactions={transactions} habitants={habitants} cotisations={cotisations}
              onAddTransaction={async (newTx) => { const tx: Transaction = { id: `tx-${Date.now()}`, ...newTx }; const updated = [tx, ...transactions]; await syncTransactions(updated); addLog('Finance', `Transaction ${tx.type} - ${tx.categorie} - ${tx.montant.toLocaleString('fr-FR')} Ar`); }}
              onDeleteTransaction={async (id) => { const t = transactions.find(x => x.id === id); const updated = transactions.filter(x => x.id !== id); await syncTransactions(updated); if (t) addLog('Finance', `Annulation transaction ${t.id}`); }}
              onAddCotisation={async (newCot) => { const cot: CotisationAdidy = { id: `cot-${Date.now()}`, ...newCot }; const updated = [cot, ...cotisations]; await syncCotisations(updated); addLog('Finance', `Cotisation Adidy - Foyer: ${cot.codeMenage} - ${cot.montant.toLocaleString('fr-FR')} Ar`); const tx: Transaction = { id: `tx-cot-${Date.now()}`, date: cot.datePaiement, type: 'recette', montant: cot.montant, categorie: 'Dons & Cotisations', description: `Cotisation Adidy - Foyer: ${cot.codeMenage} - Réf: ${cot.recuNo}`, responsable: cot.responsable }; await syncTransactions([tx, ...transactions]); }}
              onDeleteCotisation={async (id) => { const c = cotisations.find(x => x.id === id); const updated = cotisations.filter(x => x.id !== id); await syncCotisations(updated); if (c) { addLog('Finance', `Annulation cotisation - Foyer: ${c.codeMenage}`); const txUpdated = transactions.filter(t => !t.description.includes(c.recuNo)); await syncTransactions(txUpdated); } }}
            />
          </div>
        )}

        {activeTab === 'materials' && (
          <div className="animate-fadeIn">
            <MaterialsModule materiels={materiels}
              onAddMateriel={async (newMat) => { const mat: Materiel = { id: `mat-${Date.now()}`, ...newMat }; const updated = [...materiels, mat]; await syncMateriels(updated); addLog('Matériel', `Ajout : ${mat.nom} - ${mat.categorie}`); }}
              onUpdateMateriel={async (updatedMat) => { const updated = materiels.map(m => m.id === updatedMat.id ? updatedMat : m); await syncMateriels(updated); addLog('Matériel', `Mise à jour : ${updatedMat.nom}`); }}
              onDeleteMateriel={async (id) => { const t = materiels.find(m => m.id === id); const updated = materiels.filter(m => m.id !== id); await syncMateriels(updated); if (t) addLog('Matériel', `Retrait : ${t.nom}`); }}
            />
          </div>
        )}

        {activeTab === 'land' && <div className="animate-fadeIn"><LandModule allResidents={habitants} onAddLog={addLog} /></div>}

      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400 select-none">
        <p className="font-semibold text-slate-500 font-sans">REPUBLIQUE DE MADAGASCAR</p>
        <p className="mt-1 flex items-center justify-center space-x-1.5 font-mono text-[10px]"><span>Service d'enregistrement d'état civil numérisé du Fokontany</span><span>•</span><span>Version 2.0.0</span></p>
      </footer>

      {selectedResident && <ResidentDetailModal resident={selectedResident} allResidents={habitants} onClose={() => setSelectedResident(null)} onEdit={(res) => { setFormCurrentResident(res); setIsFormOpen(true); }} onGenerateCertificate={(res) => { setCertificateResident(res); setIsCertificateOpen(true); }} onNavigateToResident={(res) => setSelectedResident(res)} onQuickStatusChange={handleQuickStatusChange} onAddFamilyMember={handleAddFamilyMember} logs={logs} />}
      {isFormOpen && <ResidentForm resident={formCurrentResident} allResidents={habitants} onClose={() => { setIsFormOpen(false); setFormCurrentResident(undefined); }} onSave={handleSaveResident} />}
      {isCertificateOpen && certificateResident && <CertificateModal resident={certificateResident} onClose={() => { setIsCertificateOpen(false); setCertificateResident(null); }} onLoggedAction={(a, m) => addLog(a, m)} onAddTransaction={async (newTx) => { const tx: Transaction = { id: `tx-${Date.now()}`, ...newTx }; await syncTransactions([tx, ...transactions]); }} />}
    </div>
  );
}
