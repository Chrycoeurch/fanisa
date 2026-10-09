/**
 * FANISA – Module Collecte Terrain (remplace KoboToolbox)
 * Formulaire mobile offline-first : foyer + membres + vahiny + photos.
 * Tout est sauvegardé en IndexedDB, synchronisé vers Supabase quand réseau disponible.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Home, Users, UserPlus, Camera, QrCode, MapPin, Wifi, WifiOff,
  CheckCircle, AlertCircle, Clock, Upload, ChevronDown, ChevronUp,
  Plus, Trash2, ArrowLeft, Save, RefreshCw, X, Info, Baby,
} from 'lucide-react';
import {
  db,
  genUUID, genCodePersonne,
  sauvegarderFoyerOffline, sauvegarderMembreOffline, sauvegarderVahinyOffline, sauvegarderPhotoOffline,
  getStatsOffline, nettoyerDonneesSynchronisees,
  type CollecteFoyer, type CollecteMembre, type CollecteVahiny,
} from '../lib/offlineDB';
import { lancerSync, estEnLigne, onChangementReseau, type RapportSync } from '../lib/syncEngine';
import { useLiveQuery } from 'dexie-react-hooks';

// ── Constantes ────────────────────────────────────────────────

const QUARTIERS = [
  { sigle: 'BTN', nom: 'Betainomby', prefixes: ['A','B','C','D','E','F'] },
  { sigle: 'AMN', nom: 'Ambohimanarina', prefixes: ['K','L','M','N','O'] },
  { sigle: 'ADL', nom: 'Andalamahintsy', prefixes: ['AF'] },
  { sigle: 'TRV', nom: 'Tsararivotra', prefixes: ['AA','AB','AC','AD','AE'] },
  { sigle: 'MHV', nom: 'Mahavanona', prefixes: ['H','I','J'] },
  { sigle: 'TH1', nom: 'Tsarahonenana 1', prefixes: ['P','Y','Z'] },
  { sigle: 'TH2', nom: 'Tsarahonenana 2', prefixes: ['Q','R','S'] },
  { sigle: 'TMM', nom: 'Tsaramandroso Maromaniry', prefixes: ['W','X'] },
  { sigle: 'THL', nom: 'Tsarahonenana Lycée 2', prefixes: ['T'] },
];

const ECOLES = ['Sainte Famille', 'Lycée II', 'Bethany School', 'Le Beau Printemps', 'Primo', 'Autre'];
const CLASSES = ['Préscolaire', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale', 'Supérieur', 'Formation pro'];
const RELATIONS = ['Chef', 'Épouse/Époux', 'Fils', 'Fille', 'Père', 'Mère', 'Frère', 'Sœur', 'Grand-père', 'Grand-mère', 'Petit-fils', 'Petite-fille', 'Oncle', 'Tante', 'Neveu', 'Nièce', 'Vahiny', 'Autre'];
const WG_OPTIONS = ['Aucune difficulté', 'Quelques difficultés', 'Beaucoup de difficultés', 'Ne peut pas du tout'];
const NATIONALITES = ['Malagasy', 'Etrangere', 'Double'] as const;
const PAYS_ETRANGERS = ['Comores', 'France', 'Chine', 'Inde', 'Pakistan', 'Maurice', 'Autre'];
const TYPES_PIECE_ETRANGERE = ['Passeport', 'Carte de résident', 'Carte consulaire', 'Autre'];

// ── Étapes du formulaire ──────────────────────────────────────

type Etape = 'liste' | 'foyer' | 'membres' | 'vahiny' | 'resume';

// ── État du formulaire foyer ──────────────────────────────────

const FOYER_VIDE = (): Partial<CollecteFoyer> => ({
  uuid: genUUID(),
  agent_id: '',
  fokontany: 'Ambodisaina',
  adresse: '',
  quartier: '',
  carreau: '',
  type_logement: '',
  statut_occupant: '',
  eau_source: '',
  toilette_type: '',
  eclairage_source: '',
  cuisson_source: '',
  est_vulnerable: false,
  possede_carnet: undefined,
  date_collecte: new Date().toISOString().slice(0, 10),
});

const MEMBRE_VIDE = (foyer_uuid: string, is_chef = false): Partial<CollecteMembre> => ({
  uuid: genUUID(),
  foyer_uuid,
  nom: '',
  prenom: '',
  sexe: 'M',
  nationalite: 'Malagasy',
  relation_chef: is_chef ? 'Chef' : '',
  is_chef,
  code_personne: genCodePersonne(),
});

const VAHINY_VIDE = (foyer_uuid: string): Partial<CollecteVahiny> => ({
  uuid: genUUID(),
  foyer_uuid,
  nom: '',
  prenom: '',
  sexe: 'M',
  code_personne: genCodePersonne(),
});

// ── Composant principal ────────────────────────────────────────

export default function CollecteModule() {
  const [etape, setEtape] = useState<Etape>('liste');
  const [foyer, setFoyer] = useState<Partial<CollecteFoyer>>(FOYER_VIDE());
  const [membres, setMembres] = useState<Partial<CollecteMembre>[]>([MEMBRE_VIDE('', true)]);
  const [vahiny, setVahiny] = useState<Partial<CollecteVahiny>[]>([]);
  const [enLigne, setEnLigne] = useState(estEnLigne());
  const [syncEnCours, setSyncEnCours] = useState(false);
  const [dernierRapport, setDernierRapport] = useState<RapportSync | null>(null);
  const [showRapport, setShowRapport] = useState(false);
  const [erreurSauvegarde, setErreurSauvegarde] = useState('');
  const [sauvegardOk, setSauvegardOk] = useState(false);

  const stats = useLiveQuery(() => getStatsOffline(), []);
  const foyersEnAttente = useLiveQuery(() => db.collecte_foyers.where('statut_sync').notEqual('synchronise').toArray(), []);

  useEffect(() => {
    const unsub = onChangementReseau(setEnLigne);
    return unsub;
  }, []);

  // Sync auto quand connexion revenue
  useEffect(() => {
    if (enLigne && stats && stats.enAttente > 0) {
      handleSync();
    }
  }, [enLigne]);

  const handleSync = async () => {
    setSyncEnCours(true);
    const rapport = await lancerSync();
    setDernierRapport(rapport);
    setShowRapport(true);
    setSyncEnCours(false);
  };

  const demarrerNouveauFoyer = () => {
    const uuid = genUUID();
    setFoyer({ ...FOYER_VIDE(), uuid });
    setMembres([{ ...MEMBRE_VIDE(uuid, true) }]);
    setVahiny([]);
    setEtape('foyer');
    setSauvegardOk(false);
    setErreurSauvegarde('');
  };

  const sauvegarder = async () => {
    try {
      setErreurSauvegarde('');
      const foyerUuid = foyer.uuid!;

      // Valider champs obligatoires
      if (!foyer.adresse) throw new Error('L\'adresse est obligatoire');
      if (!foyer.quartier) throw new Error('Le quartier est obligatoire');
      if (membres.length === 0) throw new Error('Au moins un membre requis');
      const chef = membres.find(m => m.is_chef);
      if (!chef) throw new Error('Un chef de ménage est requis');
      if (!chef.nom || !chef.prenom) throw new Error('Nom et prénom du chef requis');

      // Sauvegarder foyer
      await sauvegarderFoyerOffline(foyer as Omit<CollecteFoyer, 'id' | 'statut_sync' | 'nb_tentatives_sync' | 'created_at' | 'updated_at'>);

      // Sauvegarder membres
      for (const m of membres) {
        if (m.nom && m.prenom) {
          await sauvegarderMembreOffline({ ...m, foyer_uuid: foyerUuid } as Omit<CollecteMembre, 'id' | 'statut_sync' | 'created_at'>);
        }
      }

      // Sauvegarder vahiny
      for (const v of vahiny) {
        if (v.nom && v.prenom) {
          await sauvegarderVahinyOffline({ ...v, foyer_uuid: foyerUuid } as Omit<CollecteVahiny, 'id' | 'statut_sync' | 'created_at'>);
        }
      }

      setSauvegardOk(true);
      setEtape('resume');

      // Tenter sync immédiate si en ligne
      if (enLigne) handleSync();
    } catch (e) {
      setErreurSauvegarde(e instanceof Error ? e.message : String(e));
    }
  };

  // ── Rendu ──────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Barre statut réseau */}
      <div className={`fixed top-0 left-0 right-0 z-50 text-center py-1 text-xs font-bold transition-all ${enLigne ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
        {enLigne ? (
          <span className="flex items-center justify-center gap-1"><Wifi className="h-3 w-3" /> En ligne</span>
        ) : (
          <span className="flex items-center justify-center gap-1"><WifiOff className="h-3 w-3" /> Hors ligne — données sauvegardées localement</span>
        )}
      </div>

      <div className="pt-7">
        {etape === 'liste' && (
          <VueListe
            foyers={foyersEnAttente || []}
            stats={stats}
            enLigne={enLigne}
            syncEnCours={syncEnCours}
            dernierRapport={dernierRapport}
            showRapport={showRapport}
            setShowRapport={setShowRapport}
            onNouveauFoyer={demarrerNouveauFoyer}
            onSync={handleSync}
            onNettoyage={async () => { await nettoyerDonneesSynchronisees(); }}
          />
        )}

        {etape === 'foyer' && (
          <FormulaireFoyer
            foyer={foyer}
            setFoyer={setFoyer}
            onSuivant={() => setEtape('membres')}
            onAnnuler={() => setEtape('liste')}
          />
        )}

        {etape === 'membres' && (
          <FormulaireMembres
            foyerUuid={foyer.uuid!}
            membres={membres}
            setMembres={setMembres}
            onSuivant={() => setEtape('vahiny')}
            onRetour={() => setEtape('foyer')}
          />
        )}

        {etape === 'vahiny' && (
          <FormulaireVahiny
            foyerUuid={foyer.uuid!}
            vahiny={vahiny}
            setVahiny={setVahiny}
            onSuivant={sauvegarder}
            onRetour={() => setEtape('membres')}
            erreur={erreurSauvegarde}
          />
        )}

        {etape === 'resume' && (
          <Resume
            foyer={foyer}
            membres={membres}
            vahiny={vahiny}
            sauvegardOk={sauvegardOk}
            enLigne={enLigne}
            syncEnCours={syncEnCours}
            onNouveau={() => { setEtape('liste'); }}
          />
        )}
      </div>
    </div>
  );
}

// ── Vue liste des collectes en attente ────────────────────────

function VueListe({ foyers, stats, enLigne, syncEnCours, dernierRapport, showRapport, setShowRapport, onNouveauFoyer, onSync, onNettoyage }: {
  foyers: CollecteFoyer[];
  stats: Awaited<ReturnType<typeof getStatsOffline>> | undefined;
  enLigne: boolean;
  syncEnCours: boolean;
  dernierRapport: RapportSync | null;
  showRapport: boolean;
  setShowRapport: (v: boolean) => void;
  onNouveauFoyer: () => void;
  onSync: () => void;
  onNettoyage: () => void;
}) {
  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Collecte Terrain</h1>
          <p className="text-sm text-slate-500">Fokontany Ambodisaina</p>
        </div>
        <button onClick={onNouveauFoyer} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm shadow">
          <Plus className="h-4 w-4" /> Nouveau foyer
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard icon={<Home className="h-5 w-5 text-blue-500" />} label="Foyers" value={stats.foyers} />
          <StatCard icon={<Users className="h-5 w-5 text-emerald-500" />} label="Membres" value={stats.membres} />
          <StatCard icon={<Clock className="h-5 w-5 text-amber-500" />} label="En attente" value={stats.enAttente} urgent={stats.enAttente > 0} />
        </div>
      )}

      {/* Bouton sync */}
      {stats && stats.enAttente > 0 && (
        <button
          onClick={onSync}
          disabled={!enLigne || syncEnCours}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm mb-4 transition ${enLigne ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
        >
          <Upload className={`h-4 w-4 ${syncEnCours ? 'animate-bounce' : ''}`} />
          {syncEnCours ? 'Synchronisation…' : enLigne ? `Synchroniser (${stats.enAttente} en attente)` : 'Hors ligne — sync impossible'}
        </button>
      )}

      {/* Rapport sync */}
      {showRapport && dernierRapport && (
        <div className={`rounded-xl p-4 mb-4 text-sm ${dernierRapport.erreurs.length > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <div className="flex justify-between items-start mb-2">
            <span className="font-bold text-slate-700">Rapport de synchronisation</span>
            <button onClick={() => setShowRapport(false)}><X className="h-4 w-4 text-slate-400" /></button>
          </div>
          <p className="text-slate-600">✓ {dernierRapport.foyers_ok} foyers · {dernierRapport.membres_ok} membres · {dernierRapport.photos_ok} photos</p>
          {dernierRapport.doublons_ignores > 0 && <p className="text-amber-600">⚠ {dernierRapport.doublons_ignores} doublon(s) ignoré(s)</p>}
          {dernierRapport.erreurs.map((e, i) => <p key={i} className="text-red-600 text-xs mt-1">✗ {e}</p>)}
          <p className="text-slate-400 text-xs mt-1">{(dernierRapport.duree_ms / 1000).toFixed(1)}s</p>
        </div>
      )}

      {/* Liste foyers locaux */}
      {foyers.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Home className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Aucune collecte en cours</p>
          <p className="text-xs mt-1">Appuyez sur « Nouveau foyer » pour commencer</p>
        </div>
      ) : (
        <div className="space-y-2">
          {foyers.map(f => (
            <div key={f.uuid} className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800 text-sm">{f.adresse || 'Adresse non renseignée'}</p>
                <p className="text-xs text-slate-500">{f.quartier} · {f.date_collecte}</p>
                {f.code_menage && <p className="text-xs font-mono text-blue-600">{f.code_menage}</p>}
              </div>
              <StatutBadge statut={f.statut_sync} />
            </div>
          ))}
        </div>
      )}

      {stats && stats.foyers > 0 && (
        <button onClick={onNettoyage} className="w-full mt-4 text-xs text-slate-400 underline text-center">
          Nettoyer les données déjà synchronisées
        </button>
      )}
    </div>
  );
}

// ── Formulaire Foyer ──────────────────────────────────────────

function FormulaireFoyer({ foyer, setFoyer, onSuivant, onAnnuler }: {
  foyer: Partial<CollecteFoyer>;
  setFoyer: React.Dispatch<React.SetStateAction<Partial<CollecteFoyer>>>;
  onSuivant: () => void;
  onAnnuler: () => void;
}) {
  const set = (key: keyof CollecteFoyer, val: unknown) => setFoyer(f => ({ ...f, [key]: val }));
  const photoRef = useRef<HTMLInputElement>(null);

  const handleGPS = () => {
    if (!navigator.geolocation) return alert('GPS non disponible sur cet appareil');
    navigator.geolocation.getCurrentPosition(
      pos => { set('gps_lat', pos.coords.latitude); set('gps_lng', pos.coords.longitude); },
      () => alert('Impossible d\'obtenir la position GPS'),
    );
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !foyer.uuid) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await sauvegarderPhotoOffline(foyer.uuid!, 'maison', reader.result as string, file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleQR = async () => {
    const code = prompt('Entrez ou scannez le code du carnet :');
    if (code) set('code_menage', code.trim().toUpperCase());
  };

  const quartierSelectionne = QUARTIERS.find(q => q.sigle === foyer.quartier);

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onAnnuler} className="p-2 rounded-lg bg-slate-100"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h2 className="font-bold text-slate-800">Informations du foyer</h2>
          <p className="text-xs text-slate-500">Étape 1 / 3</p>
        </div>
      </div>

      {/* Carnet Fokontany */}
      <Section titre="Carnet Fokontany" icone={<QrCode className="h-4 w-4" />}>
        <div className="flex gap-2 mb-3">
          <BtnOuiNon label="Possède un carnet ?" value={foyer.possede_carnet} onChange={v => set('possede_carnet', v)} />
        </div>
        {foyer.possede_carnet && (
          <>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="AMB-TRV-26-T-XXXXX"
                value={foyer.code_menage || ''}
                onChange={e => set('code_menage', e.target.value.toUpperCase())}
              />
              <button onClick={handleQR} className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold">
                <QrCode className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">Format : AMB-TRV-26-T-XXXXX ou numéro provisoire AMB-TRV-26-P-XXXXX</p>
          </>
        )}
        {foyer.possede_carnet === false && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">Sans carnet — un numéro provisoire sera attribué à l'import.</p>
        )}
      </Section>

      {/* Localisation */}
      <Section titre="Localisation" icone={<MapPin className="h-4 w-4" />}>
        <label className="label-field">Quartier *</label>
        <select className="champ" value={foyer.quartier || ''} onChange={e => set('quartier', e.target.value)}>
          <option value="">Choisir…</option>
          {QUARTIERS.map(q => <option key={q.sigle} value={q.sigle}>{q.nom} ({q.sigle})</option>)}
        </select>

        {quartierSelectionne && (
          <>
            <label className="label-field mt-2">Carreau</label>
            <input className="champ" placeholder="ex: 1, 2, 3…" value={foyer.carreau || ''} onChange={e => set('carreau', e.target.value)} />
          </>
        )}

        <label className="label-field mt-2">Adresse / Description du lieu *</label>
        <input className="champ" placeholder="Rue, nom du terrain, repère…" value={foyer.adresse || ''} onChange={e => set('adresse', e.target.value)} />

        <button onClick={handleGPS} className="mt-2 flex items-center gap-2 text-sm text-blue-600 font-semibold">
          <MapPin className="h-4 w-4" />
          {foyer.gps_lat ? `GPS : ${foyer.gps_lat.toFixed(5)}, ${foyer.gps_lng?.toFixed(5)}` : 'Capturer la position GPS'}
        </button>
      </Section>

      {/* Logement */}
      <Section titre="Logement" icone={<Home className="h-4 w-4" />}>
        <label className="label-field">Type de logement</label>
        <select className="champ" value={foyer.type_logement || ''} onChange={e => set('type_logement', e.target.value)}>
          <option value="">Choisir…</option>
          {['Maison en dur', 'Case en bois', 'Semi-dur', 'Appartement', 'Taudis', 'Autre'].map(t => <option key={t}>{t}</option>)}
        </select>

        <label className="label-field mt-2">Statut occupant</label>
        <select className="champ" value={foyer.statut_occupant || ''} onChange={e => set('statut_occupant', e.target.value)}>
          <option value="">Choisir…</option>
          {['Propriétaire', 'Locataire', 'Occupant à titre gratuit', 'Hébergé'].map(t => <option key={t}>{t}</option>)}
        </select>

        <div className="grid grid-cols-3 gap-2 mt-2">
          <div>
            <label className="label-field">Toiture</label>
            <select className="champ" value={foyer.materiau_toiture || ''} onChange={e => set('materiau_toiture', e.target.value)}>
              <option value="">—</option>
              {['Tôle', 'Tuile', 'Chaume', 'Béton', 'Autre'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Murs</label>
            <select className="champ" value={foyer.materiau_mur || ''} onChange={e => set('materiau_mur', e.target.value)}>
              <option value="">—</option>
              {['Brique', 'Béton', 'Bois', 'Terre', 'Autre'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Plancher</label>
            <select className="champ" value={foyer.materiau_plancher || ''} onChange={e => set('materiau_plancher', e.target.value)}>
              <option value="">—</option>
              {['Béton', 'Carrelage', 'Bois', 'Terre battue', 'Autre'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </Section>

      {/* Eau & Assainissement */}
      <Section titre="Eau & Assainissement" icone={<Info className="h-4 w-4" />}>
        <label className="label-field">Source d'eau principale</label>
        <select className="champ" value={foyer.eau_source || ''} onChange={e => set('eau_source', e.target.value)}>
          <option value="">Choisir…</option>
          {['Réseau JIRAMA', 'Borne fontaine', 'Puits', 'Rivière', 'Eau de pluie', 'Vendeur', 'Autre'].map(t => <option key={t}>{t}</option>)}
        </select>

        <label className="label-field mt-2">Toilettes</label>
        <select className="champ" value={foyer.toilette_type || ''} onChange={e => set('toilette_type', e.target.value)}>
          <option value="">Choisir…</option>
          {['Latrine améliorée', 'Latrine simple', 'WC chasse d\'eau', 'Plein air', 'Partagé', 'Autre'].map(t => <option key={t}>{t}</option>)}
        </select>
      </Section>

      {/* Énergie */}
      <Section titre="Énergie" icone={<Info className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label-field">Éclairage</label>
            <select className="champ" value={foyer.eclairage_source || ''} onChange={e => set('eclairage_source', e.target.value)}>
              <option value="">—</option>
              {['Électricité JIRAMA', 'Panneau solaire', 'Lampe à pétrole', 'Bougie', 'Autre'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Cuisson</label>
            <select className="champ" value={foyer.cuisson_source || ''} onChange={e => set('cuisson_source', e.target.value)}>
              <option value="">—</option>
              {['Charbon', 'Bois', 'Gaz', 'Électrique', 'Autre'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </Section>

      {/* Photo maison */}
      <Section titre="Photo de la maison" icone={<Camera className="h-4 w-4" />}>
        <button onClick={() => photoRef.current?.click()} className="w-full border-2 border-dashed border-slate-300 rounded-xl p-4 text-center text-sm text-slate-500 hover:border-blue-400 transition">
          <Camera className="h-6 w-6 mx-auto mb-1 text-slate-400" />
          Prendre ou choisir une photo
        </button>
        <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
      </Section>

      {/* Observations */}
      <Section titre="Observations" icone={<Info className="h-4 w-4" />}>
        <textarea className="champ" rows={3} placeholder="Notes complémentaires…" value={foyer.observations || ''} onChange={e => set('observations', e.target.value)} />
      </Section>

      {/* Bouton suivant */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4">
        <button onClick={onSuivant} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm">
          Suivant : Membres →
        </button>
      </div>
    </div>
  );
}

// ── Formulaire Membres ────────────────────────────────────────

function FormulaireMembres({ foyerUuid, membres, setMembres, onSuivant, onRetour }: {
  foyerUuid: string;
  membres: Partial<CollecteMembre>[];
  setMembres: React.Dispatch<React.SetStateAction<Partial<CollecteMembre>[]>>;
  onSuivant: () => void;
  onRetour: () => void;
}) {
  const [ouvert, setOuvert] = useState<number | null>(0);

  const ajouterMembre = () => {
    const idx = membres.length;
    setMembres(m => [...m, { ...MEMBRE_VIDE(foyerUuid, false) }]);
    setOuvert(idx);
  };

  const supprimerMembre = (idx: number) => {
    if (membres[idx].is_chef) return alert('Le chef de ménage ne peut pas être supprimé');
    setMembres(m => m.filter((_, i) => i !== idx));
    setOuvert(null);
  };

  const setM = (idx: number, key: keyof CollecteMembre, val: unknown) => {
    setMembres(m => m.map((mb, i) => i === idx ? { ...mb, [key]: val } : mb));
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onRetour} className="p-2 rounded-lg bg-slate-100"><ArrowLeft className="h-4 w-4" /></button>
        <div className="flex-1">
          <h2 className="font-bold text-slate-800">Membres du foyer</h2>
          <p className="text-xs text-slate-500">Étape 2 / 3 · {membres.length} membre(s)</p>
        </div>
        <button onClick={ajouterMembre} className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold">
          <Plus className="h-3.5 w-3.5" /> Ajouter
        </button>
      </div>

      <div className="space-y-3">
        {membres.map((m, idx) => (
          <div key={m.uuid} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-3 text-left"
              onClick={() => setOuvert(ouvert === idx ? null : idx)}
            >
              <div className="flex items-center gap-2">
                {m.is_chef && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">CHEF</span>}
                <span className="font-semibold text-sm text-slate-800">
                  {m.nom && m.prenom ? `${m.nom} ${m.prenom}` : `Membre ${idx + 1}`}
                </span>
                {m.sexe && <span className="text-xs text-slate-400">{m.sexe === 'M' ? '♂' : '♀'}</span>}
              </div>
              <div className="flex items-center gap-2">
                {!m.is_chef && (
                  <button onClick={e => { e.stopPropagation(); supprimerMembre(idx); }} className="p-1 text-red-400 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {ouvert === idx ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
            </button>

            {ouvert === idx && (
              <div className="px-3 pb-3 space-y-2 border-t border-slate-100 pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label-field">Nom *</label>
                    <input className="champ" value={m.nom || ''} onChange={e => setM(idx, 'nom', e.target.value.toUpperCase())} placeholder="NOM" />
                  </div>
                  <div>
                    <label className="label-field">Prénom *</label>
                    <input className="champ" value={m.prenom || ''} onChange={e => setM(idx, 'prenom', e.target.value)} placeholder="Prénom" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label-field">Sexe</label>
                    <select className="champ" value={m.sexe || 'M'} onChange={e => setM(idx, 'sexe', e.target.value)}>
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-field">Date de naissance</label>
                    <input type="date" className="champ" value={m.date_naissance || ''} onChange={e => setM(idx, 'date_naissance', e.target.value)} />
                  </div>
                </div>

                {!m.is_chef && (
                  <div>
                    <label className="label-field">Lien avec le chef</label>
                    <select className="champ" value={m.relation_chef || ''} onChange={e => setM(idx, 'relation_chef', e.target.value)}>
                      <option value="">Choisir…</option>
                      {RELATIONS.filter(r => r !== 'Chef' && r !== 'Vahiny').map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                )}

                {/* Nationalité */}
                <div>
                  <label className="label-field">Nationalité</label>
                  <select className="champ" value={m.nationalite || 'Malagasy'} onChange={e => setM(idx, 'nationalite', e.target.value)}>
                    {NATIONALITES.map(n => <option key={n} value={n}>{n === 'Etrangere' ? 'Étrangère' : n === 'Double' ? 'Double nationalité' : n}</option>)}
                  </select>
                </div>

                {m.nationalite === 'Malagasy' || m.nationalite === 'Double' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label-field">CIN</label>
                      <input className="champ font-mono" value={m.cin || ''} onChange={e => setM(idx, 'cin', e.target.value)} placeholder="N° CIN" />
                    </div>
                    <div>
                      <label className="label-field">Date CIN</label>
                      <input type="date" className="champ" value={m.date_cin || ''} onChange={e => setM(idx, 'date_cin', e.target.value)} />
                    </div>
                  </div>
                ) : m.nationalite === 'Etrangere' ? (
                  <>
                    <div>
                      <label className="label-field">Pays</label>
                      <select className="champ" value={m.nationalite_pays || ''} onChange={e => setM(idx, 'nationalite_pays', e.target.value)}>
                        <option value="">Choisir…</option>
                        {PAYS_ETRANGERS.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label-field">Type de pièce</label>
                        <select className="champ" value={m.type_piece_etrangere || ''} onChange={e => setM(idx, 'type_piece_etrangere', e.target.value)}>
                          <option value="">Choisir…</option>
                          {TYPES_PIECE_ETRANGERE.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label-field">N° pièce</label>
                        <input className="champ font-mono" value={m.numero_piece_etrangere || ''} onChange={e => setM(idx, 'numero_piece_etrangere', e.target.value)} />
                      </div>
                    </div>
                  </>
                ) : null}

                <div>
                  <label className="label-field">Téléphone</label>
                  <input type="tel" className="champ" value={m.telephone || ''} onChange={e => setM(idx, 'telephone', e.target.value)} placeholder="034 XX XXX XX" />
                </div>

                {/* Scolarisation (3–17 ans) */}
                {m.date_naissance && (() => {
                  const age = new Date().getFullYear() - new Date(m.date_naissance).getFullYear();
                  return age >= 3 && age <= 17 ? (
                    <div className="bg-blue-50 rounded-lg p-2 space-y-2">
                      <p className="text-xs font-bold text-blue-700">Scolarisation ({age} ans)</p>
                      <BtnOuiNon label="Scolarisé(e) ?" value={m.est_scolarise} onChange={v => setM(idx, 'est_scolarise', v)} />
                      {m.est_scolarise && (
                        <>
                          <select className="champ text-xs" value={m.ecole || ''} onChange={e => setM(idx, 'ecole', e.target.value)}>
                            <option value="">École…</option>
                            {ECOLES.map(e => <option key={e}>{e}</option>)}
                          </select>
                          <select className="champ text-xs" value={m.classe || ''} onChange={e => setM(idx, 'classe', e.target.value)}>
                            <option value="">Classe…</option>
                            {CLASSES.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </>
                      )}
                    </div>
                  ) : null;
                })()}

                {/* Moins de 5 ans */}
                {m.date_naissance && (() => {
                  const age = new Date().getFullYear() - new Date(m.date_naissance).getFullYear();
                  return age < 5 ? (
                    <div className="bg-green-50 rounded-lg p-2 space-y-2">
                      <p className="text-xs font-bold text-green-700 flex items-center gap-1"><Baby className="h-3 w-3" /> Moins de 5 ans</p>
                      <BtnOuiNon label="Acte de naissance ?" value={m.acte_naissance} onChange={v => setM(idx, 'acte_naissance', v)} />
                      <BtnOuiNon label="Vaccination complète ?" value={m.vaccination_complete} onChange={v => setM(idx, 'vaccination_complete', v)} />
                    </div>
                  ) : null;
                })()}

                {/* Washington Group (5 ans et +) */}
                {m.date_naissance && (() => {
                  const age = new Date().getFullYear() - new Date(m.date_naissance).getFullYear();
                  return age >= 5 ? (
                    <WashingtonGroup membre={m} idx={idx} setM={setM} />
                  ) : null;
                })()}

                <p className="text-xs text-slate-400 font-mono">Code : {m.code_personne}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4">
        <button onClick={onSuivant} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm">
          Suivant : Vahiny →
        </button>
      </div>
    </div>
  );
}

// ── Washington Group (handicap) ────────────────────────────────

function WashingtonGroup({ membre, idx, setM }: { membre: Partial<CollecteMembre>; idx: number; setM: (i: number, k: keyof CollecteMembre, v: unknown) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const champs: { key: keyof CollecteMembre; label: string }[] = [
    { key: 'wg_vision', label: 'Vision (avec lunettes si nécessaire)' },
    { key: 'wg_audition', label: 'Audition (avec appareil si nécessaire)' },
    { key: 'wg_mobilite', label: 'Marche ou montée des escaliers' },
    { key: 'wg_cognition', label: 'Mémorisation ou concentration' },
    { key: 'wg_soins_personnels', label: 'Soins personnels (se laver, s\'habiller)' },
    { key: 'wg_communication', label: 'Communication (comprendre / être compris)' },
  ];

  return (
    <div className="bg-purple-50 rounded-lg p-2">
      <button onClick={() => setOuvert(!ouvert)} className="w-full flex items-center justify-between text-xs font-bold text-purple-700">
        <span>Handicap (Washington Group)</span>
        {ouvert ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {ouvert && (
        <div className="mt-2 space-y-2">
          {champs.map(c => (
            <div key={c.key}>
              <label className="text-xs text-slate-600">{c.label}</label>
              <select className="champ text-xs mt-0.5" value={(membre[c.key] as string) || ''} onChange={e => setM(idx, c.key, e.target.value)}>
                <option value="">—</option>
                {WG_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Formulaire Vahiny ─────────────────────────────────────────

function FormulaireVahiny({ foyerUuid, vahiny, setVahiny, onSuivant, onRetour, erreur }: {
  foyerUuid: string;
  vahiny: Partial<CollecteVahiny>[];
  setVahiny: React.Dispatch<React.SetStateAction<Partial<CollecteVahiny>[]>>;
  onSuivant: () => void;
  onRetour: () => void;
  erreur: string;
}) {
  const setV = (idx: number, key: keyof CollecteVahiny, val: unknown) =>
    setVahiny(v => v.map((vv, i) => i === idx ? { ...vv, [key]: val } : vv));

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onRetour} className="p-2 rounded-lg bg-slate-100"><ArrowLeft className="h-4 w-4" /></button>
        <div className="flex-1">
          <h2 className="font-bold text-slate-800">Vahiny (visiteurs / locataires temporaires)</h2>
          <p className="text-xs text-slate-500">Étape 3 / 3 · {vahiny.length} vahiny</p>
        </div>
        <button onClick={() => setVahiny(v => [...v, { ...VAHINY_VIDE(foyerUuid) }])} className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold">
          <Plus className="h-3.5 w-3.5" /> Ajouter
        </button>
      </div>

      {vahiny.length === 0 && (
        <div className="text-center py-8 text-slate-400 text-sm">
          <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucun vahiny dans ce foyer</p>
          <p className="text-xs mt-1">Les vahiny ne comptent pas dans le total des membres.</p>
        </div>
      )}

      <div className="space-y-3">
        {vahiny.map((v, idx) => (
          <div key={v.uuid} className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-bold text-slate-700">Vahiny {idx + 1}</span>
              <button onClick={() => setVahiny(vs => vs.filter((_, i) => i !== idx))} className="text-red-400"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label-field">Nom *</label><input className="champ" value={v.nom || ''} onChange={e => setV(idx, 'nom', e.target.value.toUpperCase())} /></div>
              <div><label className="label-field">Prénom *</label><input className="champ" value={v.prenom || ''} onChange={e => setV(idx, 'prenom', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label-field">Sexe</label>
                <select className="champ" value={v.sexe || 'M'} onChange={e => setV(idx, 'sexe', e.target.value)}>
                  <option value="M">M</option><option value="F">F</option>
                </select>
              </div>
              <div><label className="label-field">CIN</label><input className="champ font-mono" value={v.cin || ''} onChange={e => setV(idx, 'cin', e.target.value)} /></div>
            </div>
            <div><label className="label-field">Provenance</label><input className="champ" value={v.provenance || ''} onChange={e => setV(idx, 'provenance', e.target.value)} placeholder="Ville / Fokontany d'origine" /></div>
            <div><label className="label-field">Motif du séjour</label><input className="champ" value={v.motif || ''} onChange={e => setV(idx, 'motif', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label-field">Date d'arrivée</label><input type="date" className="champ" value={v.date_arrivee || ''} onChange={e => setV(idx, 'date_arrivee', e.target.value)} /></div>
              <div><label className="label-field">Durée prévue</label><input className="champ" value={v.duree_prevue || ''} onChange={e => setV(idx, 'duree_prevue', e.target.value)} placeholder="ex: 2 mois" /></div>
            </div>
          </div>
        ))}
      </div>

      {erreur && <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{erreur}</div>}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4">
        <button onClick={onSuivant} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2">
          <Save className="h-4 w-4" /> Sauvegarder le foyer
        </button>
      </div>
    </div>
  );
}

// ── Résumé ────────────────────────────────────────────────────

function Resume({ foyer, membres, vahiny, sauvegardOk, enLigne, syncEnCours, onNouveau }: {
  foyer: Partial<CollecteFoyer>;
  membres: Partial<CollecteMembre>[];
  vahiny: Partial<CollecteVahiny>[];
  sauvegardOk: boolean;
  enLigne: boolean;
  syncEnCours: boolean;
  onNouveau: () => void;
}) {
  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="text-center py-8">
        {sauvegardOk ? (
          <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
        ) : (
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
        )}
        <h2 className="text-xl font-bold text-slate-800 mb-1">
          {sauvegardOk ? 'Foyer sauvegardé !' : 'Erreur de sauvegarde'}
        </h2>
        <p className="text-slate-500 text-sm">{foyer.adresse}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-slate-500">Code ménage</span><span className="font-mono font-bold">{foyer.code_menage || 'Provisoire'}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Quartier</span><span className="font-semibold">{foyer.quartier}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Membres</span><span className="font-semibold">{membres.length}</span></div>
        {vahiny.length > 0 && <div className="flex justify-between"><span className="text-slate-500">Vahiny</span><span className="font-semibold">{vahiny.length}</span></div>}
      </div>

      <div className={`rounded-xl p-3 text-sm text-center mb-4 ${enLigne ? (syncEnCours ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700') : 'bg-amber-50 text-amber-700'}`}>
        {enLigne ? (syncEnCours ? '⏳ Synchronisation en cours…' : '✓ Synchronisé avec la base de données') : '📴 Hors ligne — sera synchronisé dès la reconnexion'}
      </div>

      <button onClick={onNouveau} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2">
        <Plus className="h-4 w-4" /> Nouveau foyer
      </button>
    </div>
  );
}

// ── Petits composants utilitaires ──────────────────────────────

function Section({ titre, icone, children }: { titre: string; icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-3">
        {icone} {titre}
      </h3>
      {children}
    </div>
  );
}

function StatCard({ icon, label, value, urgent }: { icon: React.ReactNode; label: string; value: number; urgent?: boolean }) {
  return (
    <div className={`rounded-xl p-3 text-center ${urgent ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-slate-200'}`}>
      <div className="flex justify-center mb-1">{icon}</div>
      <p className={`text-xl font-bold ${urgent ? 'text-amber-600' : 'text-slate-800'}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function StatutBadge({ statut }: { statut: string }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    en_attente: { cls: 'bg-amber-100 text-amber-700', label: 'En attente' },
    en_cours:   { cls: 'bg-blue-100 text-blue-700', label: 'En cours' },
    synchronise: { cls: 'bg-emerald-100 text-emerald-700', label: 'Synchronisé' },
    erreur:     { cls: 'bg-red-100 text-red-700', label: 'Erreur' },
  };
  const s = cfg[statut] || cfg.en_attente;
  return <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${s.cls}`}>{s.label}</span>;
}

function BtnOuiNon({ label, value, onChange }: { label: string; value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <div>
      <label className="label-field">{label}</label>
      <div className="flex gap-2 mt-1">
        <button onClick={() => onChange(true)} className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition ${value === true ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200'}`}>Oui</button>
        <button onClick={() => onChange(false)} className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition ${value === false ? 'bg-red-400 text-white border-red-400' : 'bg-white text-slate-600 border-slate-200'}`}>Non</button>
      </div>
    </div>
  );
}
