import React, { useState } from 'react';
import { Foyer, Membre } from '../types';
import { X, Home, MapPin, Users, UserCheck, PlusCircle, Edit2, Trash2, AlertTriangle, Phone, Mail, CreditCard, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import MembreProfil360 from './MembreProfil360';

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
            <button onClick={onEditFoyer} className="p-2 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600"><Edit2 className="h-4 w-4" /></button>
            <button onClick={onDeleteFoyer} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-500" /></button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 text-center">
          <div><p className="text-lg font-bold text-slate-800">{foyer.nombre_membres}</p><p className="text-[10px] text-slate-500 uppercase font-semibold">Membres</p></div>
          <div><p className="text-lg font-bold text-slate-800">{foyer.nombre_pieces || '—'}</p><p className="text-[10px] text-slate-500 uppercase font-semibold">Pièces</p></div>
          <div><p className="text-lg font-bold text-slate-800">{foyer.superficie_maison ? `${foyer.superficie_maison}m²` : '—'}</p><p className="text-[10px] text-slate-500 uppercase font-semibold">Superficie</p></div>
          <div><p className="text-lg font-bold text-slate-800">{membres.filter(m => m.est_vulnerable).length}</p><p className="text-[10px] text-slate-500 uppercase font-semibold">Vulnérables</p></div>
        </div>

        {/* Liste membres */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
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
      </div>
    </div>
  );
}
