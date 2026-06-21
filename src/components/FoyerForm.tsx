import React, { useState, useEffect } from 'react';
import { Foyer } from '../types';
import { supabase } from '../lib/supabase';
import { X, Home, MapPin, Image, Loader2, Upload, Building2, UserCog, Droplets, Trash2, Wifi, AlertTriangle, Info, HeartCrack } from 'lucide-react';

interface Props {
  foyer?: Foyer;
  onClose: () => void;
  onSave: (foyer: Partial<Foyer>) => Promise<void>;
}

const TYPES_LOGEMENT = ['Maison traditionnelle', 'Villa', 'Appartement', 'Case en bois', 'Studio', 'Autres'];
const MATERIAUX_TOITURE = ['Tôle', 'Tuile', 'Chaume / Ravinala', 'Béton', 'Autres'];
const MATERIAUX_MUR = ['Brique', 'Parpaing / Béton', 'Bois', 'Terre battue', 'Ravinala / Falafa', 'Autres'];
const MATERIAUX_PLANCHER = ['Ciment', 'Carrelage', 'Terre battue', 'Bois', 'Autres'];
const STATUTS_OCCUPANT = ['Propriétaire', 'Locataire', 'Gardien', 'Occupant à titre gratuit', 'Autres'];

const EAU_SOURCES = ['Robinet dans le logement', 'Robinet dans la cour', 'Borne fontaine publique', 'Puits protégé', 'Puits non protégé', 'Source aménagée', 'Source non aménagée', 'Rivière', 'Lac', 'Eau de pluie', "Achat aupres d'un vendeur d'eau", 'Autre'];
const EAU_DISPO = ["Toute l'annee", 'Saisonniere uniquement', 'Rarement disponible'];
const EAU_TEMPS = ['Sur place', 'Moins de 15 minutes', '15 a 30 minutes', '30 a 60 minutes', 'Plus de 60 minutes'];
const TOILETTE_TYPES = ["WC avec chasse d'eau", 'Latrine amelioree', 'Latrine traditionnelle', 'Toilette partagee', 'Aucune toilette'];
const EVAC_EAUX = ['Canalisation', 'Fosse septique', 'Puisard', 'Rejet dans la nature', 'Autre'];
const ECLAIRAGE_SOURCES = ['JIRAMA', 'Panneaux solaires', 'Groupe electrogene', 'Batterie', 'Lampe rechargeable', 'Lampe a petrole', 'Bougie', 'Aucune', 'Autre'];
const CUISSON_SOURCES = ['Charbon', 'Bois de chauffe', 'Gaz', 'Electricite', 'Biogaz', 'Autre'];
const DECHETS_MODES = ['Collecte communale', 'Collecte privee', 'Brulage', 'Enterrement', 'Compostage', 'Depot sauvage', 'Rejet dans la nature', 'Autre'];
const RESEAU_NIVEAUX = ['Tres bonne', 'Bonne', 'Moyenne', 'Faible', 'Aucune'];
const INTERNET_MOYENS = ['Donnees mobiles', 'Fibre optique', 'ADSL', 'Satellite', 'Wi-Fi partage', 'Aucun'];
const RISQUES_TYPES = ['Inondation', 'Cyclone', 'Glissement de terrain', 'Secheresse', 'Erosion', 'Incendie', 'Autre'];
const CATASTROPHE_TYPES = ['Inondation', 'Cyclone', 'Incendie', 'Secheresse', 'Autre'];
const CONDITIONS_VIE = ['Tres bonnes', 'Bonnes', 'Moyennes', 'Difficiles', 'Tres difficiles'];

// Module Vulnerabilite du menage
const VULNERABILITE_RAISONS = ['Absence de revenu stable', 'Chomage du chef de menage', 'Personne agee vivant seule', "Presence d'une personne handicapee", "Presence d'une maladie chronique grave", 'Femme chef de menage seule', 'Veuf / Veuve sans soutien', 'Famille nombreuse (5 enfants ou plus)', 'Orphelin(s) a charge', 'Insecurite alimentaire', 'Victime de catastrophe naturelle', 'Autre'];
const FREQUENCE_DIFFICULTE = ['Jamais', 'Rarement', 'Parfois', 'Souvent', 'Tres souvent'];
const REPAS_JOUR = ['1 repas', '2 repas', '3 repas ou plus'];
const CATASTROPHES_NAT = ['Cyclone', 'Inondation', 'Incendie', 'Glissement de terrain', 'Secheresse', 'Autre'];
const NIVEAUX_DEGATS = ['Faible', 'Modere', 'Important', 'Total'];
const ORGANISMES_AIDE = ['Fokontany', 'Commune', 'District', 'BNGRC', 'Croix-Rouge Malagasy', 'ONG nationale', 'ONG internationale', 'Association', 'Eglise', 'Entreprise privee', 'Autre'];
const TYPES_AIDE = ['Vivres alimentaires', 'Riz', 'Huile', 'Eau potable', "Kit d'hygiene", 'Kit scolaire', 'Couvertures', 'Vetements', 'Ustensiles de cuisine', 'Materiaux de construction', 'Toles', 'Bois', 'Argent / Transfert monetaire', 'Relogement temporaire', 'Assistance medicale', 'Semences agricoles', 'Autre'];
const TRAVAUX_TYPES = ['Aucune intervention', 'Reparation mineure', 'Renovation partielle', 'Renovation importante', 'Reconstruction complete'];
const TRAVAUX_PARTIES = ['Toiture', 'Murs', 'Sol', 'Portes', 'Fenetres', 'Charpente', 'Installation electrique', 'Installation sanitaire', 'Ensemble de la maison'];

async function genCodeMenage(): Promise<string> {
  const { data } = await supabase.from('foyers').select('code_menage').order('created_at', { ascending: false });
  if (!data || data.length === 0) return 'MEN-001';
  const nums = data.map(f => parseInt((f.code_menage || '').replace('MEN-', '')) || 0).filter(n => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `MEN-${String(max + 1).padStart(3, '0')}`;
}

function ChoiceGroup({ label, options, value, onChange, required, cols = 2 }: { label: string; options: string[]; value: string; onChange: (v: string) => void; required?: boolean; cols?: number }) {
  const [customMode, setCustomMode] = useState(value !== '' && !options.includes(value));
  const [customVal, setCustomVal] = useState(customMode ? value : '');
  return (
    <div>
      <label className="text-xs font-bold text-slate-600 uppercase block mb-1.5">{label} {required && <span className="text-red-500">*</span>}</label>
      <div className={`grid grid-cols-${cols} gap-2`}>
        {options.map(opt => (
          <label key={opt} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${value === opt && !customMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            <input type="radio" className="hidden" checked={value === opt && !customMode} onChange={() => { onChange(opt); setCustomMode(false); }} />
            {opt}
          </label>
        ))}
      </div>
      {(value === 'Autre' || value === 'Autres' || customMode) && (
        <input value={customVal} onChange={e => { setCustomVal(e.target.value); setCustomMode(true); onChange(e.target.value); }} placeholder="Préciser..." className="w-full mt-2 border border-indigo-300 bg-indigo-50 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none" />
      )}
    </div>
  );
}

function YesNo({ label, value, onChange }: { label: string; value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-600 uppercase block mb-1.5">{label}</label>
      <div className="flex gap-2">
        {[{ v: true, l: 'Oui' }, { v: false, l: 'Non' }].map(({ v, l }) => (
          <label key={l} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border cursor-pointer text-sm font-semibold transition ${value === v ? (v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-500 text-white border-slate-500') : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            <input type="radio" className="hidden" checked={value === v} onChange={() => onChange(v)} />{l}
          </label>
        ))}
      </div>
    </div>
  );
}

function CheckGroup({ label, options, values, onToggle }: { label: string; options: string[]; values: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-600 uppercase block mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <label key={opt} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer text-xs font-semibold transition ${values.includes(opt) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
            <input type="checkbox" className="hidden" checked={values.includes(opt)} onChange={() => onToggle(opt)} />{opt}
          </label>
        ))}
      </div>
    </div>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-600 uppercase block mb-1">{label}</label>
      <input type="number" min="0" value={value} onChange={e => onChange(e.target.value)} placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
    </div>
  );
}

function UrgencyButtons({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const LEVELS = [
    { v: 'Faible', color: 'bg-emerald-500', dot: '🟢' },
    { v: 'Moyen', color: 'bg-amber-400', dot: '🟡' },
    { v: 'Eleve', color: 'bg-orange-500', dot: '🟠' },
    { v: 'Critique', color: 'bg-red-600', dot: '🔴' },
  ];
  return (
    <div>
      <label className="text-xs font-bold text-slate-600 uppercase block mb-1.5">{label}</label>
      <div className="flex gap-2 flex-wrap">
        {LEVELS.map(l => (
          <label key={l.v} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${value === l.v ? `${l.color} text-white border-transparent` : 'bg-white text-slate-600 border-slate-200'}`}>
            <input type="radio" className="hidden" checked={value === l.v} onChange={() => onChange(l.v)} />
            <span>{l.dot}</span>{l.v}
          </label>
        ))}
      </div>
    </div>
  );
}

type Tab = 'general' | 'logement' | 'eau_assainissement' | 'energie_dechets' | 'connectivite' | 'risques' | 'vulnerabilite';
const TAB_ORDER: Tab[] = ['general', 'logement', 'eau_assainissement', 'energie_dechets', 'connectivite', 'risques', 'vulnerabilite'];

export default function FoyerForm({ foyer, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [tab, setTab] = useState<Tab>('general');
  const [code_menage, setCodeMenage] = useState(foyer?.code_menage || '');
  const [loadingCode, setLoadingCode] = useState(!foyer);

  // Général
  const [statut, setStatut] = useState<Foyer['statut']>(foyer?.statut || 'Actif');
  const [adresse, setAdresse] = useState(foyer?.adresse || '');
  const [fokontany, setFokontany] = useState(foyer?.fokontany || '');
  const [commune, setCommune] = useState(foyer?.commune || '');
  const [district, setDistrict] = useState(foyer?.district || '');
  const [gps_lat, setGpsLat] = useState(foyer?.gps_lat?.toString() || '');
  const [gps_lng, setGpsLng] = useState(foyer?.gps_lng?.toString() || '');
  const [carreau, setCarreau] = useState(foyer?.carreau || '');
  const [num_carreau, setNumCarreau] = useState(foyer?.num_carreau || '');

  // Logement
  const [type_logement, setTypeLogement] = useState(foyer?.type_logement || '');
  const [a_etage, setAEtage] = useState(foyer?.a_etage || false);
  const [nombre_etages, setNombreEtages] = useState(foyer?.nombre_etages?.toString() || '1');
  const [materiau_toiture, setMateriauToiture] = useState(foyer?.materiau_toiture || '');
  const [materiau_mur, setMateriauMur] = useState(foyer?.materiau_mur || '');
  const [materiau_plancher, setMateriauPlancher] = useState(foyer?.materiau_plancher || '');
  const [nombre_pieces, setNombrePieces] = useState(foyer?.nombre_pieces?.toString() || '');
  const [superficie_maison, setSuperficie] = useState(foyer?.superficie_maison?.toString() || '');
  const [photo_maison_url, setPhotoMaisonUrl] = useState(foyer?.photo_maison_url || '');
  const [statut_occupant, setStatutOccupant] = useState(foyer?.statut_occupant || 'Propriétaire');
  const [proprietaire_nom, setProprietaireNom] = useState(foyer?.proprietaire_nom || '');
  const [proprietaire_prenom, setProprietairePrenom] = useState(foyer?.proprietaire_prenom || '');
  const [proprietaire_cin, setProprietaireCin] = useState(foyer?.proprietaire_cin || '');
  const [proprietaire_telephone, setProprietaireTelephone] = useState(foyer?.proprietaire_telephone || '');
  const [proprietaire_adresse, setProprietaireAdresse] = useState(foyer?.proprietaire_adresse || '');
  const isProprietaire = statut_occupant === 'Propriétaire';

  // Eau & Assainissement
  const [eau_source, setEauSource] = useState(foyer?.eau_source || '');
  const [eau_potable, setEauPotable] = useState<boolean | undefined>(foyer?.eau_potable);
  const [eau_disponibilite, setEauDisponibilite] = useState(foyer?.eau_disponibilite || '');
  const [eau_temps_acces, setEauTempsAcces] = useState(foyer?.eau_temps_acces || '');
  const [toilette_type, setToiletteType] = useState(foyer?.toilette_type || '');
  const [lavage_mains, setLavageMains] = useState<boolean | undefined>(foyer?.lavage_mains);
  const [savon_disponible, setSavonDisponible] = useState<boolean | undefined>(foyer?.savon_disponible);
  const [evacuation_eaux_usees, setEvacEaux] = useState(foyer?.evacuation_eaux_usees || '');

  // Énergie & Déchets
  const [eclairage_source, setEclairageSource] = useState(foyer?.eclairage_source || '');
  const [a_electricite, setAElectricite] = useState<boolean | undefined>(foyer?.a_electricite);
  const [cuisson_source, setCuissonSource] = useState(foyer?.cuisson_source || '');
  const [dechets_mode, setDechetsMode] = useState(foyer?.dechets_mode || '');
  const [dechets_tri, setDechetsTri] = useState<boolean | undefined>(foyer?.dechets_tri);

  // Connectivité
  const [reseau_mobile, setReseauMobile] = useState(foyer?.reseau_mobile || '');
  const [acces_internet, setAccesInternet] = useState<boolean | undefined>(foyer?.acces_internet);
  const [internet_moyens, setInternetMoyens] = useState<string[]>(foyer?.internet_moyens || []);

  // Risques
  const [risque_naturel, setRisqueNaturel] = useState<boolean | undefined>(foyer?.risque_naturel);
  const [risques_types, setRisquesTypes] = useState<string[]>(foyer?.risques_types || []);
  const [catastrophe_subie, setCatastropheSubie] = useState<boolean | undefined>(foyer?.catastrophe_subie);
  const [catastrophe_types, setCatastropheTypes] = useState<string[]>(foyer?.catastrophe_types || []);
  const [difficulte_eau, setDifficulteEau] = useState<boolean | undefined>(foyer?.difficulte_eau);
  const [difficulte_electricite, setDifficulteElectricite] = useState<boolean | undefined>(foyer?.difficulte_electricite);
  const [conditions_vie, setConditionsVie] = useState(foyer?.conditions_vie || '');

  // Module Vulnérabilité du ménage
  const [est_vulnerable, setEstVulnerable] = useState<boolean | undefined>(foyer?.est_vulnerable);
  const [vulnerabilite_raisons, setVulnerabiliteRaisons] = useState<string[]>(foyer?.vulnerabilite_raisons || []);
  const [vulnerabilite_precision, setVulnerabilitePrecision] = useState(foyer?.vulnerabilite_precision || '');
  const [nb_personnes_agees, setNbPersonnesAgees] = useState(foyer?.nb_personnes_agees?.toString() || '0');
  const [nb_personnes_handicapees, setNbPersonnesHandicapees] = useState(foyer?.nb_personnes_handicapees?.toString() || '0');
  const [nb_orphelins, setNbOrphelins] = useState(foyer?.nb_orphelins?.toString() || '0');
  const [nb_enfants_moins5, setNbEnfantsMoins5] = useState(foyer?.nb_enfants_moins5?.toString() || '0');
  const [nb_femmes_enceintes, setNbFemmesEnceintes] = useState(foyer?.nb_femmes_enceintes?.toString() || '0');
  const [nb_maladies_chroniques, setNbMaladiesChroniques] = useState(foyer?.nb_maladies_chroniques?.toString() || '0');
  const [difficulte_alimentaire, setDifficulteAlimentaire] = useState<boolean | undefined>(foyer?.difficulte_alimentaire);
  const [frequence_difficulte_alim, setFrequenceDifficulteAlim] = useState(foyer?.frequence_difficulte_alim || '');
  const [nb_repas_jour, setNbRepasJour] = useState(foyer?.nb_repas_jour || '');
  const [affecte_catastrophe, setAffecteCatastrophe] = useState<boolean | undefined>(foyer?.affecte_catastrophe);
  const [catastrophe_nat_types, setCatastropheNatTypes] = useState<string[]>(foyer?.catastrophe_nat_types || []);
  const [annee_derniere_catastrophe, setAnneeDerniereCatastrophe] = useState(foyer?.annee_derniere_catastrophe?.toString() || '');
  const [niveau_degats, setNiveauDegats] = useState(foyer?.niveau_degats || '');
  const [aide_recue, setAideRecue] = useState<boolean | undefined>(foyer?.aide_recue);
  const [aide_catastrophe_concernee, setAideCatastropheConcernee] = useState(foyer?.aide_catastrophe_concernee || '');
  const [aide_annee_intervention, setAideAnneeIntervention] = useState(foyer?.aide_annee_intervention?.toString() || '');
  const [aide_organismes, setAideOrganismes] = useState<string[]>(foyer?.aide_organismes || []);
  const [aide_nom_organisme, setAideNomOrganisme] = useState(foyer?.aide_nom_organisme || '');
  const [aide_types, setAideTypes] = useState<string[]>(foyer?.aide_types || []);
  const [aide_precision, setAidePrecision] = useState(foyer?.aide_precision || '');
  const [aide_suffisante, setAideSuffisante] = useState(foyer?.aide_suffisante || '');
  const [necessite_appui, setNecessiteAppui] = useState<boolean | undefined>(foyer?.necessite_appui);
  const [logement_necessite_travaux, setLogementNecessiteTravaux] = useState<boolean | undefined>(foyer?.logement_necessite_travaux);
  const [travaux_types, setTravauxTypes] = useState<string[]>(foyer?.travaux_types || []);
  const [travaux_parties, setTravauxParties] = useState<string[]>(foyer?.travaux_parties || []);
  const [travaux_urgence, setTravauxUrgence] = useState(foyer?.travaux_urgence || '');
  const [travaux_commentaire, setTravauxCommentaire] = useState(foyer?.travaux_commentaire || '');
  const [travaux_photo_url, setTravauxPhotoUrl] = useState(foyer?.travaux_photo_url || '');
  const [uploadingTravauxPhoto, setUploadingTravauxPhoto] = useState(false);
  const [niveau_vulnerabilite_global, setNiveauVulnerabiliteGlobal] = useState(foyer?.niveau_vulnerabilite_global || '');
  const [observations_complementaires, setObservationsComplementaires] = useState(foyer?.observations_complementaires || '');

  const toggleArr = (arr: string[], val: string) => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  const isLastTab = tab === TAB_ORDER[TAB_ORDER.length - 1];

  useEffect(() => {
    if (!foyer) genCodeMenage().then(code => { setCodeMenage(code); setLoadingCode(false); });
  }, [foyer]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image trop grande (max 5 Mo)'); return; }
    setUploadingPhoto(true);
    const ext = file.name.split('.').pop();
    const path = `maisons/${code_menage}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('Photos').upload(path, file, { upsert: true });
    if (error) { alert('Erreur upload : ' + error.message); setUploadingPhoto(false); return; }
    const { data: urlData } = supabase.storage.from('Photos').getPublicUrl(path);
    setPhotoMaisonUrl(urlData.publicUrl);
    setUploadingPhoto(false);
  };

  const handleTravauxPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image trop grande (max 5 Mo)'); return; }
    setUploadingTravauxPhoto(true);
    const ext = file.name.split('.').pop();
    const path = `travaux/${code_menage}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('Photos').upload(path, file, { upsert: true });
    if (error) { alert('Erreur upload : ' + error.message); setUploadingTravauxPhoto(false); return; }
    const { data: urlData } = supabase.storage.from('Photos').getPublicUrl(path);
    setTravauxPhotoUrl(urlData.publicUrl);
    setUploadingTravauxPhoto(false);
  };

  // Validation par onglet — bloque le passage si données importantes manquantes
  const validateTab = (): string | null => {
    if (tab === 'general') {
      if (!fokontany.trim()) return 'Le fokontany est obligatoire.';
    }
    if (tab === 'logement') {
      if (!type_logement) return 'Le type de logement est obligatoire.';
      if (!statut_occupant) return "Le statut de l'occupant est obligatoire.";
    }
    if (tab === 'eau_assainissement') {
      if (!eau_source) return "La source d'eau est obligatoire.";
      if (eau_potable === undefined) return "Veuillez préciser si l'eau est potable.";
      if (!toilette_type) return 'Le type de toilette est obligatoire.';
    }
    if (tab === 'energie_dechets') {
      if (!eclairage_source) return "La source d'éclairage est obligatoire.";
      if (a_electricite === undefined) return "Veuillez préciser si le ménage dispose d'électricité.";
      if (!cuisson_source) return 'La source de cuisson est obligatoire.';
      if (!dechets_mode) return "Le mode d'élimination des déchets est obligatoire.";
    }
    if (tab === 'connectivite') {
      if (!reseau_mobile) return 'La couverture réseau est obligatoire.';
      if (acces_internet === undefined) return "Veuillez préciser l'accès à Internet.";
    }
    if (tab === 'risques') {
      if (risque_naturel === undefined) return 'Veuillez préciser si le ménage est exposé à un risque.';
      if (catastrophe_subie === undefined) return 'Veuillez préciser si le ménage a subi une catastrophe.';
      if (!conditions_vie) return 'Les conditions de vie sont obligatoires.';
    }
    if (tab === 'vulnerabilite') {
      if (est_vulnerable === undefined) return 'Veuillez préciser si le ménage est vulnérable.';
      if (difficulte_alimentaire === undefined) return 'Veuillez préciser les difficultés alimentaires.';
      if (affecte_catastrophe === undefined) return 'Veuillez préciser si le ménage a été affecté par une catastrophe.';
      if (logement_necessite_travaux === undefined) return 'Veuillez préciser si le logement nécessite des travaux.';
      if (!niveau_vulnerabilite_global) return 'Le niveau global de vulnérabilité est obligatoire.';
    }
    return null;
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateTab();
    if (err) { alert(err); return; }
    const idx = TAB_ORDER.indexOf(tab);
    if (idx < TAB_ORDER.length - 1) setTab(TAB_ORDER[idx + 1]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateTab();
    if (err) { alert(err); return; }
    setSaving(true);
    await onSave({
      code_menage, statut,
      adresse: adresse || undefined, fokontany, commune: commune || undefined, district: district || undefined,
      gps_lat: gps_lat ? parseFloat(gps_lat) : undefined, gps_lng: gps_lng ? parseFloat(gps_lng) : undefined,
      carreau: carreau || undefined, num_carreau: num_carreau || undefined,
      type_logement: type_logement || undefined, a_etage, nombre_etages: a_etage ? (parseInt(nombre_etages) || 1) : undefined,
      materiau_toiture: materiau_toiture || undefined, materiau_mur: materiau_mur || undefined, materiau_plancher: materiau_plancher || undefined,
      nombre_pieces: nombre_pieces ? parseInt(nombre_pieces) : undefined, superficie_maison: superficie_maison ? parseFloat(superficie_maison) : undefined,
      photo_maison_url: photo_maison_url || undefined,
      statut_occupant,
      proprietaire_nom: !isProprietaire ? (proprietaire_nom || undefined) : undefined,
      proprietaire_prenom: !isProprietaire ? (proprietaire_prenom || undefined) : undefined,
      proprietaire_cin: !isProprietaire ? (proprietaire_cin || undefined) : undefined,
      proprietaire_telephone: !isProprietaire ? (proprietaire_telephone || undefined) : undefined,
      proprietaire_adresse: !isProprietaire ? (proprietaire_adresse || undefined) : undefined,
      eau_source: eau_source || undefined, eau_potable, eau_disponibilite: eau_disponibilite || undefined, eau_temps_acces: eau_temps_acces || undefined,
      toilette_type: toilette_type || undefined, lavage_mains, savon_disponible, evacuation_eaux_usees: evacuation_eaux_usees || undefined,
      eclairage_source: eclairage_source || undefined, a_electricite, cuisson_source: cuisson_source || undefined,
      dechets_mode: dechets_mode || undefined, dechets_tri,
      reseau_mobile: reseau_mobile || undefined, acces_internet, internet_moyens,
      risque_naturel, risques_types, catastrophe_subie, catastrophe_types,
      difficulte_eau, difficulte_electricite, conditions_vie: conditions_vie || undefined,
      est_vulnerable, vulnerabilite_raisons, vulnerabilite_precision: vulnerabilite_precision || undefined,
      nb_personnes_agees: parseInt(nb_personnes_agees) || 0,
      nb_personnes_handicapees: parseInt(nb_personnes_handicapees) || 0,
      nb_orphelins: parseInt(nb_orphelins) || 0,
      nb_enfants_moins5: parseInt(nb_enfants_moins5) || 0,
      nb_femmes_enceintes: parseInt(nb_femmes_enceintes) || 0,
      nb_maladies_chroniques: parseInt(nb_maladies_chroniques) || 0,
      difficulte_alimentaire, frequence_difficulte_alim: frequence_difficulte_alim || undefined, nb_repas_jour: nb_repas_jour || undefined,
      affecte_catastrophe, catastrophe_nat_types,
      annee_derniere_catastrophe: annee_derniere_catastrophe ? parseInt(annee_derniere_catastrophe) : undefined,
      niveau_degats: niveau_degats || undefined,
      aide_recue, aide_catastrophe_concernee: aide_catastrophe_concernee || undefined,
      aide_annee_intervention: aide_annee_intervention ? parseInt(aide_annee_intervention) : undefined,
      aide_organismes, aide_nom_organisme: aide_nom_organisme || undefined, aide_types,
      aide_precision: aide_precision || undefined, aide_suffisante: aide_suffisante || undefined,
      necessite_appui,
      logement_necessite_travaux, travaux_types, travaux_parties,
      travaux_urgence: travaux_urgence || undefined, travaux_commentaire: travaux_commentaire || undefined,
      travaux_photo_url: travaux_photo_url || undefined,
      niveau_vulnerabilite_global: niveau_vulnerabilite_global || undefined,
      observations_complementaires: observations_complementaires || undefined,
    });
    setSaving(false);
  };

  const TABS = [
    { key: 'general', label: 'Général', icon: MapPin },
    { key: 'logement', label: 'Logement', icon: Building2 },
    { key: 'eau_assainissement', label: 'Eau & Assainissement', icon: Droplets },
    { key: 'energie_dechets', label: 'Énergie & Déchets', icon: Trash2 },
    { key: 'connectivite', label: 'Connectivité', icon: Wifi },
    { key: 'risques', label: 'Risques & Vie', icon: AlertTriangle },
    { key: 'vulnerabilite', label: 'Vulnérabilité', icon: HeartCrack },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl"><Home className="h-5 w-5 text-white" /></div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{foyer ? 'Modifier le foyer' : 'Nouveau foyer'}</h2>
              <p className="text-xs text-slate-500">Code : {loadingCode ? <span className="text-slate-400 italic">génération…</span> : <span className="font-mono font-bold text-indigo-600">{code_menage}</span>}</p>
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
            const isLocked = !foyer && idx > curIdx;
            return (
              <button key={key} type="button" onClick={() => { if (!isLocked) setTab(key as Tab); }} disabled={isLocked}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition shrink-0 ${isActive ? 'border-indigo-600 text-indigo-700' : isLocked ? 'border-transparent text-slate-300 cursor-not-allowed' : isDone ? 'border-transparent text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <Icon className="h-3.5 w-3.5" />{label}{isDone && ' ✓'}
              </button>
            );
          })}
        </div>

        {/* Form */}
        <form onSubmit={isLastTab ? handleSubmit : handleNext} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">

            {/* ── GÉNÉRAL ── */}
            {tab === 'general' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-2">Statut du foyer</label>
                  <div className="flex gap-3">
                    {(['Actif', 'Dissous', 'Déplacé'] as const).map(s => (
                      <label key={s} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm font-semibold transition ${statut === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                        <input type="radio" className="hidden" checked={statut === s} onChange={() => setStatut(s)} />{s}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Adresse physique</label>
                  <input value={adresse} onChange={e => setAdresse(e.target.value)} placeholder="Ex: Lot III G 12, Rue de l'Église" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Fokontany <span className="text-red-500">*</span></label>
                    <input value={fokontany} onChange={e => setFokontany(e.target.value)} placeholder="Ex: Androranga" required className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Commune</label>
                    <input value={commune} onChange={e => setCommune(e.target.value)} placeholder="Ex: Toamasina" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase block mb-1">District</label>
                    <input value={district} onChange={e => setDistrict(e.target.value)} placeholder="Ex: Toamasina II" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-bold text-slate-600 uppercase block mb-1">GPS Latitude</label><input value={gps_lat} onChange={e => setGpsLat(e.target.value)} placeholder="-18.9100" type="number" step="any" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" /></div>
                  <div><label className="text-xs font-bold text-slate-600 uppercase block mb-1">GPS Longitude</label><input value={gps_lng} onChange={e => setGpsLng(e.target.value)} placeholder="47.5250" type="number" step="any" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-bold text-slate-600 uppercase block mb-1">Secteur / Carreau</label><input value={carreau} onChange={e => setCarreau(e.target.value)} placeholder="Ex: Tsararivotra" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" /></div>
                  <div><label className="text-xs font-bold text-slate-600 uppercase block mb-1">Numéro de carreau</label><input value={num_carreau} onChange={e => setNumCarreau(e.target.value)} placeholder="Ex: CAR-12" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" /></div>
                </div>
              </div>
            )}

            {/* ── LOGEMENT ── */}
            {tab === 'logement' && (
              <div className="space-y-5">
                <ChoiceGroup label="Type de logement" options={TYPES_LOGEMENT} value={type_logement} onChange={setTypeLogement} required />
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-1.5">Maison à étage ?</label>
                  <div className="flex gap-3 items-center">
                    <div className="flex gap-2">
                      {[{ v: false, l: 'Non' }, { v: true, l: 'Oui' }].map(({ v, l }) => (
                        <label key={l} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border cursor-pointer text-sm font-semibold transition ${a_etage === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                          <input type="radio" className="hidden" checked={a_etage === v} onChange={() => setAEtage(v)} />{l}
                        </label>
                      ))}
                    </div>
                    {a_etage && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Nombre d'étages :</span>
                        <input type="number" min="1" max="10" value={nombre_etages} onChange={e => setNombreEtages(e.target.value)} className="w-16 border border-slate-200 rounded-lg px-2 py-2 text-sm focus:border-indigo-500 outline-none text-center" />
                      </div>
                    )}
                  </div>
                </div>
                <ChoiceGroup label="Matériau de toiture" options={MATERIAUX_TOITURE} value={materiau_toiture} onChange={setMateriauToiture} />
                <ChoiceGroup label="Matériau de mur" options={MATERIAUX_MUR} value={materiau_mur} onChange={setMateriauMur} />
                <ChoiceGroup label="Matériau de plancher" options={MATERIAUX_PLANCHER} value={materiau_plancher} onChange={setMateriauPlancher} />
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-bold text-slate-600 uppercase block mb-1">Nombre de pièces</label><input value={nombre_pieces} onChange={e => setNombrePieces(e.target.value)} placeholder="Ex: 3" type="number" min="1" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" /></div>
                  <div><label className="text-xs font-bold text-slate-600 uppercase block mb-1">Superficie (m²)</label><input value={superficie_maison} onChange={e => setSuperficie(e.target.value)} placeholder="Ex: 85" type="number" min="1" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" /></div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <ChoiceGroup label="Statut de l'occupant" options={STATUTS_OCCUPANT} value={statut_occupant} onChange={setStatutOccupant} required />
                  {!isProprietaire && statut_occupant && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 mt-3">
                      <p className="text-xs text-amber-700 font-semibold flex items-center gap-1.5"><Info className="h-3.5 w-3.5" />Informations du propriétaire (à compléter ultérieurement si non disponibles)</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs font-semibold text-amber-700 uppercase block mb-1">Nom</label><input value={proprietaire_nom} onChange={e => setProprietaireNom(e.target.value)} placeholder="Nom" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" /></div>
                        <div><label className="text-xs font-semibold text-amber-700 uppercase block mb-1">Prénom</label><input value={proprietaire_prenom} onChange={e => setProprietairePrenom(e.target.value)} placeholder="Prénom" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs font-semibold text-amber-700 uppercase block mb-1">CIN</label><input value={proprietaire_cin} onChange={e => setProprietaireCin(e.target.value)} placeholder="CIN" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white font-mono" /></div>
                        <div><label className="text-xs font-semibold text-amber-700 uppercase block mb-1">Téléphone</label><input value={proprietaire_telephone} onChange={e => setProprietaireTelephone(e.target.value)} placeholder="+261 34..." className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" /></div>
                      </div>
                      <div><label className="text-xs font-semibold text-amber-700 uppercase block mb-1">Adresse du propriétaire</label><input value={proprietaire_adresse} onChange={e => setProprietaireAdresse(e.target.value)} placeholder="Adresse" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" /></div>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Image className="h-3.5 w-3.5" />Photo de la maison</h3>
                  {photo_maison_url ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 h-40">
                      <img src={photo_maison_url} alt="Maison" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setPhotoMaisonUrl('')} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 hover:bg-red-700 transition shadow-md"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <label className={`flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl cursor-pointer transition ${uploadingPhoto ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}>
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
                      {uploadingPhoto ? <><Loader2 className="h-6 w-6 text-indigo-600 animate-spin mb-2" /><p className="text-xs text-indigo-600 font-semibold">Téléversement…</p></> : <><Upload className="h-6 w-6 text-slate-300 mb-2" /><p className="text-xs font-semibold text-slate-500">Cliquer pour téléverser</p></>}
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* ── EAU & ASSAINISSEMENT ── */}
            {tab === 'eau_assainissement' && (
              <div className="space-y-5">
                <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg p-3">Module Habitat & Conditions de vie — rempli une seule fois, partagé à tous les membres du foyer.</p>
                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">1. Approvisionnement en eau</h3>
                <ChoiceGroup label="Source principale d'eau" options={EAU_SOURCES} value={eau_source} onChange={setEauSource} required />
                <YesNo label="Cette source est-elle potable ?" value={eau_potable} onChange={setEauPotable} />
                <ChoiceGroup label="Disponibilité de l'eau" options={EAU_DISPO} value={eau_disponibilite} onChange={setEauDisponibilite} cols={3} />
                <ChoiceGroup label="Temps moyen pour obtenir de l'eau" options={EAU_TEMPS} value={eau_temps_acces} onChange={setEauTempsAcces} cols={3} />

                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-t border-slate-100 pt-4">2. Assainissement</h3>
                <ChoiceGroup label="Type principal de toilette" options={TOILETTE_TYPES} value={toilette_type} onChange={setToiletteType} required />
                <YesNo label="Point de lavage des mains disponible ?" value={lavage_mains} onChange={setLavageMains} />
                <YesNo label="Savon disponible lors de la visite ?" value={savon_disponible} onChange={setSavonDisponible} />
                <ChoiceGroup label="Évacuation des eaux usées" options={EVAC_EAUX} value={evacuation_eaux_usees} onChange={setEvacEaux} />
              </div>
            )}

            {/* ── ÉNERGIE & DÉCHETS ── */}
            {tab === 'energie_dechets' && (
              <div className="space-y-5">
                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">3. Électricité et énergie</h3>
                <YesNo label="Le ménage dispose-t-il d'électricité ?" value={a_electricite} onChange={setAElectricite} />
                <ChoiceGroup label="Source principale d'éclairage" options={ECLAIRAGE_SOURCES} value={eclairage_source} onChange={setEclairageSource} required cols={3} />
                <ChoiceGroup label="Source principale pour la cuisson" options={CUISSON_SOURCES} value={cuisson_source} onChange={setCuissonSource} required cols={3} />

                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-t border-slate-100 pt-4">4. Gestion des déchets</h3>
                <ChoiceGroup label="Mode principal d'élimination des déchets" options={DECHETS_MODES} value={dechets_mode} onChange={setDechetsMode} required />
                <YesNo label="Le ménage pratique-t-il le tri des déchets ?" value={dechets_tri} onChange={setDechetsTri} />
              </div>
            )}

            {/* ── CONNECTIVITÉ ── */}
            {tab === 'connectivite' && (
              <div className="space-y-5">
                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">5. Connectivité et communication</h3>
                <ChoiceGroup label="Couverture du réseau mobile" options={RESEAU_NIVEAUX} value={reseau_mobile} onChange={setReseauMobile} required cols={3} />
                <YesNo label="Accès à Internet ?" value={acces_internet} onChange={setAccesInternet} />
                {acces_internet && (
                  <CheckGroup label="Moyen principal d'accès à Internet" options={INTERNET_MOYENS} values={internet_moyens} onToggle={v => setInternetMoyens(prev => toggleArr(prev, v))} />
                )}
              </div>
            )}

            {/* ── RISQUES & CONDITIONS DE VIE ── */}
            {tab === 'risques' && (
              <div className="space-y-5">
                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">6. Risques et environnement</h3>
                <YesNo label="Le ménage est-il exposé à un risque naturel ?" value={risque_naturel} onChange={setRisqueNaturel} />
                {risque_naturel && (
                  <CheckGroup label="Quels risques ?" options={RISQUES_TYPES} values={risques_types} onToggle={v => setRisquesTypes(prev => toggleArr(prev, v))} />
                )}
                <YesNo label="A subi une catastrophe au cours des 5 dernières années ?" value={catastrophe_subie} onChange={setCatastropheSubie} />
                {catastrophe_subie && (
                  <CheckGroup label="Type de catastrophe subie" options={CATASTROPHE_TYPES} values={catastrophe_types} onToggle={v => setCatastropheTypes(prev => toggleArr(prev, v))} />
                )}

                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-t border-slate-100 pt-4">7. Indicateurs de vulnérabilité</h3>
                <YesNo label="Difficultés régulières d'accès à l'eau ?" value={difficulte_eau} onChange={setDifficulteEau} />
                <YesNo label="Coupures d'électricité régulières ?" value={difficulte_electricite} onChange={setDifficulteElectricite} />
                <ChoiceGroup label="Le ménage estime ses conditions de vie :" options={CONDITIONS_VIE} value={conditions_vie} onChange={setConditionsVie} required cols={3} />
              </div>
            )}

            {/* ── VULNÉRABILITÉ DU MÉNAGE ── */}
            {tab === 'vulnerabilite' && (
              <div className="space-y-5">
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-3">Module Vulnérabilité du ménage — rempli une seule fois, concerne l'ensemble du foyer.</p>

                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">1. Situation de vulnérabilité</h3>
                <YesNo label="Le ménage est-il considéré comme vulnérable ?" value={est_vulnerable} onChange={setEstVulnerable} />
                {est_vulnerable && (
                  <>
                    <CheckGroup label="Raisons de vulnérabilité" options={VULNERABILITE_RAISONS} values={vulnerabilite_raisons} onToggle={v => setVulnerabiliteRaisons(prev => toggleArr(prev, v))} />
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Précision</label>
                      <input value={vulnerabilite_precision} onChange={e => setVulnerabilitePrecision(e.target.value)} placeholder="Préciser..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                    </div>
                  </>
                )}

                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-t border-slate-100 pt-4">2. Personnes vulnérables dans le ménage</h3>
                <div className="grid grid-cols-3 gap-3">
                  <NumberInput label="Pers. âgées (60+)" value={nb_personnes_agees} onChange={setNbPersonnesAgees} />
                  <NumberInput label="Pers. handicapées" value={nb_personnes_handicapees} onChange={setNbPersonnesHandicapees} />
                  <NumberInput label="Orphelins" value={nb_orphelins} onChange={setNbOrphelins} />
                  <NumberInput label="Enfants -5 ans" value={nb_enfants_moins5} onChange={setNbEnfantsMoins5} />
                  <NumberInput label="Femmes enceintes" value={nb_femmes_enceintes} onChange={setNbFemmesEnceintes} />
                  <NumberInput label="Maladies chroniques" value={nb_maladies_chroniques} onChange={setNbMaladiesChroniques} />
                </div>

                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-t border-slate-100 pt-4">3. Sécurité alimentaire</h3>
                <YesNo label="Le ménage rencontre-t-il des difficultés pour se nourrir ?" value={difficulte_alimentaire} onChange={setDifficulteAlimentaire} />
                {difficulte_alimentaire && (
                  <ChoiceGroup label="Fréquence des difficultés alimentaires" options={FREQUENCE_DIFFICULTE} value={frequence_difficulte_alim} onChange={setFrequenceDifficulteAlim} cols={3} />
                )}
                <ChoiceGroup label="Nombre moyen de repas par jour" options={REPAS_JOUR} value={nb_repas_jour} onChange={setNbRepasJour} cols={3} />

                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-t border-slate-100 pt-4">4. Exposition aux catastrophes naturelles</h3>
                <YesNo label="Le ménage a-t-il été affecté par une catastrophe naturelle au cours des 5 dernières années ?" value={affecte_catastrophe} onChange={setAffecteCatastrophe} />
                {affecte_catastrophe && (
                  <>
                    <CheckGroup label="Type de catastrophe" options={CATASTROPHES_NAT} values={catastrophe_nat_types} onToggle={v => setCatastropheNatTypes(prev => toggleArr(prev, v))} />
                    <div className="grid grid-cols-2 gap-3">
                      <NumberInput label="Année de la dernière catastrophe" value={annee_derniere_catastrophe} onChange={setAnneeDerniereCatastrophe} />
                      <ChoiceGroup label="Niveau des dégâts subis" options={NIVEAUX_DEGATS} value={niveau_degats} onChange={setNiveauDegats} cols={2} />
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-500 uppercase">4.1 Aides reçues après catastrophe</p>
                      <YesNo label="Le ménage a-t-il déjà bénéficié d'une aide suite à une catastrophe naturelle ?" value={aide_recue} onChange={setAideRecue} />
                      {aide_recue && (
                        <>
                          <ChoiceGroup label="Catastrophe concernée" options={CATASTROPHES_NAT} value={aide_catastrophe_concernee} onChange={setAideCatastropheConcernee} cols={3} />
                          <NumberInput label="Année de l'intervention" value={aide_annee_intervention} onChange={setAideAnneeIntervention} />
                          <CheckGroup label="Organisme ayant apporté l'aide" options={ORGANISMES_AIDE} values={aide_organismes} onToggle={v => setAideOrganismes(prev => toggleArr(prev, v))} />
                          <div>
                            <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Nom de l'organisme</label>
                            <input value={aide_nom_organisme} onChange={e => setAideNomOrganisme(e.target.value)} placeholder="Nom" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                          </div>
                          <CheckGroup label="Type d'aide reçue" options={TYPES_AIDE} values={aide_types} onToggle={v => setAideTypes(prev => toggleArr(prev, v))} />
                          <div>
                            <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Précision sur l'aide reçue</label>
                            <textarea value={aide_precision} onChange={e => setAidePrecision(e.target.value)} rows={2} placeholder="Détails..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none resize-none" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-600 uppercase block mb-2">L'aide reçue était-elle suffisante ?</label>
                            <div className="flex gap-2 flex-wrap">
                              {['Oui', 'Partiellement', 'Non'].map(s => (
                                <label key={s} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${aide_suffisante === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                                  <input type="radio" className="hidden" checked={aide_suffisante === s} onChange={() => setAideSuffisante(s)} />{s}
                                </label>
                              ))}
                            </div>
                          </div>
                          <YesNo label="Le ménage nécessite-t-il encore un appui aujourd'hui ?" value={necessite_appui} onChange={setNecessiteAppui} />
                        </>
                      )}
                    </div>
                  </>
                )}

                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-t border-slate-100 pt-4">5. État du logement</h3>
                <YesNo label="La maison nécessite-t-elle des travaux ?" value={logement_necessite_travaux} onChange={setLogementNecessiteTravaux} />
                {logement_necessite_travaux && (
                  <>
                    <CheckGroup label="Type d'intervention nécessaire" options={TRAVAUX_TYPES} values={travaux_types} onToggle={v => setTravauxTypes(prev => toggleArr(prev, v))} />
                    <CheckGroup label="Partie concernée" options={TRAVAUX_PARTIES} values={travaux_parties} onToggle={v => setTravauxParties(prev => toggleArr(prev, v))} />
                    <UrgencyButtons label="Niveau d'urgence" value={travaux_urgence} onChange={setTravauxUrgence} />
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Commentaire de l'agent recenseur</label>
                      <textarea value={travaux_commentaire} onChange={e => setTravauxCommentaire(e.target.value)} rows={2} placeholder="Observations..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none resize-none" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Photo de la maison (optionnel)</label>
                      {travaux_photo_url ? (
                        <div className="relative rounded-xl overflow-hidden border border-slate-200 h-32">
                          <img src={travaux_photo_url} alt="Travaux" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => setTravauxPhotoUrl('')} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      ) : (
                        <label className={`flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-xl cursor-pointer transition ${uploadingTravauxPhoto ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}>
                          <input type="file" accept="image/*" className="hidden" onChange={handleTravauxPhotoUpload} disabled={uploadingTravauxPhoto} />
                          {uploadingTravauxPhoto ? <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" /> : <Upload className="h-5 w-5 text-slate-300" />}
                        </label>
                      )}
                    </div>
                  </>
                )}

                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-t border-slate-100 pt-4">6. Priorité du ménage</h3>
                <UrgencyButtons label="Niveau global de vulnérabilité" value={niveau_vulnerabilite_global} onChange={setNiveauVulnerabiliteGlobal} />
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Observations complémentaires</label>
                  <textarea value={observations_complementaires} onChange={e => setObservationsComplementaires(e.target.value)} rows={3} placeholder="Notes additionnelles..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none resize-none" />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-5 border-t border-slate-100 sticky bottom-0 bg-white">
            {tab === 'general' ? (
              <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Annuler</button>
            ) : (
              <button type="button" onClick={() => { const idx = TAB_ORDER.indexOf(tab); if (idx > 0) setTab(TAB_ORDER[idx - 1]); }} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">← Précédent</button>
            )}
            <button type="submit" disabled={saving || loadingCode || uploadingPhoto} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition flex items-center justify-center gap-2 ${isLastTab ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:opacity-50`}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</> : isLastTab ? (foyer ? 'Enregistrer les modifications' : 'Créer le foyer') : 'Valider →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
