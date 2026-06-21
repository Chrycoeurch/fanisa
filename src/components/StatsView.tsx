import React, { useState } from 'react';
import { Habitant, Foyer, Membre } from '../types';
import { SECTEUR_LIST, FOKONTANY_LIST } from '../seedData';
import { Users, Heart, GraduationCap, Briefcase, ChevronRight, TrendingUp, Droplets, Zap, Sun, Flame, Wifi, AlertTriangle, ShieldAlert, Gauge, UserX, Home, Hammer, Construction, Baby, Accessibility, Activity, Syringe, ClipboardList } from 'lucide-react';

interface StatsViewProps {
  habitants: Habitant[];
  foyers?: Foyer[];
  membres?: Membre[];
}

export default function StatsView({ habitants, foyers = [], membres = [] }: StatsViewProps) {
  const activeHabitants = habitants.filter(h => h.statut === 'Actif');
  const totalCount = activeHabitants.length;
  
  // Calculate demographic metrics
  const menCount = activeHabitants.filter(h => h.sexe === 'M').length;
  const womenCount = activeHabitants.filter(h => h.sexe === 'F').length;
  const childrenCount = activeHabitants.filter(h => {
    const age = new Date().getFullYear() - new Date(h.dateNaissance).getFullYear();
    return age < 18;
  }).length;
  
  // Households (unique codeMenage)
  const uniqueHouseholds = new Set(activeHabitants.map(h => h.famille.codeMenage)).size;
  
  // Health markers
  const htSurveillance = activeHabitants.filter(h => h.sante.hypertension === 'Surveillance').length;
  const htPrioritaire = activeHabitants.filter(h => h.sante.hypertension === 'Prioritaire').length;
  const dbSurveillance = activeHabitants.filter(h => h.sante.diabete === 'Surveillance').length;
  const dbPrioritaire = activeHabitants.filter(h => h.sante.diabete === 'Prioritaire').length;
  
  // Sectors of activity
  const secteurCounts = SECTEUR_LIST.reduce((acc, current) => {
    acc[current] = activeHabitants.filter(h => h.economie.secteur === current).length;
    return acc;
  }, {} as Record<string, number>);
  
  // Education levels
  const rawLevels = ['Préscolaire', 'Primaire', 'Secondaire', 'Universitaire', 'Aucun'];
  const eduCounts = rawLevels.reduce((acc, current) => {
    acc[current] = activeHabitants.filter(h => h.education.niveauEtude === current).length;
    return acc;
  }, {} as Record<string, number>);

  // Fokontany counts
  const fokontanyCounts = FOKONTANY_LIST.reduce((acc, current) => {
    acc[current] = activeHabitants.filter(h => h.residence.fokontany === current).length;
    return acc;
  }, {} as Record<string, number>);

  // ── Indicateurs automatiques (basés sur les foyers) ──────────
  const activeFoyers = foyers.filter(f => f.statut === 'Actif');
  const totalFoyers = activeFoyers.length;
  const pct = (n: number) => totalFoyers > 0 ? Math.round((n / totalFoyers) * 100) : 0;

  const nbEauPotable = activeFoyers.filter(f => f.eau_potable === true).length;
  const nbSansToilette = activeFoyers.filter(f => f.toilette_type === 'Aucune toilette').length;
  const nbElectrifies = activeFoyers.filter(f => f.a_electricite === true).length;
  const nbSolaire = activeFoyers.filter(f => f.eclairage_source === 'Panneaux solaires').length;
  const nbCharbonBois = activeFoyers.filter(f => f.cuisson_source === 'Charbon' || f.cuisson_source === 'Bois de chauffe').length;
  const nbInternet = activeFoyers.filter(f => f.acces_internet === true).length;
  const nbInondation = activeFoyers.filter(f => (f.risques_types || []).includes('Inondation')).length;
  const nbVulnerables = activeFoyers.filter(f => f.est_vulnerable === true).length;

  // ── Indicateurs niveau ménage (nouveaux, sans doublon) ────────
  const activeMembres = membres.filter(m => m.statut === 'Actif');
  // Personne âgée vivant seule = foyer avec 1 seul membre actif, âgé de 60+
  const nbPersonnesAgeesIsolees = activeFoyers.filter(f => {
    const membresFoyer = activeMembres.filter(m => m.foyer_id === f.id);
    if (membresFoyer.length !== 1) return false;
    const m = membresFoyer[0];
    if (!m.date_naissance) return false;
    const age = Math.abs(new Date(Date.now() - new Date(m.date_naissance).getTime()).getUTCFullYear() - 1970);
    return age >= 60;
  }).length;
  const nbMenagesHandicap = activeFoyers.filter(f => (f.nb_personnes_handicapees || 0) > 0).length;
  const nbInsecuriteAlim = activeFoyers.filter(f => f.difficulte_alimentaire === true).length;
  const nbToucheCatastrophe = activeFoyers.filter(f => f.affecte_catastrophe === true).length;
  const nbRenovation = activeFoyers.filter(f => (f.travaux_types || []).some(t => t.includes('Renovation') || t.includes('Rénovation'))).length;
  const nbReconstruction = activeFoyers.filter(f => (f.travaux_types || []).includes('Reconstruction complete') || (f.travaux_types || []).includes('Reconstruction complète')).length;
  const menagesPrioritaires = activeFoyers.filter(f => f.niveau_vulnerabilite_global === 'Critique' || f.travaux_urgence === 'Critique');

  // ── Indicateurs niveau individu (santé) ───────────────────────
  const nbFemmesEnceintes = activeMembres.filter(m => m.grossesse_cours === true).length;
  const nbPersonnesHandicapees = activeMembres.filter(m => m.handicap_oui === true).length;
  const nbHypertendus = activeMembres.filter(m => m.hypertension && m.hypertension !== 'Normal').length;
  const nbDiabetiques = activeMembres.filter(m => m.diabete && m.diabete !== 'Normal').length;
  const nbMaladiesChroniques = activeMembres.filter(m => (m.maladies_chroniques || []).length > 0).length;
  const nbPersonnesPrioritaires = activeMembres.filter(m => m.priorite_sanitaire === 'Prioritaire').length;
  const nbVaccines = activeMembres.filter(m => m.statut_vaccinal === 'A jour' || m.statut_vaccinal === 'À jour').length;
  const nbNonVaccines = activeMembres.filter(m => m.statut_vaccinal === 'Non vaccine' || m.statut_vaccinal === 'Non vacciné').length;
  const nbSuiviMedical = activeMembres.filter(m => m.suivi_medical === true).length;


  // Taux d'accès global aux services de base : moyenne (eau potable + électricité + toilette correcte + internet)
  const nbServiceBase = activeFoyers.filter(f =>
    f.eau_potable === true && f.a_electricite === true && f.toilette_type !== 'Aucune toilette'
  ).length;
  const tauxAccesServices = pct(nbServiceBase);

  const INDICATEURS = [
    { label: 'Accès à l\'eau potable', value: nbEauPotable, icon: Droplets, color: 'blue' },
    { label: 'Sans toilette', value: nbSansToilette, icon: AlertTriangle, color: 'red' },
    { label: 'Ménages électrifiés', value: nbElectrifies, icon: Zap, color: 'amber' },
    { label: 'Utilisant le solaire', value: nbSolaire, icon: Sun, color: 'yellow' },
    { label: 'Charbon / Bois (cuisson)', value: nbCharbonBois, icon: Flame, color: 'orange' },
    { label: 'Accès à Internet', value: nbInternet, icon: Wifi, color: 'indigo' },
    { label: 'Exposés aux inondations', value: nbInondation, icon: AlertTriangle, color: 'cyan' },
    { label: 'Ménages vulnérables', value: nbVulnerables, icon: ShieldAlert, color: 'rose' },
  ];

  const INDICATEURS_MENAGE = [
    { label: 'Personnes âgées isolées', value: nbPersonnesAgeesIsolees, icon: UserX, color: 'amber' },
    { label: 'Ménages avec handicapé(s)', value: nbMenagesHandicap, icon: Accessibility, color: 'indigo' },
    { label: 'Insécurité alimentaire', value: nbInsecuriteAlim, icon: AlertTriangle, color: 'red' },
    { label: 'Touchés par catastrophe', value: nbToucheCatastrophe, icon: AlertTriangle, color: 'orange' },
    { label: 'Maisons à rénover', value: nbRenovation, icon: Hammer, color: 'amber' },
    { label: 'Maisons à reconstruire', value: nbReconstruction, icon: Construction, color: 'red' },
  ];

  const INDICATEURS_SANTE = [
    { label: 'Femmes enceintes', value: nbFemmesEnceintes, icon: Baby, color: 'pink' },
    { label: 'Personnes handicapées', value: nbPersonnesHandicapees, icon: Accessibility, color: 'indigo' },
    { label: 'Hypertendus', value: nbHypertendus, icon: Activity, color: 'red' },
    { label: 'Diabétiques', value: nbDiabetiques, icon: Activity, color: 'orange' },
    { label: 'Maladies chroniques', value: nbMaladiesChroniques, icon: Heart, color: 'rose' },
    { label: 'Personnes prioritaires', value: nbPersonnesPrioritaires, icon: AlertTriangle, color: 'red' },
    { label: 'Vaccinés à jour', value: nbVaccines, icon: Syringe, color: 'green' },
    { label: 'Non vaccinés', value: nbNonVaccines, icon: Syringe, color: 'amber' },
    { label: 'Suivi médical requis', value: nbSuiviMedical, icon: ClipboardList, color: 'blue' },
  ];

  const COLOR_MAP: Record<string, { bg: string; text: string; iconBg: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', iconBg: 'bg-blue-100' },
    red: { bg: 'bg-red-50', text: 'text-red-700', iconBg: 'bg-red-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', iconBg: 'bg-amber-100' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', iconBg: 'bg-yellow-100' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-700', iconBg: 'bg-orange-100' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', iconBg: 'bg-indigo-100' },
    cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', iconBg: 'bg-cyan-100' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-700', iconBg: 'bg-rose-100' },
    pink: { bg: 'bg-pink-50', text: 'text-pink-700', iconBg: 'bg-pink-100' },
    green: { bg: 'bg-emerald-50', text: 'text-emerald-700', iconBg: 'bg-emerald-100' },
  };

  // SVG Donut calculation for Gender
  const menPercentage = totalCount > 0 ? (menCount / totalCount) * 100 : 0;
  const womenPercentage = totalCount > 0 ? (womenCount / totalCount) * 100 : 0;
  
  // Donut attributes
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashMen = (menPercentage / 100) * circumference;
  const strokeDashWomen = (womenPercentage / 100) * circumference;

  return (
    <div id="stats-view-container" className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div id="metric-population" className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Habitants Actifs</p>
            <h3 className="text-2xl font-semibold text-slate-900 font-mono mt-0.5">{totalCount}</h3>
            <p className="text-xs text-slate-400 mt-1">{habitants.length - totalCount} archivés (décédés/départ)</p>
          </div>
        </div>

        <div id="metric-households" className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Ménages Enregistrés</p>
            <h3 className="text-2xl font-semibold text-slate-900 font-mono mt-0.5">{uniqueHouseholds}</h3>
            <p className="text-xs text-slate-400 mt-1">~{(totalCount / (uniqueHouseholds || 1)).toFixed(1)} hab. par ménage</p>
          </div>
        </div>

        <div id="metric-children" className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="bg-cyan-50 p-3 rounded-lg text-cyan-600">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Mineurs (-18 ans)</p>
            <h3 className="text-2xl font-semibold text-slate-900 font-mono mt-0.5">{childrenCount}</h3>
            <p className="text-xs text-slate-400 mt-1">{totalCount > 0 ? ((childrenCount / totalCount) * 100).toFixed(0) : 0}% de la population active</p>
          </div>
        </div>

        <div id="metric-vulnerable" className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="bg-amber-50 p-3 rounded-lg text-amber-600">
            <Heart className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Suivis de Santé</p>
            <h3 className="text-2xl font-semibold text-slate-900 font-mono mt-0.5">{htPrioritaire + dbPrioritaire + htSurveillance + dbSurveillance}</h3>
            <p className="text-xs text-indigo-700 font-medium mt-1 bg-indigo-50/50 inline-block px-1.5 py-0.5 rounded">{htPrioritaire + dbPrioritaire} cas prioritaires</p>
          </div>
        </div>
      </div>

      {/* Visual Analytics */}
      <div id="charts-row" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Demographics / Gender Donut */}
        <div id="gender-donut-card" className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-slate-800">Répartition Démographique par Sexe</h4>
              <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Rapport H / F</span>
            </div>
            
            <div className="flex items-center justify-center p-4 relative">
              <svg className="w-40 h-40 transform -rotate-90">
                {/* Background Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  className="stroke-slate-100"
                  strokeWidth="16"
                  fill="transparent"
                />
                {/* Men Segment */}
                {totalCount > 0 && strokeDashMen > 0 && (
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    className="stroke-indigo-600 transition-all duration-500 hover:opacity-90"
                    strokeWidth="16"
                    fill="transparent"
                    strokeDasharray={`${strokeDashMen} ${circumference}`}
                  />
                )}
                {/* Women Segment */}
                {totalCount > 0 && strokeDashWomen > 0 && (
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    className="stroke-pink-500 transition-all duration-500 hover:opacity-90"
                    strokeWidth="16"
                    fill="transparent"
                    strokeDasharray={`${strokeDashWomen} ${circumference}`}
                    strokeDashoffset={-strokeDashMen}
                  />
                )}
              </svg>
              {/* Inner Center Metrics */}
              <div className="absolute text-center">
                <span className="text-xs font-mono text-slate-500 uppercase">Ratio H/F</span>
                <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                  {womenCount > 0 ? (menCount / womenCount).toFixed(2) : menCount}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 mt-4 border-t border-slate-100 pt-4">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block"></span>
                <span className="text-slate-600">Hommes</span>
              </div>
              <span className="font-mono font-medium text-slate-900">{menCount} ({menPercentage.toFixed(0)}%)</span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-pink-500 inline-block"></span>
                <span className="text-slate-600">Femmes</span>
              </div>
              <span className="font-mono font-medium text-slate-900">{womenCount} ({womenPercentage.toFixed(0)}%)</span>
            </div>
          </div>
        </div>

        {/* Sectors of Activity Bar Chart */}
        <div id="economic-sectors-card" className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-slate-800">Répartition par Secteur Économique</h4>
            <div className="flex items-center text-xs text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded">
              <Briefcase className="h-3.5 w-3.5 mr-1" />
              Secteurs actifs
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(secteurCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([secteur, count]) => {
                const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
                return (
                  <div key={secteur} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-700 font-medium truncate max-w-[250px]">{secteur}</span>
                      <span className="font-mono text-slate-500 font-medium">{count} ({percentage.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage || 2}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

      </div>

      {/* Focus: Health and Education Grid */}
      <div id="health-edu-row" className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Health Risk Monitors */}
        <div id="health-risks-card" className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-slate-800">Statut Cardio-Vasculaire & Endocrinien</h4>
            <span className="text-xs text-rose-600 font-medium bg-rose-50 px-2 py-0.5 rounded flex items-center">
              <Heart className="h-3.5 w-3.5 mr-1" />
              Surveillance Médicale
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hypertension segment */}
            <div className="border border-slate-100 rounded-lg p-4 bg-slate-50/50">
              <p className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">Hypertension Artérielle</p>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Normal</span>
                  <span className="font-semibold font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    {activeHabitants.filter(h => h.sante.hypertension === 'Normal').length} (
                    {((activeHabitants.filter(h => h.sante.hypertension === 'Normal').length / (totalCount || 1)) * 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Surveillance</span>
                  <span className="font-semibold font-mono text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    {htSurveillance} ({((htSurveillance / (totalCount || 1)) * 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Prioritaire / Risque</span>
                  <span className="font-semibold font-mono text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                    {htPrioritaire} ({((htPrioritaire / (totalCount || 1)) * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Diabetes segment */}
            <div className="border border-slate-100 rounded-lg p-4 bg-slate-50/50">
              <p className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">Diabète & Glycémie</p>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Normal</span>
                  <span className="font-semibold font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    {activeHabitants.filter(h => h.sante.diabete === 'Normal').length} (
                    {((activeHabitants.filter(h => h.sante.diabete === 'Normal').length / (totalCount || 1)) * 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Surveillance</span>
                  <span className="font-semibold font-mono text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    {dbSurveillance} ({((dbSurveillance / (totalCount || 1)) * 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Prioritaire / Risque</span>
                  <span className="font-semibold font-mono text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                    {dbPrioritaire} ({((dbPrioritaire / (totalCount || 1)) * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Education level */}
        <div id="education-attainment-card" className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-slate-800">Niveau d'Instruction Général</h4>
            <span className="text-xs text-sky-600 font-medium bg-sky-50 px-2 py-0.5 rounded flex items-center">
              <GraduationCap className="h-3.5 w-3.5 mr-1" />
              Scolarisation
            </span>
          </div>

          <div className="space-y-4">
            {Object.entries(eduCounts).map(([level, count]) => {
              const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
              return (
                <div key={level}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">{level}</span>
                    <span className="font-mono text-slate-900 font-semibold">{count} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct || 1}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Indicateurs automatiques du Fokontany */}
      <div id="auto-indicators" className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Gauge className="h-4 w-4 text-indigo-600" />Indicateurs automatiques</h4>
          <span className="text-xs text-slate-400">{totalFoyers} foyer{totalFoyers > 1 ? 's' : ''} actif{totalFoyers > 1 ? 's' : ''}</span>
        </div>

        {totalFoyers === 0 ? (
          <p className="text-xs text-slate-400 italic py-8 text-center">Aucun foyer enregistré pour le moment.</p>
        ) : (
          <>
            {/* Taux d'accès global */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl p-5 mb-5 text-white flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-200 uppercase tracking-wider font-semibold">Taux d'accès aux services de base</p>
                <p className="text-3xl font-bold mt-1">{tauxAccesServices}%</p>
                <p className="text-[11px] text-indigo-200 mt-0.5">{nbServiceBase} / {totalFoyers} foyers avec eau potable + électricité + toilette</p>
              </div>
              <div className="w-20 h-20 relative shrink-0">
                <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke="white" strokeWidth="8" strokeDasharray={`${2 * Math.PI * 34}`} strokeDashoffset={`${2 * Math.PI * 34 * (1 - tauxAccesServices / 100)}`} strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* Grille indicateurs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {INDICATEURS.map(({ label, value, icon: Icon, color }) => {
                const c = COLOR_MAP[color];
                return (
                  <div key={label} className={`${c.bg} rounded-xl p-4 border border-slate-100`}>
                    <div className={`${c.iconBg} w-8 h-8 rounded-lg flex items-center justify-center mb-2`}>
                      <Icon className={`h-4 w-4 ${c.text}`} />
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{value}</p>
                    <p className={`text-[11px] font-medium ${c.text} mt-0.5`}>{label}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{pct(value)}% des foyers</p>
                  </div>
                );
              })}
            </div>

            {/* Indicateurs niveau ménage */}
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-6 mb-3">Vulnérabilité & Habitat</h5>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {INDICATEURS_MENAGE.map(({ label, value, icon: Icon, color }) => {
                const c = COLOR_MAP[color];
                return (
                  <div key={label} className={`${c.bg} rounded-xl p-4 border border-slate-100`}>
                    <div className={`${c.iconBg} w-8 h-8 rounded-lg flex items-center justify-center mb-2`}>
                      <Icon className={`h-4 w-4 ${c.text}`} />
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{value}</p>
                    <p className={`text-[11px] font-medium ${c.text} mt-0.5`}>{label}</p>
                  </div>
                );
              })}
            </div>

            {/* Liste ménages prioritaires */}
            {menagesPrioritaires.length > 0 && (
              <div className="mt-6 bg-red-50 border border-red-100 rounded-xl p-4">
                <h5 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" />Ménages prioritaires pour intervention ({menagesPrioritaires.length})
                </h5>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {menagesPrioritaires.map(f => (
                    <div key={f.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-xs border border-red-100">
                      <span className="font-mono font-bold text-slate-700">{f.code_menage}</span>
                      <span className="text-slate-500">{[f.adresse, f.fokontany].filter(Boolean).join(' · ')}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white">Critique</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Indicateurs santé individuelle */}
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-6 mb-3">Santé de la population ({activeMembres.length} personnes)</h5>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {INDICATEURS_SANTE.map(({ label, value, icon: Icon, color }) => {
                const c = COLOR_MAP[color];
                const pctMembres = activeMembres.length > 0 ? Math.round((value / activeMembres.length) * 100) : 0;
                return (
                  <div key={label} className={`${c.bg} rounded-xl p-4 border border-slate-100`}>
                    <div className={`${c.iconBg} w-8 h-8 rounded-lg flex items-center justify-center mb-2`}>
                      <Icon className={`h-4 w-4 ${c.text}`} />
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{value}</p>
                    <p className={`text-[11px] font-medium ${c.text} mt-0.5`}>{label}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{pctMembres}% de la population</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Fokontany demographics ledger */}
      <div id="geography-ledger" className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <h4 className="text-sm font-semibold text-slate-800 mb-4">Démographie par Fokontany</h4>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {Object.entries(fokontanyCounts).map(([fokontany, count]) => (
            <div key={fokontany} className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 text-center">
              <span className="text-xs font-semibold text-slate-800 truncate block mb-1">{fokontany}</span>
              <p className="font-mono text-lg font-bold text-slate-900">{count}</p>
              <span className="text-[10px] text-slate-400 font-mono">habitants</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
