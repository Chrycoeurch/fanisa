import React, { useState, useEffect } from 'react';
import { Foyer } from '../types';
import { supabase } from '../lib/supabase';
import { X, Home, MapPin, Image, Loader2, Upload, Building2, UserCog, Droplets, Trash2, Wifi, AlertTriangle, Info, HeartCrack, Tv, Beef } from 'lucide-react';

interface Props {
  foyer?: Foyer;
  onClose: () => void;
  onSave: (foyer: Partial<Foyer>) => Promise<void>;
}

const ETATS_LOGEMENT = ['Bon', 'Moyen', 'Dégradé', 'Très dégradé'];
const APPARTENANCE_MAISON = ['La famille élargie / héritage non partagé', 'Une autre personne (non membre du ménage)', 'Employeur / entreprise', 'État / Commune', 'Ne sait pas'];
const TYPES_LOGEMENT = ['Maison traditionnelle', 'Villa', 'Appartement', 'Case en bois', 'Studio', 'Autres'];
const MATERIAUX_TOITURE = ['Tôle', 'Tuile', 'Chaume / Ravinala', 'Béton', 'Bois', 'Autres'];
const MATERIAUX_MUR = ['Brique', 'Parpaing / Béton', 'Bois', 'Terre battue', 'Ravinala / Falafa', 'Tôle', 'Autres'];
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
const INTERNET_MOYENS = ['Donnees mobiles', 'Fibre optique', 'ADSL', 'Satellite', 'Starlink', 'Wi-Fi partage', 'Aucun'];
const OPERATEURS_MOBILE_MONEY = ['MVola', 'Orange Money', 'Airtel Money', 'BNI Mobile', 'BRED Mobile'];
const RISQUES_TYPES = ['Inondation', 'Cyclone', 'Glissement de terrain', 'Secheresse', 'Erosion', 'Incendie', 'Autre'];
const CATASTROPHE_TYPES = ['Inondation', 'Cyclone', 'Incendie', 'Secheresse', 'Autre'];
const CONDITIONS_VIE = ['Tres bonnes', 'Bonnes', 'Moyennes', 'Difficiles', 'Tres difficiles'];

// Module Vulnerabilite du menage
const VULNERABILITE_RAISONS = ['Absence de revenu stable', 'Chomage du chef de menage', 'Personne agee vivant seule', "Presence d'une personne handicapee", "Presence d'une maladie chronique grave", 'Femme chef de menage seule', 'Veuf / Veuve sans soutien', 'Famille nombreuse (5 enfants ou plus)', 'Orphelin(s) a charge', 'Insecurite alimentaire', 'Victime de catastrophe naturelle', 'Autre'];
const FREQUENCE_DIFFICULTE = ['Jamais', 'Rarement', 'Parfois', 'Souvent', 'Tres souvent'];
const REPAS_JOUR = ['1 repas', '2 repas', '3 repas ou plus'];
const CATASTROPHES_NAT = ['Cyclone', 'Inondation', 'Incendie', 'Glissement de terrain', 'Secheresse', 'Autre'];
const NIVEAUX_DEGATS = ['Faible', 'Modere', 'Important', 'Total'];
const ORGANISMES_AIDE = ['Fokontany', 'Commune', 'District', 'BNGRC', 'FID', 'Croix-Rouge Malagasy', 'ONG nationale', 'ONG internationale', 'Association', 'Eglise', 'Entreprise privee', 'Autre'];
const TYPES_AIDE = ['Vivres alimentaires', 'Riz', 'Huile', 'Eau potable', "Kit d'hygiene", 'Kit scolaire', 'Couvertures', 'Vetements', 'Ustensiles de cuisine', 'Materiaux de construction', 'Toles', 'Bois', 'Argent / Transfert monetaire', 'Relogement temporaire', 'Assistance medicale', 'Semences agricoles', 'Autre'];
const TRAVAUX_TYPES = ['Aucune intervention', 'Reparation mineure', 'Renovation partielle', 'Renovation importante', 'Reconstruction complete'];
const TRAVAUX_PARTIES = ['Toiture', 'Murs', 'Sol', 'Portes', 'Fenetres', 'Charpente', 'Installation electrique', 'Installation sanitaire', 'Ensemble de la maison'];

// Équipements & biens (Kobo §11)
const BIENS_MENAGE = ['Télévision', 'Réfrigérateur', 'Congélateur', 'Téléphone mobile', 'Ordinateur', 'Radio', 'Cuisinière à gaz', 'Cuisinière électrique', 'Machine à laver', 'Climatiseur', 'Ventilateur', 'Groupe électrogène', 'Panneau solaire', 'Moto / scooter', 'Voiture', 'Cyclo-pousse / pousse-pousse', 'Bajaj / tuk-tuk', 'Aucun'];
const MOYENS_TRANSPORT = ['À pied', 'Vélo', 'Moto / scooter', 'Voiture', 'Taxi-brousse', 'Transport en commun', 'Cyclo-pousse / pousse-pousse', 'Bajaj / tuk-tuk', 'Autre', 'Aucun'];
const USAGES_VEHICULES = ['Usage personnel / familial', 'Loué à une autre personne', 'Conduit par un membre du ménage pour gagner sa vie', 'Transport de marchandises / commerce', 'Autre', 'Ne sait pas'];
const TYPES_AIDE_MENAGE = ['Cash / transfert monétaire', 'Vivres / denrées', 'Santé / soins', 'Éducation / scolarité', 'Logement / hébergement', 'Divers matériaux de construction', 'Autre'];
const DONATEURS_AIDE = ['État / programme public', 'FID', 'BNGRC', 'Croix Rouge', 'PAM', 'Banque mondiale', 'ONG', 'Association locale', 'Église / organisation religieuse', 'Donateur privé / individu', 'Organisation internationale', 'Autre'];

// Élevage (Kobo §12)
const TYPES_ELEVAGE = ['Poules / poulets', 'Canards', 'Oies', 'Dindes', 'Porcs', 'Zébus / bovins', 'Chèvres / moutons', 'Lapins', 'Poissons (pisciculture)', 'Abeilles (apiculture)', 'Autre'];
const BUTS_ELEVAGE = ['Consommation familiale', 'Vente', 'Épargne / cérémonies', 'Autre'];
const LIEUX_ELEVAGE = ['Sur la parcelle du ménage (cour)', 'Ailleurs dans le Fokontany', 'Hors du Fokontany', 'Autre'];

async function genCodeMenage(fokontany: string): Promise<string> {
  if (!fokontany.trim()) {
    throw new Error('Veuillez d\'abord saisir le fokontany avant de générer un code.');
  }
  const { data, error } = await supabase.rpc('pick_next_carnet', { p_fokontany: fokontany.trim() });
  if (error || !data) {
    throw new Error(`Plus de carnets disponibles pour le fokontany « ${fokontany} ». Contactez l'administrateur.`);
  }
  return data as string;
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

type Tab = 'general' | 'logement' | 'eau_assainissement' | 'energie_dechets' | 'connectivite' | 'risques' | 'equipements' | 'elevage';
const TAB_ORDER: Tab[] = ['general', 'logement', 'eau_assainissement', 'energie_dechets', 'connectivite', 'risques', 'equipements', 'elevage'];

export default function FoyerForm({ foyer, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [tab, setTab] = useState<Tab>('general');
  const [code_menage, setCodeMenage] = useState(foyer?.code_menage || '');
  const [loadingCode, setLoadingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

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
  const [identification_logement, setIdentificationLogement] = useState(foyer?.identification_logement || '');
  const [numero_maison, setNumeroMaison] = useState(foyer?.numero_maison || '');
  const [a_etage, setAEtage] = useState(foyer?.a_etage || false);
  const [nombre_etages, setNombreEtages] = useState(foyer?.nombre_etages?.toString() || '1');
  const [materiaux_toiture, setMateriauxToiture] = useState<string[]>(foyer?.materiaux_toiture || (foyer?.materiau_toiture ? [foyer.materiau_toiture] : []));
  const [materiaux_mur, setMateriauxMur] = useState<string[]>(foyer?.materiaux_mur || (foyer?.materiau_mur ? [foyer.materiau_mur] : []));
  const [materiau_mur_autre, setMateriauMurAutre] = useState('');
  const [note_agent_incomplete, setNoteAgentIncomplete] = useState('');
  const [formations_pro_autre, setFormationsProAutre] = useState('');
  const [materiaux_plancher, setMateriauxPlancher] = useState<string[]>(foyer?.materiaux_plancher || (foyer?.materiau_plancher ? [foyer.materiau_plancher] : []));
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

  // § Logement — état général & appartenance (Kobo §10 / §7)
  const [etat_logement, setEtatLogement] = useState(foyer?.etat_logement || '');
  const [appartenance_maison, setAppartenanceMaison] = useState(foyer?.appartenance_maison || '');

  // § Aide sociale ménage (Kobo §7)
  const [aide_sociale_menage, setAideSocialeMenage] = useState(foyer?.aide_sociale_menage || '');
  const [types_aide_sociale, setTypesAideSociale] = useState<string[]>(foyer?.types_aide_sociale || []);
  const [donateurs_aide_cash, setDonateursAideCash] = useState<string[]>(foyer?.donateurs_aide_cash || []);
  const [donateurs_aide_vivres, setDonateursAideVivres] = useState<string[]>(foyer?.donateurs_aide_vivres || []);
  const [donateurs_aide_sante, setDonateursAideSante] = useState<string[]>(foyer?.donateurs_aide_sante || []);
  const [donateurs_aide_education, setDonateursAideEducation] = useState<string[]>(foyer?.donateurs_aide_education || []);
  const [donateurs_aide_logement, setDonateursAideLogement] = useState<string[]>(foyer?.donateurs_aide_logement || []);
  const [donateurs_aide_materiaux, setDonateursAideMateriaux] = useState<string[]>(foyer?.donateurs_aide_materiaux || []);
  const [donateurs_aide_autre, setDonateursAideAutre] = useState<string[]>(foyer?.donateurs_aide_autre || []);

  // § Mobile Money (Kobo §10 connectivité)
  const [utilise_mobile_money, setUtiliseMobileMoney] = useState<boolean | undefined>(foyer?.utilise_mobile_money);
  const [operateurs_mobile_money, setOperateursMobileMoney] = useState<string[]>(foyer?.operateurs_mobile_money || []);

  // § Équipements du ménage (Kobo §11)
  const [moyen_transport, setMoyenTransport] = useState(foyer?.moyen_transport || '');
  const [biens_menage, setBiensMenage] = useState<string[]>(foyer?.biens_menage || []);
  const [nb_motos, setNbMotos] = useState(foyer?.nb_motos?.toString() || '0');
  const [nb_voitures, setNbVoitures] = useState(foyer?.nb_voitures?.toString() || '0');
  const [nb_cyclopousses, setNbCyclopousses] = useState(foyer?.nb_cyclopousses?.toString() || '0');
  const [nb_bajaj, setNbBajaj] = useState(foyer?.nb_bajaj?.toString() || '0');
  const [usage_vehicules, setUsageVehicules] = useState<string[]>(foyer?.usage_vehicules || []);

  // § Élevage (Kobo §12)
  const [pratique_elevage, setPratiqueElevage] = useState<boolean | undefined>(foyer?.pratique_elevage);
  const [types_elevage, setTypesElevage] = useState<string[]>(foyer?.types_elevage || []);
  const [nb_poules, setNbPoules] = useState(foyer?.nb_poules?.toString() || '');
  const [nb_canards, setNbCanards] = useState(foyer?.nb_canards?.toString() || '');
  const [nb_oies, setNbOies] = useState(foyer?.nb_oies?.toString() || '');
  const [nb_dindes, setNbDindes] = useState(foyer?.nb_dindes?.toString() || '');
  const [nb_porcs, setNbPorcs] = useState(foyer?.nb_porcs?.toString() || '');
  const [nb_zebus, setNbZebus] = useState(foyer?.nb_zebus?.toString() || '');
  const [nb_chevres, setNbChevres] = useState(foyer?.nb_chevres?.toString() || '');
  const [nb_lapins, setNbLapins] = useState(foyer?.nb_lapins?.toString() || '');
  const [nb_bassins_pisciculture, setNbBassins] = useState(foyer?.nb_bassins_pisciculture?.toString() || '');
  const [nb_ruches, setNbRuches] = useState(foyer?.nb_ruches?.toString() || '');
  const [but_elevage, setButElevage] = useState<string[]>(foyer?.but_elevage || []);
  const [lieu_elevage, setLieuElevage] = useState(foyer?.lieu_elevage || '');
  const [carnet_eleveur, setCarnetEleveur] = useState<boolean | undefined>(foyer?.carnet_eleveur);
  const [animaux_vaccines, setAnimauxVaccines] = useState<boolean | undefined>(foyer?.animaux_vaccines);

  const toggleArr = (arr: string[], val: string) => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  const isLastTab = tab === TAB_ORDER[TAB_ORDER.length - 1];

  // Génère le code carnet depuis le pool dès que le fokontany est saisi (nouveau foyer uniquement)
  useEffect(() => {
    if (foyer || !fokontany.trim() || code_menage) return;
    setLoadingCode(true);
    setCodeError(null);
    genCodeMenage(fokontany)
      .then(code => { setCodeMenage(code); })
      .catch(err => { setCodeError(err.message); })
      .finally(() => setLoadingCode(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fokontany]);

  // Auto-remplir le LOT depuis l'adresse — toujours recalculé, non modifiable
  useEffect(() => {
    const match = adresse.match(/(?:lot\s+)?(\d+\/[A-Z0-9\-]+)/i);
    if (match) {
      setIdentificationLogement(match[1]);
    } else if (adresse) {
      // Si pas de format LOT détecté, utiliser l'adresse brute tronquée
      setIdentificationLogement('');
    }
  }, [adresse]);

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
    if (!foyer && !code_menage) {
      alert('Aucun carnet QR disponible pour ce fokontany. Veuillez contacter l\'administrateur.');
      return;
    }
    if (!foyer && codeError) {
      alert(codeError);
      return;
    }
    setSaving(true);
    await onSave({
      code_menage, statut,
      adresse: adresse || undefined, fokontany, commune: commune || undefined, district: district || undefined,
      gps_lat: gps_lat ? parseFloat(gps_lat) : undefined, gps_lng: gps_lng ? parseFloat(gps_lng) : undefined,
      carreau: carreau || undefined, num_carreau: num_carreau || undefined,
      type_logement: type_logement || undefined,
      identification_logement: identification_logement || undefined,
      numero_maison: numero_maison || undefined,
      a_etage, nombre_etages: a_etage ? (parseInt(nombre_etages) || 1) : undefined,
      materiaux_toiture, materiaux_mur, materiaux_plancher,
      materiau_toiture: materiaux_toiture[0] || undefined,
      materiau_mur: materiaux_mur[0] || undefined,
      materiau_plancher: materiaux_plancher[0] || undefined,
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
      // § Logement état & appartenance
      etat_logement: etat_logement || undefined,
      appartenance_maison: appartenance_maison || undefined,
      // § Aide sociale ménage
      aide_sociale_menage: aide_sociale_menage || undefined,
      types_aide_sociale,
      donateurs_aide_cash,
      donateurs_aide_vivres,
      donateurs_aide_sante,
      donateurs_aide_education,
      donateurs_aide_logement,
      donateurs_aide_materiaux,
      donateurs_aide_autre,
      // § Mobile Money
      utilise_mobile_money,
      operateurs_mobile_money,
      // § Équipements
      moyen_transport: moyen_transport || undefined,
      biens_menage,
      nb_motos: parseInt(nb_motos) || 0,
      nb_voitures: parseInt(nb_voitures) || 0,
      nb_cyclopousses: parseInt(nb_cyclopousses) || 0,
      nb_bajaj: parseInt(nb_bajaj) || 0,
      usage_vehicules,
      // § Élevage
      pratique_elevage,
      types_elevage,
      nb_poules: nb_poules ? parseInt(nb_poules) : undefined,
      nb_canards: nb_canards ? parseInt(nb_canards) : undefined,
      nb_oies: nb_oies ? parseInt(nb_oies) : undefined,
      nb_dindes: nb_dindes ? parseInt(nb_dindes) : undefined,
      nb_porcs: nb_porcs ? parseInt(nb_porcs) : undefined,
      nb_zebus: nb_zebus ? parseInt(nb_zebus) : undefined,
      nb_chevres: nb_chevres ? parseInt(nb_chevres) : undefined,
      nb_lapins: nb_lapins ? parseInt(nb_lapins) : undefined,
      nb_bassins_pisciculture: nb_bassins_pisciculture ? parseInt(nb_bassins_pisciculture) : undefined,
      nb_ruches: nb_ruches ? parseInt(nb_ruches) : undefined,
      but_elevage,
      lieu_elevage: lieu_elevage || undefined,
      carnet_eleveur,
      animaux_vaccines,
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
    { key: 'equipements', label: 'Équipements', icon: Tv },
    { key: 'elevage', label: 'Élevage', icon: Beef },
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
              <p className="text-xs text-slate-500">
                Code : {loadingCode
                  ? <span className="text-slate-400 italic">Attribution en cours…</span>
                  : codeError
                    ? <span className="text-red-500 italic">⚠ {codeError}</span>
                    : code_menage
                      ? <span className="font-mono font-bold text-indigo-600">{code_menage}</span>
                      : <span className="text-slate-400 italic">Saisissez le fokontany</span>
                }
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

                {/* Identification du logement */}
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-1.5">Identification du logement</label>
                  <div className="flex gap-2 items-stretch">
                    {/* LOT — lecture seule, extrait automatiquement de l'adresse */}
                    <div className="flex-1">
                      <p className="text-[10px] text-slate-400 mb-1">N° de lot <span className="text-indigo-500 font-semibold">(auto depuis adresse)</span></p>
                      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-mono border ${identification_logement ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-400 italic'}`}>
                        <span className="text-slate-400 text-xs select-none">LOT</span>
                        <span className="font-bold">{identification_logement || 'Saisir l\'adresse ci-dessus'}</span>
                        <span className="ml-auto text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-sans">Auto</span>
                      </div>
                    </div>
                    {/* N° maison — seul champ modifiable */}
                    <div className="w-28 shrink-0">
                      <p className="text-[10px] text-slate-400 mb-1">N° maison <span className="text-red-400">*</span></p>
                      <input
                        value={numero_maison}
                        onChange={e => setNumeroMaison(e.target.value.toUpperCase())}
                        placeholder="M1"
                        maxLength={5}
                        className="w-full border-2 border-indigo-300 bg-white rounded-lg px-3 py-2.5 text-sm focus:border-indigo-600 outline-none font-mono uppercase text-center font-bold tracking-widest"
                      />
                    </div>
                  </div>
                  {/* Identifiant final calculé */}
                  {identification_logement && numero_maison ? (
                    <div className="mt-2 flex items-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2.5">
                      <span className="text-xs font-semibold opacity-80">Identifiant officiel :</span>
                      <span className="font-mono font-bold text-base tracking-wide">LOT {identification_logement}-{numero_maison}</span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                      <span className="text-amber-500">⚠</span>
                      {!identification_logement ? "Saisissez une adresse avec numéro de lot (ex: Lot 20/AA-146)" : "Ajoutez le numéro de maison (ex: M1, M2...)"}
                    </p>
                  )}
                </div>

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

                <CheckGroup label="Matériau(x) de toiture" options={MATERIAUX_TOITURE} values={materiaux_toiture} onToggle={v => setMateriauxToiture(prev => toggleArr(prev, v))} />
                <div>
                  <CheckGroup label="Matériau(x) de mur" options={MATERIAUX_MUR} values={materiaux_mur} onToggle={v => setMateriauxMur(prev => toggleArr(prev, v))} />
                  {materiaux_mur.includes('Autres') && (
                    <input value={materiau_mur_autre} onChange={e => setMateriauMurAutre(e.target.value)} placeholder="Précisez le matériau de mur..." className="mt-2 w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none bg-indigo-50/30" />
                  )}
                </div>
                <CheckGroup label="Matériau(x) de plancher" options={MATERIAUX_PLANCHER} values={materiaux_plancher} onToggle={v => setMateriauxPlancher(prev => toggleArr(prev, v))} />
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

                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">État & appartenance (Kobo §7 / §10)</h3>
                  <ChoiceGroup label="État général du logement" options={ETATS_LOGEMENT} value={etat_logement} onChange={setEtatLogement} cols={4} />
                  <ChoiceGroup label="À qui appartient cette maison ?" options={APPARTENANCE_MAISON} value={appartenance_maison} onChange={setAppartenanceMaison} cols={2} />
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
                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Mobile Money (Kobo §10)</h3>
                  <YesNo label="Le ménage utilise-t-il le Mobile Money ?" value={utilise_mobile_money} onChange={setUtiliseMobileMoney} />
                  {utilise_mobile_money && (
                    <CheckGroup label="Opérateurs utilisés" options={OPERATEURS_MOBILE_MONEY} values={operateurs_mobile_money} onToggle={v => setOperateursMobileMoney(prev => toggleArr(prev, v))} />
                  )}
                </div>
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

                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">8. Aide sociale du ménage (Kobo §7)</h3>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase block mb-1.5">Le ménage reçoit-il une aide sociale ?</label>
                    <div className="flex flex-wrap gap-2">
                      {['Oui', 'Non', 'Ne sait pas', 'Refuse de répondre'].map(opt => (
                        <label key={opt} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${aide_sociale_menage === opt ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                          <input type="radio" className="hidden" checked={aide_sociale_menage === opt} onChange={() => setAideSocialeMenage(opt)} />{opt}
                        </label>
                      ))}
                    </div>
                  </div>
                  {aide_sociale_menage === 'Oui' && (
                    <>
                      <CheckGroup label="Types d'aide reçue" options={TYPES_AIDE_MENAGE} values={types_aide_sociale} onToggle={v => setTypesAideSociale(prev => toggleArr(prev, v))} />
                      {types_aide_sociale.includes('Cash / transfert monétaire') && (
                        <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                          <p className="text-xs font-bold text-slate-500 uppercase">Donateurs — Cash</p>
                          <CheckGroup label="" options={DONATEURS_AIDE} values={donateurs_aide_cash} onToggle={v => setDonateursAideCash(prev => toggleArr(prev, v))} />
                        </div>
                      )}
                      {types_aide_sociale.includes('Vivres / denrées') && (
                        <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                          <p className="text-xs font-bold text-slate-500 uppercase">Donateurs — Vivres</p>
                          <CheckGroup label="" options={DONATEURS_AIDE} values={donateurs_aide_vivres} onToggle={v => setDonateursAideVivres(prev => toggleArr(prev, v))} />
                        </div>
                      )}
                      {types_aide_sociale.includes('Santé / soins') && (
                        <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                          <p className="text-xs font-bold text-slate-500 uppercase">Donateurs — Santé</p>
                          <CheckGroup label="" options={DONATEURS_AIDE} values={donateurs_aide_sante} onToggle={v => setDonateursAideSante(prev => toggleArr(prev, v))} />
                        </div>
                      )}
                      {types_aide_sociale.includes('Éducation / scolarité') && (
                        <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                          <p className="text-xs font-bold text-slate-500 uppercase">Donateurs — Éducation</p>
                          <CheckGroup label="" options={DONATEURS_AIDE} values={donateurs_aide_education} onToggle={v => setDonateursAideEducation(prev => toggleArr(prev, v))} />
                        </div>
                      )}
                      {types_aide_sociale.includes('Logement / hébergement') && (
                        <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                          <p className="text-xs font-bold text-slate-500 uppercase">Donateurs — Logement</p>
                          <CheckGroup label="" options={DONATEURS_AIDE} values={donateurs_aide_logement} onToggle={v => setDonateursAideLogement(prev => toggleArr(prev, v))} />
                        </div>
                      )}
                      {types_aide_sociale.includes('Divers matériaux de construction') && (
                        <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                          <p className="text-xs font-bold text-slate-500 uppercase">Donateurs — Matériaux</p>
                          <CheckGroup label="" options={DONATEURS_AIDE} values={donateurs_aide_materiaux} onToggle={v => setDonateursAideMateriaux(prev => toggleArr(prev, v))} />
                        </div>
                      )}
                      {types_aide_sociale.includes('Autre') && (
                        <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                          <p className="text-xs font-bold text-slate-500 uppercase">Donateurs — Autre aide</p>
                          <CheckGroup label="" options={DONATEURS_AIDE} values={donateurs_aide_autre} onToggle={v => setDonateursAideAutre(prev => toggleArr(prev, v))} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── ÉQUIPEMENTS & BIENS ── */}
            {tab === 'equipements' && (
              <div className="space-y-5">
                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">9. Équipements & biens du ménage (Kobo §11)</h3>
                <ChoiceGroup label="Moyen de transport principal du ménage" options={MOYENS_TRANSPORT} value={moyen_transport} onChange={setMoyenTransport} cols={2} />
                <CheckGroup label="Biens possédés par le ménage" options={BIENS_MENAGE} values={biens_menage} onToggle={v => setBiensMenage(prev => toggleArr(prev, v))} />

                {/* Compter les véhicules si sélectionnés */}
                {(biens_menage.includes('Moto / scooter') || biens_menage.includes('Voiture') || biens_menage.includes('Cyclo-pousse / pousse-pousse') || biens_menage.includes('Bajaj / tuk-tuk')) && (
                  <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-slate-500 uppercase">Nombre de véhicules</p>
                    <div className="grid grid-cols-2 gap-3">
                      {biens_menage.includes('Moto / scooter') && <NumberInput label="Motos / Scooters" value={nb_motos} onChange={setNbMotos} />}
                      {biens_menage.includes('Voiture') && <NumberInput label="Voitures" value={nb_voitures} onChange={setNbVoitures} />}
                      {biens_menage.includes('Cyclo-pousse / pousse-pousse') && <NumberInput label="Cyclo-pousses" value={nb_cyclopousses} onChange={setNbCyclopousses} />}
                      {biens_menage.includes('Bajaj / tuk-tuk') && <NumberInput label="Bajaj / Tuk-tuk" value={nb_bajaj} onChange={setNbBajaj} />}
                    </div>
                    <CheckGroup label="Usage des véhicules" options={USAGES_VEHICULES} values={usage_vehicules} onToggle={v => setUsageVehicules(prev => toggleArr(prev, v))} />
                  </div>
                )}
              </div>
            )}

            {/* ── ÉLEVAGE ── */}
            {tab === 'elevage' && (
              <div className="space-y-5">
                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">10. Élevage (Kobo §12)</h3>
                <YesNo label="Le ménage pratique-t-il l'élevage ?" value={pratique_elevage} onChange={setPratiqueElevage} />
                {pratique_elevage && (
                  <>
                    <CheckGroup label="Types d'animaux élevés" options={TYPES_ELEVAGE} values={types_elevage} onToggle={v => setTypesElevage(prev => toggleArr(prev, v))} />

                    {types_elevage.length > 0 && (
                      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-bold text-slate-500 uppercase">Nombre par espèce</p>
                        <div className="grid grid-cols-2 gap-3">
                          {types_elevage.includes('Poules / poulets') && <NumberInput label="Poules / Poulets" value={nb_poules} onChange={setNbPoules} />}
                          {types_elevage.includes('Canards') && <NumberInput label="Canards" value={nb_canards} onChange={setNbCanards} />}
                          {types_elevage.includes('Oies') && <NumberInput label="Oies" value={nb_oies} onChange={setNbOies} />}
                          {types_elevage.includes('Dindes') && <NumberInput label="Dindes" value={nb_dindes} onChange={setNbDindes} />}
                          {types_elevage.includes('Porcs') && <NumberInput label="Porcs" value={nb_porcs} onChange={setNbPorcs} />}
                          {types_elevage.includes('Zébus / bovins') && <NumberInput label="Zébus / Bovins" value={nb_zebus} onChange={setNbZebus} />}
                          {types_elevage.includes('Chèvres / moutons') && <NumberInput label="Chèvres / Moutons" value={nb_chevres} onChange={setNbChevres} />}
                          {types_elevage.includes('Lapins') && <NumberInput label="Lapins" value={nb_lapins} onChange={setNbLapins} />}
                          {types_elevage.includes('Poissons (pisciculture)') && <NumberInput label="Bassins pisciculture" value={nb_bassins_pisciculture} onChange={setNbBassins} />}
                          {types_elevage.includes('Abeilles (apiculture)') && <NumberInput label="Ruches" value={nb_ruches} onChange={setNbRuches} />}
                        </div>
                      </div>
                    )}

                    <CheckGroup label="But principal de l'élevage" options={BUTS_ELEVAGE} values={but_elevage} onToggle={v => setButElevage(prev => toggleArr(prev, v))} />
                    <ChoiceGroup label="Lieu de l'élevage" options={LIEUX_ELEVAGE} value={lieu_elevage} onChange={setLieuElevage} cols={2} />
                    <YesNo label="Possède un carnet d'éleveur ?" value={carnet_eleveur} onChange={setCarnetEleveur} />
                    <YesNo label="Animaux vaccinés ?" value={animaux_vaccines} onChange={setAnimauxVaccines} />
                  </>
                )}
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
