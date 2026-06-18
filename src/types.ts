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
  hypertension: StatutSante;
  diabete: StatutSante;
  vaccination: string[];
  poids?: number;
  taille?: number;
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
