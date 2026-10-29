import React from 'react';
import {
  Document, Page, View, Text, StyleSheet, pdf,
} from '@react-pdf/renderer';
import { supabase } from './supabase';
import { telechargerPDF } from './documents';

// ── Palette ──────────────────────────────────────────────────────
const P = {
  vert:   '#065F46',   // couleur foncier (ambre → on utilise vert foncé)
  amber:  '#92400E',
  amberL: '#FFFBEB',
  amberM: '#D97706',
  bleu:   '#1E3A8A',
  bleuL:  '#EFF6FF',
  grisF:  '#1E293B',
  grisM:  '#64748B',
  grisL:  '#F1F5F9',
  grisB:  '#CBD5E1',
  blanc:  '#FFFFFF',
  rouge:  '#EF4444',
  orange: '#F59E0B',
};

// ── Labels ───────────────────────────────────────────────────────
const STATUTS_LABELS: Record<string,string> = {
  proprietaire_declare:'Propriétaire déclaré',
  ayant_droit_declare:'Ayant-droit déclaré',
  occupant_gratuit:'Occupant gratuit',
  locataire:'Locataire',
  gardien:'Gardien',
  inconnu:'Inconnu',
};
const ORIGINES_LABELS: Record<string,string> = {
  achat:'Achat', heritage:'Héritage', donation:'Donation',
  attribution:'Attribution', occupation_ancienne:'Occupation ancienne',
  autre:'Autre', inconnue:'Inconnue',
};
const TYPES_PERSONNE_LABELS: Record<string,string> = {
  personne_physique:'Personne physique', couple:'Couple',
  indivision:'Indivision', association:'Association',
  entreprise:'Entreprise', etat_commune:'État / Commune',
  autre:'Autre', inconnu:'Inconnu',
};
const MEV_LABELS: Record<string,string> = {
  habitation:'Habitation', commerce:'Commerce', agriculture:'Agriculture',
  elevage:'Élevage', plantation:'Plantation', cloture:'Clôture',
  infrastructure:'Infrastructure', aucune:'Aucune',
};
const LIENS_LABELS: Record<string,string> = {
  detenteur_declare:'Détenteur déclaré', ayant_droit_declare:'Ayant-droit déclaré',
  proprietaire_titre:'Propriétaire sur titre', heritier_declare:'Héritier déclaré',
  gestionnaire:'Gestionnaire', bailleur:'Bailleur', autre:'Autre',
};
const STATUT_COLLECTE_LABELS: Record<string,string> = {
  complet:'Complet', a_verifier:'À vérifier', incomplet:'Incomplet',
  annule:'Annulé', doublon:'Doublon',
};
const STATUT_COLLECTE_COLORS: Record<string,string> = {
  complet: '#059669', a_verifier: '#D97706', incomplet: '#DC2626',
  annule: '#64748B', doublon: '#7C3AED',
};
const TYPE_CONSTR_LABELS: Record<string,string> = {
  maison_individuelle:'Maison individuelle', appartement:'Appartement',
  commerce:'Commerce', atelier:'Atelier', hangar:'Hangar', annexe:'Annexe', autre:'Autre',
};
const ETAT_CONSTR_LABELS: Record<string,string> = {
  achevee:'Achevée', en_construction:'En construction', ruine:'Ruine',
};

// ── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica', fontSize: 8, color: P.grisF,
    backgroundColor: P.blanc, paddingHorizontal: 15, paddingVertical: 12,
  },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  headerLeft: { flex: 1 },
  headerCenter: { flex: 2, alignItems: 'center' },
  headerRight: { flex: 1, alignItems: 'flex-end' },
  fanisaTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: P.bleu },
  fanisaSub: { fontSize: 7.5, color: P.grisM, marginTop: 2 },
  docTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: P.grisF },
  docSub: { fontSize: 7.5, color: P.grisM, marginTop: 2 },
  lotCode: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: P.amberM },
  lotDate: { fontSize: 7.5, color: P.grisM, marginTop: 2 },
  hline: { height: 2, backgroundColor: P.amberM, marginBottom: 5 },

  // Section header
  sectionBar: { backgroundColor: P.amberM, paddingHorizontal: 6, paddingVertical: 4, marginBottom: 3 },
  sectionTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: P.blanc },

  // Identité parcelle
  idBlock: {
    flexDirection: 'row', backgroundColor: P.grisL,
    border: `0.5 solid ${P.grisB}`, padding: 6, marginBottom: 3,
  },
  idMain: { flex: 2 },
  idSide: { flex: 1, alignItems: 'flex-end' },
  idLot: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: P.grisF, marginBottom: 2 },
  idSub: { fontSize: 7.5, color: P.grisM, marginBottom: 1 },
  statutBadge: {
    paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 10, marginBottom: 3,
  },
  statutText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: P.blanc },

  // Indicateurs
  indsRow: { flexDirection: 'row', gap: 2, marginBottom: 3 },
  indCard: {
    flex: 1, backgroundColor: P.grisL,
    border: `0.3 solid ${P.grisB}`, alignItems: 'center', paddingVertical: 5,
  },
  indVal: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  indLabel: { fontSize: 6, color: P.grisM, textAlign: 'center' },

  // Cartes situation
  sitRow: { flexDirection: 'row', gap: 2, marginBottom: 3 },
  sitCard: { flex: 1, border: `0.4 solid ${P.grisB}`, backgroundColor: P.blanc },
  sitCardTitle: {
    fontSize: 8, fontFamily: 'Helvetica-Bold', paddingHorizontal: 5,
    paddingVertical: 3, borderBottom: `1.5 solid ${P.amberM}`,
  },
  sitCardBody: { padding: 5 },
  sitItem: { fontSize: 7.5, marginBottom: 2.5, lineHeight: 1.3 },

  // Tableau détenteurs / constructions
  tableHeader: {
    flexDirection: 'row', backgroundColor: P.amberM,
    paddingVertical: 3, paddingHorizontal: 2,
  },
  tableHeaderText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: P.blanc },
  tableRow: {
    flexDirection: 'row', paddingVertical: 2.5,
    paddingHorizontal: 2, borderBottom: `0.2 solid ${P.grisB}`,
  },
  tableRowAlt: { backgroundColor: P.grisL },
  tableCell: { fontSize: 7.5 },
  tableCellBold: { fontSize: 7.5, fontFamily: 'Helvetica-Bold' },

  // Box générique
  grisBox: {
    backgroundColor: P.grisL, border: `0.4 solid ${P.grisB}`,
    padding: 6, marginBottom: 3,
  },
  amberBox: {
    backgroundColor: P.amberL, border: `0.4 solid ${P.grisB}`,
    padding: 8, marginBottom: 3,
  },
  boxText: { fontSize: 7.5 },

  // Observations
  obsBox: {
    border: `0.4 solid ${P.grisB}`, padding: 8, minHeight: 35, marginBottom: 4,
  },
  obsText: { fontSize: 7.5, lineHeight: 1.5 },

  // GPS
  gpsRow: { flexDirection: 'row', gap: 3, marginBottom: 3 },
  gpsCard: {
    flex: 1, border: `0.4 solid ${P.grisB}`, alignItems: 'center',
    paddingVertical: 6, backgroundColor: '#F0FDF4',
  },
  gpsVal: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#065F46', marginBottom: 2 },
  gpsLabel: { fontSize: 6.5, color: P.grisM },

  // Signatures
  sigRow: { flexDirection: 'row', border: `0.5 solid ${P.grisB}`, marginBottom: 4 },
  sigCell: { flex: 1, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 },
  sigBorder: { borderLeft: `0.3 solid ${P.grisB}` },
  sigTitle: { fontSize: 8, color: P.grisM, marginBottom: 20 },
  sigLine: { height: 0.5, backgroundColor: P.grisM, width: '80%', marginBottom: 4 },
  sigSub: { fontSize: 7.5, color: P.grisM },

  // Footer
  footLine: { height: 0.4, backgroundColor: P.grisB, marginBottom: 3 },
  footText: { fontSize: 7, color: P.grisM, textAlign: 'center' },

  mb2: { marginBottom: 2 },
  mb3: { marginBottom: 3 },
  mb4: { marginBottom: 4 },
});

// ── Helpers ───────────────────────────────────────────────────────
const sf = (v: any) => String(v || '—').replace(/[^\x00-\xFF]/g, '?');
const sfArr = (v: any, labels?: Record<string,string>) => {
  if (!Array.isArray(v) || v.length === 0) return '—';
  return v.map(x => labels ? (labels[x] || x) : x).join(', ');
};

// ── Composants ───────────────────────────────────────────────────
const SectionBar = ({ title }: { title: string }) => (
  <View style={s.sectionBar}><Text style={s.sectionTitle}>{title}</Text></View>
);

const IndCard = ({ val, label, color }: { val: string; label: string; color: string }) => (
  <View style={s.indCard}>
    <Text style={[s.indVal, { color }]}>{val}</Text>
    <Text style={s.indLabel}>{label}</Text>
  </View>
);

const SitCard = ({ title, color, items }: { title: string; color: string; items: [string,string][] }) => (
  <View style={s.sitCard}>
    <Text style={[s.sitCardTitle, { borderBottomColor: color, color }]}>{title}</Text>
    <View style={s.sitCardBody}>
      {items.map(([k, v], i) => (
        <Text key={i} style={s.sitItem}>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>{k}:</Text> {v}
        </Text>
      ))}
    </View>
  </View>
);

// ── Document principal ────────────────────────────────────────────
function FicheParcellaire({ parcelle, detenteurs, constructions }: {
  parcelle: any;
  detenteurs: any[];
  constructions: any[];
}) {
  const now = new Date().toLocaleDateString('fr-FR') + ' - ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const statutColor = STATUT_COLLECTE_COLORS[parcelle.statut_collecte] || P.grisM;
  const statutLabel = STATUT_COLLECTE_LABELS[parcelle.statut_collecte] || sf(parcelle.statut_collecte);

  // Superficie prioritaire
  const superficiePrincipale = parcelle.superficie_gps
    ? `${parcelle.superficie_gps} m² (GPS)`
    : parcelle.superficie_declaree
    ? `${parcelle.superficie_declaree} m² (déclarée)`
    : parcelle.superficie_estimee
    ? `${parcelle.superficie_estimee} m² (estimée)`
    : '—';

  // Résumé intelligent
  let resume = `Cette parcelle (Lot ${sf(parcelle.lot_id || parcelle.numero_lot)})`;
  if (parcelle.statut_propriete) resume += ` est declaree par un ${STATUTS_LABELS[parcelle.statut_propriete] || sf(parcelle.statut_propriete)}.`;
  if (detenteurs.length > 0 && detenteurs[0]?.nom) {
    resume += ` Detenteur principal: ${sf(detenteurs[0].nom)}${detenteurs[0].prenom ? ' ' + sf(detenteurs[0].prenom) : ''}.`;
  }
  if (parcelle.mise_en_valeur?.length > 0) {
    resume += ` Mise en valeur: ${sfArr(parcelle.mise_en_valeur, MEV_LABELS)}.`;
  }
  if (constructions.length > 0) {
    resume += ` ${constructions.length} construction${constructions.length > 1 ? 's' : ''} recensee${constructions.length > 1 ? 's' : ''}.`;
  }
  if (parcelle.origine_droit) {
    resume += ` Origine du droit: ${ORIGINES_LABELS[parcelle.origine_droit] || sf(parcelle.origine_droit)}.`;
  }

  // Colonnes détenteurs
  const detColW = ['40%', '22%', '20%', '18%'];
  const detHeaders = ['Nom', 'Type', 'Lien', 'Statut présence'];

  // Colonnes constructions
  const conColW = ['12%', '30%', '18%', '16%', '24%'];
  const conHeaders = ['#', 'Type', 'État', 'Superficie', 'Usage'];

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── EN-TÊTE ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.fanisaTitle}>FANISA</Text>
            <Text style={s.fanisaSub}>Gestion du Fokontany</Text>
          </View>
          <View style={s.headerCenter}>
            <Text style={s.docTitle}>FICHE PARCELLAIRE</Text>
            <Text style={s.docSub}>Document officiel - Module Foncier</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.lotCode}>LOT {sf(parcelle.lot_id || parcelle.numero_lot)}</Text>
            <Text style={s.lotDate}>{now}</Text>
          </View>
        </View>
        <View style={s.hline} />

        {/* ── IDENTIFICATION PARCELLE ── */}
        <View style={s.idBlock}>
          <View style={s.idMain}>
            <Text style={s.idLot}>LOT {sf(parcelle.lot_id || parcelle.numero_lot)}</Text>
            <Text style={s.idSub}>Fokontany: {sf(parcelle.fokontany)}{parcelle.quartier ? '  |  Quartier: ' + sf(parcelle.quartier) : ''}{parcelle.carreau ? '  |  Carreau: ' + sf(parcelle.carreau) : ''}</Text>
            {parcelle.adresse && <Text style={s.idSub}>Adresse: {sf(parcelle.adresse)}</Text>}
            {parcelle.statut_propriete && (
              <Text style={[s.idSub, { marginTop: 3 }]}>
                Statut: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{STATUTS_LABELS[parcelle.statut_propriete] || sf(parcelle.statut_propriete)}</Text>
              </Text>
            )}
          </View>
          <View style={s.idSide}>
            <View style={[s.statutBadge, { backgroundColor: statutColor }]}>
              <Text style={s.statutText}>* {statutLabel}</Text>
            </View>
            {parcelle.date_collecte && <Text style={s.idSub}>Collecte: {sf(parcelle.date_collecte)}</Text>}
            {parcelle.code_agent && <Text style={s.idSub}>Agent: {sf(parcelle.code_agent)}</Text>}
          </View>
        </View>

        {/* ── INDICATEURS ── */}
        <SectionBar title="  INDICATEURS CLES" />
        <View style={[s.indsRow, s.mb3]}>
          <IndCard val={superficiePrincipale.split(' ')[0] || '—'} label="Superficie (m2)" color={P.amberM} />
          <IndCard val={String(detenteurs.length || '—')} label="Detenteurs" color={P.bleu} />
          <IndCard val={String(constructions.length || '0')} label="Constructions" color={P.grisM} />
          <IndCard
            val={parcelle.presence_constructions === true ? 'Oui' : parcelle.presence_constructions === false ? 'Non' : '—'}
            label="Bati" color={P.grisF}
          />
          <IndCard
            val={parcelle.gps_lat ? 'GPS OK' : '—'}
            label="Localisation" color={parcelle.gps_lat ? '#059669' : P.grisM}
          />
          <IndCard
            val={parcelle.documents_propriete && parcelle.documents_propriete !== 'aucun' ? 'Oui' : 'Non'}
            label="Documents" color={P.amberM}
          />
        </View>

        {/* ── RÉSUMÉ ── */}
        <SectionBar title="  RESUME FANISA" />
        <View style={[s.amberBox, s.mb3]}>
          <Text style={s.obsText}>{resume}</Text>
        </View>

        {/* ── SITUATION FONCIERE ── */}
        <SectionBar title="  SITUATION FONCIERE" />
        <View style={[s.sitRow, s.mb3]}>
          <SitCard
            title="Terrain" color={P.amberM}
            items={[
              ['Nature', sf(parcelle.nature_terrain)],
              ['Occupation', sf(parcelle.occupation_terrain)],
              ['Superficie decl.', parcelle.superficie_declaree ? `${parcelle.superficie_declaree} m2` : '—'],
              ['Superficie est.', parcelle.superficie_estimee ? `${parcelle.superficie_estimee} m2` : '—'],
            ]}
          />
          <SitCard
            title="Droit" color={P.bleu}
            items={[
              ['Origine', ORIGINES_LABELS[parcelle.origine_droit] || sf(parcelle.origine_droit)],
              ['Annee acq.', sf(parcelle.annee_acquisition)],
              ['Debut occup.', sf(parcelle.annee_debut_occupation)],
              ['Detail', sf(parcelle.origine_droit_detail)],
            ]}
          />
          <SitCard
            title="Documents" color={P.amberM}
            items={[
              ['Titre', sf(parcelle.documents_propriete)],
              ['Autres docs', sfArr(parcelle.autres_documents)],
              ['Mise en valeur', sfArr(parcelle.mise_en_valeur, MEV_LABELS)],
              ['Amenagee', parcelle.parcelle_amenagee === true ? 'Oui' : parcelle.parcelle_amenagee === false ? 'Non' : '—'],
            ]}
          />
        </View>

        {/* ── DÉTENTEURS ── */}
        <SectionBar title="  DETENTEURS / TITULAIRES" />
        <View style={s.mb3}>
          {detenteurs.length === 0 ? (
            <Text style={{ fontSize: 8, color: P.grisM }}>Aucun detenteur enregistre.</Text>
          ) : (
            <>
              <View style={s.tableHeader}>
                {detHeaders.map((h, i) => (
                  <Text key={i} style={[s.tableHeaderText, { width: detColW[i] }]}>{h}</Text>
                ))}
              </View>
              {detenteurs.map((det, idx) => (
                <View key={idx} style={[s.tableRow, idx % 2 === 1 && s.tableRowAlt]}>
                  <Text style={[s.tableCellBold, { width: detColW[0] }]}>
                    {[sf(det.nom), det.prenom ? sf(det.prenom) : ''].filter(Boolean).join(' ').toUpperCase() || '—'}
                  </Text>
                  <Text style={[s.tableCell, { width: detColW[1] }]}>
                    {TYPES_PERSONNE_LABELS[det.type_personne] || sf(det.type_personne)}
                  </Text>
                  <Text style={[s.tableCell, { width: detColW[2] }]}>
                    {LIENS_LABELS[det.lien_parcelle] || sf(det.lien_parcelle)}
                  </Text>
                  <Text style={[s.tableCell, { width: detColW[3] }]}>
                    {det.present_sur_place === true ? 'Present' : det.present_sur_place === false ? 'Absent' : '—'}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* ── CONSTRUCTIONS ── */}
        {constructions.length > 0 && (
          <>
            <SectionBar title="  CONSTRUCTIONS SUR LA PARCELLE" />
            <View style={s.mb3}>
              <View style={s.tableHeader}>
                {conHeaders.map((h, i) => (
                  <Text key={i} style={[s.tableHeaderText, { width: conColW[i] }]}>{h}</Text>
                ))}
              </View>
              {constructions.map((con, idx) => (
                <View key={idx} style={[s.tableRow, idx % 2 === 1 && s.tableRowAlt]}>
                  <Text style={[s.tableCell, { width: conColW[0] }]}>{String(idx + 1)}</Text>
                  <Text style={[s.tableCell, { width: conColW[1] }]}>
                    {TYPE_CONSTR_LABELS[con.type_construction] || sf(con.type_construction)}
                  </Text>
                  <Text style={[s.tableCell, { width: conColW[2] }]}>
                    {ETAT_CONSTR_LABELS[con.etat_construction] || sf(con.etat_construction)}
                  </Text>
                  <Text style={[s.tableCell, { width: conColW[3] }]}>
                    {con.superficie_construction ? `${con.superficie_construction} m2` : '—'}
                  </Text>
                  <Text style={[s.tableCell, { width: conColW[4] }]}>
                    {sf(con.usage_construction)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── GPS ── */}
        {(parcelle.gps_lat || parcelle.gps_lng || parcelle.superficie_gps) && (
          <>
            <SectionBar title="  LOCALISATION GPS" />
            <View style={[s.gpsRow, s.mb3]}>
              <View style={s.gpsCard}>
                <Text style={s.gpsVal}>{parcelle.gps_lat ? String(parcelle.gps_lat) : '—'}</Text>
                <Text style={s.gpsLabel}>Latitude</Text>
              </View>
              <View style={s.gpsCard}>
                <Text style={s.gpsVal}>{parcelle.gps_lng ? String(parcelle.gps_lng) : '—'}</Text>
                <Text style={s.gpsLabel}>Longitude</Text>
              </View>
              {parcelle.superficie_gps && (
                <View style={s.gpsCard}>
                  <Text style={s.gpsVal}>{parcelle.superficie_gps} m2</Text>
                  <Text style={s.gpsLabel}>Superficie GPS</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* ── COLLECTE & VALIDATION ── */}
        <SectionBar title="  VALIDATION ET COLLECTE" />
        <View style={[s.grisBox, s.mb3]}>
          <Text style={s.boxText}>
            Personne rencontree: {sf(parcelle.personne_rencontree)}  |  Statut collecte: {statutLabel}
            {parcelle.besoin_verification ? '  |  [VERIFICATION REQUISE]' : ''}
            {parcelle.dossier_a_completer ? '  |  [DOSSIER A COMPLETER]' : ''}
          </Text>
          {parcelle.difficulte_rencontree && (
            <Text style={[s.boxText, { marginTop: 3, color: P.rouge }]}>
              Difficulte: {sf(parcelle.difficulte_rencontree)}
            </Text>
          )}
        </View>

        {/* ── OBSERVATIONS ── */}
        <SectionBar title="  OBSERVATIONS" />
        <View style={[s.obsBox, s.mb3]}>
          <Text style={s.obsText}>{sf(parcelle.observations || 'Aucune observation.')}</Text>
        </View>

        {/* ── SIGNATURES ── */}
        <View style={s.sigRow}>
          {['Agent collecteur', 'Chef Fokontany', 'Cachet officiel'].map((label, i) => (
            <View key={i} style={[s.sigCell, i > 0 && s.sigBorder]}>
              <Text style={s.sigTitle}>{label}</Text>
              <View style={s.sigLine} />
              <Text style={s.sigSub}>Signature</Text>
            </View>
          ))}
        </View>

        {/* ── PIED DE PAGE ── */}
        <View style={s.footLine} />
        <Text style={s.footText}>
          FANISA v2.0  |  Fiche Parcellaire  |  Ref. LOT {sf(parcelle.lot_id || parcelle.numero_lot)}  |  {now}
        </Text>

      </Page>
    </Document>
  );
}

// ── Export public ─────────────────────────────────────────────────
export async function imprimerFicheParcellaire(parcelle: any) {
  // Charger détenteurs et constructions
  const [{ data: detenteurs }, { data: constructions }] = await Promise.all([
    supabase.from('detenteurs_foncier').select('*').eq('parcelle_id', parcelle.id).order('created_at', { ascending: true }),
    supabase.from('constructions_foncier').select('*').eq('parcelle_id', parcelle.id).order('c_num', { ascending: true }),
  ]);

  const blob = await pdf(
    <FicheParcellaire
      parcelle={parcelle}
      detenteurs={detenteurs || []}
      constructions={constructions || []}
    />
  ).toBlob();
  const buf = await blob.arrayBuffer();
  await telechargerPDF(
    new Uint8Array(buf),
    `FICHE_PARCELLAIRE_LOT_${(parcelle.lot_id || parcelle.numero_lot || 'INCONNU').replace(/[^A-Z0-9]/gi, '_')}.pdf`
  );
}
