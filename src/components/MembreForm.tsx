import React, { useState, useEffect } from 'react';
import { Membre, RelationChef, Foyer } from '../types';
import { supabase } from '../lib/supabase';
import { SECTEUR_LIST, COMPETENCES_LIST, LANGUES_LIST, COMPULSORY_VACCINATIONS } from '../seedData';
import { X, User, GraduationCap, HeartPulse, ShieldAlert, Loader2, Upload, Camera } from 'lucide-react';

interface Props {
  foyer: Foyer;
  membre?: Membre;
  membres: Membre[];
  onClose: () => void;
  onSave: (m: Partial<Membre>) => Promise<void>;
}

const RELATIONS: RelationChef[] = ['Chef', 'Épouse/Époux', 'Fils', 'Fille', 'Père', 'Mère', 'Frère', 'Sœur', 'Grand-père', 'Grand-mère', 'Petit-fils', 'Petite-fille', 'Oncle', 'Tante', 'Neveu', 'Nièce', 'Autre'];
const GROUPES_SANG = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Inconnu'];
const NIVEAUX_ETUDE = ['Nourrisson / Crèche', 'Préscolaire', 'Non scolarisé', 'Primaire', 'Secondaire', 'Universitaire', 'Formation professionnelle'];
const ACTIVITES_PRINCIPALES = [
  'Agriculture', 'Élevage', 'Pêche', 'Artisanat', 'Commerce', 'Transport',
  'Construction', 'Administration', 'Enseignement', 'Santé', 'Services',
  'Retraité', 'Sans emploi', 'Étudiant', 'Femme au foyer', 'Autre',
];
const ACTIVITES_SECONDAIRES = ['Agriculture', 'Élevage', 'Commerce', 'Pêche', 'Artisanat', 'Transport', 'Construction', 'Enseignement', 'Santé', 'Services', 'Retraité', 'Étudiant', 'Sans emploi', 'Aucune', 'Autre'];
const STATUTS_PROFESSIONNELS = ['Salarié', 'Indépendant', 'Employeur', 'Sans emploi', 'Aide familiale'];
const SITUATIONS_EMPLOI = ['Emploi permanent', 'Emploi temporaire', 'Emploi saisonnier', 'Travail journalier', 'Travail occasionnel', 'Sans emploi'];
const SECTEURS_ACTIVITE = ['Public', 'Privé', 'ONG', 'Association', 'Coopérative', 'Entreprise individuelle', 'Auto-entrepreneur'];
const ANCIENNETES = ['Moins de 1 an', '1 à 5 ans', '5 à 10 ans', 'Plus de 10 ans'];
const CONTRIBUTIONS_REVENU = ['Principale source de revenu', 'Source secondaire', 'Aucun revenu'];
const AGR_TYPES = ['Boutique', 'Épicerie', 'Gargote', 'Atelier', 'Taxi', 'Camion', 'Terrain agricole', 'Élevage', 'Location immobilière', 'Autre activité'];
const COMPETENCES_PREDEFINIES = ['Maçon', 'Menuisier', 'Électricien', 'Soudeur', 'Chauffeur', 'Mécanicien', 'Informaticien', 'Comptable', 'Enseignant', 'Couturier', 'Agriculteur', 'Éleveur', 'Infirmier', 'Agent administratif', 'Commerçant'];
const FORMATIONS_PRO = ['Aucune', 'Agriculture', 'Élevage', 'Informatique', 'Comptabilité', 'Maçonnerie', 'Électricité', 'Mécanique', 'Couture', 'Commerce', 'Gestion', 'Autre'];
const FOURCHETTES_REVENU = ['Moins de 100 000 Ar', '100 000 - 300 000 Ar', '300 000 - 500 000 Ar', '500 000 - 1 000 000 Ar', 'Plus de 1 000 000 Ar', 'Aucun revenu'];

// Module Sante etendu
const HANDICAP_TYPES = ['Moteur', 'Visuel', 'Auditif', 'Mental / Intellectuel', 'Psychique', 'Trouble de la parole', 'Handicap multiple', 'Autre'];
const AUTONOMIE_NIVEAUX = ['Autonome', 'Assistance partielle', 'Dependance totale'];
const MALADIES_CHRONIQUES = ['Hypertension arterielle', 'Diabete', 'Asthme', 'Epilepsie', 'Maladie cardiaque', 'Insuffisance renale', 'Tuberculose', 'Cancer', 'VIH/SIDA', 'Drepanocytose', 'Arthrose severe', 'Maladie respiratoire chronique', 'Autre'];
const ALLERGIES_LIST = ['Aucune', 'Medicaments', 'Alimentaires', "Piqures d'insectes", 'Produits chimiques', 'Autres'];
const VACCINS_LIST = ['BCG (Tuberculose)', 'Polio', 'DTC (Diphterie, Tetanos, Coqueluche)', 'Hepatite B', 'Rougeole', 'Fievre Jaune', 'COVID-19', 'HPV', 'Tetanos', 'Autre'];
const STATUT_VACCINAL = ['A jour', 'Partiellement vaccine', 'Non vaccine', 'Inconnu'];
const LIENS_PARENTE = ['Pere', 'Mere', 'Epoux / Epouse', 'Fils / Fille', 'Frere / Soeur', 'Grand-parent', 'Tuteur', 'Voisin', 'Autre'];

function YesNo({ label, value, onChange }: { label: string; value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-500 uppercase block mb-2">{label}</label>
      <div className="flex gap-3">
        {[{ v: true, l: 'Oui' }, { v: false, l: 'Non' }].map(({ v, l }) => (
          <label key={l} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border cursor-pointer text-sm font-semibold transition ${value === v ? (v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-500 text-white border-slate-500') : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            <input type="radio" className="hidden" checked={value === v} onChange={() => onChange(v)} />{l}
          </label>
        ))}
      </div>
    </div>
  );
}

function CheckGroup({ label, options, values, onToggle, cols = 2 }: { label: string; options: string[]; values: string[]; onToggle: (v: string) => void; cols?: number }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-500 uppercase block mb-2">{label}</label>
      <div className={cols === 2 ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-2'}>
        {options.map(opt => (
          <label key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs transition ${values.includes(opt) ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold' : 'bg-white border-slate-200 text-slate-600'}`}>
            <input type="checkbox" checked={values.includes(opt)} onChange={() => onToggle(opt)} className="rounded" />{opt}
          </label>
        ))}
      </div>
    </div>
  );
}

function PriorityButtons({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-500 uppercase block mb-2">{label}</label>
      <div className="flex gap-3">
        {(['Normal', 'Surveillance', 'Prioritaire']).map(v => (
          <label key={v} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${value === v ? (v === 'Prioritaire' ? 'bg-red-600 text-white border-red-600' : v === 'Surveillance' ? 'bg-amber-500 text-white border-amber-500' : 'bg-emerald-600 text-white border-emerald-600') : 'bg-white text-slate-600 border-slate-200'}`}>
            <input type="radio" className="hidden" checked={value === v} onChange={() => onChange(v)} />{v}
          </label>
        ))}
      </div>
    </div>
  );
}

const VULNERABILITE_CATS = ['Grand âge', 'Handicap', 'Pauvreté extrême', 'Famille monoparentale', 'Maladie chronique', 'Déscolarisation', 'Malnutrition'];
const AIDES = ['Vivres', 'Aide financière', 'Soins gratuits', 'Bourse', 'Logement social'];
type Tab = 'identite' | 'famille' | 'education' | 'sante' | 'vulnerabilite';

export default function MembreForm({ foyer, membre, membres, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [tab, setTab] = useState<Tab>('identite');

  // Identité
  const [nom, setNom] = useState(membre?.nom || '');
  const [prenom, setPrenom] = useState(membre?.prenom || '');
  const [sexe, setSexe] = useState<'M'|'F'>(membre?.sexe || 'M');
  const [date_naissance, setDateNaissance] = useState(membre?.date_naissance || '');
  const [lieu_naissance, setLieuNaissance] = useState(membre?.lieu_naissance || '');
  const [cin, setCin] = useState(membre?.cin || '');
  const [date_cin, setDateCin] = useState(membre?.date_cin || '');
  const [cin_est_duplicata, setCinEstDuplicata] = useState<boolean>(membre?.cin_est_duplicata || false);
  const [cin_duplicata_date, setCinDuplicataDate] = useState(membre?.cin_duplicata_date || '');
  const [situation_matrimoniale, setSituationMatrimoniale] = useState(membre?.situation_matrimoniale || '');
  const [religion, setReligion] = useState(membre?.religion || '');
  const [telephone, setTelephone] = useState(membre?.telephone || '');
  const [email, setEmail] = useState(membre?.email || '');
  const [statut, setStatut] = useState<Membre['statut']>(membre?.statut || 'Actif');
  const [autre_relation_label, setAutreRelationLabel] = useState(membre?.relation_chef && !["Chef","Épouse/Époux","Fils","Fille","Père","Mère","Frère","Sœur","Grand-père","Grand-mère","Petit-fils","Petite-fille","Oncle","Tante","Neveu","Nièce"].includes(membre.relation_chef) ? membre.relation_chef : "");
  const [relation_chef, setRelationChef] = useState<RelationChef>(membre?.relation_chef || 'Autre');
  const [photo_url, setPhotoUrl] = useState(membre?.photo_url || '');

  // Famille
  const [conjoint_id, setConjointId] = useState(membre?.conjoint_id || '');

  // Auto-remplissage contact d'urgence depuis le conjoint si chef de famille
  const conjointMembre = membres.find(m => m.id === conjoint_id);
  useEffect(() => {
    if (conjoint_id && conjointMembre && !contact_urgence_nom) {
      setContactUrgenceNom(`${conjointMembre.nom} ${conjointMembre.prenom}`);
      if (conjointMembre.telephone) setContactUrgenceTelephone(conjointMembre.telephone);
      setContactUrgenceLien('Epoux / Epouse');
    }
  }, [conjoint_id]);
  const [pere_id, setPereId] = useState(membre?.pere_id || '');
  const [mere_id, setMereId] = useState(membre?.mere_id || '');
  const [pere_nom, setPereNom] = useState(membre?.pere_nom || '');
  const [mere_nom, setMereNom] = useState(membre?.mere_nom || '');

  // Éducation
  const [niveau_etude, setNiveauEtude] = useState(membre?.niveau_etude || 'Secondaire');
  const [niveau_instruction_detail, setNiveauInstructionDetail] = useState(membre?.niveau_instruction_detail || '');
  const [filiere_etudes, setFiliereEtudes] = useState(membre?.filiere_etudes || '');
  const [diplome, setDiplome] = useState(membre?.diplome || '');
  const [profession, setProfession] = useState(membre?.profession || '');
  const [detail_activite, setDetailActivite] = useState(membre?.employeur || '');
  const [statut_professionnel, setStatutProfessionnel] = useState(membre?.statut_professionnel || '');
  const [revenu_fourchette, setRevenuFourchette] = useState(membre?.revenu_fourchette || '');
  const [activite_secondaire, setActiviteSecondaire] = useState(membre?.activite_secondaire || '');
  const [situation_emploi, setSituationEmploi] = useState(membre?.situation_emploi || '');
  const [secteur_activite, setSecteurActivite] = useState(membre?.secteur_activite || '');
  const [anciennete_professionnelle, setAnciennete] = useState(membre?.anciennete_professionnelle || '');
  const [contribution_revenu, setContributionRevenu] = useState(membre?.contribution_revenu || '');
  const [agr_types, setAgrTypes] = useState<string[]>(membre?.agr_types || []);
  const [formations_pro, setFormationsPro] = useState<string[]>(membre?.formations_pro || []);
  const [competence_custom, setCompetenceCustom] = useState('');
  const [secteur, setSecteur] = useState(membre?.secteur || '');
  const [employeur, setEmployeur] = useState(membre?.employeur || '');
  const [revenu_estime, setRevenu] = useState(membre?.revenu_estime?.toString() || '');
  const [langues, setLangues] = useState<string[]>(membre?.langues || ['Malagasy']);
  const [competences, setCompetences] = useState<string[]>(membre?.competences || []);
  const [newCompetence, setNewCompetence] = useState('');

  // Santé
  const [groupe_sanguin, setGroupeSanguin] = useState(membre?.groupe_sanguin || '');
  const [handicap, setHandicap] = useState(membre?.handicap || '');
  const [handicap_oui, setHandicapOui] = useState<boolean>(membre?.handicap_oui || false);
  const [handicap_types, setHandicapTypes] = useState<string[]>(membre?.handicap_types || []);
  const [handicap_precision, setHandicapPrecision] = useState(membre?.handicap_precision || '');
  const [handicap_autonomie, setHandicapAutonomie] = useState(membre?.handicap_autonomie || '');
  const [handicap_carte, setHandicapCarte] = useState<boolean | undefined>(membre?.handicap_carte);
  const [hypertension, setHypertension] = useState<Membre['hypertension']>(membre?.hypertension || 'Normal');
  const [diabete, setDiabete] = useState<Membre['diabete']>(membre?.diabete || 'Normal');
  const [maladies_chroniques, setMaladiesChroniques] = useState<string[]>(membre?.maladies_chroniques || []);
  const [maladie_autre, setMaladieAutre] = useState(membre?.maladie_autre || '');
  const [traitement_regulier, setTraitementRegulier] = useState<boolean | undefined>(membre?.traitement_regulier);
  const [suivi_medical, setSuiviMedical] = useState<boolean | undefined>(membre?.suivi_medical);
  const [priorite_sanitaire, setPrioriteSanitaire] = useState(membre?.priorite_sanitaire || 'Normal');
  // Grossesse
  const [grossesse_cours, setGrossesseCours] = useState<boolean | undefined>(membre?.grossesse_cours);
  const [grossesse_mois, setGrossesseMois] = useState(membre?.grossesse_mois?.toString() || '');
  const [grossesse_date_accouchement, setGrossesseDateAccouchement] = useState(membre?.grossesse_date_accouchement || '');
  const [grossesse_cpn, setGrossesseCpn] = useState(membre?.grossesse_cpn?.toString() || '');
  const [grossesse_risque, setGrossesseRisque] = useState<boolean | undefined>(membre?.grossesse_risque);
  const [grossesse_suivie, setGrossesseSuivie] = useState<boolean | undefined>(membre?.grossesse_suivie);
  const [grossesse_centre_sante, setGrossesseCentreSante] = useState(membre?.grossesse_centre_sante || '');
  // Allergies
  const [allergies, setAllergies] = useState<string[]>(membre?.allergies || []);
  const [allergies_precision, setAllergiesPrecision] = useState(membre?.allergies_precision || '');
  // Vaccination
  const [vaccination, setVaccination] = useState<string[]>(membre?.vaccination || []);
  const [statut_vaccinal, setStatutVaccinal] = useState(membre?.statut_vaccinal || '');
  const [poids, setPoids] = useState(membre?.poids?.toString() || '');
  const [taille, setTaille] = useState(membre?.taille?.toString() || '');
  // Contact urgence
  const [contact_urgence_nom, setContactUrgenceNom] = useState(membre?.contact_urgence_nom || '');
  const [contact_urgence_telephone, setContactUrgenceTelephone] = useState(membre?.contact_urgence_telephone || '');
  const [contact_urgence_lien, setContactUrgenceLien] = useState(membre?.contact_urgence_lien || '');
  // Documents sanitaires
  const [photo_carnet_vaccination, setPhotoCarnetVaccination] = useState(membre?.photo_carnet_vaccination || '');
  const [photo_carte_handicap, setPhotoCarteHandicap] = useState(membre?.photo_carte_handicap || '');
  const [photo_document_medical, setPhotoDocumentMedical] = useState(membre?.photo_document_medical || '');
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  // Vulnérabilité
  const [est_vulnerable, setEstVulnerable] = useState(membre?.est_vulnerable || false);
  const [vulnerabilite_categories, setVulnCats] = useState<string[]>(membre?.vulnerabilite_categories || []);
  const [vulnerabilite_description, setVulnDesc] = useState(membre?.vulnerabilite_description || '');
  const [niveau_priorite, setNiveauPriorite] = useState<Membre['niveau_priorite']>(membre?.niveau_priorite || 'Aucun');
  const [aides_obtenues, setAides] = useState<string[]>(membre?.aides_obtenues || []);

  const toggleArr = <T,>(arr: T[], val: T) => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  const age = date_naissance ? Math.abs(new Date(Date.now() - new Date(date_naissance).getTime()).getUTCFullYear() - 1970) : 99;
  const isMineur = age < 18;
  const isJeuneAdulte = age >= 16; // téléphone/email autorisés dès 16 ans
  const isEnfant = age < 15;       // pas de CIN, pas d'activité économique
  const isTresPetit = age < 6;     // nourrisson/préscolaire — masquer éducation/eco/vulnérabilité
  const isAdulte = age >= 18;      // CIN, statut pro, revenu, etc.
  const autresMembres = membres.filter(m => m.id !== membre?.id);
  const chef = membres.find(m => m.is_chef);
  const conjointChef = chef ? membres.find(m => m.id === chef.conjoint_id) : undefined;

  // ── Logique auto famille selon relation ──────────────────────
  useEffect(() => {
    if (membre) return; // pas d'auto sur modification
    if (!chef) return;

    if (relation_chef === 'Épouse/Époux') {
      // Conjoint = chef automatiquement
      setConjointId(chef.id);
      setPereId(''); setMereId(''); setPereNom(''); setMereNom('');
    } else if (relation_chef === 'Fils' || relation_chef === 'Fille') {
      // Père = chef (si homme) ou conjoint du chef (si femme)
      // Mère = chef (si femme) ou conjoint du chef (si homme)
      if (chef.sexe === 'M') {
        setPereId(chef.id);
        if (conjointChef) setMereId(conjointChef.id);
      } else {
        setMereId(chef.id);
        if (conjointChef) setPereId(conjointChef.id);
      }
      setConjointId('');
    } else if (relation_chef === 'Frère' || relation_chef === 'Sœur') {
      // Mêmes parents que le chef
      setPereId(chef.pere_id || '');
      setMereId(chef.mere_id || '');
      setPereNom(chef.pere_nom || '');
      setMereNom(chef.mere_nom || '');
      setConjointId('');
    } else if (relation_chef === 'Petit-fils' || relation_chef === 'Petite-fille') {
      // Parents = enfants du chef (ceux qui sont fils/fille dans les membres)
      const enfants = membres.filter(m => m.pere_id === chef.id || m.mere_id === chef.id);
      const enfantM = enfants.find(e => e.sexe === 'M');
      const enfantF = enfants.find(e => e.sexe === 'F');
      if (enfantM) setPereId(enfantM.id);
      if (enfantF) setMereId(enfantF.id);
      setConjointId('');
    } else {
      // Réinitialiser
      setConjointId(''); setPereId(''); setMereId(''); setPereNom(''); setMereNom('');
    }
  }, [relation_chef]);

  // ── Upload photo membre ──────────────────────────────────────
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image trop grande (max 5 Mo)'); return; }
    setUploadingPhoto(true);
    const ext = file.name.split('.').pop();
    const path = `membres/${foyer.code_menage}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('Photos').upload(path, file, { upsert: true });
    if (error) { alert('Erreur upload : ' + error.message); setUploadingPhoto(false); return; }
    const { data: urlData } = supabase.storage.from('Photos').getPublicUrl(path);
    setPhotoUrl(urlData.publicUrl);
    setUploadingPhoto(false);
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'carnet' | 'handicap' | 'medical') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Fichier trop grand (max 5 Mo)'); return; }
    setUploadingDoc(type);
    const ext = file.name.split('.').pop();
    const path = `documents/${foyer.code_menage}-${type}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('Photos').upload(path, file, { upsert: true });
    if (error) { alert('Erreur upload : ' + error.message); setUploadingDoc(null); return; }
    const { data: urlData } = supabase.storage.from('Photos').getPublicUrl(path);
    if (type === 'carnet') setPhotoCarnetVaccination(urlData.publicUrl);
    if (type === 'handicap') setPhotoCarteHandicap(urlData.publicUrl);
    if (type === 'medical') setPhotoDocumentMedical(urlData.publicUrl);
    setUploadingDoc(null);
  };

  const TAB_ORDER: Tab[] = ['identite', 'famille', 'education', 'sante', 'vulnerabilite'];
  const isLastTab = tab === TAB_ORDER[TAB_ORDER.length - 1];

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'identite' && (!nom.trim() || !prenom.trim())) {
      alert('Le nom et le prénom sont obligatoires.');
      return;
    }
    const idx = TAB_ORDER.indexOf(tab);
    if (idx < TAB_ORDER.length - 1) setTab(TAB_ORDER[idx + 1]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim() || !prenom.trim()) return;
    // Validation CIN : le 6ème chiffre doit correspondre au sexe
    if (cin && cin.length >= 6) {
      const sixiemeChiffre = cin[5];
      if (sexe === 'M' && sixiemeChiffre !== '1') {
        alert(`❌ Numéro CIN invalide : le 6ème chiffre doit être "1" pour un homme (actuel : "${sixiemeChiffre}").\nVérifiez le numéro CIN saisi.`);
        return;
      }
      if (sexe === 'F' && sixiemeChiffre !== '2') {
        alert(`❌ Numéro CIN invalide : le 6ème chiffre doit être "2" pour une femme (actuel : "${sixiemeChiffre}").\nVérifiez le numéro CIN saisi.`);
        return;
      }
    }
    setSaving(true);
    await onSave({
      foyer_id: foyer.id,
      nom: nom.toUpperCase(),
      prenom,
      sexe,
      date_naissance: date_naissance || undefined,
      lieu_naissance: lieu_naissance || undefined,
      cin: cin || undefined,
      date_cin: date_cin || undefined,
      cin_est_duplicata: cin_est_duplicata || false,
      cin_duplicata_date: cin_est_duplicata && cin_duplicata_date ? cin_duplicata_date : undefined,
      situation_matrimoniale: situation_matrimoniale || undefined,
      religion: religion || undefined,
      niveau_instruction_detail: niveau_instruction_detail || undefined,
      telephone: telephone || undefined,
      email: email || undefined,
      photo_url: photo_url || undefined,
      statut,
      relation_chef,
      is_chef: relation_chef === 'Chef',
      conjoint_id: conjoint_id || undefined,
      pere_id: pere_id || undefined,
      mere_id: mere_id || undefined,
      pere_nom: pere_nom || undefined,
      mere_nom: mere_nom || undefined,
      niveau_etude,
      filiere_etudes: filiere_etudes || undefined,
      diplome: diplome || undefined,
      profession: profession || undefined,
      secteur: secteur || undefined,
      employeur: (employeur || detail_activite) || undefined,
      revenu_estime: revenu_estime ? parseFloat(revenu_estime) : undefined,
      statut_professionnel: statut_professionnel || undefined,
      revenu_fourchette: revenu_fourchette || undefined,
      activite_secondaire: activite_secondaire || undefined,
      situation_emploi: situation_emploi || undefined,
      secteur_activite: secteur_activite || undefined,
      anciennete_professionnelle: anciennete_professionnelle || undefined,
      contribution_revenu: contribution_revenu || undefined,
      agr_types,
      formations_pro,
      langues,
      competences,
      groupe_sanguin: groupe_sanguin || undefined,
      handicap: handicap || undefined,
      handicap_oui,
      handicap_types,
      handicap_precision: handicap_precision || undefined,
      handicap_autonomie: handicap_autonomie || undefined,
      handicap_carte,
      hypertension,
      diabete,
      maladies_chroniques,
      maladie_autre: maladie_autre || undefined,
      traitement_regulier,
      suivi_medical,
      priorite_sanitaire,
      grossesse_cours: sexe === 'F' ? grossesse_cours : undefined,
      grossesse_mois: grossesse_mois ? parseInt(grossesse_mois) : undefined,
      grossesse_date_accouchement: grossesse_date_accouchement || undefined,
      grossesse_cpn: grossesse_cpn ? parseInt(grossesse_cpn) : undefined,
      grossesse_risque,
      grossesse_suivie,
      grossesse_centre_sante: grossesse_centre_sante || undefined,
      allergies,
      allergies_precision: allergies_precision || undefined,
      vaccination,
      statut_vaccinal: statut_vaccinal || undefined,
      poids: poids ? parseFloat(poids) : undefined,
      taille: taille ? parseFloat(taille) : undefined,
      contact_urgence_nom: contact_urgence_nom || undefined,
      contact_urgence_telephone: contact_urgence_telephone || undefined,
      contact_urgence_lien: contact_urgence_lien || undefined,
      photo_carnet_vaccination: photo_carnet_vaccination || undefined,
      photo_carte_handicap: photo_carte_handicap || undefined,
      photo_document_medical: photo_document_medical || undefined,
      est_vulnerable,
      vulnerabilite_categories,
      vulnerabilite_description: vulnerabilite_description || undefined,
      niveau_priorite,
      aides_obtenues,
    });
    setSaving(false);
  };

  const TABS = [
    { key: 'identite', label: 'Identité', icon: User },
    { key: 'famille', label: 'Famille', icon: User },
    { key: 'education', label: 'Éduc. & Éco.', icon: GraduationCap },
    { key: 'sante', label: 'Santé', icon: HeartPulse },
    { key: 'vulnerabilite', label: 'Vulnérabilité', icon: ShieldAlert },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            {/* Photo preview dans le header */}
            <div className="relative">
              {photo_url ? (
                <img src={photo_url} alt="Photo" className="w-12 h-12 rounded-full object-cover border-2 border-emerald-300" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <User className="h-6 w-6 text-emerald-600" />
                </div>
              )}
              <label className="absolute -bottom-1 -right-1 bg-emerald-600 rounded-full p-1 cursor-pointer hover:bg-emerald-700 transition">
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
                {uploadingPhoto ? <Loader2 className="h-2.5 w-2.5 text-white animate-spin" /> : <Camera className="h-2.5 w-2.5 text-white" />}
              </label>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{membre ? 'Modifier le membre' : 'Nouveau membre'}</h2>
              <p className="text-xs text-slate-500">Foyer <span className="font-mono font-bold text-indigo-600">{foyer.code_menage}</span></p>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                {[foyer.adresse, foyer.carreau && `Carreau ${foyer.num_carreau || foyer.carreau}`, foyer.fokontany && `FKT ${foyer.fokontany}`].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-500" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 overflow-x-auto shrink-0">
          {TABS.map(({ key, label, icon: Icon }) => {
            const idx = TAB_ORDER.indexOf(key as Tab);
            const curIdx = TAB_ORDER.indexOf(tab);
            const isDone = idx < curIdx;
            const isActive = tab === key;
            const isLocked = !membre && idx > curIdx;
            return (
              <button key={key} type="button" onClick={() => { if (!isLocked) setTab(key as Tab); }} disabled={isLocked} className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition shrink-0 ${isActive ? 'border-indigo-600 text-indigo-700' : isLocked ? 'border-transparent text-slate-300 cursor-not-allowed' : isDone ? 'border-transparent text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <Icon className="h-3.5 w-3.5" />{label}{isDone && ' ✓'}
              </button>
            );
          })}
        </div>

        {/* Form */}
        <form onSubmit={isLastTab ? handleSubmit : handleNext} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">

            {/* ── IDENTITÉ ── */}
            {tab === 'identite' && (
              <div className="space-y-4">
                {/* Relation */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Lien avec le chef de foyer <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-3 gap-2">
                    {RELATIONS.map(r => (
                      <label key={r} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${relation_chef === r ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                        <input type="radio" className="hidden" checked={relation_chef === r} onChange={() => setRelationChef(r)} />{r}
                      </label>
                    ))}
                  </div>
                  {relation_chef === 'Autre' && (
                    <div className="mt-3">
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Préciser la relation <span className="text-red-500">*</span></label>
                      <input value={autre_relation_label} onChange={e => setAutreRelationLabel(e.target.value)} placeholder="Ex: Beau-frère, Tuteur, Cousin..." className="w-full border border-indigo-300 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-indigo-50" required />
                    </div>
                  )}
                  {/* Indication auto */}
                  {!membre && chef && ['Fils', 'Fille', 'Frère', 'Sœur', 'Épouse/Époux'].includes(relation_chef) && (
                    <p className="text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5 mt-2">
                      ✓ Liens familiaux pré-remplis automatiquement — vérifiez dans l'onglet <strong>Famille</strong>
                    </p>
                  )}
                </div>

                {/* Nom & Prénom */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nom <span className="text-red-500">*</span></label>
                    <input value={nom} onChange={e => setNom(e.target.value)} placeholder="RAKOTO" required className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none uppercase" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Prénom(s) <span className="text-red-500">*</span></label>
                    <input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Jean" required className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                </div>

                {/* Sexe */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Sexe</label>
                  <div className="flex gap-3">
                    {(['M', 'F'] as const).map(s => (
                      <label key={s} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm font-semibold transition ${sexe === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                        <input type="radio" className="hidden" checked={sexe === s} onChange={() => setSexe(s)} />
                        {s === 'M' ? '♂ Masculin' : '♀ Féminin'}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Situation matrimoniale */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Situation matrimoniale</label>
                  <div className="flex flex-wrap gap-2">
                    {['Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf/Veuve', 'En union libre', 'Autre'].map(s => (
                      <label key={s} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${situation_matrimoniale === s || (s === 'Autre' && !['Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf/Veuve', 'En union libre', 'Autre', ''].includes(situation_matrimoniale) && s === 'Autre') ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                        <input type="radio" className="hidden" checked={situation_matrimoniale === s} onChange={() => setSituationMatrimoniale(s)} />
                        {s}
                      </label>
                    ))}
                  </div>
                  {situation_matrimoniale === 'Autre' && (
                    <input onChange={e => setSituationMatrimoniale(e.target.value)} placeholder="Précisez la situation..." className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none" />
                  )}
                </div>

                {/* Religion */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Religion</label>
                  <div className="flex flex-wrap gap-2">
                    {['Catholique', 'Protestant', 'Adventiste', 'Islam', 'Témoins de Jéhovah', 'Traditionnel', 'Autre'].map(r => (
                      <label key={r} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${religion === r ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                        <input type="radio" className="hidden" checked={religion === r} onChange={() => setReligion(r)} />
                        {r}
                      </label>
                    ))}
                  </div>
                  {religion === 'Autre' && (
                    <input onChange={e => setReligion(e.target.value)} placeholder="Précisez la religion..." className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none" />
                  )}
                </div>

                {/* Naissance */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Date de naissance</label>
                    <input type="date" value={date_naissance} onChange={e => setDateNaissance(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Lieu de naissance</label>
                    <input value={lieu_naissance} onChange={e => setLieuNaissance(e.target.value)} placeholder="Ex: Toamasina" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                </div>

                {/* CIN — masqué pour les moins de 18 ans */}
                {isAdulte && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Numéro CIN</label>
                        <input value={cin} onChange={e => setCin(e.target.value)} placeholder="12 chiffres" maxLength={12} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none font-mono" />
                        {cin.length >= 6 && (
                          <p className={`text-[10px] mt-0.5 ${(sexe === 'M' && cin[5] === '1') || (sexe === 'F' && cin[5] === '2') ? 'text-emerald-600' : 'text-red-500 font-bold'}`}>
                            {(sexe === 'M' && cin[5] === '1') || (sexe === 'F' && cin[5] === '2') ? '✓ 6ème chiffre conforme' : `⚠ 6ème chiffre "${cin[5]}" — attendu "${sexe === 'M' ? '1' : '2'}" pour ${sexe === 'M' ? 'Masculin' : 'Féminin'}`}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Date CIN</label>
                        <input type="date" value={date_cin} onChange={e => setDateCin(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={cin_est_duplicata} onChange={e => setCinEstDuplicata(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
                      <span className="font-semibold text-slate-700">CIN Duplicata</span>
                    </label>
                    {cin_est_duplicata && (
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Date du duplicata</label>
                        <input type="date" value={cin_duplicata_date} onChange={e => setCinDuplicataDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                      </div>
                    )}
                  </div>
                )}

                {/* Contact — téléphone et email dès 16 ans */}
                {isJeuneAdulte && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Téléphone</label>
                      <input value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="+261 34 56 789 01" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Email</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nom@exemple.mg" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                    </div>
                  </div>
                )}
                {!isJeuneAdulte && date_naissance && (
                  <p className="text-[11px] text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">Téléphone et email disponibles à partir de 16 ans.</p>
                )}

                {/* Poids & Taille */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Poids (kg)</label>
                    <input type="number" value={poids} onChange={e => setPoids(e.target.value)} placeholder="Ex: 65" step="0.1" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Taille (cm)</label>
                    <input type="number" value={taille} onChange={e => setTaille(e.target.value)} placeholder="Ex: 170" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                </div>

                {/* Statut */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Statut</label>
                  <div className="flex gap-3">
                    {(['Actif', 'Décédé', 'Déménagé'] as const).map(s => (
                      <label key={s} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${statut === s ? (s === 'Actif' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-600 text-white border-slate-600') : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                        <input type="radio" className="hidden" checked={statut === s} onChange={() => setStatut(s)} />{s}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── FAMILLE ── */}
            {tab === 'famille' && (
              <div className="space-y-4">
                <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg p-3">
                  Les liens sont pré-remplis automatiquement selon la relation choisie. Vous pouvez les modifier.
                </p>
                {/* Père */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Père</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">Dans le registre</p>
                      <select value={pere_id} onChange={e => { setPereId(e.target.value); if (e.target.value) setPereNom(''); }} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-white">
                        <option value="">— Aucun —</option>
                        {autresMembres.filter(m => m.sexe === 'M').map(m => <option key={m.id} value={m.id}>{m.nom} {m.prenom} ({m.relation_chef})</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">Nom libre (hors registre)</p>
                      <input value={pere_nom} onChange={e => setPereNom(e.target.value)} placeholder="Nom complet du père" disabled={!!pere_id} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none disabled:bg-slate-50 disabled:text-slate-400" />
                    </div>
                  </div>
                  {pere_id && (
                    <p className="text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-2.5 py-1">
                      ↳ <strong>{autresMembres.find(m => m.id === pere_id)?.prenom}</strong> sera reconnu comme père de <strong>{prenom || '…'}</strong>
                    </p>
                  )}
                </div>

                {/* Mère */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Mère</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">Dans le registre</p>
                      <select value={mere_id} onChange={e => { setMereId(e.target.value); if (e.target.value) setMereNom(''); }} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-white">
                        <option value="">— Aucune —</option>
                        {autresMembres.filter(m => m.sexe === 'F').map(m => <option key={m.id} value={m.id}>{m.nom} {m.prenom} ({m.relation_chef})</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">Nom libre (hors registre)</p>
                      <input value={mere_nom} onChange={e => setMereNom(e.target.value)} placeholder="Nom complet de la mère" disabled={!!mere_id} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none disabled:bg-slate-50 disabled:text-slate-400" />
                    </div>
                  </div>
                  {mere_id && (
                    <p className="text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-2.5 py-1">
                      ↳ <strong>{autresMembres.find(m => m.id === mere_id)?.prenom}</strong> sera reconnue comme mère de <strong>{prenom || '…'}</strong>
                    </p>
                  )}
                </div>

                {/* Conjoint */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Conjoint(e)</label>
                  <select value={conjoint_id} onChange={e => setConjointId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-white">
                    <option value="">— Aucun —</option>
                    {autresMembres.map(m => <option key={m.id} value={m.id}>{m.nom} {m.prenom} ({m.relation_chef})</option>)}
                  </select>
                  {conjoint_id && (
                    <p className="text-[11px] text-pink-600 bg-pink-50 border border-pink-100 rounded px-2.5 py-1">
                      ↳ <strong>{autresMembres.find(m => m.id === conjoint_id)?.prenom}</strong> et <strong>{prenom || '…'}</strong> sont époux/épouse
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── ÉDUCATION & ÉCONOMIE ── */}
            {tab === 'education' && (
              <div className="space-y-5">
                {isTresPetit && date_naissance && (
                  <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg p-3">Enfant de moins de 6 ans — seul le niveau d'instruction est applicable.</p>
                )}

                {/* ── Section 1 : Éducation ── */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">1. Formation & Instruction</h3>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Niveau d'instruction</label>
                    <div className="grid grid-cols-2 gap-2">
                      {NIVEAUX_ETUDE.map(n => (
                        <label key={n} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${niveau_etude === n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                          <input type="radio" className="hidden" checked={niveau_etude === n} onChange={() => setNiveauEtude(n)} />{n}
                        </label>
                      ))}
                    </div>
                    {['Primaire', 'Secondaire', 'Collège', 'Lycée'].includes(niveau_etude) && (
                      <div className="mt-2">
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Préciser la classe *</label>
                        <input value={niveau_instruction_detail} onChange={e => setNiveauInstructionDetail(e.target.value)} placeholder={niveau_etude === 'Primaire' ? 'Ex: 11ème, 10ème, 9ème, 8ème...' : 'Ex: 6ème, 5ème, 4ème, 3ème, 2nde, 1ère, Tle...'} className="w-full border border-indigo-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-indigo-50/30" />
                      </div>
                    )}
                  </div>
                  {!isTresPetit && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Diplôme le plus élevé</label>
                          <input value={diplome} onChange={e => setDiplome(e.target.value)} placeholder="Ex: BACC, Licence, Master" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                        </div>
                        {(niveau_etude === 'Universitaire' || niveau_etude === 'Formation professionnelle') && (
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Filière / Spécialisation</label>
                            <input value={filiere_etudes} onChange={e => setFiliereEtudes(e.target.value)} placeholder="Ex: Médecine, Informatique..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Formations professionnelles reçues</label>
                        <div className="flex flex-wrap gap-2">
                          {FORMATIONS_PRO.map(f => (
                            <label key={f} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer text-xs font-semibold transition ${formations_pro.includes(f) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                              <input type="checkbox" className="hidden" checked={formations_pro.includes(f)} onChange={() => setFormationsPro(prev => toggleArr(prev, f))} />{f}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Langues parlées</label>
                        <div className="flex flex-wrap gap-2">
                          {LANGUES_LIST.map(l => (
                            <label key={l} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer text-xs font-semibold transition ${langues.includes(l) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                              <input type="checkbox" className="hidden" checked={langues.includes(l)} onChange={() => setLangues(prev => toggleArr(prev, l))} />{l}
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* ── Section 2 : Activités ── */}
                {!isEnfant && (
                  <div className="space-y-4 border-t border-slate-100 pt-4">
                    <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">2. Activités & Emploi</h3>

                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Activité principale <span className="text-red-500">*</span></label>
                      <div className="grid grid-cols-2 gap-2">
                        {ACTIVITES_PRINCIPALES.map(a => (
                          <label key={a} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer text-xs font-semibold transition ${profession === a ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                            <input type="radio" className="hidden" checked={profession === a} onChange={() => setProfession(a)} />{a}
                          </label>
                        ))}
                      </div>
                      {profession && !['Retraité', 'Sans emploi', 'Étudiant', 'Femme au foyer'].includes(profession) && (
                        <input value={detail_activite} onChange={e => setDetailActivite(e.target.value)}
                          placeholder={profession === 'Agriculture' ? 'Ex: Riziculture, maraîchage...' : profession === 'Commerce' ? 'Ex: Épicerie, vente ambulante...' : 'Préciser...'}
                          className="w-full mt-2 border border-indigo-200 bg-indigo-50/40 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Activité secondaire</label>
                      <div className="grid grid-cols-2 gap-2">
                        {ACTIVITES_SECONDAIRES.map(a => (
                          <label key={a} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${activite_secondaire === a ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                            <input type="radio" className="hidden" checked={activite_secondaire === a} onChange={() => setActiviteSecondaire(a)} />{a}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Situation de l'emploi</label>
                        <select value={situation_emploi} onChange={e => setSituationEmploi(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-white">
                          <option value="">Choisir...</option>
                          {SITUATIONS_EMPLOI.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Statut professionnel</label>
                        <select value={statut_professionnel} onChange={e => setStatutProfessionnel(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-white">
                          <option value="">Choisir...</option>
                          {STATUTS_PROFESSIONNELS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Secteur d'activité</label>
                        <select value={secteur_activite} onChange={e => setSecteurActivite(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-white">
                          <option value="">Choisir...</option>
                          {SECTEURS_ACTIVITE.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Ancienneté professionnelle</label>
                        <select value={anciennete_professionnelle} onChange={e => setAnciennete(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-white">
                          <option value="">Choisir...</option>
                          {ANCIENNETES.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Employeur</label>
                        <input value={employeur} onChange={e => setEmployeur(e.target.value)} placeholder="Ex: Société, Ministère..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Revenu mensuel</label>
                        <select value={revenu_fourchette} onChange={e => setRevenuFourchette(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-white">
                          <option value="">Choisir...</option>
                          {FOURCHETTES_REVENU.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Contribution au revenu du ménage</label>
                      <div className="flex gap-2 flex-wrap">
                        {CONTRIBUTIONS_REVENU.map(c => (
                          <label key={c} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${contribution_revenu === c ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200'}`}>
                            <input type="radio" className="hidden" checked={contribution_revenu === c} onChange={() => setContributionRevenu(c)} />{c}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Section 3 : AGR ── */}
                {!isEnfant && (
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">3. Activités génératrices de revenus (AGR)</h3>
                    <div className="flex flex-wrap gap-2">
                      {AGR_TYPES.map(a => (
                        <label key={a} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer text-xs font-semibold transition ${agr_types.includes(a) ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200'}`}>
                          <input type="checkbox" className="hidden" checked={agr_types.includes(a)} onChange={() => setAgrTypes(prev => toggleArr(prev, a))} />{a}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Section 4 : Compétences ── */}
                {!isEnfant && (
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">4. Bibliothèque de compétences</h3>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {COMPETENCES_PREDEFINIES.map(c => (
                        <label key={c} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer text-xs font-semibold transition ${competences.includes(c) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                          <input type="checkbox" className="hidden" checked={competences.includes(c)} onChange={() => setCompetences(prev => toggleArr(prev, c))} />{c}
                        </label>
                      ))}
                    </div>
                    {/* Compétences personnalisées */}
                    {competences.filter(c => !COMPETENCES_PREDEFINIES.includes(c)).map(c => (
                      <span key={c} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full text-xs font-semibold mr-1.5">
                        {c}<button type="button" onClick={() => setCompetences(prev => prev.filter(x => x !== c))} className="text-indigo-400 hover:text-indigo-700">×</button>
                      </span>
                    ))}
                    <div className="flex gap-2">
                      <input value={competence_custom} onChange={e => setCompetenceCustom(e.target.value)} placeholder="Ajouter une compétence personnalisée..." className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none" onKeyDown={e => { if (e.key === 'Enter' && competence_custom.trim()) { setCompetences(prev => [...prev, competence_custom.trim()]); setCompetenceCustom(''); e.preventDefault(); } }} />
                      <button type="button" onClick={() => { if (competence_custom.trim()) { setCompetences(prev => [...prev, competence_custom.trim()]); setCompetenceCustom(''); }}} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">+</button>
                    </div>
                    <p className="text-[11px] text-slate-400">Appuyer sur Entrée ou + pour ajouter une compétence personnalisée</p>
                  </div>
                )}
              </div>
            )}

            {/* ── SANTÉ ── */}
            {tab === 'sante' && (
              <div className="space-y-5">
                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">1. Groupe sanguin</h3>
                <div>
                  <select value={groupe_sanguin} onChange={e => setGroupeSanguin(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-white">
                    <option value="">Inconnu</option>
                    {GROUPES_SANG.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-t border-slate-100 pt-4">2. Handicap</h3>
                <YesNo label="La personne est-elle en situation de handicap ?" value={handicap_oui} onChange={setHandicapOui} />
                {handicap_oui && (
                  <>
                    <CheckGroup label="Type de handicap" options={HANDICAP_TYPES} values={handicap_types} onToggle={v => setHandicapTypes(prev => toggleArr(prev, v))} />
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Précision du handicap</label>
                      <input value={handicap_precision} onChange={e => setHandicapPrecision(e.target.value)} placeholder="Préciser..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Niveau d'autonomie</label>
                      <div className="flex gap-2 flex-wrap">
                        {AUTONOMIE_NIVEAUX.map(n => (
                          <label key={n} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${handicap_autonomie === n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                            <input type="radio" className="hidden" checked={handicap_autonomie === n} onChange={() => setHandicapAutonomie(n)} />{n}
                          </label>
                        ))}
                      </div>
                    </div>
                    <YesNo label="Possède une carte de handicap" value={handicap_carte} onChange={setHandicapCarte} />
                  </>
                )}

                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-t border-slate-100 pt-4">3. Hypertension artérielle</h3>
                <PriorityButtons label="Situation" value={hypertension} onChange={v => setHypertension(v as Membre['hypertension'])} />

                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-t border-slate-100 pt-4">4. Diabète</h3>
                <PriorityButtons label="Situation" value={diabete} onChange={v => setDiabete(v as Membre['diabete'])} />

                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-t border-slate-100 pt-4">5. Maladies chroniques</h3>
                <CheckGroup label="Maladies diagnostiquées" options={MALADIES_CHRONIQUES} values={maladies_chroniques} onToggle={v => setMaladiesChroniques(prev => toggleArr(prev, v))} />
                {maladies_chroniques.includes('Autre') && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Autre maladie chronique</label>
                    <input value={maladie_autre} onChange={e => setMaladieAutre(e.target.value)} placeholder="Préciser..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                )}
                <YesNo label="Traitement médical régulier ?" value={traitement_regulier} onChange={setTraitementRegulier} />
                <YesNo label="Suivi médical régulier ?" value={suivi_medical} onChange={setSuiviMedical} />
                <PriorityButtons label="Niveau de priorité sanitaire" value={priorite_sanitaire} onChange={setPrioriteSanitaire} />

                {sexe === 'F' && (
                  <>
                    <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-t border-slate-100 pt-4">6. Grossesse</h3>
                    <YesNo label="Grossesse en cours ?" value={grossesse_cours} onChange={setGrossesseCours} />
                    {grossesse_cours && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nombre de mois de grossesse</label>
                            <input type="number" min="0" max="9" value={grossesse_mois} onChange={e => setGrossesseMois(e.target.value)} placeholder="Ex: 5" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Date probable d'accouchement</label>
                            <input type="date" value={grossesse_date_accouchement} onChange={e => setGrossesseDateAccouchement(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nombre de consultations prénatales (CPN)</label>
                          <input type="number" min="0" value={grossesse_cpn} onChange={e => setGrossesseCpn(e.target.value)} placeholder="Ex: 3" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                        </div>
                        <YesNo label="Grossesse à risque ?" value={grossesse_risque} onChange={setGrossesseRisque} />
                        <YesNo label="Suivie dans un centre de santé ?" value={grossesse_suivie} onChange={setGrossesseSuivie} />
                        {grossesse_suivie && (
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nom du centre de santé</label>
                            <input value={grossesse_centre_sante} onChange={e => setGrossesseCentreSante(e.target.value)} placeholder="Nom du centre" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-t border-slate-100 pt-4">7. Allergies</h3>
                <CheckGroup label="Allergies connues" options={ALLERGIES_LIST} values={allergies} onToggle={v => setAllergies(prev => toggleArr(prev, v))} cols={1} />
                {allergies.length > 0 && !allergies.includes('Aucune') && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Précision des allergies</label>
                    <input value={allergies_precision} onChange={e => setAllergiesPrecision(e.target.value)} placeholder="Préciser..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                )}

                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-t border-slate-100 pt-4">8. Vaccinations</h3>
                <CheckGroup label="Vaccins reçus" options={VACCINS_LIST} values={vaccination} onToggle={v => setVaccination(prev => toggleArr(prev, v))} />
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Statut vaccinal</label>
                  <div className="flex gap-2 flex-wrap">
                    {STATUT_VACCINAL.map(s => (
                      <label key={s} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${statut_vaccinal === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                        <input type="radio" className="hidden" checked={statut_vaccinal === s} onChange={() => setStatutVaccinal(s)} />{s}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Poids (kg)</label>
                    <input type="number" value={poids} onChange={e => setPoids(e.target.value)} placeholder="Ex: 65" step="0.1" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Taille (cm)</label>
                    <input type="number" value={taille} onChange={e => setTaille(e.target.value)} placeholder="Ex: 170" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                </div>

                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-t border-slate-100 pt-4">9. Contact d'urgence</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nom du contact</label>
                    <input value={contact_urgence_nom} onChange={e => setContactUrgenceNom(e.target.value)} placeholder="Nom complet" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Téléphone</label>
                    <input value={contact_urgence_telephone} onChange={e => setContactUrgenceTelephone(e.target.value)} placeholder="+261 34..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Lien de parenté</label>
                  <select value={contact_urgence_lien} onChange={e => setContactUrgenceLien(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-white">
                    <option value="">Choisir...</option>
                    {LIENS_PARENTE.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>

                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-t border-slate-100 pt-4">10. Documents sanitaires</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'carnet' as const, label: 'Carnet de vaccination', url: photo_carnet_vaccination, set: setPhotoCarnetVaccination },
                    { key: 'handicap' as const, label: 'Carte de handicap', url: photo_carte_handicap, set: setPhotoCarteHandicap },
                    { key: 'medical' as const, label: 'Document médical', url: photo_document_medical, set: setPhotoDocumentMedical },
                  ].map(({ key, label, url, set }) => (
                    <div key={key}>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{label}</label>
                      {url ? (
                        <div className="relative h-20 rounded-lg overflow-hidden border border-slate-200">
                          <img src={url} alt={label} className="w-full h-full object-cover" />
                          <button type="button" onClick={() => set('')} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5"><X className="h-3 w-3" /></button>
                        </div>
                      ) : (
                        <label className={`flex flex-col items-center justify-center h-20 border-2 border-dashed rounded-lg cursor-pointer transition ${uploadingDoc === key ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}>
                          <input type="file" accept="image/*" className="hidden" onChange={e => handleDocUpload(e, key)} disabled={!!uploadingDoc} />
                          {uploadingDoc === key ? <Loader2 className="h-4 w-4 text-indigo-600 animate-spin" /> : <Upload className="h-4 w-4 text-slate-300" />}
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── VULNÉRABILITÉ ── */}
            {tab === 'vulnerabilite' && (
              <div className="space-y-4">
                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${est_vulnerable ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-white'}`}>
                  <input type="checkbox" checked={est_vulnerable} onChange={e => setEstVulnerable(e.target.checked)} className="h-4 w-4 rounded" />
                  <span className="font-semibold text-sm text-slate-800">Ce membre est en situation de vulnérabilité</span>
                </label>
                {est_vulnerable && (
                  <>
                    <div>
                      <label className="text-xs font-bold text-rose-700 uppercase block mb-2">Niveau d'urgence</label>
                      <div className="flex gap-3">
                        {(['Aucun', 'Moyen', 'Critique'] as const).map(n => (
                          <label key={n} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${niveau_priorite === n ? (n === 'Critique' ? 'bg-red-600 text-white border-red-600' : n === 'Moyen' ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-400 text-white border-slate-400') : 'bg-white text-slate-600 border-slate-200'}`}>
                            <input type="radio" className="hidden" checked={niveau_priorite === n} onChange={() => setNiveauPriorite(n)} />{n}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-rose-700 uppercase block mb-2">Catégories de risque</label>
                      <div className="grid grid-cols-2 gap-2">
                        {VULNERABILITE_CATS.map(c => (
                          <label key={c} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs transition ${vulnerabilite_categories.includes(c) ? 'bg-rose-50 border-rose-300 text-rose-800 font-semibold' : 'bg-white border-slate-200 text-slate-600'}`}>
                            <input type="checkbox" checked={vulnerabilite_categories.includes(c)} onChange={() => setVulnCats(prev => toggleArr(prev, c))} className="rounded" />{c}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-rose-700 uppercase block mb-2">Aides obtenues</label>
                      <div className="flex flex-wrap gap-2">
                        {AIDES.map(a => (
                          <label key={a} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer text-xs font-semibold transition ${aides_obtenues.includes(a) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                            <input type="checkbox" className="hidden" checked={aides_obtenues.includes(a)} onChange={() => setAides(prev => toggleArr(prev, a))} />{a}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-rose-700 uppercase block mb-1">Observations</label>
                      <textarea value={vulnerabilite_description} onChange={e => setVulnDesc(e.target.value)} rows={3} placeholder="Situation précaire, besoins spécifiques..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none resize-none" />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-5 border-t border-slate-100 sticky bottom-0 bg-white">
            {tab === 'identite' ? (
              <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Annuler</button>
            ) : (
              <button type="button" onClick={() => { const idx = TAB_ORDER.indexOf(tab); if (idx > 0) setTab(TAB_ORDER[idx - 1]); }} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">← Précédent</button>
            )}
            <button type="submit" disabled={saving} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition flex items-center justify-center gap-2 ${isLastTab ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</>
                : isLastTab
                  ? (membre ? 'Enregistrer les modifications' : 'Enregistrer')
                  : 'Valider →'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
