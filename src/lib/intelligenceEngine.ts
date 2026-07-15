/**
 * FANISA — Moteur d'Analyse Intelligent
 * Calcule automatiquement le score de vulnérabilité et les indices
 * à partir des données factuelles collectées. Aucune saisie subjective.
 */
import { Foyer, Membre } from '../types';

// ── Types ─────────────────────────────────────────────────────────
export interface IndiceDetail {
  nom: string;
  score: number;       // 0–100
  poids: number;       // % pondération dans le score global
  facteurs_negatifs: string[];
  facteurs_positifs: string[];
}

export interface AnalyseIntelligence {
  score_global: number;         // 0–100
  niveau: 'Critique' | 'Élevée' | 'Modérée' | 'Faible' | 'Négligeable';
  couleur: string;
  indices: IndiceDetail[];
  facteurs_vulnerabilite: string[];
  points_forts: string[];
  recommandations: string[];
  completude: number;           // % complétude des données
  peut_analyser: boolean;
  raison_blocage?: string;
}

// ── Helpers ───────────────────────────────────────────────────────
const ageOf = (m: Membre): number =>
  m.date_naissance ? new Date().getFullYear() - new Date(m.date_naissance).getFullYear() : 0;

const clamp = (n: number): number => Math.max(0, Math.min(100, n));

// ── Vérification complétude ───────────────────────────────────────
export function verifierCompletude(foyer: Foyer, membres: Membre[]): { ok: boolean; pourcentage: number; manquants: string[] } {
  const manquants: string[] = [];
  let total = 0, remplis = 0;

  // Foyer
  const champsObligatoires: [any, string][] = [
    [foyer.adresse, 'Adresse du foyer'],
    [foyer.type_logement, 'Type de logement'],
    [foyer.eau_source || foyer.source_eau_principale, 'Source d\'eau'],
    [foyer.statut_occupant, 'Statut d\'occupation'],
    [(foyer.materiaux_mur || []).length > 0 || foyer.materiau_mur, 'Matériaux de mur'],
    [foyer.source_energie_cuisine || foyer.energie_cuisson, 'Source d\'énergie cuisine'],
  ];
  champsObligatoires.forEach(([val, label]) => {
    total++;
    if (val) remplis++; else manquants.push(label);
  });

  // Membres
  if (membres.length === 0) { manquants.push('Aucun membre recensé'); total++; }
  if (!membres.some(m => m.is_chef)) { manquants.push('Chef de ménage non désigné'); total++; }

  membres.forEach(m => {
    total += 3;
    if (m.date_naissance) remplis++; else manquants.push(`Date naissance : ${m.prenom || m.nom}`);
    if (m.sexe) remplis++;
    if (m.profession || ageOf(m) < 6) remplis++; else manquants.push(`Profession : ${m.prenom || m.nom}`);
  });

  const pourcentage = total > 0 ? Math.round((remplis / total) * 100) : 0;
  return { ok: pourcentage >= 70 && membres.length > 0, pourcentage, manquants: manquants.slice(0, 5) };
}

// ── MOTEUR PRINCIPAL ──────────────────────────────────────────────
export function analyserMenage(foyer: Foyer, membres: Membre[]): AnalyseIntelligence {
  const completude = verifierCompletude(foyer, membres);

  if (!completude.ok) {
    return {
      score_global: 0, niveau: 'Critique', couleur: '#EF4444',
      indices: [], facteurs_vulnerabilite: [], points_forts: [], recommandations: [],
      completude: completude.pourcentage, peut_analyser: false,
      raison_blocage: completude.manquants.join(' · '),
    };
  }

  const neg: string[] = [];
  const pos: string[] = [];
  const reco: string[] = [];

  // ── 1. INDICE LOGEMENT (poids: 20%) ──────────────────────────
  let scoreLoge = 60;
  const negLoge: string[] = [], posLoge: string[] = [];

  const murs = (foyer.materiaux_mur || [foyer.materiau_mur]).filter(Boolean).join(', ').toLowerCase();
  const toiture = (foyer.materiaux_toiture || [foyer.materiau_toiture]).filter(Boolean).join(', ').toLowerCase();
  const plancher = (foyer.materiaux_plancher || [foyer.materiau_plancher]).filter(Boolean).join(', ').toLowerCase();
  const typeLog = (foyer.type_logement || '').toLowerCase();

  if (murs.includes('brique') || murs.includes('béton') || murs.includes('parpaing')) { scoreLoge += 15; posLoge.push('Murs solides'); }
  else if (murs.includes('bois') || murs.includes('planches')) { scoreLoge -= 10; negLoge.push('Murs en bois'); }
  else if (murs.includes('tôle') || murs.includes('paille') || murs.includes('bambou')) { scoreLoge -= 20; negLoge.push('Habitat précaire (tôle/paille)'); }

  if (toiture.includes('tôle') || toiture.includes('tuile') || toiture.includes('béton')) { scoreLoge += 10; posLoge.push('Toiture solide'); }
  else if (toiture.includes('paille') || toiture.includes('végétal')) { scoreLoge -= 15; negLoge.push('Toiture précaire'); }

  if (typeLog.includes('en dur') || typeLog.includes('permanent') || typeLog.includes('béton')) { scoreLoge += 10; posLoge.push('Logement permanent'); }
  else if (typeLog.includes('précaire') || typeLog.includes('temporaire')) { scoreLoge -= 15; negLoge.push('Logement précaire'); }

  if (foyer.nombre_pieces) {
    const ratio = membres.length / foyer.nombre_pieces;
    if (ratio > 4) { scoreLoge -= 10; negLoge.push('Surpeuplement'); }
    else if (ratio <= 2) { scoreLoge += 5; posLoge.push('Espace suffisant'); }
  }
  if (foyer.superficie_maison && foyer.superficie_maison < 20) { scoreLoge -= 10; negLoge.push('Surface très réduite (<20m²)'); }

  if (negLoge.length === 0 && scoreLoge > 75) posLoge.push('Logement de bonne qualité');

  // ── 2. INDICE EAU & ASSAINISSEMENT (poids: 15%) ──────────────
  let scoreEau = 50;
  const negEau: string[] = [], posEau: string[] = [];
  const sourceEau = (foyer.eau_source || foyer.source_eau_principale || '').toLowerCase();

  if (sourceEau.includes('robinet') && sourceEau.includes('maison')) { scoreEau += 40; posEau.push('Eau courante à domicile'); }
  else if (sourceEau.includes('robinet') || sourceEau.includes('réseau')) { scoreEau += 25; posEau.push('Accès au réseau public'); }
  else if (sourceEau.includes('fontaine') || sourceEau.includes('borne')) { scoreEau += 15; posEau.push('Fontaine publique'); }
  else if (sourceEau.includes('puits')) { scoreEau += 5; }
  else if (sourceEau.includes('rivière') || sourceEau.includes('marigot') || sourceEau.includes('pluie')) { scoreEau -= 20; negEau.push('Source d\'eau non sécurisée'); }

  const toilettes = (foyer.type_toilettes || foyer.assainissement || '').toLowerCase();
  if (toilettes.includes('chasse') || toilettes.includes('wc')) { scoreEau += 15; posEau.push('Toilettes avec chasse d\'eau'); }
  else if (toilettes.includes('fosse') || toilettes.includes('latrine')) { scoreEau += 5; }
  else if (toilettes.includes('pas') || toilettes.includes('aucun') || !toilettes) { scoreEau -= 20; negEau.push('Absence de toilettes'); }

  // ── 3. INDICE ÉNERGIE & CONNECTIVITÉ (poids: 10%) ────────────
  let scoreEner = 50;
  const negEner: string[] = [], posEner: string[] = [];

  if (foyer.a_electricite === true) { scoreEner += 30; posEner.push('Électricité disponible'); }
  else { scoreEner -= 10; negEner.push('Pas d\'électricité'); }

  const energie = (foyer.source_energie_cuisine || foyer.energie_cuisson || '').toLowerCase();
  if (energie.includes('gaz') || energie.includes('électrique')) { scoreEner += 15; posEner.push('Énergie cuisine propre'); }
  else if (energie.includes('charbon')) { scoreEner -= 5; }
  else if (energie.includes('bois') || energie.includes('biomasse')) { scoreEner -= 10; negEner.push('Cuisine au bois (pollution)'); }

  const internet = foyer.a_internet || membres.some(m => m.acces_internet_individuel);
  if (internet) { scoreEner += 10; posEner.push('Accès à internet'); }

  // ── 4. INDICE ÉCONOMIQUE (poids: 25%) ─────────────────────────
  let scoreEco = 50;
  const negEco: string[] = [], posEco: string[] = [];

  const travailleursActifs = membres.filter(m => {
    const p = (m.profession || '').toLowerCase();
    const a = ageOf(m);
    return a >= 18 && p && !p.includes('sans') && !p.includes('retraité') && !p.includes('élève') && !p.includes('étudiant');
  });
  const nbAdultes = membres.filter(m => ageOf(m) >= 18).length;
  const tauxActif = nbAdultes > 0 ? travailleursActifs.length / nbAdultes : 0;

  if (tauxActif >= 0.7) { scoreEco += 20; posEco.push('Majorité de membres actifs'); }
  else if (tauxActif >= 0.5) { scoreEco += 10; }
  else if (tauxActif < 0.3) { scoreEco -= 15; negEco.push('Faible taux d\'activité économique'); }

  const revenuChef = membres.find(m => m.is_chef)?.revenu_estime || 0;
  const revenuTotal = membres.reduce((s, m) => s + (m.revenu_estime || 0), 0);
  if (revenuTotal > 500000) { scoreEco += 15; posEco.push('Revenus estimés corrects'); }
  else if (revenuTotal > 200000) { scoreEco += 5; }
  else if (revenuTotal > 0 && revenuTotal < 100000) { scoreEco -= 15; negEco.push('Revenus très faibles'); }
  else if (revenuTotal === 0) { scoreEco -= 5; } // données manquantes

  const hasCompteBank = membres.some(m => m.compte_bancaire);
  if (hasCompteBank) { scoreEco += 10; posEco.push('Compte bancaire'); }

  const hasElevage = membres.some(m => (m.agr_types || []).some(a => a.toLowerCase().includes('elev')));
  const hasAgri = membres.some(m => (m.agr_types || []).some(a => a.toLowerCase().includes('agri')));
  if (hasElevage || hasAgri) { scoreEco += 10; posEco.push('Activité agropastorale'); }

  // ── 5. INDICE SANITAIRE (poids: 15%) ─────────────────────────
  let scoreSante = 60;
  const negSante: string[] = [], posSante: string[] = [];

  const nbHandicap = membres.filter(m => m.handicap_oui || !!m.handicap).length;
  const nbMaladies = membres.filter(m => (m.maladies_chroniques || []).length > 0).length;
  const nbGrossesse = membres.filter(m => m.grossesse_cours).length;
  const nbVaccines = membres.filter(m => (m.vaccination || []).length > 0).length;

  if (nbHandicap > 0) { scoreSante -= nbHandicap * 10; negSante.push(`${nbHandicap} personne(s) handicapée(s)`); }
  if (nbMaladies > 0) { scoreSante -= nbMaladies * 8; negSante.push(`${nbMaladies} maladie(s) chronique(s)`); }
  if (nbGrossesse > 0) { scoreSante -= 5; negSante.push('Grossesse(s) en cours (suivi nécessaire)'); }

  const nbSuivi = membres.filter(m => m.suivi_medical).length;
  if (nbSuivi > 0) { posSante.push('Suivi médical actif'); }

  if (nbVaccines >= membres.length * 0.8) { scoreSante += 15; posSante.push('Vaccination complète'); }
  else if (nbVaccines > 0) { scoreSante += 5; }
  else { scoreSante -= 5; negSante.push('Vaccination non documentée'); }

  const hypertensionCrit = membres.filter(m => m.hypertension === 'Prioritaire').length;
  const diabeteCrit = membres.filter(m => m.diabete === 'Prioritaire').length;
  if (hypertensionCrit + diabeteCrit > 0) { scoreSante -= (hypertensionCrit + diabeteCrit) * 8; negSante.push('Pathologies chroniques prioritaires'); }

  // ── 6. INDICE ÉDUCATIF (poids: 10%) ──────────────────────────
  let scoreEduc = 60;
  const negEduc: string[] = [], posEduc: string[] = [];

  const enfants6_18 = membres.filter(m => { const a = ageOf(m); return a >= 6 && a <= 18; });
  const nbScolarises = enfants6_18.filter(m => {
    const p = (m.profession || '').toLowerCase();
    return p.includes('élève') || p.includes('étudiant') || m.niveau_etude;
  }).length;

  if (enfants6_18.length > 0) {
    const taux = nbScolarises / enfants6_18.length;
    if (taux >= 0.9) { scoreEduc += 20; posEduc.push('Tous les enfants scolarisés'); }
    else if (taux >= 0.6) { scoreEduc += 5; }
    else if (taux < 0.5) { scoreEduc -= 20; negEduc.push('Enfants non scolarisés'); }
  }

  const adultesSansDiplome = membres.filter(m => {
    const a = ageOf(m);
    return a >= 18 && (!m.niveau_etude || m.niveau_etude === 'Aucun');
  }).length;
  if (adultesSansDiplome > 0) { scoreEduc -= adultesSansDiplome * 5; negEduc.push('Adultes sans instruction'); }

  const niveauxSuper = membres.filter(m => m.niveau_etude && ['Universitaire', 'Lycée', 'Baccalauréat'].some(n => m.niveau_etude!.includes(n))).length;
  if (niveauxSuper > 0) { scoreEduc += niveauxSuper * 8; posEduc.push('Niveau d\'études élevé'); }

  // ── 7. INDICE COMPOSITION FAMILIALE (poids: 5%) ──────────────
  let scoreCompo = 70;
  const negCompo: string[] = [], posCompo: string[] = [];

  const nbEnfantsMoins5 = membres.filter(m => ageOf(m) < 5).length;
  const nbAges60plus = membres.filter(m => ageOf(m) >= 60).length;
  const ratioDepend = nbAdultes > 0 ? (membres.length - nbAdultes) / nbAdultes : 10;

  if (nbEnfantsMoins5 >= 3) { scoreCompo -= 15; negCompo.push(`${nbEnfantsMoins5} enfants < 5 ans`); }
  if (nbAges60plus >= 2) { scoreCompo -= 10; negCompo.push(`${nbAges60plus} personnes âgées`); }
  if (ratioDepend > 2.5) { scoreCompo -= 15; negCompo.push('Taux de dépendance élevé'); }
  if (membres.length === 1) { scoreCompo -= 10; negCompo.push('Ménage isolé (personne seule)'); }
  if (travailleursActifs.length >= 2) { scoreCompo += 10; posCompo.push('Pluriactif'); }

  // ── SCORE GLOBAL PONDÉRÉ ──────────────────────────────────────
  const ponderation = [
    { nom: 'Logement', score: clamp(scoreLoge), poids: 20, neg: negLoge, pos: posLoge },
    { nom: 'Eau & Assainissement', score: clamp(scoreEau), poids: 15, neg: negEau, pos: posEau },
    { nom: 'Énergie & Services', score: clamp(scoreEner), poids: 10, neg: negEner, pos: posEner },
    { nom: 'Situation économique', score: clamp(scoreEco), poids: 25, neg: negEco, pos: posEco },
    { nom: 'Santé', score: clamp(scoreSante), poids: 15, neg: negSante, pos: posSante },
    { nom: 'Éducation', score: clamp(scoreEduc), poids: 10, neg: negEduc, pos: posEduc },
    { nom: 'Composition familiale', score: clamp(scoreCompo), poids: 5, neg: negCompo, pos: posCompo },
  ];

  const scoreGlobal = clamp(Math.round(
    ponderation.reduce((s, p) => s + p.score * p.poids / 100, 0)
  ));

  // Tous facteurs négatifs triés par impact
  const tousNegatifs = ponderation.flatMap(p => p.neg.map(n => ({ msg: n, poids: p.poids })));
  tousNegatifs.sort((a, b) => b.poids - a.poids);
  const tousPositifs = ponderation.flatMap(p => p.pos);

  // Recommandations basées sur les indices les plus faibles
  const indicesFaibles = [...ponderation].sort((a, b) => a.score - b.score);
  const recoMap: Record<string, string> = {
    'Logement': 'Prioritaire pour la réhabilitation du logement',
    'Eau & Assainissement': 'Accès à l\'eau potable à améliorer',
    'Énergie & Services': 'Amélioration de l\'accès aux services essentiels',
    'Situation économique': 'Éligible à un programme de microcrédit ou aide sociale',
    'Santé': 'Suivi médical et accès aux soins prioritaire',
    'Éducation': 'Soutien à la scolarisation des enfants',
    'Composition familiale': 'Suivi social recommandé',
  };

  indicesFaibles.filter(i => i.score < 60).forEach(i => {
    if (recoMap[i.nom]) reco.push(recoMap[i.nom]);
  });
  if (reco.length === 0) reco.push('Aucune intervention prioritaire identifiée — situation stable');
  if (tousNegatifs.some(n => n.msg.includes('alimentaire') || n.msg.includes('revenu'))) {
    reco.unshift('Prioritaire pour une aide alimentaire');
  }

  // Niveau de vulnérabilité
  const niveau = scoreGlobal >= 80 ? 'Négligeable'
    : scoreGlobal >= 65 ? 'Faible'
    : scoreGlobal >= 50 ? 'Modérée'
    : scoreGlobal >= 35 ? 'Élevée'
    : 'Critique';

  const couleur = scoreGlobal >= 80 ? '#10B981'
    : scoreGlobal >= 65 ? '#3B82F6'
    : scoreGlobal >= 50 ? '#F59E0B'
    : scoreGlobal >= 35 ? '#F97316'
    : '#EF4444';

  return {
    score_global: scoreGlobal,
    niveau,
    couleur,
    indices: ponderation.map(p => ({
      nom: p.nom, score: p.score, poids: p.poids,
      facteurs_negatifs: p.neg, facteurs_positifs: p.pos,
    })),
    facteurs_vulnerabilite: tousNegatifs.map(n => n.msg).slice(0, 8),
    points_forts: tousPositifs.slice(0, 6),
    recommandations: [...new Set(reco)].slice(0, 5),
    completude: completude.pourcentage,
    peut_analyser: true,
  };
}
