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
const NIVEAUX_ETUDE = ['Non scolarisé', 'Primaire', 'Secondaire', 'Universitaire', 'Formation professionnelle'];
const ACTIVITES_PRINCIPALES = [
  'Agriculture', 'Élevage', 'Pêche', 'Artisanat', 'Commerce', 'Transport',
  'Construction', 'Administration', 'Enseignement', 'Santé', 'Services',
  'Retraité', 'Sans emploi', 'Étudiant', 'Femme au foyer', 'Autre',
];
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
  const [telephone, setTelephone] = useState(membre?.telephone || '');
  const [email, setEmail] = useState(membre?.email || '');
  const [statut, setStatut] = useState<Membre['statut']>(membre?.statut || 'Actif');
  const [autre_relation_label, setAutreRelationLabel] = useState(membre?.relation_chef && !["Chef","Épouse/Époux","Fils","Fille","Père","Mère","Frère","Sœur","Grand-père","Grand-mère","Petit-fils","Petite-fille","Oncle","Tante","Neveu","Nièce"].includes(membre.relation_chef) ? membre.relation_chef : "");
  const [relation_chef, setRelationChef] = useState<RelationChef>(membre?.relation_chef || 'Autre');
  const [photo_url, setPhotoUrl] = useState(membre?.photo_url || '');

  // Famille
  const [conjoint_id, setConjointId] = useState(membre?.conjoint_id || '');
  const [pere_id, setPereId] = useState(membre?.pere_id || '');
  const [mere_id, setMereId] = useState(membre?.mere_id || '');
  const [pere_nom, setPereNom] = useState(membre?.pere_nom || '');
  const [mere_nom, setMereNom] = useState(membre?.mere_nom || '');

  // Éducation
  const [niveau_etude, setNiveauEtude] = useState(membre?.niveau_etude || 'Secondaire');
  const [diplome, setDiplome] = useState(membre?.diplome || '');
  const [profession, setProfession] = useState(membre?.profession || '');
  const [detail_activite, setDetailActivite] = useState(membre?.employeur || '');
  const [secteur, setSecteur] = useState(membre?.secteur || '');
  const [employeur, setEmployeur] = useState(membre?.employeur || '');
  const [revenu_estime, setRevenu] = useState(membre?.revenu_estime?.toString() || '');
  const [langues, setLangues] = useState<string[]>(membre?.langues || ['Malagasy']);
  const [competences, setCompetences] = useState<string[]>(membre?.competences || []);
  const [newCompetence, setNewCompetence] = useState('');

  // Santé
  const [groupe_sanguin, setGroupeSanguin] = useState(membre?.groupe_sanguin || '');
  const [handicap, setHandicap] = useState(membre?.handicap || '');
  const [hypertension, setHypertension] = useState<Membre['hypertension']>(membre?.hypertension || 'Normal');
  const [diabete, setDiabete] = useState<Membre['diabete']>(membre?.diabete || 'Normal');
  const [vaccination, setVaccination] = useState<string[]>(membre?.vaccination || []);
  const [poids, setPoids] = useState(membre?.poids?.toString() || '');
  const [taille, setTaille] = useState(membre?.taille?.toString() || '');

  // Vulnérabilité
  const [est_vulnerable, setEstVulnerable] = useState(membre?.est_vulnerable || false);
  const [vulnerabilite_categories, setVulnCats] = useState<string[]>(membre?.vulnerabilite_categories || []);
  const [vulnerabilite_description, setVulnDesc] = useState(membre?.vulnerabilite_description || '');
  const [niveau_priorite, setNiveauPriorite] = useState<Membre['niveau_priorite']>(membre?.niveau_priorite || 'Aucun');
  const [aides_obtenues, setAides] = useState<string[]>(membre?.aides_obtenues || []);

  const toggleArr = <T,>(arr: T[], val: T) => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  const age = date_naissance ? Math.abs(new Date(Date.now() - new Date(date_naissance).getTime()).getUTCFullYear() - 1970) : 99;
  const isMineur = age < 18;
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
      diplome: diplome || undefined,
      profession: profession || undefined,
      secteur: secteur || undefined,
      employeur: (employeur || detail_activite) || undefined,
      revenu_estime: revenu_estime ? parseFloat(revenu_estime) : undefined,
      langues,
      competences,
      groupe_sanguin: groupe_sanguin || undefined,
      handicap: handicap || undefined,
      hypertension,
      diabete,
      vaccination,
      poids: poids ? parseFloat(poids) : undefined,
      taille: taille ? parseFloat(taille) : undefined,
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
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key as Tab)} className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition ${tab === key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
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

                {/* CIN */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Numéro CIN</label>
                    <input value={cin} onChange={e => setCin(e.target.value)} placeholder="12 chiffres" maxLength={12} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none font-mono" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Date CIN</label>
                    <input type="date" value={date_cin} onChange={e => setDateCin(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                </div>

                {/* Contact */}
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
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Niveau d'instruction</label>
                  <div className="grid grid-cols-2 gap-2">
                    {NIVEAUX_ETUDE.map(n => (
                      <label key={n} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${niveau_etude === n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                        <input type="radio" className="hidden" checked={niveau_etude === n} onChange={() => setNiveauEtude(n)} />{n}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Diplôme le plus élevé</label>
                  <input value={diplome} onChange={e => setDiplome(e.target.value)} placeholder="Ex: BACC, Licence, Master" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Langues</label>
                  <div className="flex flex-wrap gap-2">
                    {LANGUES_LIST.map(l => (
                      <label key={l} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer text-xs font-semibold transition ${langues.includes(l) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                        <input type="checkbox" className="hidden" checked={langues.includes(l)} onChange={() => setLangues(prev => toggleArr(prev, l))} />{l}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Activité principale <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-2 gap-2">
                    {ACTIVITES_PRINCIPALES.map(a => (
                      <label key={a} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer text-xs font-semibold transition ${profession === a ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                        <input type="radio" className="hidden" checked={profession === a} onChange={() => setProfession(a)} />{a}
                      </label>
                    ))}
                  </div>
                </div>

                {profession && !['Retraité', 'Sans emploi', 'Étudiant', 'Femme au foyer'].includes(profession) && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                      Précision sur l'activité <span className="text-slate-400 normal-case font-normal">({profession.toLowerCase()})</span>
                    </label>
                    <input
                      value={detail_activite}
                      onChange={e => setDetailActivite(e.target.value)}
                      placeholder={
                        profession === 'Agriculture' ? 'Ex: Riziculture, maraîchage...' :
                        profession === 'Élevage' ? 'Ex: Bovins, volailles, porcins...' :
                        profession === 'Pêche' ? 'Ex: Pêche côtière, aquaculture...' :
                        profession === 'Artisanat' ? 'Ex: Menuiserie, couture, poterie...' :
                        profession === 'Commerce' ? 'Ex: Épicerie, vente ambulante...' :
                        profession === 'Transport' ? 'Ex: Taxi-brousse, livraison...' :
                        profession === 'Construction' ? 'Ex: Maçonnerie, électricité...' :
                        profession === 'Administration' ? 'Ex: Fonctionnaire, agent communal...' :
                        profession === 'Enseignement' ? 'Ex: Instituteur, professeur...' :
                        profession === 'Santé' ? 'Ex: Infirmier, sage-femme...' :
                        profession === 'Services' ? 'Ex: Coiffure, restauration...' :
                        'Préciser...'
                      }
                      className="w-full border border-indigo-200 bg-indigo-50/40 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Employeur</label>
                    <input value={employeur} onChange={e => setEmployeur(e.target.value)} placeholder="Ex: Société, Ministère" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Revenu estimé (Ar)</label>
                    <input type="number" value={revenu_estime} onChange={e => setRevenu(e.target.value)} placeholder="500000" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Compétences</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {competences.map(c => (
                      <span key={c} className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                        {c}<button type="button" onClick={() => setCompetences(prev => prev.filter(x => x !== c))} className="text-indigo-400 hover:text-indigo-700">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <select value={newCompetence} onChange={e => setNewCompetence(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none bg-white">
                      <option value="">Ajouter une compétence...</option>
                      {COMPETENCES_LIST.filter(c => !competences.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button type="button" onClick={() => { if (newCompetence) { setCompetences(prev => [...prev, newCompetence]); setNewCompetence(''); }}} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">+</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── SANTÉ ── */}
            {tab === 'sante' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Groupe sanguin</label>
                    <select value={groupe_sanguin} onChange={e => setGroupeSanguin(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-white">
                      <option value="">Inconnu</option>
                      {GROUPES_SANG.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Handicap</label>
                    <input value={handicap} onChange={e => setHandicap(e.target.value)} placeholder="Ex: Non-voyant, Moteur" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                </div>
                {(['hypertension', 'diabete'] as const).map(field => (
                  <div key={field}>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-2">{field === 'hypertension' ? 'Hypertension artérielle' : 'Diabète'}</label>
                    <div className="flex gap-3">
                      {(['Normal', 'Surveillance', 'Prioritaire'] as const).map(v => (
                        <label key={v} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${(field === 'hypertension' ? hypertension : diabete) === v ? (v === 'Prioritaire' ? 'bg-red-600 text-white border-red-600' : v === 'Surveillance' ? 'bg-amber-500 text-white border-amber-500' : 'bg-emerald-600 text-white border-emerald-600') : 'bg-white text-slate-600 border-slate-200'}`}>
                          <input type="radio" className="hidden" checked={(field === 'hypertension' ? hypertension : diabete) === v} onChange={() => field === 'hypertension' ? setHypertension(v) : setDiabete(v)} />{v}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Vaccinations</label>
                  <div className="grid grid-cols-2 gap-2">
                    {COMPULSORY_VACCINATIONS.map(v => (
                      <label key={v} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs transition ${vaccination.includes(v) ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold' : 'bg-white border-slate-200 text-slate-600'}`}>
                        <input type="checkbox" checked={vaccination.includes(v)} onChange={() => setVaccination(prev => toggleArr(prev, v))} className="rounded" />{v}
                      </label>
                    ))}
                  </div>
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
