import { Habitant, HistoriqueLog } from './types';

export const COMPULSORY_VACCINATIONS = [
  'BCG (Tuberculose)',
  'Polio',
  'DTC (Diphtérie, Tétanos, Coqueluche)',
  'Hépatite B',
  'Rougeole',
  'Fèvre Jaune'
];

export const FOKONTANY_LIST = [
  'Ambohitantely',
  'Ankadifotsy',
  'Isoraka',
  'Analakely',
  'Behoririka',
  'Tsaralalàna',
  'Ambodisaina'
];

export const COMMUNE_LIST = [
  'Antananarivo Renivohitra',
  'Ambohimanarina',
  'Ankadikely Ilafy',
  'Alasora',
  'Toamasina Suburbaine'
];

export const DISTRICT_LIST = [
  'Antananarivo I',
  'Antananarivo II',
  'Antananarivo III',
  'Antananarivo IV',
  'Antananarivo V',
  'Antananarivo VI',
  'Toamasina II'
];

export const SECTEUR_LIST = [
  'Agriculture & Élevage',
  'Commerce & Artisanat',
  'Éducation & Enseignement',
  'Santé & Social',
  'Bâtiment & Travaux Publics',
  'Technologie de l\'Information',
  'Administration Publique',
  'Transport & Logistique',
  'Service Privé',
  'Sans Emploi / Retraité'
];

export const COMPETENCES_LIST = [
  'Agriculture bio',
  'Ébénisterie',
  'Couture',
  'Mécanique auto',
  'Maçonnerie',
  'Comptabilité',
  'Développement Web',
  'Cuisine & Restauration',
  'Électricité bâtiment',
  'Plomberie',
  'Traduction'
];

export const LANGUES_LIST = [
  'Malagasy',
  'Français',
  'Anglais',
  'Chinois',
  'Allemand'
];

export const initialHabitants: Habitant[] = [
  // Ménage 1 (MEN-01): Famille Rabearivelo (Chef, Conjointe, 2 Enfants)
  {
    id: 'hab-001',
    cin: '101281002934',
    dateCin: '2015-04-12',
    nom: 'RABEARIVELO',
    prenom: 'Andry Jean',
    sexe: 'M',
    dateNaissance: '1988-06-15',
    lieuNaissance: 'Antananarivo',
    telephone: '+261 34 11 234 56',
    email: 'andry.rabearivelo@fokontany.mg',
    statut: 'Actif',
    famille: {
      codeMenage: 'MEN-001',
      isChefMenage: true,
      conjointId: 'hab-002',
      pereId: undefined,
      mereId: undefined,
      enfantsIds: ['hab-003', 'hab-004']
    },
    residence: {
      adresse: 'III M 45 Ambohitantely',
      fokontany: 'Ambohitantely',
      commune: 'Antananarivo Renivohitra',
      district: 'Antananarivo I',
      gps: { lat: -18.9102, lng: 47.5251 }
    },
    education: {
      niveauEtude: 'Universitaire',
      diplome: 'Master en Agro-économie',
      competences: ['Agriculture bio', 'Comptabilité', 'Traduction'],
      langues: ['Malagasy', 'Français', 'Anglais']
    },
    economie: {
      profession: 'Chef de projet agricole',
      secteur: 'Agriculture & Élevage',
      employeur: 'ONG Fandrosoana',
      revenuEstime: 1200000 // en Ariary
    },
    sante: {
      groupeSanguin: 'O+',
      hypertension: 'Normal',
      diabete: 'Normal',
      vaccination: ['BCG (Tuberculose)', 'Polio', 'Hépatite B']
    }
  },
  {
    id: 'hab-002',
    cin: '101292021948',
    dateCin: '2018-10-05',
    nom: 'RASOAMALALA',
    prenom: 'Marie Viviane',
    sexe: 'F',
    dateNaissance: '1992-09-22',
    lieuNaissance: 'Fianarantsoa',
    telephone: '+261 32 44 567 89',
    email: 'viviane.rasoa@gmail.com',
    statut: 'Actif',
    famille: {
      codeMenage: 'MEN-001',
      isChefMenage: false,
      conjointId: 'hab-001',
      enfantsIds: ['hab-003', 'hab-004']
    },
    residence: {
      adresse: 'III M 45 Ambohitantely',
      fokontany: 'Ambohitantely',
      commune: 'Antananarivo Renivohitra',
      district: 'Antananarivo I',
      gps: { lat: -18.9102, lng: 47.5251 }
    },
    education: {
      niveauEtude: 'Secondaire',
      diplome: 'BACC de l\'enseignement secondaire',
      competences: ['Couture', 'Cuisine & Restauration'],
      langues: ['Malagasy', 'Français']
    },
    economie: {
      profession: 'Couturière Indépendante',
      secteur: 'Commerce & Artisanat',
      revenuEstime: 600000
    },
    sante: {
      groupeSanguin: 'A+',
      hypertension: 'Normal',
      diabete: 'Surveillance',
      vaccination: ['BCG (Tuberculose)', 'Polio', 'Rougeole']
    }
  },
  {
    id: 'hab-003',
    nom: 'RABEARIVELO',
    prenom: 'Toky Nirina',
    sexe: 'M',
    dateNaissance: '2015-03-10',
    lieuNaissance: 'Antananarivo',
    statut: 'Actif',
    famille: {
      codeMenage: 'MEN-001',
      isChefMenage: false,
      pereId: 'hab-001',
      mereId: 'hab-002',
      enfantsIds: []
    },
    residence: {
      adresse: 'III M 45 Ambohitantely',
      fokontany: 'Ambohitantely',
      commune: 'Antananarivo Renivohitra',
      district: 'Antananarivo I'
    },
    education: {
      niveauEtude: 'Primaire',
      competences: [],
      langues: ['Malagasy', 'Français']
    },
    economie: {
      profession: 'Écolier',
      secteur: 'Sans Emploi / Retraité',
    },
    sante: {
      groupeSanguin: 'O+',
      hypertension: 'Normal',
      diabete: 'Normal',
      vaccination: ['BCG (Tuberculose)', 'Polio', 'DTC (Diphtérie, Tétanos, Coqueluche)', 'Hépatite B', 'Rougeole']
    }
  },
  {
    id: 'hab-004',
    nom: 'RABEARIVELO',
    prenom: 'Mihaja Hasina',
    sexe: 'F',
    dateNaissance: '2019-11-04',
    lieuNaissance: 'Antananarivo',
    statut: 'Actif',
    famille: {
      codeMenage: 'MEN-001',
      isChefMenage: false,
      pereId: 'hab-001',
      mereId: 'hab-002',
      enfantsIds: []
    },
    residence: {
      adresse: 'III M 45 Ambohitantely',
      fokontany: 'Ambohitantely',
      commune: 'Antananarivo Renivohitra',
      district: 'Antananarivo I'
    },
    education: {
      niveauEtude: 'Préscolaire',
      competences: [],
      langues: ['Malagasy']
    },
    economie: {
      profession: 'Enfant',
      secteur: 'Sans Emploi / Retraité',
    },
    sante: {
      groupeSanguin: 'A+',
      hypertension: 'Normal',
      diabete: 'Normal',
      vaccination: ['BCG (Tuberculose)', 'Polio', 'DTC (Diphtérie, Tétanos, Coqueluche)', 'Rougeole']
    }
  },

  // Ménage 2 (MEN-002) : Couple d'enseignants retraités (Chef, Conjointe)
  {
    id: 'hab-005',
    cin: '101031049281',
    dateCin: '1995-07-20',
    nom: 'RAKOTOMALALA',
    prenom: 'Arnaud Paul',
    sexe: 'M',
    dateNaissance: '1952-01-08',
    lieuNaissance: 'Toamasina',
    telephone: '+261 33 08 342 11',
    statut: 'Actif',
    famille: {
      codeMenage: 'MEN-002',
      isChefMenage: true,
      conjointId: 'hab-006',
      enfantsIds: []
    },
    residence: {
      adresse: 'Lot IV G 12 Ankadifotsy',
      fokontany: 'Ankadifotsy',
      commune: 'Antananarivo Renivohitra',
      district: 'Antananarivo III',
      gps: { lat: -18.9021, lng: 47.5302 }
    },
    education: {
      niveauEtude: 'Universitaire',
      diplome: 'Licence en Histoire',
      competences: ['Traduction'],
      langues: ['Malagasy', 'Français']
    },
    economie: {
      profession: 'Enseignant Retraité',
      secteur: 'Sans Emploi / Retraité',
      revenuEstime: 380000
    },
    sante: {
      groupeSanguin: 'B+',
      hypertension: 'Prioritaire',
      diabete: 'Normal',
      vaccination: ['BCG (Tuberculose)', 'Polio']
    },
    vulnerabilite: {
      estVulnerable: true,
      categories: ['Grand âge', 'Maladie chronique'],
      niveauPriorite: 'Moyen',
      description: 'Retraité de 74 ans sous traitement cardiovasculaire prioritaire régulier.',
      aidesObtenues: ['Soins gratuits']
    }
  },
  {
    id: 'hab-006',
    cin: '101052011294',
    dateCin: '1998-11-12',
    nom: 'RANDRIANASOLO',
    prenom: 'Esther Beatrice',
    sexe: 'F',
    dateNaissance: '1955-05-18',
    lieuNaissance: 'Antsirabe',
    statut: 'Actif',
    famille: {
      codeMenage: 'MEN-002',
      isChefMenage: false,
      conjointId: 'hab-005',
      enfantsIds: []
    },
    residence: {
      adresse: 'Lot IV G 12 Ankadifotsy',
      fokontany: 'Ankadifotsy',
      commune: 'Antananarivo Renivohitra',
      district: 'Antananarivo III',
      gps: { lat: -18.9021, lng: 47.5302 }
    },
    education: {
      niveauEtude: 'Universitaire',
      diplome: 'CAPEN Enseignement',
      competences: ['Couture'],
      langues: ['Malagasy', 'Français']
    },
    economie: {
      profession: 'Institutrice Retraitée',
      secteur: 'Sans Emploi / Retraité',
      revenuEstime: 350005
    },
    sante: {
      groupeSanguin: 'O-',
      hypertension: 'Surveillance',
      diabete: 'Prioritaire',
      vaccination: ['BCG (Tuberculose)', 'Polio']
    },
    vulnerabilite: {
      estVulnerable: true,
      categories: ['Grand âge', 'Maladie chronique'],
      niveauPriorite: 'Moyen',
      description: 'Enseignante retraitée sujette à une surveillance glycémique étroite.',
      aidesObtenues: ['Soins gratuits']
    }
  },

  // Ménage 3 (MEN-003): Mère célibataire active (Chef, 1 Enfant)
  {
    id: 'hab-007',
    cin: '101182049102',
    dateCin: '2011-06-18',
    nom: 'ANDRIANJAFY',
    prenom: 'Harilala Fitia',
    sexe: 'F',
    dateNaissance: '1985-02-14',
    lieuNaissance: 'Mahajanga',
    telephone: '+261 34 89 110 22',
    email: 'harilala.andrianjafy@gmail.com',
    statut: 'Actif',
    famille: {
      codeMenage: 'MEN-003',
      isChefMenage: true,
      enfantsIds: ['hab-008']
    },
    residence: {
      adresse: 'Lot A 51 Isoraka',
      fokontany: 'Isoraka',
      commune: 'Antananarivo Renivohitra',
      district: 'Antananarivo I',
      gps: { lat: -18.9115, lng: 47.5198 }
    },
    education: {
      niveauEtude: 'Universitaire',
      diplome: 'Licence Civile / Architecture',
      competences: ['Développement Web', 'Maçonnerie'],
      langues: ['Malagasy', 'Français', 'Anglais']
    },
    economie: {
      profession: 'Infographiste 3D',
      secteur: 'Technologie de l\'Information',
      employeur: 'E-Media Madagascar',
      revenuEstime: 1500000
    },
    sante: {
      groupeSanguin: 'AB+',
      hypertension: 'Normal',
      diabete: 'Normal',
      vaccination: ['BCG (Tuberculose)', 'Polio', 'Hépatite B', 'Rougeole']
    },
    vulnerabilite: {
      estVulnerable: true,
      categories: ['Famille monoparentale'],
      niveauPriorite: 'Moyen',
      description: 'Mère célibataire élevant seule son fils à charge.',
      aidesObtenues: []
    }
  },
  {
    id: 'hab-008',
    nom: 'ANDRIANJAFY',
    prenom: 'Nathan Tsiry',
    sexe: 'M',
    dateNaissance: '2013-08-30',
    lieuNaissance: 'Antananarivo',
    statut: 'Actif',
    famille: {
      codeMenage: 'MEN-003',
      isChefMenage: false,
      mereId: 'hab-007',
      enfantsIds: []
    },
    residence: {
      adresse: 'Lot A 51 Isoraka',
      fokontany: 'Isoraka',
      commune: 'Antananarivo Renivohitra',
      district: 'Antananarivo I'
    },
    education: {
      niveauEtude: 'Primaire',
      competences: [],
      langues: ['Malagasy', 'Français']
    },
    economie: {
      profession: 'Écolier',
      secteur: 'Sans Emploi / Retraité'
    },
    sante: {
      groupeSanguin: 'B+',
      hypertension: 'Normal',
      diabete: 'Normal',
      vaccination: ['BCG (Tuberculose)', 'Polio', 'DTC (Diphtérie, Tétanos, Coqueluche)', 'Rougeole']
    }
  },

  // Cas particuliers (Décédé / Déménagé pour tester l'historique de statut)
  {
    id: 'hab-009',
    cin: '101011039481',
    dateCin: '1974-05-18',
    nom: 'RANDRIAMANDIMBY',
    prenom: 'Lucien',
    sexe: 'M',
    dateNaissance: '1934-11-20',
    lieuNaissance: 'Fianarantsoa',
    statut: 'Décédé',
    famille: {
      codeMenage: 'MEN-004',
      isChefMenage: true,
      enfantsIds: []
    },
    residence: {
      adresse: 'Lot III F 77 Analakely',
      fokontany: 'Analakely',
      commune: 'Antananarivo Renivohitra',
      district: 'Antananarivo I'
    },
    education: {
      niveauEtude: 'Primaire',
      competences: ['Ébénisterie'],
      langues: ['Malagasy']
    },
    economie: {
      profession: 'Ancien Menuisier',
      secteur: 'Sans Emploi / Retraité'
    },
    sante: {
      groupeSanguin: 'O+',
      hypertension: 'Prioritaire',
      diabete: 'Prioritaire',
      vaccination: ['BCG (Tuberculose)']
    }
  },
  {
    id: 'hab-010',
    cin: '101252033812',
    dateCin: '2012-08-11',
    nom: 'RAVELOSON',
    prenom: 'Fanja Rova',
    sexe: 'F',
    dateNaissance: '1990-04-03',
    lieuNaissance: 'Antsirabe',
    telephone: '+261 34 56 789 01',
    statut: 'Déménagé',
    famille: {
      codeMenage: 'MEN-005',
      isChefMenage: true,
      enfantsIds: []
    },
    residence: {
      adresse: 'Lot II B 34 Behoririka',
      fokontany: 'Behoririka',
      commune: 'Antananarivo Renivohitra',
      district: 'Antananarivo III'
    },
    education: {
      niveauEtude: 'Secondaire',
      diplome: 'BACC',
      competences: ['Couture'],
      langues: ['Malagasy', 'Français']
    },
    economie: {
      profession: 'Secrétaire administrative',
      secteur: 'Administration Publique',
      revenuEstime: 450000
    },
    sante: {
      groupeSanguin: 'A-',
      hypertension: 'Normal',
      diabete: 'Normal',
      vaccination: []
    }
  },
  {
    id: 'IND-92015',
    cin: '101351293021',
    dateCin: '2010-02-14',
    nom: 'RAZAFIMANDIMBY',
    prenom: 'Fara Charlotte',
    sexe: 'F',
    dateNaissance: '1948-11-23',
    lieuNaissance: 'Antsirabe',
    telephone: '+261 33 44 281 90',
    statut: 'Actif',
    famille: {
      codeMenage: 'FOYER-48190',
      isChefMenage: true,
      enfantsIds: []
    },
    residence: {
      adresse: 'III T 88 Isoraka',
      fokontany: 'Isoraka',
      commune: 'Antananarivo Renivohitra',
      district: 'Antananarivo I',
      gps: { lat: -18.9122, lng: 47.5189 }
    },
    education: {
      niveauEtude: 'Aucun',
      competences: ['Couture'],
      langues: ['Malagasy']
    },
    economie: {
      profession: 'Sans emploi',
      secteur: 'Commerce & Artisanat',
      revenuEstime: 60000
    },
    sante: {
      groupeSanguin: 'O+',
      handicap: 'Moteur - Difficultés de marche',
      hypertension: 'Prioritaire',
      diabete: 'Surveillance',
      vaccination: ['BCG (Tuberculose)', 'Polio']
    },
    vulnerabilite: {
      estVulnerable: true,
      categories: ['Grand âge', 'Handicap', 'Pauvreté extrême'],
      niveauPriorite: 'Critique',
      description: 'Âgée de 78 ans, handicap moteur, sans ressources financières stables et sujette à une hypertension prioritaire.',
      aidesObtenues: ['Vivres', 'Aide financière']
    }
  }
];

export const initialLogs: HistoriqueLog[] = [
  {
    id: 'log-001',
    date: '2026-06-01T08:30:00.000Z',
    utilisateur: 'Secrétaire Fokontany',
    action: 'Création',
    details: 'Initialisation du registre. Import initial de 10 résidents du Fokontany.'
  },
  {
    id: 'log-002',
    date: '2026-06-05T10:15:00.000Z',
    utilisateur: 'Adjoint Fokontany',
    action: 'Certificat généré',
    details: 'Génération du certificat de résidence Nº 2026/045 pour RABEARIVELO Andry Jean.'
  },
  {
    id: 'log-003',
    date: '2026-06-10T14:45:00.000Z',
    utilisateur: 'Secrétaire Fokontany',
    action: 'Décès',
    details: 'Mise à jour du statut de RANDRIAMANDIMBY Lucien à "Décédé" suite au dépôt de l\'acte de décès officiel Nº 124/2026.'
  },
  {
    id: 'log-004',
    date: '2026-06-11T09:00:00.000Z',
    utilisateur: 'Chef Fokontany',
    action: 'Changement adresse',
    details: 'Changement d\'adresse enregistré pour RAVELOSON Fanja Rova, ayant déménagé hors du secteur Fokontany.'
  }
];
