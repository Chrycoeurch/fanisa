import React, { useState } from 'react';
import { Foyer, Membre } from '../types';
import { X, Home, MapPin, Users, UserCheck, PlusCircle, Edit2, Trash2, AlertTriangle, HeartPulse, Phone, Mail, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';

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
};

function MembreRow({ membre, allMembres, onEdit, onDelete }: { membre: Membre; allMembres: Membre[]; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const conjoint = allMembres.find(m => m.id === membre.conjoint_id);
  const pere = allMembres.find(m => m.id === membre.pere_id);
  const mere = allMembres.find(m => m.id === membre.mere_id);
  const age = membre.date_naissance ? Math.abs(new Date(Date.now() - new Date(membre.date_naissance).getTime()).getUTCFullYear() - 1970) : null;
  const hasAlert = membre.hypertension !== 'Normal' || membre.diabete !== 'Normal';

  return (
    <div className={`border rounded-xl overflow-hidden transition ${membre.est_vulnerable ? 'border-rose-200' : 'border-slate-200'}`}>
      {/* Ligne principale */}
      <div className="flex items-center gap-3 p-3 bg-white">
        {/* Sexe indicator */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${membre.sexe === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
          {membre.sexe === 'M' ? '♂' : '♀'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-slate-900">{membre.nom} {membre.prenom}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${RELATION_COLOR[membre.relation_chef] || 'bg-slate-100 text-slate-600'}`}>{membre.relation_chef}</span>
            {membre.statut !== 'Actif' && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">{membre.statut}</span>}
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
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 hover:bg-slate-100 rounded-lg transition text-slate-400">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button onClick={onEdit} className="p-1.5 hover:bg-indigo-50 rounded-lg transition text-slate-400 hover:text-indigo-600"><Edit2 className="h-4 w-4" /></button>
          {!membre.is_chef && <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded-lg transition text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
        </div>
      </div>

      {/* Détails expandés */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-3 text-xs">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {membre.telephone && <div><span className="text-slate-400 font-semibold uppercase block mb-0.5">Téléphone</span><span className="flex items-center gap-1"><Phone className="h-3 w-3" />{membre.telephone}</span></div>}
            {membre.email && <div><span className="text-slate-400 font-semibold uppercase block mb-0.5">Email</span><span className="flex items-center gap-1"><Mail className="h-3 w-3" />{membre.email}</span></div>}
            {membre.date_naissance && <div><span className="text-slate-400 font-semibold uppercase block mb-0.5">Date de naissance</span><span>{new Date(membre.date_naissance).toLocaleDateString('fr-FR')}</span></div>}
            {membre.lieu_naissance && <div><span className="text-slate-400 font-semibold uppercase block mb-0.5">Lieu de naissance</span><span>{membre.lieu_naissance}</span></div>}
            {membre.cin && <div><span className="text-slate-400 font-semibold uppercase block mb-0.5">CIN</span><span className="flex items-center gap-1 font-mono"><CreditCard className="h-3 w-3" />{membre.cin}</span></div>}
            {membre.groupe_sanguin && <div><span className="text-slate-400 font-semibold uppercase block mb-0.5">Groupe sanguin</span><span className="font-bold text-red-700">{membre.groupe_sanguin}</span></div>}
          </div>

          {/* Famille */}
          {(conjoint || pere || mere || membre.pere_nom || membre.mere_nom) && (
            <div className="border-t border-slate-200 pt-3">
              <p className="text-slate-400 font-semibold uppercase mb-2">Liens familiaux</p>
              <div className="flex flex-wrap gap-2">
                {conjoint && <span className="bg-pink-50 border border-pink-200 text-pink-700 px-2.5 py-1 rounded-full font-medium">💑 {conjoint.prenom} {conjoint.nom}</span>}
                {(pere || membre.pere_nom) && <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full font-medium">👨 {pere ? `${pere.prenom} ${pere.nom}` : membre.pere_nom}</span>}
                {(mere || membre.mere_nom) && <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full font-medium">👩 {mere ? `${mere.prenom} ${mere.nom}` : membre.mere_nom}</span>}
              </div>
            </div>
          )}

          {/* Santé */}
          {(hasAlert || membre.vaccination.length > 0) && (
            <div className="border-t border-slate-200 pt-3">
              <p className="text-slate-400 font-semibold uppercase mb-2">Santé</p>
              <div className="flex flex-wrap gap-2">
                {membre.hypertension !== 'Normal' && <span className={`px-2.5 py-1 rounded-full font-semibold ${membre.hypertension === 'Prioritaire' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>HTA: {membre.hypertension}</span>}
                {membre.diabete !== 'Normal' && <span className={`px-2.5 py-1 rounded-full font-semibold ${membre.diabete === 'Prioritaire' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>Diabète: {membre.diabete}</span>}
                {membre.vaccination.map(v => <span key={v} className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-full">✓ {v}</span>)}
              </div>
            </div>
          )}

          {/* Économie */}
          {(membre.profession || membre.secteur || membre.revenu_estime) && (
            <div className="border-t border-slate-200 pt-3">
              <p className="text-slate-400 font-semibold uppercase mb-2">Situation économique</p>
              <div className="flex flex-wrap gap-3">
                {membre.profession && <span><strong>Profession:</strong> {membre.profession}</span>}
                {membre.secteur && <span><strong>Secteur:</strong> {membre.secteur}</span>}
                {membre.revenu_estime && <span><strong>Revenu:</strong> {membre.revenu_estime.toLocaleString('fr-FR')} Ar</span>}
              </div>
            </div>
          )}

          {/* Vulnérabilité */}
          {membre.est_vulnerable && (
            <div className="border-t border-rose-200 pt-3 bg-rose-50 -mx-4 -mb-4 px-4 pb-4 rounded-b-xl">
              <p className="text-rose-600 font-semibold uppercase mb-2 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />Vulnérabilité</p>
              <div className="flex flex-wrap gap-2">
                <span className={`px-2.5 py-1 rounded-full font-bold ${membre.niveau_priorite === 'Critique' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>{membre.niveau_priorite}</span>
                {membre.vulnerabilite_categories.map(c => <span key={c} className="bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full">{c}</span>)}
              </div>
              {membre.vulnerabilite_description && <p className="mt-2 text-slate-600 italic">{membre.vulnerabilite_description}</p>}
            </div>
          )}
        </div>
      )}
    </div>
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
            <div className="bg-indigo-600 p-2.5 rounded-xl"><Home className="h-5 w-5 text-white" /></div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-indigo-600">{foyer.code_menage}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${foyer.statut === 'Actif' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{foyer.statut}</span>
              </div>
              <p className="font-bold text-slate-900">{chef ? `${chef.nom} ${chef.prenom}` : 'Chef non défini'}</p>
              {foyer.fokontany && (
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{[foyer.adresse, foyer.fokontany].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEditFoyer} className="p-2 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600 transition"><Edit2 className="h-4 w-4" /></button>
            <button onClick={onDeleteFoyer} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition"><Trash2 className="h-4 w-4" /></button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-500" /></button>
          </div>
        </div>

        {/* Stats foyer */}
        <div className="grid grid-cols-4 gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200">
          {[
            { label: 'Membres', value: foyer.nombre_membres, icon: Users },
            { label: 'Pièces', value: foyer.nombre_pieces || '—', icon: Home },
            { label: 'Superficie', value: foyer.superficie_maison ? `${foyer.superficie_maison}m²` : '—', icon: Home },
            { label: 'Vulnérables', value: membres.filter(m => m.est_vulnerable).length, icon: AlertTriangle },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="text-center">
              <p className="text-lg font-bold text-slate-800">{value}</p>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">{label}</p>
            </div>
          ))}
        </div>

        {/* Liste membres */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Users className="h-4 w-4 text-indigo-600" />Membres du foyer</h3>
            <button onClick={onAddMembre} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition">
              <PlusCircle className="h-3.5 w-3.5" />Ajouter un membre
            </button>
          </div>

          {membres.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold">Aucun membre</p>
              <p className="text-xs mt-1">Commencez par ajouter le chef de foyer.</p>
              <button onClick={onAddMembre} className="mt-4 bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 mx-auto">
                <PlusCircle className="h-3.5 w-3.5" />Ajouter le chef de foyer
              </button>
            </div>
          ) : (
            // Chef en premier, puis autres
            [...membres.filter(m => m.is_chef), ...membres.filter(m => !m.is_chef)].map(m => (
              <MembreRow key={m.id} membre={m} allMembres={membres} onEdit={() => onEditMembre(m)} onDelete={() => onDeleteMembre(m.id)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
