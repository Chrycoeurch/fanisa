import { Transaction, Materiel, CotisationAdidy } from './types';

export const initialTransactions: Transaction[] = [
  {
    id: 'tx-001',
    date: '2026-06-01T09:00:00Z',
    type: 'recette',
    montant: 5000000,
    categorie: 'Subvention',
    description: 'Subvention annuelle d\'équipement reçue de la Commune d\'Antananarivo Renivohitra',
    responsable: 'Chef Fokontany (Admin)'
  },
  {
    id: 'tx-002',
    date: '2026-06-03T11:30:00Z',
    type: 'recette',
    montant: 240000,
    categorie: 'Droits administratifs',
    description: 'Cumul des droits de délivrance de 120 certificats de résidence hebdomadaires (2 000 Ar prêter/acte)',
    responsable: 'Secrétaire Fokontany'
  },
  {
    id: 'tx-003',
    date: '2026-06-04T14:15:00Z',
    type: 'depense',
    montant: 350000,
    categorie: 'Fournitures',
    description: 'Achat de 4 rames de papier A4, 2 cartouches d\'encre noire et fournitures administratives scolaires de secours',
    responsable: 'Secrétaire Fokontany',
    justificatifRef: 'FACT-2026-045'
  },
  {
    id: 'tx-004',
    date: '2026-06-08T10:00:00Z',
    type: 'recette',
    montant: 1200000,
    categorie: 'Dons & Cotisations',
    description: 'Don exceptionnel de l\'Association des Ressortissants d\'Ambohitantely en France',
    responsable: 'Chef Fokontany (Admin)'
  },
  {
    id: 'tx-005',
    date: '2026-06-10T16:00:00Z',
    type: 'depense',
    montant: 650000,
    categorie: 'Social',
    description: 'Aide sociale d\'urgence - Achat et distribution de packs de riz (Vatsy) pour 13 familles classées vulnérables critiques',
    responsable: 'Chef Fokontany (Admin)',
    justificatifRef: 'BON-RIZ-23a'
  },
  {
    id: 'tx-006',
    date: '2026-06-12T08:30:00Z',
    type: 'depense',
    montant: 180000,
    categorie: 'Entretien',
    description: 'Réparation et maintenance du Groupe Électrogène Fokontany (Vidange et remplacement filtre)',
    responsable: 'Adjoint de Sécurité',
    justificatifRef: 'FACT-MECA-892'
  },
  {
    id: 'tx-007',
    date: '2026-06-14T15:00:00Z',
    type: 'depense',
    montant: 450000,
    categorie: 'Événements',
    description: 'Frais de sonorisation et location de tentes complémentaires pour les préparatifs du 26 Juin',
    responsable: 'Chef Fokontany (Admin)'
  },
  {
    id: 'tx-008',
    date: '2026-06-15T10:20:00Z',
    type: 'recette',
    montant: 180000,
    categorie: 'Taxes locales',
    description: 'Redevances d\'occupation des étals de marché hebdomadaires - Fokontany Ambohitantely',
    responsable: 'Adjoint de Sécurité'
  }
];

export const initialMateriels: Materiel[] = [
  {
    id: 'mat-001',
    nom: 'Chaises en plastique bleu',
    categorie: 'Mobilier',
    quantiteTotal: 120,
    quantiteDisponible: 110,
    etat: 'Excellent',
    dateAcquisition: '2024-05-15',
    valeurEstimee: 2160000, // 18 000 Ar par chaise
    responsable: 'Secrétaire Fokontany',
    lieuStockage: 'Grande salle du Fokontany'
  },
  {
    id: 'mat-002',
    nom: 'Groupe électrogène Honda 3.5 kVA',
    categorie: 'Logistique',
    quantiteTotal: 1,
    quantiteDisponible: 1,
    etat: 'Bon',
    dateAcquisition: '2025-01-10',
    valeurEstimee: 1800000,
    responsable: 'Adjoint de Sécurité',
    lieuStockage: 'Dépôt de sécurité'
  },
  {
    id: 'mat-003',
    nom: 'Mégaphone portable rechargeable 50W',
    categorie: 'Sécurité',
    quantiteTotal: 3,
    quantiteDisponible: 2,
    etat: 'Bon',
    dateAcquisition: '2025-03-20',
    valeurEstimee: 360000, // 120 000 Ar l'unité
    responsable: 'Adjoint de Sécurité',
    lieuStockage: 'Poste de garde'
  },
  {
    id: 'mat-004',
    nom: 'Ordinateur portable Lenovo Core i3',
    categorie: 'Informatique',
    quantiteTotal: 1,
    quantiteDisponible: 1,
    etat: 'Bon',
    dateAcquisition: '2024-02-18',
    valeurEstimee: 1400000,
    responsable: 'Secrétaire Fokontany',
    lieuStockage: 'Bureau du Secrétariat'
  },
  {
    id: 'mat-005',
    nom: 'Imprimante Laser Recto-Verso Brother',
    categorie: 'Informatique',
    quantiteTotal: 1,
    quantiteDisponible: 1,
    etat: 'Moyen',
    dateAcquisition: '2024-02-18',
    valeurEstimee: 750000,
    responsable: 'Secrétaire Fokontany',
    lieuStockage: 'Bureau du Secrétariat'
  },
  {
    id: 'mat-006',
    nom: 'Tente de fête imperméable 6x4m',
    categorie: 'Événementiel',
    quantiteTotal: 2,
    quantiteDisponible: 2,
    etat: 'Bon',
    dateAcquisition: '2023-11-12',
    valeurEstimee: 1600000, // 800 000 Ar l'unité
    responsable: 'Chef Fokontany (Admin)',
    lieuStockage: 'Grande salle du Fokontany'
  },
  {
    id: 'mat-007',
    nom: 'Tableau d\'affichage vitré extérieur',
    categorie: 'Mobilier',
    quantiteTotal: 2,
    quantiteDisponible: 2,
    etat: 'Excellent',
    dateAcquisition: '2025-05-01',
    valeurEstimee: 400000,
    responsable: 'Chef Fokontany (Admin)',
    lieuStockage: 'Façade du bureau administratif'
  }
];

export const initialCotisations: CotisationAdidy[] = [
  {
    id: 'cot-001',
    codeMenage: 'MEN-001',
    habitantId: 'hab-001',
    annee: 2026,
    mois: 1,
    montant: 5000,
    datePaiement: '2026-01-05T08:30:00Z',
    responsable: 'Secrétaire Fokontany',
    recuNo: 'REC-ADIDY-25-0001'
  },
  {
    id: 'cot-002',
    codeMenage: 'MEN-001',
    habitantId: 'hab-001',
    annee: 2026,
    mois: 2,
    montant: 5000,
    datePaiement: '2026-02-04T09:00:00Z',
    responsable: 'Secrétaire Fokontany',
    recuNo: 'REC-ADIDY-25-0034'
  },
  {
    id: 'cot-003',
    codeMenage: 'MEN-001',
    habitantId: 'hab-001',
    annee: 2026,
    mois: 3,
    montant: 5000,
    datePaiement: '2026-03-05T10:15:00Z',
    responsable: 'Secrétaire Fokontany',
    recuNo: 'REC-ADIDY-25-0067'
  },
  {
    id: 'cot-004',
    codeMenage: 'MEN-001',
    habitantId: 'hab-001',
    annee: 2026,
    mois: 4,
    montant: 5000,
    datePaiement: '2026-04-06T08:00:00Z',
    responsable: 'Secrétaire Fokontany',
    recuNo: 'REC-ADIDY-25-0112'
  },
  {
    id: 'cot-005',
    codeMenage: 'MEN-001',
    habitantId: 'hab-001',
    annee: 2026,
    mois: 5,
    montant: 5000,
    datePaiement: '2026-05-05T08:45:00Z',
    responsable: 'Secrétaire Fokontany',
    recuNo: 'REC-ADIDY-25-0164'
  },
  {
    id: 'cot-006',
    codeMenage: 'MEN-002',
    habitantId: 'hab-005',
    annee: 2026,
    mois: 1,
    montant: 5000,
    datePaiement: '2026-01-10T14:30:00Z',
    responsable: 'Secrétaire Fokontany',
    recuNo: 'REC-ADIDY-25-0012'
  },
  {
    id: 'cot-007',
    codeMenage: 'MEN-002',
    habitantId: 'hab-005',
    annee: 2026,
    mois: 2,
    montant: 5000,
    datePaiement: '2026-02-12T11:00:00Z',
    responsable: 'Secrétaire Fokontany',
    recuNo: 'REC-ADIDY-25-0045'
  },
  {
    id: 'cot-008',
    codeMenage: 'MEN-003',
    habitantId: 'hab-008',
    annee: 2026,
    mois: 1,
    montant: 5000,
    datePaiement: '2026-01-15T09:15:00Z',
    responsable: 'Secrétaire Fokontany',
    recuNo: 'REC-ADIDY-25-0023'
  }
];

