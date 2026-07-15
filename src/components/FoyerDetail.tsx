import React, { useState, useEffect } from 'react';
import { Foyer, Membre } from '../types';
import { X, Home, MapPin, Users, UserCheck, PlusCircle, Edit2, Trash2, AlertTriangle, Phone, Mail, CreditCard, ChevronDown, ChevronUp, FileText, Printer, Loader2, Brain, BarChart2, CheckCircle, XCircle } from 'lucide-react';
import MembreProfil360 from './MembreProfil360';
import { genererFicheMenage } from '../lib/ficheMenagePDF';
import { telechargerPDF } from '../lib/documents';
import ModalApercu from './ModalApercu';
import { analyserMenage, verifierCompletude, type AnalyseIntelligence } from '../lib/intelligenceEngine';

interface Props {
  foyer: Foyer;
  membres: Membre[];
  onClose: () => void;
  onEditFoyer: () => void;
  onDeleteFoyer: () => void;
  onAddMembre: () => void;
  onEditMembre: (m: Membre) => void;
  onDeleteMembre: (id: string) => void;
}

const RELATION_COLOR: Record<string, string> = {
  'Chef': 'bg-indigo-100 text-indigo-700',
  'Épouse/Époux': 'bg-pink-100 text-pink-700',
  'Fils': 'bg-blue-100 text-blue-700',
  'Fille': 'bg-purple-100 text-purple-700',
  'Père': 'bg-amber-100 text-amber-700',
  'Mère': 'bg-amber-100 text-amber-700',
  'Frère': 'bg-cyan-100 text-cyan-700',
  'Sœur': 'bg-cyan-100 text-cyan-700',
  'Grand-père': 'bg-orange-100 text-orange-700',
  'Grand-mère': 'bg-orange-100 text-orange-700',
  'Petit-fils': 'bg-teal-100 text-teal-700',
  'Petite-fille': 'bg-teal-100 text-teal-700',
};

// Lien familial avec emoji + libellé précis
function LienFamilial({ emoji, lien, nom, prenom }: { emoji: string; lien: string; nom: string; prenom: string }) {
  return (
    <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
      <span>{emoji}</span>
      <span className="text-slate-400 font-medium">{lien} :</span>
      <span className="font-bold text-slate-800">{nom} {prenom}</span>
    </span>
  );
}

function MembreRow({ membre, allMembres, foyer, onEdit, onDelete }: {
  membre: Membre; allMembres: Membre[]; foyer: Foyer; onEdit: () => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showProfil, setShowProfil] = useState(false);
  const conjoint = allMembres.find(m => m.id === membre.conjoint_id);
  const pere = allMembres.find(m => m.id === membre.pere_id);
  const mere = allMembres.find(m => m.id === membre.mere_id);
  // Enfants = membres dont pere_id ou mere_id = ce membre
  const enfants = allMembres.filter(m => m.pere_id === membre.id || m.mere_id === membre.id);
  const age = membre.date_naissance
    ? Math.abs(new Date(Date.now() - new Date(membre.date_naissance).getTime()).getUTCFullYear() - 1970)
    : null;
  const hasAlert = membre.hypertension !== 'Normal' || membre.diabete !== 'Normal';

  return (
  <>
    <div className={`border rounded-xl overflow-hidden transition ${membre.est_vulnerable ? 'border-rose-200' : 'border-slate-200'}`}>

      {/* Ligne principale */}
      <div className="flex items-center gap-3 p-3 bg-white">
        {/* Photo ou avatar */}
        {membre.photo_url ? (
          <img src={membre.photo_url} alt={membre.prenom} className="w-10 h-10 rounded-full object-cover border-2 border-slate-200 shrink-0" />
        ) : (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border-2 ${membre.sexe === 'M' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-pink-50 text-pink-700 border-pink-200'}`}>
            {membre.prenom?.charAt(0)}{membre.nom?.charAt(0)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-slate-900">{membre.nom} {membre.prenom}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${RELATION_COLOR[membre.relation_chef] || 'bg-slate-100 text-slate-600'}`}>
              {membre.is_chef && <UserCheck className="h-2.5 w-2.5 inline mr-0.5" />}{membre.relation_chef}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${membre.statut === 'Actif' ? 'bg-emerald-100 text-emerald-700' : membre.statut === 'Décédé' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>{membre.statut}</span>
            {hasAlert && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⚕ Alerte</span>}
            {membre.est_vulnerable && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">⚠ Vulnérable</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
            {age !== null && <span>{age} ans</span>}
            {membre.cin && <span className="font-mono">{membre.cin}</span>}
            {membre.profession && <span>{membre.profession}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button onClick={() => setShowProfil(true)} title="Profil 360°" className="p-1.5 hover:bg-purple-50 rounded-lg text-slate-400 hover:text-purple-600"><FileText className="h-4 w-4" /></button>
          <button onClick={onEdit} className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600"><Edit2 className="h-4 w-4" /></button>
          {!membre.is_chef && <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
        </div>
      </div>

      {/* Détails expandés */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-4 text-xs">

          {/* Photo grande + infos de base */}
          <div className="flex gap-4">
            {membre.photo_url && (
              <img src={membre.photo_url} alt={membre.prenom} className="w-20 h-24 rounded-xl object-cover border-2 border-slate-200 shrink-0" />
            )}
            <div className="flex-1 grid grid-cols-2 gap-2">
              {membre.telephone && (
                <div><span className="text-slate-400 font-semibold uppercase block mb-0.5">Téléphone</span>
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{membre.telephone}</span></div>
              )}
              {membre.email && (
                <div><span className="text-slate-400 font-semibold uppercase block mb-0.5">Email</span>
                <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{membre.email}</span></div>
              )}
              {membre.date_naissance && (
                <div><span className="text-slate-400 font-semibold uppercase block mb-0.5">Date de naissance</span>
                <span>{new Date(membre.date_naissance).toLocaleDateString('fr-FR')}</span></div>
              )}
              {membre.lieu_naissance && (
                <div><span className="text-slate-400 font-semibold uppercase block mb-0.5">Lieu de naissance</span>
                <span>{membre.lieu_naissance}</span></div>
              )}
              {membre.cin && (
                <div><span className="text-slate-400 font-semibold uppercase block mb-0.5">CIN</span>
                <span className="flex items-center gap-1 font-mono"><CreditCard className="h-3 w-3" />{membre.cin}</span></div>
              )}
              {membre.groupe_sanguin && (
                <div><span className="text-slate-400 font-semibold uppercase block mb-0.5">Groupe sanguin</span>
                <span className="font-bold text-red-700">{membre.groupe_sanguin}</span></div>
              )}
            </div>
          </div>

          {/* Liens familiaux */}
          {(conjoint || pere || mere || membre.pere_nom || membre.mere_nom || enfants.length > 0) && (
            <div className="border-t border-slate-200 pt-3">
              <p className="text-slate-500 font-bold uppercase text-[10px] mb-2 tracking-wider">Liens familiaux</p>
              <div className="flex flex-wrap gap-2">
                {conjoint && (
                  <LienFamilial
                    emoji="💑"
                    lien={membre.sexe === 'M' ? 'Épouse' : 'Époux'}
                    nom={conjoint.nom}
                    prenom={conjoint.prenom}
                  />
                )}
                {pere && <LienFamilial emoji="👨" lien="Père" nom={pere.nom} prenom={pere.prenom} />}
                {!pere && membre.pere_nom && (
                  <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                    <span>👨</span>
                    <span className="text-slate-400 font-medium">Père :</span>
                    <span className="font-bold text-slate-800">{membre.pere_nom}</span>
                    <span className="text-slate-400 italic">(hors registre)</span>
                  </span>
                )}
                {mere && <LienFamilial emoji="👩" lien="Mère" nom={mere.nom} prenom={mere.prenom} />}
                {!mere && membre.mere_nom && (
                  <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                    <span>👩</span>
                    <span className="text-slate-400 font-medium">Mère :</span>
                    <span className="font-bold text-slate-800">{membre.mere_nom}</span>
                    <span className="text-slate-400 italic">(hors registre)</span>
                  </span>
                )}
                {enfants.map(e => (
                  <LienFamilial
                    key={e.id}
                    emoji={e.sexe === 'M' ? '👦' : '👧'}
                    lien={e.sexe === 'M' ? 'Fils' : 'Fille'}
                    nom={e.nom}
                    prenom={e.prenom}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Santé */}
          {(hasAlert || membre.vaccination.length > 0 || membre.handicap) && (
            <div className="border-t border-slate-200 pt-3">
              <p className="text-slate-500 font-bold uppercase text-[10px] mb-2 tracking-wider">Santé</p>
              <div className="flex flex-wrap gap-2">
                {membre.hypertension !== 'Normal' && (
                  <span className={`px-2.5 py-1 rounded-full font-semibold ${membre.hypertension === 'Prioritaire' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    HTA : {membre.hypertension}
                  </span>
                )}
                {membre.diabete !== 'Normal' && (
                  <span className={`px-2.5 py-1 rounded-full font-semibold ${membre.diabete === 'Prioritaire' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    Diabète : {membre.diabete}
                  </span>
                )}
                {membre.handicap && <span className="bg-purple-50 border border-purple-200 text-purple-700 px-2.5 py-1 rounded-full">♿ {membre.handicap}</span>}
                {membre.vaccination.map(v => <span key={v} className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-full">✓ {v}</span>)}
              </div>
            </div>
          )}

          {/* Économie */}
          {(membre.profession || membre.secteur || membre.revenu_estime) && (
            <div className="border-t border-slate-200 pt-3">
              <p className="text-slate-500 font-bold uppercase text-[10px] mb-2 tracking-wider">Situation économique</p>
              <div className="flex flex-wrap gap-3 text-slate-600">
                {membre.profession && <span><strong className="text-slate-700">Profession :</strong> {membre.profession}</span>}
                {membre.secteur && <span><strong className="text-slate-700">Secteur :</strong> {membre.secteur}</span>}
                {membre.revenu_estime && <span><strong className="text-slate-700">Revenu :</strong> {membre.revenu_estime.toLocaleString('fr-FR')} Ar</span>}
              </div>
            </div>
          )}

          {/* Vulnérabilité */}
          {membre.est_vulnerable && (
            <div className="border-t border-rose-200 pt-3 bg-rose-50 -mx-4 -mb-4 px-4 pb-4 rounded-b-xl">
              <p className="text-rose-600 font-bold uppercase text-[10px] mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />Vulnérabilité
              </p>
              <div className="flex flex-wrap gap-2">
                <span className={`px-2.5 py-1 rounded-full font-bold text-xs ${membre.niveau_priorite === 'Critique' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
                  {membre.niveau_priorite}
                </span>
                {membre.vulnerabilite_categories.map(c => (
                  <span key={c} className="bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full text-xs">{c}</span>
                ))}
              </div>
              {membre.vulnerabilite_description && (
                <p className="mt-2 text-slate-600 italic text-xs">{membre.vulnerabilite_description}</p>
              )}
              {membre.aides_obtenues.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {membre.aides_obtenues.map(a => <span key={a} className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">✓ {a}</span>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
    {showProfil && (
      <MembreProfil360 membre={membre} foyer={foyer} allMembres={allMembres} onClose={() => setShowProfil(false)} />
    )}
  </>
  );
}

export default function FoyerDetail({ foyer, membres, onClose, onEditFoyer, onDeleteFoyer, onAddMembre, onEditMembre, onDeleteMembre }: Props) {
  const chef = membres.find(m => m.is_chef);
  const [detailTab, setDetailTab] = useState<'vue360' | 'membres' | 'intelligence'>('vue360');
  const [analyse, setAnalyse] = useState<AnalyseIntelligence | null>(null);
  const [calculantAnalyse, setCalculantAnalyse] = useState(false);
  const [generatingFiche, setGeneratingFiche] = useState(false);
  const [apercuFiche, setApercuFiche] = useState<{ url: string; bytes: Uint8Array } | null>(null);

  // Calcul automatique dès qu'on clique sur l'onglet Intelligence
  useEffect(() => {
    if (detailTab === 'intelligence' && !analyse) {
      setCalculantAnalyse(true);
      setTimeout(() => {
        const result = analyserMenage(foyer, membres);
        setAnalyse(result);
        setCalculantAnalyse(false);
      }, 600);
    }
  }, [detailTab]);

  const handleFicheMenage = async () => {
    setGeneratingFiche(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const React2 = await import('react');
      const { FicheMenageDocExport } = await import('../lib/ficheMenagePDF');
      const { supabase } = await import('../lib/supabase');

      const [{ data: docs }, { data: cots }, { loadHistorique }] = await Promise.all([
        supabase.from('demandes_documents').select('nom_document,created_at').eq('foyer_id', foyer.id).in('statut', ['Payé', 'Archivé']).order('created_at', { ascending: false }),
        supabase.from('cotisations').select('statut,periode').eq('foyer_id', foyer.id),
        import('../lib/ficheMenagePDF'),
      ]);
      const cotAJour = (cots || []).some((c: any) => c.statut === 'A jour' || c.statut === 'À jour');
      const hist = await loadHistorique(foyer.id);

      const blob = await pdf(React2.default.createElement(FicheMenageDocExport, { foyer, membres, cotAJour, docs: docs || [], hist })).toBlob();
      const url = URL.createObjectURL(blob);
      const buf = await blob.arrayBuffer();
      setApercuFiche({ url, bytes: new Uint8Array(buf) });
    } catch (e) { alert('Erreur génération fiche : ' + e); }
    setGeneratingFiche(false);
  };

  const handleTelechargerFiche = async () => {
    if (!apercuFiche) return;
    await telechargerPDF(apercuFiche.bytes, `FICHE_MENAGE_${foyer.code_menage}.pdf`);
  };

  const fermerApercu = () => {
    if (apercuFiche) URL.revokeObjectURL(apercuFiche.url);
    setApercuFiche(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div className="flex items-center gap-3">
            {/* Photo maison */}
            {foyer.photo_maison_url ? (
              <img src={foyer.photo_maison_url} alt="Maison" className="w-14 h-14 rounded-xl object-cover border-2 border-slate-200 shrink-0" />
            ) : (
              <div className="bg-indigo-600 p-2.5 rounded-xl shrink-0"><Home className="h-5 w-5 text-white" /></div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-indigo-600">{foyer.code_menage}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${foyer.statut === 'Actif' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{foyer.statut}</span>
              </div>
              <p className="font-bold text-slate-900">{chef ? `${chef.nom} ${chef.prenom}` : 'Chef non défini'}</p>
              {foyer.fokontany && (
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" />{[foyer.adresse, foyer.fokontany].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleFicheMenage} disabled={generatingFiche} title="Aperçu de la fiche ménage officielle PDF" className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white text-xs font-bold rounded-lg transition">
              {generatingFiche ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              {generatingFiche ? 'Génération…' : 'Fiche ménage'}
            </button>
            <button onClick={onEditFoyer} className="p-2 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600"><Edit2 className="h-4 w-4" /></button>
            <button onClick={onDeleteFoyer} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-500" /></button>
          </div>

          {/* Modale aperçu fiche ménage */}
          {apercuFiche && (
            <ModalApercu
              titre={`Fiche ménage — ${foyer.code_menage}`}
              sous_titre={`${membres.length} membre${membres.length > 1 ? 's' : ''} · ${foyer.fokontany || ''}`}
              pdfUrl={apercuFiche.url}
              loading={false}
              nomFichier={`FICHE_MENAGE_${foyer.code_menage}.pdf`}
              onClose={fermerApercu}
              onTelecharger={handleTelechargerFiche}
            />
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 text-center">
          <div><p className="text-lg font-bold text-slate-800">{foyer.nombre_membres}</p><p className="text-[10px] text-slate-500 uppercase font-semibold">Membres</p></div>
          <div><p className="text-lg font-bold text-slate-800">{foyer.nombre_pieces || '—'}</p><p className="text-[10px] text-slate-500 uppercase font-semibold">Pièces</p></div>
          <div><p className="text-lg font-bold text-slate-800">{foyer.superficie_maison ? `${foyer.superficie_maison}m²` : '—'}</p><p className="text-[10px] text-slate-500 uppercase font-semibold">Superficie</p></div>
          <div><p className="text-lg font-bold text-slate-800">{membres.filter(m => m.est_vulnerable).length}</p><p className="text-[10px] text-slate-500 uppercase font-semibold">Vulnérables</p></div>
        </div>

        {/* Navigation onglets */}
        <div className="flex border-b border-slate-200 px-5 bg-white shrink-0">
          {[
            { key: 'vue360', label: '📋 Vue 360°' },
            { key: 'membres', label: '👨‍👩‍👧 Membres' },
            { key: 'intelligence', label: '🧠 Intelligence' },
          ].map(t => (
            <button key={t.key} onClick={() => setDetailTab(t.key as any)}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap ${detailTab === t.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">

        {/* ── VUE 360° ── */}
        {detailTab === 'vue360' && (
          <div className="space-y-4">
            {/* Infos logement */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase">Logement</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[['Type', foyer.type_logement], ['Statut occupation', foyer.statut_occupant], ['Murs', foyer.materiau_mur || (foyer.materiaux_mur || []).join(', ')], ['Eau', foyer.eau_source || foyer.source_eau_principale], ['Électricité', foyer.a_electricite ? 'Oui' : 'Non']].map(([k,v]) => v ? (
                  <div key={k as string}><span className="text-slate-400">{k} : </span><span className="font-semibold text-slate-700">{v}</span></div>
                ) : null)}
              </div>
            </div>
            {foyer.observations_complementaires && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-bold text-amber-700 uppercase mb-1">Observations</p>
                <p className="text-xs text-amber-800">{foyer.observations_complementaires}</p>
              </div>
            )}
          </div>
        )}

        {/* ── MEMBRES ── */}
        {detailTab === 'membres' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-600" />Membres du foyer
              </h3>
              <button onClick={onAddMembre} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition">
                <PlusCircle className="h-3.5 w-3.5" />Ajouter un membre
              </button>
            </div>
            {membres.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-semibold">Aucun membre</p>
                <p className="text-xs mt-1">Commencez par ajouter le chef de foyer.</p>
                <button onClick={onAddMembre} className="mt-4 bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2 mx-auto">
                  <PlusCircle className="h-3.5 w-3.5" />Ajouter le chef
                </button>
              </div>
            ) : (
              [...membres.filter(m => m.is_chef), ...membres.filter(m => !m.is_chef)].map(m => (
                <MembreRow
                  key={m.id}
                  membre={m}
                  allMembres={membres}
                  foyer={foyer}
                  onEdit={() => onEditMembre(m)}
                  onDelete={() => onDeleteMembre(m.id)}
                />
              ))
            )}
          </div>
        )}

        {/* ── 🧠 INTELLIGENCE ── */}
        {detailTab === 'intelligence' && (
          <div className="space-y-4">
            {calculantAnalyse ? (
              <div className="text-center py-16">
                <Brain className="h-10 w-10 text-indigo-500 animate-pulse mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600">Analyse en cours…</p>
                <p className="text-xs text-slate-400 mt-1">Le moteur FANISA analyse les données du ménage</p>
              </div>
            ) : !analyse ? null : !analyse.peut_analyser ? (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 text-center">
                <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
                <p className="font-bold text-amber-800 text-sm">Analyse indisponible</p>
                <p className="text-xs text-amber-700 mt-1 mb-3">Le dossier du ménage est incomplet. Veuillez terminer le recensement avant de consulter l'analyse.</p>
                <div className="bg-amber-100 rounded-xl p-3 text-left space-y-1">
                  <p className="text-[11px] font-bold text-amber-700 uppercase">Informations manquantes :</p>
                  {analyse.raison_blocage?.split(' · ').map((r, i) => (
                    <p key={i} className="text-[11px] text-amber-800 flex items-center gap-1.5"><XCircle className="h-3 w-3 shrink-0" />{r}</p>
                  ))}
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-amber-700 font-semibold">Complétude du dossier</span>
                    <span className="font-bold text-amber-800">{analyse.completude}%</span>
                  </div>
                  <div className="w-full bg-amber-200 rounded-full h-2">
                    <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${analyse.completude}%` }} />
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Score global */}
                <div className="bg-white border-2 rounded-2xl p-6 text-center" style={{ borderColor: analyse.couleur }}>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-2">Score de vulnérabilité FANISA</p>
                  <div className="relative w-28 h-28 mx-auto mb-3">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#E2E8F0" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke={analyse.couleur} strokeWidth="8"
                        strokeDasharray={`${analyse.score_global * 2.64} 264`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-black" style={{ color: analyse.couleur }}>{analyse.score_global}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">/ 100</span>
                    </div>
                  </div>
                  <p className="text-lg font-black" style={{ color: analyse.couleur }}>Vulnérabilité {analyse.niveau}</p>
                  <p className="text-xs text-slate-400 mt-1">Complétude des données : {analyse.completude}%</p>
                </div>

                {/* Indices détaillés */}
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Détail des indices</h4>
                  <div className="space-y-3">
                    {analyse.indices.map(ind => (
                      <div key={ind.nom}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-slate-700">{ind.nom}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">Poids {ind.poids}%</span>
                            <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${ind.score >= 70 ? 'bg-emerald-100 text-emerald-700' : ind.score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>{ind.score}/100</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full transition-all ${ind.score >= 70 ? 'bg-emerald-500' : ind.score >= 50 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${ind.score}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Facteurs + Points forts */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-red-700 uppercase mb-2">⚠ Facteurs de vulnérabilité</h4>
                    {analyse.facteurs_vulnerabilite.length === 0
                      ? <p className="text-xs text-slate-400">Aucun facteur identifié</p>
                      : analyse.facteurs_vulnerabilite.map((f, i) => (
                        <p key={i} className="text-xs text-red-800 flex items-start gap-1.5 mb-1.5">
                          <XCircle className="h-3 w-3 shrink-0 mt-0.5 text-red-500" />{f}
                        </p>
                      ))}
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-emerald-700 uppercase mb-2">✓ Points forts</h4>
                    {analyse.points_forts.length === 0
                      ? <p className="text-xs text-slate-400">Aucun point fort identifié</p>
                      : analyse.points_forts.map((f, i) => (
                        <p key={i} className="text-xs text-emerald-800 flex items-start gap-1.5 mb-1.5">
                          <CheckCircle className="h-3 w-3 shrink-0 mt-0.5 text-emerald-500" />{f}
                        </p>
                      ))}
                  </div>
                </div>

                {/* Recommandations */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-indigo-700 uppercase mb-2">🎯 Recommandations</h4>
                  {analyse.recommandations.map((r, i) => (
                    <p key={i} className="text-xs text-indigo-800 flex items-start gap-1.5 mb-2">
                      <span className="font-black text-indigo-500 shrink-0">→</span>{r}
                    </p>
                  ))}
                </div>

                {/* Bouton recalculer */}
                <button onClick={() => { setAnalyse(null); setCalculantAnalyse(true); setTimeout(() => { setAnalyse(analyserMenage(foyer, membres)); setCalculantAnalyse(false); }, 600); }}
                  className="w-full py-2.5 border border-indigo-200 text-indigo-600 text-xs font-bold rounded-xl hover:bg-indigo-50 transition flex items-center justify-center gap-2">
                  <Brain className="h-4 w-4" />Recalculer l'analyse
                </button>
              </>
            )}
          </div>
        )}

        </div>
      </div>
    </div>
  );
}
