import React, { useState, useEffect } from 'react';
import { Habitant, Sexe, StatutSante, StatutHabitant } from '../types';
import { 
  FOKONTANY_LIST, COMMUNE_LIST, DISTRICT_LIST, SECTEUR_LIST, 
  COMPETENCES_LIST, LANGUES_LIST, COMPULSORY_VACCINATIONS 
} from '../seedData';
import { X, Check, Save, User, MapPin, Briefcase, Heart, Plus, Trash2, Landmark, Home, Layers, HelpCircle, FileText, Camera, Upload } from 'lucide-react';

interface ResidentFormProps {
  resident?: Habitant; // if provided, editing mode; else creating mode
  allResidents: Habitant[];
  onClose: () => void;
  onSave: (resident: Habitant) => void;
}

type FormTab = 'identity' | 'residence' | 'instruction' | 'health';

export default function ResidentForm({ resident, allResidents, onClose, onSave }: ResidentFormProps) {
  const isEdit = !!resident;
  const [activeTab, setActiveTab] = useState<FormTab>('identity');

  // File to Base64 upload helper
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'identity' | 'house') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        if (type === 'identity') {
          setPhotoUrl(reader.result);
        } else {
          setPhotoMaisonUrl(reader.result);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Helper to generate a simulated beautiful avatar if camera simulation is clicked
  const simulateCapture = (type: 'identity' | 'house') => {
    if (type === 'identity') {
      // Professional preset passport photos for Madagascar residents
      const presets = [
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200&h=200",
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200&h=200",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200&h=200",
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200&h=200",
        "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&q=80&w=200&h=200"
      ];
      const selected = presets[Math.floor(Math.random() * presets.length)];
      setPhotoUrl(selected);
    } else {
      // Cozy houses / traditional architecture models in Madagascar
      const housePresets = [
        "https://images.unsplash.com/photo-1513584684374-8bab748fbf90?auto=format&fit=crop&q=80&w=300&h=200",
        "https://images.unsplash.com/photo-1524813686514-a57563d77965?auto=format&fit=crop&q=80&w=300&h=200",
        "https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?auto=format&fit=crop&q=80&w=300&h=200",
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=300&h=200"
      ];
      const selectedHouse = housePresets[Math.floor(Math.random() * housePresets.length)];
      setPhotoMaisonUrl(selectedHouse);
    }
  };

  // Core values state (with safe defaults matching Habitant interface)
  const [id, setId] = useState('');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [sexe, setSexe] = useState<Sexe>('M');
  const [dateNaissance, setDateNaissance] = useState('');
  const [lieuNaissance, setLieuNaissance] = useState('');
  const [cin, setCin] = useState('');
  const [dateCin, setDateCin] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [statut, setStatut] = useState<StatutHabitant>('Actif');
  const [photoUrl, setPhotoUrl] = useState('');

  // Sante & extra states (for age < 18)
  const [poids, setPoids] = useState('');
  const [taille, setTaille] = useState('');

  // Additional Residence states (Carreau, photo de maison, pièces, superficie)
  const [carreau, setCarreau] = useState('Tsararivotra');
  const [numCarreau, setNumCarreau] = useState('');
  const [photoMaisonUrl, setPhotoMaisonUrl] = useState('');
  const [nombrePieces, setNombrePieces] = useState('');
  const [superficieMaison, setSuperficieMaison] = useState('');

  // Famille nested state
  const [codeMenage, setCodeMenage] = useState('');
  const [isChefMenage, setIsChefMenage] = useState(false);
  const [conjointId, setConjointId] = useState('');
  const [pereId, setPereId] = useState('');
  const [mereId, setMereId] = useState('');
  const [enfantsIds, setEnfantsIds] = useState<string[]>([]);
  const [pereNom, setPereNom] = useState('');
  const [mereNom, setMereNom] = useState('');

  // Residence nested state
  const [adresse, setAdresse] = useState('');
  const [fokontany, setFokontany] = useState(FOKONTANY_LIST[0]);
  const [commune, setCommune] = useState(COMMUNE_LIST[0]);
  const [district, setDistrict] = useState(DISTRICT_LIST[0]);
  const [gpsLat, setGpsLat] = useState('');
  const [gpsLng, setGpsLng] = useState('');

  // Foncier state (simply lot number associated in address)
  const [numLot, setNumLot] = useState('');

  // Education nested state
  const [niveauEtude, setNiveauEtude] = useState('Secondaire');
  const [diplome, setDiplome] = useState('');
  const [competences, setCompetences] = useState<string[]>([]);
  const [langues, setLangues] = useState<string[]>(['Malagasy']);

  // Economie nested state
  const [profession, setProfession] = useState('');
  const [secteur, setSecteur] = useState(SECTEUR_LIST[SECTEUR_LIST.length - 1]);
  const [employeur, setEmployeur] = useState('');
  const [revenuEstime, setRevenuEstime] = useState('');

  // Sante nested state
  const [groupeSanguin, setGroupeSanguin] = useState('O+');
  const [handicap, setHandicap] = useState('');
  const [hypertension, setHypertension] = useState<StatutSante>('Normal');
  const [diabete, setDiabete] = useState<StatutSante>('Normal');
  const [vaccination, setVaccination] = useState<string[]>([]);

  // Enriched Vulnerability states
  const [estVulnerable, setEstVulnerable] = useState(false);
  const [vulnerabiliteCategories, setVulnerabiliteCategories] = useState<string[]>([]);
  const [niveauPriorite, setNiveauPriorite] = useState<'Aucun' | 'Moyen' | 'Critique'>('Aucun');
  const [vulnerabiliteDesc, setVulnerabiliteDesc] = useState('');
  const [aidesObtenues, setAidesObtenues] = useState<string[]>([]);

  // Custom Tag input states for user competencies
  const [customSkill, setCustomSkill] = useState('');

  // Age calculation and Minor checks (<18 ans)
  const calculateAge = (dobString: string): number => {
    if (!dobString) return 0;
    const today = new Date();
    const birthDate = new Date(dobString);
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      calculatedAge--;
    }
    return calculatedAge >= 0 ? calculatedAge : 0;
  };

  const age = calculateAge(dateNaissance);
  const isUnder18 = dateNaissance ? age < 18 : false;
  // Hydrate fields if editing
  useEffect(() => {
    if (resident) {
      setId(resident.id);
      setNom(resident.nom || '');
      setPrenom(resident.prenom || '');
      setSexe(resident.sexe || 'M');
      setDateNaissance(resident.dateNaissance || '');
      setLieuNaissance(resident.lieuNaissance || '');
      setCin(resident.cin || '');
      setDateCin(resident.dateCin || '');
      setTelephone(resident.telephone || '');
      setEmail(resident.email || '');
      setStatut(resident.statut || 'Actif');
      setPhotoUrl(resident.photoUrl || '');

      // Extra medical and residential fields hydration
      setPoids(resident.sante?.poids?.toString() || '');
      setTaille(resident.sante?.taille?.toString() || '');
      setCarreau(resident.residence?.carreau || 'Tsararivotra');
      setNumCarreau(resident.residence?.numCarreau || '');
      setPhotoMaisonUrl(resident.residence?.photoMaisonUrl || '');
      setNombrePieces(resident.residence?.nombrePieces?.toString() || '');
      setSuperficieMaison(resident.residence?.superficieMaison?.toString() || '');
 
      // Famille
      setCodeMenage(resident.famille?.codeMenage || '');
      setIsChefMenage(resident.famille?.isChefMenage || false);
      setConjointId(resident.famille?.conjointId || '');
      setPereId(resident.famille?.pereId || '');
      setMereId(resident.famille?.mereId || '');
      setEnfantsIds(resident.famille?.enfantsIds || []);
      setPereNom(resident.famille?.pereNom || '');
      setMereNom(resident.famille?.mereNom || '');
 
      // Residence
      setAdresse(resident.residence?.adresse || '');
      setFokontany(resident.residence?.fokontany || FOKONTANY_LIST[0]);
      setCommune(resident.residence?.commune || COMMUNE_LIST[0]);
      setDistrict(resident.residence?.district || DISTRICT_LIST[0]);
      setGpsLat(resident.residence?.gps?.lat?.toString() || '');
      setGpsLng(resident.residence?.gps?.lng?.toString() || '');
 
      // Foncier
      setNumLot(resident.residence?.numLot || '');

      // Education & Economie
      setNiveauEtude(resident.education?.niveauEtude || 'Secondaire');
      setDiplome(resident.education?.diplome || '');
      setCompetences(resident.education?.competences || []);
      setLangues(resident.education?.langues || ['Malagasy']);
      
      setProfession(resident.economie?.profession || '');
      setSecteur(resident.economie?.secteur || SECTEUR_LIST[SECTEUR_LIST.length - 1]);
      setEmployeur(resident.economie?.employeur || '');
      setRevenuEstime(resident.economie?.revenuEstime?.toString() || '');
 
      // Sante
      setGroupeSanguin(resident.sante?.groupeSanguin || 'O+');
      setHandicap(resident.sante?.handicap || '');
      setHypertension(resident.sante?.hypertension || 'Normal');
      setDiabete(resident.sante?.diabete || 'Normal');
      setVaccination(resident.sante?.vaccination || []);
 
      // Vulnerability
      setEstVulnerable(resident.vulnerabilite?.estVulnerable || false);
      setVulnerabiliteCategories(resident.vulnerabilite?.categories || []);
      setNiveauPriorite(resident.vulnerabilite?.niveauPriorite || 'Aucun');
      setVulnerabiliteDesc(resident.vulnerabilite?.description || '');
      setAidesObtenues(resident.vulnerabilite?.aidesObtenues || []);
    } else {
      // New resident - generate a dynamic random ID with IND- structure
      let customId = `IND-${Math.floor(10000 + Math.random() * 90000)}`;
      let customFoyer = `FOYER-${Math.floor(10000 + Math.random() * 90000)}`;
      setId(customId);
      setCodeMenage(customFoyer);
      
      setNom('');
      setPrenom('');
      setSexe('M');
      setDateNaissance('');
      setLieuNaissance('Antananarivo');
      setCin('');
      setDateCin('');
      setTelephone('');
      setEmail('');
      setStatut('Actif');
      setIsChefMenage(false);
      setConjointId('');
      setPereId('');
      setMereId('');
      setEnfantsIds([]);
      setAdresse('');
      setFokontany(FOKONTANY_LIST[0]);
      setCommune(COMMUNE_LIST[0]);
      setDistrict(DISTRICT_LIST[0]);
      setGpsLat('');
      setGpsLng('');
      
      setNumLot('');

      setPhotoUrl('');
      setPoids('');
      setTaille('');
      setCarreau('Tsararivotra');
      setNumCarreau('');
      setPhotoMaisonUrl('');
      setNombrePieces('');
      setSuperficieMaison('');
 
      setNiveauEtude('Secondaire');
      setDiplome('');
      setCompetences([]);
      setLangues(['Malagasy']);
      setProfession('');
      setSecteur(SECTEUR_LIST[SECTEUR_LIST.length - 1]);
      setEmployeur('');
      setRevenuEstime('');
      setGroupeSanguin('O+');
      setHandicap('');
      setHypertension('Normal');
      setDiabete('Normal');
      setVaccination([]);
      setEstVulnerable(false);
      setVulnerabiliteCategories([]);
      setNiveauPriorite('Aucun');
      setVulnerabiliteDesc('');
      setAidesObtenues([]);
    }
  }, [resident]);

  // Multiselect toggles
  const toggleLanguage = (lang: string) => {
    if (langues.includes(lang)) {
      setLangues(langues.filter(l => l !== lang));
    } else {
      setLangues([...langues, lang]);
    }
  };

  const toggleVaccine = (vaccine: string) => {
    if (vaccination.includes(vaccine)) {
      setVaccination(vaccination.filter(v => v !== vaccine));
    } else {
      setVaccination([...vaccination, vaccine]);
    }
  };

  const handleAddSkill = () => {
    if (customSkill.trim() && !competences.includes(customSkill.trim())) {
      setCompetences([...competences, customSkill.trim()]);
      setCustomSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setCompetences(competences.filter(s => s !== skillToRemove));
  };

  // Submit hander
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nom.trim() || !prenom.trim() || !dateNaissance) {
      alert("Le Nom, Prénom, et la Date de Naissance sont obligatoires.");
      return;
    }

    const payload: Habitant = {
      id,
      photoUrl: photoUrl || undefined,
      nom: nom.toUpperCase().trim(),
      prenom: prenom.trim(),
      sexe,
      dateNaissance,
      lieuNaissance: lieuNaissance.trim() || "Antananarivo",
      cin: isUnder18 ? undefined : (cin.trim() || undefined),
      dateCin: isUnder18 ? undefined : (dateCin || undefined),
      telephone: telephone.trim() || undefined,
      email: email.trim() || undefined,
      statut,
      famille: {
        codeMenage: codeMenage.trim().toUpperCase() || 'FOYER-INV',
        isChefMenage,
        conjointId: conjointId || undefined,
        pereId: pereId || undefined,
        mereId: mereId || undefined,
        enfantsIds: enfantsIds,
        pereNom: pereNom.trim() || undefined,
        mereNom: mereNom.trim() || undefined
      },
      residence: {
        adresse: adresse.trim() || 'Lot III A',
        fokontany,
        commune,
        district,
        gps: (gpsLat && gpsLng) ? { lat: parseFloat(gpsLat), lng: parseFloat(gpsLng) } : undefined,
        numLot: numLot.toUpperCase().trim() || undefined,
        carreau: carreau.trim() || undefined,
        numCarreau: numCarreau.trim() || undefined,
        photoMaisonUrl: photoMaisonUrl || undefined,
        nombrePieces: nombrePieces ? parseInt(nombrePieces, 10) : undefined,
        superficieMaison: superficieMaison ? parseFloat(superficieMaison) : undefined
      },
      education: {
        niveauEtude,
        diplome: diplome.trim() || undefined,
        competences,
        langues
      },
      economie: {
        profession: profession.trim() || "Sans profession",
        secteur,
        employeur: employeur.trim() || undefined,
        revenuEstime: revenuEstime ? parseFloat(revenuEstime) : undefined
      },
      sante: {
        groupeSanguin: groupeSanguin || undefined,
        handicap: handicap.trim() || undefined,
        hypertension,
        diabete,
        vaccination,
        poids: (isUnder18 && poids) ? parseFloat(poids) : undefined,
        taille: (isUnder18 && taille) ? parseFloat(taille) : undefined
      },
      vulnerabilite: {
        estVulnerable,
        categories: estVulnerable ? vulnerabiliteCategories : [],
        niveauPriorite: estVulnerable ? niveauPriorite : 'Aucun',
        description: estVulnerable ? vulnerabiliteDesc.trim() || undefined : undefined,
        aidesObtenues: estVulnerable ? aidesObtenues : []
      }
    };

    onSave(payload);
  };

  // Dropdown list options for family linkage matching
  const prospectiveConjoints = allResidents.filter(h => h.id !== id && h.sexe !== sexe);
  const prospectiveFathers = allResidents.filter(h => h.id !== id && h.sexe === 'M');
  const prospectiveMothers = allResidents.filter(h => h.id !== id && h.sexe === 'F');

  return (
    <div id="resident-form-overlay" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Title header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest font-sans">
              {isEdit ? "Modifier la Fiche habitant" : "Nouvel d'Enregistrement Habitant"}
            </h2>
            <span className="text-xs bg-indigo-50 text-indigo-700 font-mono px-2 py-0.5 rounded border border-indigo-100 flex items-center space-x-1">
              <span>ID : {id}</span>
              {!isEdit && (
                <button
                  type="button"
                  onClick={() => setId(`IND-${Math.floor(10000 + Math.random() * 90000)}`)}
                  className="text-[9px] text-indigo-500 hover:text-indigo-800 underline font-mono ml-1"
                  title="Générer un nouvel ID individuel"
                >
                  (Générer)
                </button>
              )}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition p-1 rounded hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Wizard Navigation tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('identity')}
            className={`px-5 py-3 text-xs font-semibold tracking-wide border-b-2 font-sans transition whitespace-nowrap flex items-center ${
              activeTab === 'identity' 
                ? 'border-indigo-600 text-indigo-700 font-bold bg-white' 
                : 'border-transparent text-slate-550 hover:text-slate-800 hover:bg-slate-100/50'
            }`}
          >
            <User className="h-3.5 w-3.5 mr-2" />
            1. État Civil & Statut
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('residence')}
            className={`px-5 py-3 text-xs font-semibold tracking-wide border-b-2 font-sans transition whitespace-nowrap flex items-center ${
              activeTab === 'residence' 
                ? 'border-indigo-600 text-indigo-700 font-bold bg-white' 
                : 'border-transparent text-slate-550 hover:text-slate-800 hover:bg-slate-100/50'
            }`}
          >
            <MapPin className="h-3.5 w-3.5 mr-2" />
            2. Adresse & Famille
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('instruction')}
            className={`px-5 py-3 text-xs font-semibold tracking-wide border-b-2 font-sans transition whitespace-nowrap flex items-center ${
              activeTab === 'instruction' 
                ? 'border-indigo-600 text-indigo-700 font-bold bg-white' 
                : 'border-transparent text-slate-550 hover:text-slate-800 hover:bg-slate-100/50'
            }`}
          >
            <Briefcase className="h-3.5 w-3.5 mr-2" />
            3. Instruction & Économie
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('health')}
            className={`px-5 py-3 text-xs font-semibold tracking-wide border-b-2 font-sans transition whitespace-nowrap flex items-center ${
              activeTab === 'health' 
                ? 'border-indigo-600 text-indigo-700 font-bold bg-white' 
                : 'border-transparent text-slate-550 hover:text-slate-800 hover:bg-slate-100/50'
            }`}
          >
            <Heart className="h-3.5 w-3.5 mr-2" />
            4. Santé & Vulnérabilités
          </button>
        </div>

        {/* Content body containing the form tabs */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* TAB 1: CIVIL IDENTITY */}
          {activeTab === 'identity' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* ID Photo Capture Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-5">
                <div className="relative h-24 w-24 rounded-full border-2 border-slate-300 bg-slate-200 flex items-center justify-center overflow-hidden shrink-0 group">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Photo d'identité" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="text-slate-400 text-center p-2">
                      <Camera className="h-8 w-8 mx-auto mb-1 text-slate-400" />
                      <span className="text-[9px] uppercase font-bold text-slate-500 leading-tight">Aucune photo</span>
                    </div>
                  )}
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="absolute inset-0 bg-red-600/80 text-white text-[10px] uppercase font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-150"
                    >
                      Supprimer
                    </button>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left space-y-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Prise de Photo d'Identité Officielle</h3>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Téléversez le portrait réglementaire du citoyen ou effectuez une capture de webcam instantanée. Formats acceptés : PNG, JPG, GIF.
                  </p>

                  <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-1">
                    <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] px-3 py-1.5 rounded-lg transition shadow-xs flex items-center space-x-1">
                      <Upload className="h-3 w-3" />
                      <span>Téléverser portrait</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handlePhotoUpload(e, 'identity')} 
                        className="hidden" 
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => simulateCapture('identity')}
                      className="bg-white hover:bg-slate-100 text-slate-705 border border-slate-300 font-semibold text-[11px] px-3 py-1.5 rounded-lg transition flex items-center space-x-1"
                    >
                      <Camera className="h-3 w-3 text-indigo-500" />
                      <span>Simuler Capture Webcam</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Nom */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Nom de famille <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={nom} 
                    onChange={e => setNom(e.target.value)}
                    placeholder="E.g. RAKOTOMANANA" 
                    className="w-full text-xs border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg p-2.5 font-mono uppercase bg-white text-slate-800"
                    required
                  />
                </div>

                {/* Prénom */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Prénoms <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={prenom} 
                    onChange={e => setPrenom(e.target.value)}
                    placeholder="E.g. Joel" 
                    className="w-full text-xs border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                    required
                  />
                </div>

                {/* Sexe Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase block">Sexe</label>
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                      <input 
                        type="radio" 
                        name="sexe" 
                        value="M" 
                        checked={sexe === 'M'}
                        onChange={() => setSexe('M')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Masculin (H)</span>
                    </label>
                    <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                      <input 
                        type="radio" 
                        name="sexe" 
                        value="F" 
                        checked={sexe === 'F'}
                        onChange={() => setSexe('F')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Féminin (F)</span>
                    </label>
                  </div>
                </div>

                {/* Statut Habitant */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase block">Statut d'activité administrative</label>
                  <select 
                    value={statut} 
                    onChange={e => setStatut(e.target.value as StatutHabitant)}
                    className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                  >
                    <option value="Actif">Actif (Résident régulier)</option>
                    <option value="Décédé">Décédé (Défunt archivé)</option>
                    <option value="Déménagé">Déménagé (Mutation d'adresse)</option>
                  </select>
                </div>

                {/* Date naissance */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Date de Naissance <span className="text-red-500">*</span></label>
                  <input 
                    type="date" 
                    value={dateNaissance} 
                    onChange={e => setDateNaissance(e.target.value)}
                    className="w-full text-xs font-mono border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800"
                    required
                  />
                </div>

                {/* Lieu naissance */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Lieu de Naissance</label>
                  <input 
                    type="text" 
                    value={lieuNaissance} 
                    onChange={e => setLieuNaissance(e.target.value)}
                    placeholder="E.g. Antananarivo" 
                    className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                  />
                </div>

                {/* CIN National Card and Date d'établissement CIN (Hidden if minor < 18 ans, replaced by poids / taille) */}
                {!isUnder18 ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 uppercase">Numéro Carte d'Identité (CIN - 12 chiffres)</label>
                      <input 
                        type="text" 
                        value={cin} 
                        onChange={e => setCin(e.target.value)}
                        placeholder="Format à 12 chiffres" 
                        maxLength={12}
                        className="w-full text-xs font-mono border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 uppercase">Date d'établissement CIN</label>
                      <input 
                        type="date" 
                        value={dateCin} 
                        onChange={e => setDateCin(e.target.value)}
                        className="w-full text-xs font-mono border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1 animate-fadeIn">
                      <label className="text-xs font-bold text-indigo-700 uppercase flex items-center space-x-1">
                        <span>Poids du mineur (kg)</span>
                        <span className="text-[10px] bg-indigo-50 px-1.5 py-0.2 rounded text-indigo-600 font-normal">Moins de 18 ans</span>
                      </label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={poids} 
                        onChange={e => setPoids(e.target.value)}
                        placeholder="E.g. 42.5" 
                        className="w-full text-xs border border-indigo-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg p-2.5 bg-indigo-50/25 text-slate-800 font-mono"
                      />
                    </div>

                    <div className="space-y-1 animate-fadeIn">
                      <label className="text-xs font-bold text-indigo-700 uppercase flex items-center space-x-1">
                        <span>Taille du mineur (cm)</span>
                        <span className="text-[10px] bg-indigo-50 px-1.5 py-0.2 rounded text-indigo-600 font-normal">Moins de 18 ans</span>
                      </label>
                      <input 
                        type="number" 
                        value={taille} 
                        onChange={e => setTaille(e.target.value)}
                        placeholder="E.g. 138" 
                        className="w-full text-xs border border-indigo-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg p-2.5 bg-indigo-50/25 text-slate-800 font-mono"
                      />
                    </div>
                  </>
                )}

                {/* Telephone */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Téléphone</label>
                  <input 
                    type="text" 
                    value={telephone} 
                    onChange={e => setTelephone(e.target.value)}
                    placeholder="E.g. +261 34 56 789 01" 
                    className="w-full text-xs font-mono border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Email</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nom@fokontany.mg" 
                    className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                  />
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: RESIDENCE & FAMILY TIES */}
          {activeTab === 'residence' && (
            <div className="space-y-4 animate-fadeIn">
              
              <div className="bg-slate-50 p-4 border border-slate-100 rounded-lg space-y-4">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Adresse locale de Fokontany</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Adresse */}
                  <div className="space-y-1 col-span-1 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 uppercase">Adresse physique (Lot / Villa)</label>
                    <input 
                      type="text" 
                      value={adresse} 
                      onChange={e => setAdresse(e.target.value)}
                      placeholder="E.g. Lot III G 12" 
                      className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                    />
                  </div>

                  {/* Fokontany dropdown */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase">Fokontany de scrutin</label>
                    <select 
                      value={fokontany} 
                      onChange={e => setFokontany(e.target.value)}
                      className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                    >
                      {FOKONTANY_LIST.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>

                  {/* Commune dropdown */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase">Commune d'assignation</label>
                    <select 
                      value={commune} 
                      onChange={e => setCommune(e.target.value)}
                      className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                    >
                      {COMMUNE_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* District dropdown */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase">District municipal</label>
                    <select 
                      value={district} 
                      onChange={e => setDistrict(e.target.value)}
                      className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                    >
                      {DISTRICT_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  {/* Gps Coordinates */}
                  <div className="grid grid-cols-2 gap-2 col-span-1">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 uppercase">GPS Latitude</label>
                      <input 
                        type="number" 
                        step="any"
                        placeholder="-18.9100"
                        value={gpsLat} 
                        onChange={e => setGpsLat(e.target.value)}
                        className="w-full text-xs font-mono border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 uppercase">GPS Longitude</label>
                      <input 
                        type="number" 
                        step="any"
                        placeholder="47.5250"
                        value={gpsLng} 
                        onChange={e => setGpsLng(e.target.value)}
                        className="w-full text-xs font-mono border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Habitat & Carreau details section */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-4">
                <div className="flex items-center space-x-2">
                  <Home className="h-4 w-4 text-indigo-600" />
                  <span className="text-[10px] uppercase font-extrabold text-slate-700 tracking-wider">Structure & Caractéristiques de l'Habitat</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Carreau */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase">Secteur / Carreau (E.g. Tsararivotra)</label>
                    <input 
                      type="text"
                      value={carreau} 
                      onChange={e => setCarreau(e.target.value)}
                      placeholder="E.g. Tsararivotra" 
                      className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800 font-medium"
                    />
                  </div>

                  {/* Numéro de carreau */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase">Numéro de Carreau</label>
                    <input 
                      type="text"
                      value={numCarreau} 
                      onChange={e => setNumCarreau(e.target.value)}
                      placeholder="E.g. CAR-12" 
                      className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800 font-mono font-medium"
                    />
                  </div>

                  {/* Nombre de pièces */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase">Nombre de pièces de la maison</label>
                    <input 
                      type="number" 
                      value={nombrePieces} 
                      onChange={e => setNombrePieces(e.target.value)}
                      placeholder="E.g. 3" 
                      min="1"
                      className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800 font-mono font-medium"
                    />
                  </div>

                  {/* Superficie de la maison */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase">Superficie au sol de la maison (m²)</label>
                    <input 
                      type="number" 
                      value={superficieMaison} 
                      onChange={e => setSuperficieMaison(e.target.value)}
                      placeholder="E.g. 85" 
                      min="1"
                      className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800 font-mono font-medium"
                    />
                  </div>
                </div>

                {/* House Photo Section */}
                <div className="border-t border-slate-200 pt-3 flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
                  <div className="relative h-20 w-28 rounded-lg border border-slate-300 bg-slate-200 flex items-center justify-center overflow-hidden shrink-0 group">
                    {photoMaisonUrl ? (
                      <img src={photoMaisonUrl} alt="Photo de la maison" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="text-slate-400 text-center p-1">
                        <Home className="h-5 w-5 mx-auto mb-0.5 text-slate-400" />
                        <span className="text-[8px] uppercase font-bold text-slate-500 leading-none block">Sans photo</span>
                      </div>
                    )}
                    {photoMaisonUrl && (
                      <button
                        type="button"
                        onClick={() => setPhotoMaisonUrl('')}
                        className="absolute inset-0 bg-red-600/80 text-white text-[9px] uppercase font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-150"
                      >
                        Retirer
                      </button>
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5 text-center sm:text-left">
                    <h4 className="text-[11px] font-bold uppercase text-slate-800 tracking-wide">Prise Photos de la Maison</h4>
                    <p className="text-[9px] text-slate-500 leading-normal font-medium">
                      Intégrez le panorama ou plan extérieur de l'habitation principale pour l'inventaire cadastral du Fokontany. Hand-drawn / photos supportées.
                    </p>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 pt-0.5">
                      <label className="cursor-pointer bg-slate-200 hover:bg-slate-300 text-slate-850 font-bold text-[10px] px-2.5 py-1.5 rounded border border-slate-300 transition flex items-center space-x-1">
                        <Upload className="h-2.5 w-2.5" />
                        <span>Téléverser photo</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handlePhotoUpload(e, 'house')} 
                          className="hidden" 
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => simulateCapture('house')}
                        className="bg-white hover:bg-slate-50 text-slate-705 border border-slate-300 font-bold text-[10px] px-2.5 py-1.5 rounded transition flex items-center space-x-1"
                      >
                        <Camera className="h-2.5 w-2.5 text-indigo-500" />
                        <span>Simuler Appareil</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Famille links structure */}
              <div className="border border-slate-200 p-4 rounded-lg space-y-4 bg-white">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Graphe Famille & Rôle Ménage</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Code menage */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase">Code de recensement Ménage (E.g. FOYER-12345)</label>
                    <div className="flex space-x-1.5">
                      <input 
                        type="text" 
                        value={codeMenage} 
                        onChange={e => setCodeMenage(e.target.value)}
                        placeholder="FOYER-..." 
                        className="flex-1 text-xs font-mono uppercase border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setCodeMenage(`FOYER-${Math.floor(10000 + Math.random() * 90000)}`)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-750 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-sans font-semibold transition"
                        title="Régénérer le code de ménage"
                      >
                        Générer
                      </button>
                    </div>
                  </div>

                  {/* Chef de menage checkbox */}
                  <div className="flex items-center space-x-2 pt-6">
                    <input 
                      type="checkbox" 
                      id="chefMenage" 
                      checked={isChefMenage}
                      onChange={e => setIsChefMenage(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <label htmlFor="chefMenage" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                      Déclarer en tant que Chef de Ménage
                    </label>
                  </div>

                  {/* Select Conjoint */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase">Conjoint / Époux(se) rattaché(e)</label>
                    <select 
                      value={conjointId} 
                      onChange={e => setConjointId(e.target.value)}
                      className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800 font-mono"
                    >
                      <option value="">Aucun link spécifié</option>
                      {prospectiveConjoints.map(h => (
                        <option key={h.id} value={h.id}>{h.nom} {h.prenom} ({h.id})</option>
                      ))}
                    </select>
                  </div>

                  {/* Select Father */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase">Père (Parent dans la base)</label>
                    <select 
                      value={pereId} 
                      onChange={e => setPereId(e.target.value)}
                      className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800 font-mono"
                    >
                      <option value="">Aucun lien spécifié</option>
                      {prospectiveFathers.map(h => (
                        <option key={h.id} value={h.id}>{h.nom} {h.prenom} ({h.id})</option>
                      ))}
                    </select>
                  </div>

                  {/* Manual Father Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase">Père (Nom complet si hors base)</label>
                    <input 
                      type="text"
                      value={pereNom}
                      onChange={e => setPereNom(e.target.value)}
                      placeholder="Nom complet du père (ex: RAKOTO Jean)"
                      className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                    />
                  </div>

                  {/* Select Mother */}
                  <div className="space-y-1 md:col-span-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase">Mère (Parente dans la base)</label>
                    <select 
                      value={mereId} 
                      onChange={e => setMereId(e.target.value)}
                      className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800 font-mono"
                    >
                      <option value="">Aucun lien spécifié</option>
                      {prospectiveMothers.map(h => (
                        <option key={h.id} value={h.id}>{h.nom} {h.prenom} ({h.id})</option>
                      ))}
                    </select>
                  </div>

                  {/* Manual Mother Name */}
                  <div className="space-y-1 md:col-span-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase">Mère (Nom complet si hors base)</label>
                    <input 
                      type="text"
                      value={mereNom}
                      onChange={e => setMereNom(e.target.value)}
                      placeholder="Nom complet de la mère (ex: RAZANABAO Marie)"
                      className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                    />
                  </div>

                  {/* Select childrens */}
                  <div className="space-y-2 col-span-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase block">Enfants rattachés au foyer</label>
                    <div className="border border-slate-200 rounded-lg p-2 h-28 overflow-y-auto space-y-1 bg-slate-50/20">
                      {allResidents.filter(h => h.id !== id).map(h => {
                        const isSelected = enfantsIds.includes(h.id);
                        return (
                          <label key={h.id} className="flex items-center space-x-2 text-xs cursor-pointer select-none py-0.5 hover:bg-slate-50">
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (isSelected) {
                                  setEnfantsIds(enfantsIds.filter(cid => cid !== h.id));
                                } else {
                                  setEnfantsIds([...enfantsIds, h.id]);
                                }
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-550 h-3.5 w-3.5"
                            />
                            <span className="font-mono text-[11px]">{h.nom} {h.prenom}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EDUCATION & ECONOMY */}
          {activeTab === 'instruction' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Niveau d'etude */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Niveau d'Instruction</label>
                  <select 
                    value={niveauEtude} 
                    onChange={e => setNiveauEtude(e.target.value)}
                    className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                  >
                    <option value="Aucun">Aucun (Non scolarisé)</option>
                    <option value="Préscolaire">Préscolaire / Maternelle</option>
                    <option value="Primaire">Primaire (EPP)</option>
                    <option value="Secondaire">Secondaire (Collège / Lycée)</option>
                    <option value="Universitaire">Universitaire (Enseignement supérieur)</option>
                  </select>
                </div>

                {/* Diplome */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Diplôme le plus élevé</label>
                  <input 
                    type="text" 
                    value={diplome} 
                    onChange={e => setDiplome(e.target.value)}
                    placeholder="E.g. BACC, Licence, Master" 
                    className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                  />
                </div>

                {/* Profession */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Profession déclarée</label>
                  <input 
                    type="text" 
                    value={profession} 
                    onChange={e => setProfession(e.target.value)}
                    placeholder="E.g. Agriculteur, Couturier, Enseignant" 
                    className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                  />
                </div>

                {/* Secteur d'activité */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Secteur Économique principal</label>
                  <select 
                    value={secteur} 
                    onChange={e => setSecteur(e.target.value)}
                    className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                  >
                    {SECTEUR_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Employeur */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Employeur / Compagnie</label>
                  <input 
                    type="text" 
                    value={employeur} 
                    onChange={e => setEmployeur(e.target.value)}
                    placeholder="E.g. Société ou Ministère ..." 
                    className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                  />
                </div>

                {/* Revenu estimé (Ariary) */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Revenu Mensuel Estimé (Ariary)</label>
                  <input 
                    type="number" 
                    value={revenuEstime} 
                    onChange={e => setRevenuEstime(e.target.value)}
                    placeholder="E.g. 500000" 
                    className="w-full text-xs font-mono border border-slate-200 focus:border-indigo-500 rounded-lg p-2 bg-white text-slate-800"
                  />
                </div>

                {/* Langues selection (badges list checking) */}
                <div className="col-span-1 md:col-span-2 space-y-1.5 pt-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase block">Langues d'expression (Cocher)</label>
                  <div className="flex flex-wrap gap-4 text-xs font-medium">
                    {LANGUES_LIST.map(lang => {
                      const active = langues.includes(lang);
                      return (
                        <label key={lang} className="flex items-center space-x-1.5 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={active}
                            onChange={() => toggleLanguage(lang)}
                            className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                          <span>{lang}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Skills/Competences - dynamic list building */}
                <div className="col-span-1 md:col-span-2 space-y-2.5 pt-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase block">Compétences & Métiers secondaires</label>
                  
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      placeholder="Ajouter savoir-faire (ex: Cuisine, Électricité...)" 
                      value={customSkill}
                      onChange={e => setCustomSkill(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                      className="flex-1 text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={handleAddSkill}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4 rounded-lg flex items-center shadow-xs"
                    >
                      <Plus className="h-4 w-4 mr-0.5" />
                      Insérer
                    </button>
                  </div>

                  {/* Skills lists display */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {competences.length > 0 ? (
                      competences.map(skill => (
                        <span key={skill} className="bg-slate-100 text-slate-800 text-[10px] px-2.5 py-1 rounded-full border border-slate-200 flex items-center font-medium">
                          {skill}
                          <button 
                            type="button" 
                            onClick={() => handleRemoveSkill(skill)}
                            className="ml-1 text-slate-400 hover:text-slate-600 rounded bg-slate-200/50 p-0.5"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Aucun savoir-faire pour l'instant</span>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: HEALTH DIAGNOSIS & SUIVIS */}
          {activeTab === 'health' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Groupe Sanguin */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Groupe Sanguin</label>
                  <select 
                    value={groupeSanguin} 
                    onChange={e => setGroupeSanguin(e.target.value)}
                    className="w-full text-xs font-mono border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                  >
                    <option value="">Inconnu</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>

                {/* Handicap */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Situation de handicap (facultatif)</label>
                  <input 
                    type="text" 
                    value={handicap} 
                    onChange={e => setHandicap(e.target.value)}
                    placeholder="E.g. Nonvoyant, Moteur ..." 
                    className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                  />
                </div>

                {/* Hypertension condition */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Suivi Hypertension Artérielle</label>
                  <select 
                    value={hypertension} 
                    onChange={e => setHypertension(e.target.value as StatutSante)}
                    className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                  >
                    <option value="Normal">Normal (Pas de risque majeur)</option>
                    <option value="Surveillance">Surveillance (Stade modéré)</option>
                    <option value="Prioritaire">Prioritaire / Risque élevé</option>
                  </select>
                </div>

                {/* Diabete condition */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Suivi Diabète & Glycémie</label>
                  <select 
                    value={diabete} 
                    onChange={e => setDiabete(e.target.value as StatutSante)}
                    className="w-full text-xs border border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 bg-white text-slate-800"
                  >
                    <option value="Normal">Normal (Sain)</option>
                    <option value="Surveillance">Surveillance (Prédiabète)</option>
                    <option value="Prioritaire">Prioritaire (Suivi thérapeutique)</option>
                  </select>
                </div>

                {/* Vaccination checklists */}
                <div className="col-span-1 md:col-span-2 space-y-2 pt-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase block">Carnet de Vaccination Légale (Cocher)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                    {COMPULSORY_VACCINATIONS.map(vaccine => {
                      const checked = vaccination.includes(vaccine);
                      return (
                        <label key={vaccine} className="flex items-center space-x-2.5 cursor-pointer py-1.5 px-2 hover:bg-white rounded transition">
                          <input 
                            type="checkbox" 
                            checked={checked}
                            onChange={() => toggleVaccine(vaccine)}
                            className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                          <span className="text-slate-700 font-medium text-[11px]">{vaccine}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* VULNERABILITY EVALUATION CONTROLS */}
                <div className="col-span-1 md:col-span-2 mt-4 pt-4 border-t border-slate-150 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Évaluation Administrative de Vulnérabilité</h4>
                      <p className="text-[10px] text-slate-450">Déclarer cette personne comme vulnérable pour l'inclusion dans les programmes d'aides sociales.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={estVulnerable} 
                        onChange={e => setEstVulnerable(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                      <span className="ml-2 text-xs font-semibold text-slate-700">{estVulnerable ? 'ACTIVE' : 'INACTIVE'}</span>
                    </label>
                  </div>

                  {estVulnerable && (
                    <div className="p-4 bg-rose-50/20 border border-rose-100 rounded-xl space-y-4 animate-fadeIn">
                      
                      {/* Priority Level */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-rose-950 uppercase block">Niveau d'Urgence / Score Social</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['Aucun', 'Moyen', 'Critique'].map(lvl => (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => setNiveauPriorite(lvl as any)}
                              className={`py-2 px-3 rounded-lg border text-xs font-bold uppercase transition ${
                                niveauPriorite === lvl 
                                  ? lvl === 'Critique' ? 'bg-red-600 text-white border-red-600 shadow-xs' : 'bg-amber-500 text-white border-amber-500 shadow-xs'
                                  : 'bg-white text-slate-650 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {lvl === 'Aucun' ? 'Faible / Aucun' : lvl}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Vulnerability Categories */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-rose-950 uppercase block">Catégories de Risque Social (Sélectionner)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            'Grand âge',
                            'Handicap',
                            'Pauvreté extrême',
                            'Famille monoparentale',
                            'Maladie chronique',
                            'Déscolarisation',
                            'Malnutrition'
                          ].map(cat => {
                            const selected = vulnerabiliteCategories.includes(cat);
                            return (
                              <label key={cat} className={`flex items-center space-x-2 p-2 border rounded-lg cursor-pointer transition text-xs font-semibold ${selected ? 'bg-rose-50/40 border-rose-300 text-rose-900' : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'}`}>
                                <input 
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => {
                                    if (selected) {
                                      setVulnerabiliteCategories(vulnerabiliteCategories.filter(c => c !== cat));
                                    } else {
                                      setVulnerabiliteCategories([...vulnerabiliteCategories, cat]);
                                    }
                                  }}
                                  className="rounded text-rose-600 focus:ring-rose-400 h-3.5 w-3.5"
                                />
                                <span>{cat}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Social Benefits Received */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-rose-950 uppercase block">Aides Nationales / Communales Déjà Obtenues</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            'Vivres',
                            'Aide financière',
                            'Soins gratuits',
                            'Bourse'
                          ].map(aide => {
                            const active = aidesObtenues.includes(aide);
                            const labelText = aide === 'Vivres' ? 'Vivres / Panier d\'aide de Fokontany' :
                                              aide === 'Aide financière' ? 'Aide financière diretta (Vatsy)' :
                                              aide === 'Soins gratuits' ? 'Soins médicaux de base gratuits' :
                                              'Bourses / fournitures éducatives';
                            return (
                              <label key={aide} className={`flex items-center space-x-2 p-2 border rounded-lg cursor-pointer transition text-xs font-medium ${active ? 'bg-emerald-50/50 border-emerald-300 text-emerald-990 font-bold' : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'}`}>
                                <input 
                                  type="checkbox"
                                  checked={active}
                                  onChange={() => {
                                    if (active) {
                                      setAidesObtenues(aidesObtenues.filter(a => a !== aide));
                                    } else {
                                      setAidesObtenues([...aidesObtenues, aide]);
                                    }
                                  }}
                                  className="rounded text-emerald-600 focus:ring-emerald-455 h-3.5 w-3.5"
                                />
                                <span>{labelText}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Social Description Comments */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-rose-950 uppercase">Observations de l'Enquêteur Social</label>
                        <textarea
                          rows={2}
                          value={vulnerabiliteDesc}
                          onChange={e => setVulnerabiliteDesc(e.target.value)}
                          placeholder="Saisir des notes détaillées sur la situation précaire de l'individu ou du foyer..."
                          className="w-full text-xs border border-slate-200 focus:border-rose-400 focus:ring-1 focus:ring-rose-400 rounded-lg p-2.5 bg-white text-slate-800"
                        />
                      </div>

                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

        </form>

        {/* Modal Wizard Actions footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex space-x-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('identity')}
              className={`p-1 px-3 text-[11px] font-bold rounded-lg border uppercase hover:bg-slate-200 transition ${activeTab === 'identity' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              1
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('residence')}
              className={`p-1 px-3 text-[11px] font-bold rounded-lg border uppercase hover:bg-slate-200 transition ${activeTab === 'residence' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              2
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('instruction')}
              className={`p-1 px-3 text-[11px] font-bold rounded-lg border uppercase hover:bg-slate-200 transition ${activeTab === 'instruction' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              3
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('health')}
              className={`p-1 px-3 text-[11px] font-bold rounded-lg border uppercase hover:bg-slate-200 transition ${activeTab === 'health' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              4
            </button>
          </div>
          
          <div className="flex space-x-3">
            <button 
              type="button" 
              onClick={onClose}
              className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-750 text-xs font-sans font-semibold py-2 px-4 rounded-lg transition duration-150"
            >
              Fermer l'éditeur
            </button>
            
            <button 
              type="button" 
              onClick={handleSubmit}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-sans font-semibold py-2 px-5 rounded-lg flex items-center space-x-1.5 shadow-xs transition duration-150"
            >
              <Save className="h-4 w-4" />
              <span>Enregistrer la fiche</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
