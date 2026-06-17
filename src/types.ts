export type Sexe = 'M' | 'F';
export type StatutSante = 'Normal' | 'Surveillance' | 'Prioritaire';
export type StatutHabitant = 'Actif' | 'Décédé' | 'Déménagé';

export interface Habitant {
  id: string;
  photoUrl?: string;
  cin?: string;
  dateCin?: string;
  nom: string;
  prenom: string;
  sexe: Sexe;
  dateNaissance: string;
  lieuNaissance: string;
  telephone?: string;
  email?: string;
  statut: StatutHabitant;
  
  // Famille
  famille: {
    codeMenage: string;
    isChefMenage: boolean;
    conjointId?: string;
    pereId?: string;
    mereId?: string;
    enfantsIds: string[];
    pereNom?: string; // Nom libre pour le père
    mereNom?: string; // Nom libre pour la mère
  };

  // Résidence
  residence: {
    adresse: string;
    fokontany: string;
    commune: string;
    district: string;
    gps?: { lat: number; lng: number };
    numLot?: string; // Numéro de lot foncier associé
    carreau?: string; // Carreau (ex: Tsararivotra)
    numCarreau?: string; // Numéro de carreau
    photoMaisonUrl?: string; // Photos de la maison (base64 ou URL)
    nombrePieces?: number; // Nombre de pièces
    superficieMaison?: number; // Superficie de la maison (m²)
  };

  // Éducation & Économie
  education: {
    niveauEtude: string;
    diplome?: string;
    competences: string[];
    langues: string[];
  };
  economie: {
    profession: string;
    secteur: string;
    employeur?: string;
    revenuEstime?: number;
  };

  // Santé
  sante: {
    groupeSanguin?: string;
    handicap?: string;
    hypertension: StatutSante;
    diabete: StatutSante;
    vaccination: string[];
    poids?: number; // Poids si < 18 ans
    taille?: number; // Taille si < 18 ans
  };

  // Vulnérabilité (Enrichissement)
  vulnerabilite?: {
    estVulnerable: boolean;
    categories: string[]; // ex: "Grand âge", "Handicap", "Pauvreté extrême", "Famille monoparentale", "Maladie chronique", "Déscolarisation", "Malnutrition"
    description?: string;
    niveauPriorite: 'Aucun' | 'Moyen' | 'Critique';
    aidesObtenues: string[]; // ex: "Vivres", "Aide financière", "Soins gratuits", "Bourse"
  };
}

export interface HistoriqueLog {
  id: string;
  date: string;
  utilisateur: string;
  action: 'Création' | 'Modification' | 'Changement adresse' | 'Certificat généré' | 'Décès' | 'Déménagement' | 'Finance' | 'Matériel' | 'Foncier' | 'Succession';
  details: string;
  habitantId?: string; // ID de l'habitant pour filtrer l'historique de cet individu
}

export interface TransfertOrigine {
  id: string;
  date: string;
  typeTransfert: 'Achat' | 'Succession' | 'Don' | 'Partage' | 'Mutation' | 'Autre';
  description: string;
  montantTransaction?: number; // en Ariary
  ancienProprietaire?: string;
  nouveauProprietaire: string;
  piecesJustificatives?: string;
}

export interface LotFoncier {
  id: string;
  numeroLot: string;
  titreFoncier?: string; // ex: "Titre Nº 4209-A"
  cadastreRef?: string;
  superficie: number; // m²
  adresse: string;
  statutOccupant: 'Propriétaire' | 'Locataire' | 'Occupant à titre gratuit' | 'Indivis Civils' | 'Litigieux';
  occupantsMenageCode?: string; // Lie un foyer (codeMenage)
  typeUsage: 'Habitation' | 'Commercial' | 'Agricole' | 'Mixte';
  historiqueSuccessions: TransfertOrigine[];
  notes?: string;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'recette' | 'depense';
  montant: number; // Ariary (MGA)
  categorie: 'Subvention' | 'Droits administratifs' | 'Dons & Cotisations' | 'Taxes locales' | 'Achat matériel' | 'Fournitures' | 'Entretien' | 'Social' | 'Événements' | 'Autre';
  description: string;
  responsable: string;
  justificatifRef?: string;
}

export interface Materiel {
  id: string;
  nom: string;
  categorie: 'Mobilier' | 'Informatique' | 'Logistique' | 'Événementiel' | 'Sécurité' | 'Autre';
  quantiteTotal: number;
  quantiteDisponible: number;
  etat: 'Excellent' | 'Bon' | 'Moyen' | 'Détérioré' | 'En panne';
  dateAcquisition: string;
  valeurEstimee: number; // Ariary (MGA)
  responsable: string;
  lieuStockage: string;
}

export interface CotisationAdidy {
  id: string;
  codeMenage: string; // Foyer/ménage
  habitantId?: string; // Optionnel : membre payeur spécifique
  annee: number; // e.g. 2026
  mois: number; // 1 à 12 (Janvier à Décembre)
  montant: number; // Ariary
  datePaiement: string;
  responsable: string;
  recuNo: string;
}

