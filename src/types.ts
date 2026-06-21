// ── Types de base ─────────────────────────────────────────────
export type Sexe = 'M' | 'F';
export type StatutSante = 'Normal' | 'Surveillance' | 'Prioritaire';
export type StatutMembre = 'Actif' | 'Décédé' | 'Déménagé';
export type StatutFoyer = 'Actif' | 'Dissous' | 'Déplacé';
export type RelationChef = 'Chef' | 'Épouse/Époux' | 'Fils' | 'Fille' | 'Père' | 'Mère' | 'Frère' | 'Sœur' | 'Grand-père' | 'Grand-mère' | 'Petit-fils' | 'Petite-fille' | 'Oncle' | 'Tante' | 'Neveu' | 'Nièce' | 'Autre';

// ── Foyer ─────────────────────────────────────────────────────
export interface Foyer {
  id: string;
  code_menage: string;
  statut: StatutFoyer;
  adresse: string;
  fokontany: string;
  commune: string;
  district: string;
  gps_lat?: number;
  gps_lng?: number;
  carreau?: string;
  num_carreau?: string;
  nombre_pieces?: number;
  superficie_maison?: number;
  photo_maison_url?: string;
  nombre_membres: number;
  // Logement
  type_logement?: string;
  a_etage?: boolean;
  nombre_etages?: number;
  materiau_toiture?: string;
  materiau_mur?: string;
  materiau_plancher?: string;
  // Occupation
  statut_occupant?: string;
  proprietaire_nom?: string;
  proprietaire_prenom?: string;
  proprietaire_cin?: string;
  proprietaire_telephone?: string;
  proprietaire_adresse?: string;
  // Eau
  eau_source?: string;
  eau_potable?: boolean;
  eau_disponibilite?: string;
  eau_temps_acces?: string;
  // Assainissement
  toilette_type?: string;
  lavage_mains?: boolean;
  savon_disponible?: boolean;
  evacuation_eaux_usees?: string;
  // Électricité & énergie
  eclairage_source?: string;
  a_electricite?: boolean;
  cuisson_source?: string;
  // Déchets
  dechets_mode?: string;
  dechets_tri?: boolean;
  // Connectivité
  reseau_mobile?: string;
  acces_internet?: boolean;
  internet_moyens?: string[];
  // Risques
  risque_naturel?: boolean;
  risques_types?: string[];
  catastrophe_subie?: boolean;
  catastrophe_types?: string[];
  // Vulnérabilité ménage
  difficulte_eau?: boolean;
  difficulte_electricite?: boolean;
  conditions_vie?: string;
  // Module Vulnérabilité du ménage
  est_vulnerable?: boolean;
  vulnerabilite_raisons?: string[];
  vulnerabilite_precision?: string;
  nb_personnes_agees?: number;
  nb_personnes_handicapees?: number;
  nb_orphelins?: number;
  nb_enfants_moins5?: number;
  nb_femmes_enceintes?: number;
  nb_maladies_chroniques?: number;
  difficulte_alimentaire?: boolean;
  frequence_difficulte_alim?: string;
  nb_repas_jour?: string;
  affecte_catastrophe?: boolean;
  catastrophe_nat_types?: string[];
  annee_derniere_catastrophe?: number;
  niveau_degats?: string;
  aide_recue?: boolean;
  aide_catastrophe_concernee?: string;
  aide_annee_intervention?: number;
  aide_organismes?: string[];
  aide_nom_organisme?: string;
  aide_types?: string[];
  aide_precision?: string;
  aide_suffisante?: string;
  necessite_appui?: boolean;
  logement_necessite_travaux?: boolean;
  travaux_types?: string[];
  travaux_parties?: string[];
  travaux_urgence?: string;
  travaux_commentaire?: string;
  travaux_photo_url?: string;
  niveau_vulnerabilite_global?: string;
  observations_complementaires?: string;
  created_at?: string;
  updated_at?: string;
}

// ── Membre ────────────────────────────────────────────────────
export interface Membre {
  id: string;
  foyer_id: string;
  // Identité
  nom: string;
  prenom: string;
  sexe: Sexe;
  date_naissance?: string;
  lieu_naissance?: string;
  cin?: string;
  date_cin?: string;
  telephone?: string;
  email?: string;
  photo_url?: string;
  statut: StatutMembre;
  // Relation
  relation_chef: RelationChef;
  is_chef: boolean;
  conjoint_id?: string;
  pere_id?: string;
  mere_id?: string;
  pere_nom?: string;
  mere_nom?: string;
  // Éducation
  niveau_etude: string;
  diplome?: string;
  competences: string[];
  langues: string[];
  // Économie
  profession?: string;
  secteur?: string;
  employeur?: string;
  revenu_estime?: number;
  // Santé
  groupe_sanguin?: string;
  handicap?: string;
  handicap_oui?: boolean;
  handicap_types?: string[];
  handicap_precision?: string;
  handicap_autonomie?: string;
  handicap_carte?: boolean;
  hypertension: StatutSante;
  diabete: StatutSante;
  maladies_chroniques?: string[];
  maladie_autre?: string;
  traitement_regulier?: boolean;
  suivi_medical?: boolean;
  priorite_sanitaire?: string;
  // Grossesse (sexe F)
  grossesse_cours?: boolean;
  grossesse_mois?: number;
  grossesse_date_accouchement?: string;
  grossesse_cpn?: number;
  grossesse_risque?: boolean;
  grossesse_suivie?: boolean;
  grossesse_centre_sante?: string;
  // Allergies
  allergies?: string[];
  allergies_precision?: string;
  // Vaccination
  vaccination: string[];
  statut_vaccinal?: string;
  // Anthropométrie
  poids?: number;
  taille?: number;
  // Contact urgence
  contact_urgence_nom?: string;
  contact_urgence_telephone?: string;
  contact_urgence_lien?: string;
  // Documents sanitaires
  photo_carnet_vaccination?: string;
  photo_carte_handicap?: string;
  photo_document_medical?: string;
  // Vulnérabilité
  est_vulnerable: boolean;
  vulnerabilite_categories: string[];
  vulnerabilite_description?: string;
  niveau_priorite: 'Aucun' | 'Moyen' | 'Critique';
  aides_obtenues: string[];
  created_at?: string;
  updated_at?: string;
}

// ── Log ───────────────────────────────────────────────────────
export interface Log {
  id: string;
  date: string;
  utilisateur: string;
  action: string;
  details: string;
  foyer_id?: string;
  membre_id?: string;
}

// ── Anciens types conservés pour Finance/Matériels/Foncier ───
export type StatutHabitant = StatutMembre;
export interface Habitant {
  id: string; nom: string; prenom: string; sexe: Sexe; dateNaissance: string;
  lieuNaissance: string; cin?: string; dateCin?: string; telephone?: string;
  email?: string; statut: StatutHabitant; photoUrl?: string;
  famille: { codeMenage: string; isChefMenage: boolean; conjointId?: string; pereId?: string; mereId?: string; enfantsIds: string[]; pereNom?: string; mereNom?: string; };
  residence: { adresse: string; fokontany: string; commune: string; district: string; gps?: { lat: number; lng: number }; numLot?: string; carreau?: string; numCarreau?: string; photoMaisonUrl?: string; nombrePieces?: number; superficieMaison?: number; };
  education: { niveauEtude: string; diplome?: string; competences: string[]; langues: string[]; };
  economie: { profession: string; secteur: string; employeur?: string; revenuEstime?: number; };
  sante: { groupeSanguin?: string; handicap?: string; hypertension: StatutSante; diabete: StatutSante; vaccination: string[]; poids?: number; taille?: number; };
  vulnerabilite?: { estVulnerable: boolean; categories: string[]; description?: string; niveauPriorite: 'Aucun' | 'Moyen' | 'Critique'; aidesObtenues: string[]; };
}
export interface HistoriqueLog { id: string; date: string; utilisateur: string; action: 'Création' | 'Modification' | 'Changement adresse' | 'Certificat généré' | 'Décès' | 'Déménagement' | 'Finance' | 'Matériel' | 'Foncier' | 'Succession'; details: string; habitantId?: string; }
export interface TransfertOrigine { id: string; date: string; typeTransfert: 'Achat' | 'Succession' | 'Don' | 'Partage' | 'Mutation' | 'Autre'; description: string; montantTransaction?: number; ancienProprietaire?: string; nouveauProprietaire: string; piecesJustificatives?: string; }
export interface LotFoncier { id: string; numeroLot: string; titreFoncier?: string; cadastreRef?: string; superficie: number; adresse: string; statutOccupant: 'Propriétaire' | 'Locataire' | 'Occupant à titre gratuit' | 'Indivis Civils' | 'Litigieux'; occupantsMenageCode?: string; typeUsage: 'Habitation' | 'Commercial' | 'Agricole' | 'Mixte'; historiqueSuccessions: TransfertOrigine[]; notes?: string; }
export interface Transaction { id: string; date: string; type: 'recette' | 'depense'; montant: number; categorie: 'Subvention' | 'Droits administratifs' | 'Dons & Cotisations' | 'Taxes locales' | 'Achat matériel' | 'Fournitures' | 'Entretien' | 'Social' | 'Événements' | 'Autre'; description: string; responsable: string; justificatifRef?: string; }
export interface Materiel { id: string; nom: string; categorie: 'Mobilier' | 'Informatique' | 'Logistique' | 'Événementiel' | 'Sécurité' | 'Autre'; quantiteTotal: number; quantiteDisponible: number; etat: 'Excellent' | 'Bon' | 'Moyen' | 'Détérioré' | 'En panne'; dateAcquisition: string; valeurEstimee: number; responsable: string; lieuStockage: string; }
export interface CotisationAdidy { id: string; codeMenage: string; habitantId?: string; annee: number; mois: number; montant: number; datePaiement: string; responsable: string; recuNo: string; }
