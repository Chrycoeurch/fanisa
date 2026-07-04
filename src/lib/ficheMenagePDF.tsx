import React from 'react';
import {
  Document, Page, View, Text, StyleSheet, Font, pdf,
} from '@react-pdf/renderer';
import { Foyer, Membre } from '../types';
import { supabase } from './supabase';
import { telechargerPDF } from './documents';

// ── Palette ──────────────────────────────────────────────────────
const P = {
  bleu:   '#1E3A8A',
  bleuL:  '#EFF6FF',
  vert:   '#10B981',
  vertL:  '#ECFDF5',
  orange: '#F59E0B',
  rouge:  '#EF4444',
  violet: '#8B5CF6',
  cyan:   '#0EA5E9',
  grisF:  '#1E293B',
  grisM:  '#64748B',
  grisL:  '#F1F5F9',
  grisB:  '#CBD5E1',
  blanc:  '#FFFFFF',
};

// ── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 8, color: P.grisF, backgroundColor: P.blanc, paddingHorizontal: 15, paddingVertical: 12 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  headerLeft: { flex: 1 },
  headerCenter: { flex: 2, alignItems: 'center' },
  headerRight: { flex: 1, alignItems: 'flex-end' },
  fanisaTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: P.bleu },
  fanisaSub: { fontSize: 7.5, color: P.grisM, marginTop: 2 },
  docTitle: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: P.grisF },
  docSub: { fontSize: 7.5, color: P.grisM, marginTop: 2 },
  qrBox: { width: 22, height: 22, backgroundColor: P.grisL, border: `0.5 solid ${P.grisB}`, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  qrText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: P.grisM },
  menCode: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: P.bleu },
  menDate: { fontSize: 7.5, color: P.grisM, marginTop: 2 },
  hline: { height: 2, backgroundColor: P.bleu, marginBottom: 4 },

  // Section header
  sectionBar: { backgroundColor: P.bleu, paddingHorizontal: 6, paddingVertical: 4, marginBottom: 2 },
  sectionTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: P.blanc },

  // Chef block
  chefBlock: { flexDirection: 'row', backgroundColor: P.grisL, border: `0.5 solid ${P.grisB}`, padding: 6, marginBottom: 3, alignItems: 'flex-start' },
  photoBox: { width: 34, height: 50, backgroundColor: P.blanc, border: `0.5 solid ${P.grisB}`, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  photoText: { fontSize: 7, color: P.grisM },
  chefInfo: { flex: 1 },
  chefNom: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: P.grisF, marginBottom: 2 },
  chefSub: { fontSize: 7.5, color: P.grisM, marginBottom: 1 },
  badgesRow: { flexDirection: 'row', marginTop: 6, gap: 3 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: P.blanc },
  scoreBox: { width: 46, alignItems: 'center', justifyContent: 'center', border: `2 solid ${P.vert}`, padding: 4, marginLeft: 8 },
  scorePct: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  scoreLabel: { fontSize: 6, color: P.grisM, textAlign: 'center' },

  // Indicateurs
  indsRow: { flexDirection: 'row', gap: 2, marginBottom: 2 },
  indCard: { flex: 1, backgroundColor: P.grisL, border: `0.3 solid ${P.grisB}`, alignItems: 'center', paddingVertical: 5 },
  indVal: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  indLabel: { fontSize: 6, color: P.grisM, textAlign: 'center' },

  // Resume
  resumeBox: { backgroundColor: P.bleuL, border: `0.4 solid ${P.grisB}`, padding: 8, marginBottom: 3 },
  resumeText: { fontSize: 8, lineHeight: 1.5 },

  // Composition
  tableHeader: { flexDirection: 'row', backgroundColor: P.bleu, paddingVertical: 3, paddingHorizontal: 2 },
  tableHeaderText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: P.blanc },
  tableRow: { flexDirection: 'row', paddingVertical: 2.5, paddingHorizontal: 2, borderBottom: `0.2 solid ${P.grisB}` },
  tableRowAlt: { backgroundColor: P.grisL },
  tableCell: { fontSize: 7.5 },
  tableCellBold: { fontSize: 7.5, fontFamily: 'Helvetica-Bold' },

  // Situation
  sitRow: { flexDirection: 'row', gap: 2, marginBottom: 3 },
  sitCard: { flex: 1, border: `0.4 solid ${P.grisB}`, backgroundColor: P.blanc },
  sitCardTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', paddingHorizontal: 5, paddingVertical: 3, borderBottom: `1.5 solid ${P.vert}` },
  sitCardBody: { padding: 5 },
  sitItem: { fontSize: 7.5, marginBottom: 2.5, lineHeight: 1.3 },

  // Patrimoine & Docs
  grisBox: { backgroundColor: P.grisL, border: `0.4 solid ${P.grisB}`, padding: 6, marginBottom: 3 },
  grisBoxText: { fontSize: 7.5 },

  // Historique
  histRow: { flexDirection: 'row', marginBottom: 3, alignItems: 'flex-start' },
  histBullet: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: P.bleu, width: 10, marginRight: 4 },
  histDate: { fontSize: 8, fontFamily: 'Helvetica-Bold', width: 52, marginRight: 4 },
  histLabel: { fontSize: 8, flex: 1 },

  // Observations
  obsBox: { border: `0.4 solid ${P.grisB}`, padding: 8, minHeight: 40, marginBottom: 4 },
  obsText: { fontSize: 7.5, lineHeight: 1.5 },

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
});

// ── Helpers ───────────────────────────────────────────────────────
const sf = (v: any) => String(v || '—').replace(/[^\x00-\xFF]/g, '?');
const ageOf = (m: Membre) => m.date_naissance ? new Date().getFullYear() - new Date(m.date_naissance).getFullYear() : 0;

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
        <Text key={i} style={s.sitItem}><Text style={{ fontFamily: 'Helvetica-Bold' }}>{k}:</Text> {v}</Text>
      ))}
    </View>
  </View>
);

// ── Document principal ────────────────────────────────────────────
function FicheMenageDoc({ foyer, membres, cotAJour, docs, hist }: {
  foyer: Foyer; membres: Membre[]; cotAJour: boolean;
  docs: any[]; hist: { date: string; label: string }[];
}) {
  const mems = [...membres].sort((a, b) => (a.is_chef ? -1 : b.is_chef ? 1 : 0));
  const chef = mems.find(m => m.is_chef);
  const now  = new Date().toLocaleDateString('fr-FR') + ' - ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const nbEnf  = mems.filter(m => ageOf(m) < 18).length;
  const nbAges = mems.filter(m => ageOf(m) >= 60).length;
  const nbVuln = mems.filter(m => m.est_vulnerable).length;
  const nbSco  = mems.filter(m => { const p = (m.profession||'').toLowerCase(); return p.includes('eleve')||p.includes('etudiant'); }).length;
  const nbTrav = mems.filter(m => { const p = (m.profession||'').toLowerCase(); return p && !p.includes('eleve') && !p.includes('etudiant'); }).length;
  const nbAlpha = mems.filter(m => m.niveau_etude && m.niveau_etude !== 'Aucun').length;
  const niveaux = mems.map(m => m.niveau_etude).filter(Boolean);
  const niveauMoy = niveaux[Math.floor(niveaux.length/2)] || '—';

  const murs = Array.isArray(foyer.materiaux_mur) && foyer.materiaux_mur.length > 0 ? foyer.materiaux_mur.join(', ') : foyer.materiau_mur || '—';
  const eau  = foyer.eau_source || '—';
  const elec = foyer.a_electricite === true ? 'Oui' : foyer.a_electricite === false ? 'Non' : '—';
  const chefVacc = chef?.vaccination || [];
  const vaccStr  = chefVacc.length > 0 ? (chefVacc.length > 2 ? 'Complete' : chefVacc.join(', ')) : '—';
  const nbHandi  = mems.filter(m => m.handicap_oui || !!m.handicap).length;
  const nbSuivi  = mems.filter(m => m.suivi_medical).length;
  const revenu   = chef?.revenu_estime ? `${Number(chef.revenu_estime).toLocaleString('fr-FR')} Ar` : chef?.revenu_fourchette || '—';
  const hasAgri  = mems.some(m => (m.agr_types||[]).some(a => a.toLowerCase().includes('agri')));
  const hasElev  = mems.some(m => (m.agr_types||[]).some(a => a.toLowerCase().includes('elev')));

  // Score
  let sc = 0, tot = 0;
  const add = (c: boolean, p: number) => { tot += p; if (c) sc += p; };
  add(!!foyer.adresse, 5); add(!!foyer.type_logement, 5); add(!!foyer.eau_source, 10);
  add(foyer.a_electricite === true, 5); add(!!foyer.statut_occupant, 5);
  add((foyer.materiaux_mur||[]).length > 0 || !!foyer.materiau_mur, 5);
  add(mems.some(m => m.is_chef), 10); add(mems.length > 0, 10);
  add(mems.some(m => !!m.cin), 15); add(mems.some(m => !!m.profession), 10);
  add(mems.some(m => (m.vaccination||[]).length > 0), 10); add(mems.length >= 2, 10);
  const score = tot > 0 ? Math.round((sc/tot)*100) : 0;
  const scoreColor = score >= 70 ? P.vert : score >= 50 ? P.orange : P.rouge;

  // Resume
  const nbE2 = mems.filter(m => ageOf(m) < 18).length;
  let resumeText = `Ce menage est compose de ${mems.length} personne${mems.length>1?'s':''}`;
  if (nbE2) resumeText += ` dont ${nbE2} enfant${nbE2>1?'s':''}`;
  resumeText += '.';
  if (chef?.profession) resumeText += ` Le chef de menage est ${sf(chef.profession).toLowerCase()}.`;
  if (foyer.type_logement) {
    resumeText += ` Le logement est de type ${sf(foyer.type_logement).toLowerCase()}`;
    const p: string[] = [];
    if (foyer.nombre_pieces) p.push(`${foyer.nombre_pieces} pieces`);
    if (foyer.superficie_maison) p.push(`${foyer.superficie_maison}m2`);
    if (p.length) resumeText += ` (${p.join(', ')})`;
    resumeText += '.';
  }
  if (cotAJour) resumeText += ' Les cotisations sont a jour.';
  if (nbVuln) resumeText += ` ${nbVuln} personne${nbVuln>1?'s':''} vulnerable${nbVuln>1?'s':''} recensee${nbVuln>1?'s':''}.`;

  const colW = ['32%','14%','8%','28%','18%'];
  const headers = ['Nom','Lien','Age','Profession','Statut'];

  const dernierDoc = docs[0];
  const docLabel = dernierDoc ? `${sf(dernierDoc.nom_document)} (${new Date(dernierDoc.created_at).toLocaleDateString('fr-FR')})` : '—';

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
            <Text style={s.docTitle}>FICHE MENAGE</Text>
            <Text style={s.docSub}>Document officiel - Usage administratif</Text>
          </View>
          <View style={s.headerRight}>
            <View style={s.qrBox}><Text style={s.qrText}>QR</Text></View>
            <Text style={s.menCode}>{foyer.code_menage}</Text>
            <Text style={s.menDate}>{now}</Text>
          </View>
        </View>
        <View style={s.hline} />

        {/* ── CHEF ── */}
        <View style={s.chefBlock}>
          <View style={s.photoBox}><Text style={s.photoText}>PHOTO</Text></View>
          <View style={s.chefInfo}>
            <Text style={s.chefNom}>{chef ? `${sf(chef.nom).toUpperCase()} ${sf(chef.prenom)}`.trim() : '—'}</Text>
            <Text style={s.chefSub}>Chef de menage  |  {sf(foyer.adresse)}</Text>
            <Text style={s.chefSub}>{[foyer.fokontany&&`Fokontany ${foyer.fokontany}`,foyer.commune&&`Commune ${foyer.commune}`,foyer.district&&`District ${foyer.district}`].filter(Boolean).join(' | ')}</Text>
            {(chef?.telephone||foyer.annee_installation) && <Text style={s.chefSub}>{[chef?.telephone&&`Tel: ${chef.telephone}`,foyer.annee_installation&&`Installe depuis: ${foyer.annee_installation}`].filter(Boolean).join('  |  ')}</Text>}
            <View style={s.badgesRow}>
              <View style={[s.badge,{backgroundColor:P.vert}]}><Text style={s.badgeText}>* Actif</Text></View>
              {(foyer as any).note_agent_incomplete && <View style={[s.badge,{backgroundColor:P.orange}]}><Text style={s.badgeText}>* A suivre</Text></View>}
              <View style={[s.badge,{backgroundColor:cotAJour?P.cyan:P.orange}]}><Text style={s.badgeText}>{cotAJour?'* Cotisation a jour':'* Cotisation en retard'}</Text></View>
            </View>
          </View>
          <View style={[s.scoreBox,{borderColor:scoreColor}]}>
            <Text style={[s.scorePct,{color:scoreColor}]}>{score}%</Text>
            <Text style={s.scoreLabel}>Score FANISA</Text>
          </View>
        </View>

        {/* ── INDICATEURS ── */}
        <SectionBar title="  INDICATEURS CLES" />
        <View style={[s.indsRow, s.mb2]}>
          <IndCard val={String(mems.length)}         label="Membres"     color={P.bleu} />
          <IndCard val={String(foyer.nombre_pieces||'—')} label="Pieces"  color={P.bleu} />
          <IndCard val={foyer.superficie_maison?`${foyer.superficie_maison}m2`:'—'} label="Superficie" color={P.cyan} />
          <IndCard val={String(nbEnf)}  label="Enfants"      color={P.orange} />
          <IndCard val={String(nbAges)} label="Pers. agees"  color={P.violet} />
          <IndCard val={String(nbVuln)} label="Vulnerables"  color={P.rouge} />
        </View>
        <View style={[s.indsRow, s.mb3]}>
          <IndCard val={String(nbSco)}  label="Scolarises"   color={P.vert} />
          <IndCard val={String(nbTrav)} label="Travailleurs"  color={P.vert} />
          <IndCard val="—"              label="Activites"     color={P.cyan} />
          <IndCard val="—"              label="Terrain"       color={P.orange} />
          <IndCard val="—"              label="Vehicule"      color={P.violet} />
          <IndCard val="—"              label="Elevage"       color={P.orange} />
        </View>

        {/* ── RÉSUMÉ ── */}
        <SectionBar title="  RESUME INTELLIGENT FANISA" />
        <View style={[s.resumeBox, s.mb3]}>
          <Text style={s.resumeText}>{resumeText}</Text>
        </View>

        {/* ── COMPOSITION ── */}
        <SectionBar title="  COMPOSITION DU MENAGE" />
        <View style={s.mb3}>
          <View style={s.tableHeader}>
            {headers.map((h,i) => <Text key={i} style={[s.tableHeaderText,{width:colW[i]}]}>{h}</Text>)}
          </View>
          {mems.map((m, idx) => (
            <View key={m.id} style={[s.tableRow, idx%2===1&&s.tableRowAlt]}>
              <Text style={[m.is_chef?s.tableCellBold:s.tableCell,{width:colW[0]}]}>{`${sf(m.nom).toUpperCase()} ${sf(m.prenom)}`.trim()}</Text>
              <Text style={[s.tableCell,{width:colW[1]}]}>{sf(m.relation_chef||(m.is_chef?'Chef':'—'))}</Text>
              <Text style={[s.tableCell,{width:colW[2]}]}>{ageOf(m)>0?String(ageOf(m)):'—'}</Text>
              <Text style={[s.tableCell,{width:colW[3]}]}>{sf(m.profession)}</Text>
              <Text style={[s.tableCell,{width:colW[4]}]}>{m.est_vulnerable?'Vulnerable':sf(m.statut)}</Text>
            </View>
          ))}
        </View>

        {/* ── SITUATION ── */}
        <SectionBar title="  SITUATION DU MENAGE" />
        <View style={[s.sitRow, s.mb3]}>
          <SitCard title="Sante" color={P.vert} items={[['Vaccination',vaccStr.length>20?'Complete':vaccStr],['Chronique',nbHandi>0?`${nbHandi} cas`:'Aucune'],['Handicap',String(nbHandi)],['Suivi',nbSuivi>0?'Oui':'—']]} />
          <SitCard title="Habitat" color={P.bleu} items={[['Type',sf(foyer.type_logement)],['Murs',sf(murs)],['Eau',sf(eau)],['Electricite',elec]]} />
          <SitCard title="Education" color={P.orange} items={[['Eleves',String(nbSco)],['Niveau moy.',sf(niveauMoy)],['Abandon','0'],['Alphabetises',`${nbAlpha}/${mems.length}`]]} />
          <SitCard title="Economie" color={P.violet} items={[['Revenu',sf(revenu)],['Agriculture',hasAgri?'Oui':'Non'],['Elevage',hasElev?'Oui':'Non']]} />
        </View>

        {/* ── PATRIMOINE ── */}
        <SectionBar title="  PATRIMOINE" />
        <View style={[s.grisBox, s.mb3]}>
          <Text style={s.grisBoxText}>Terrain: —  |  Maison: —  |  Moto: —  |  TV: —  |  Telephone: {chef?.telephone?'1':'—'}</Text>
        </View>

        {/* ── DOCUMENTS ── */}
        <SectionBar title="  DOCUMENTS ADMINISTRATIFS" />
        <View style={[s.grisBox, s.mb3]}>
          <Text style={s.grisBoxText}>Total: {docs.length} document{docs.length>1?'s':''}  |  Dernier: {docLabel}  |  Statut: Conforme</Text>
        </View>

        {/* ── HISTORIQUE ── */}
        <SectionBar title="  HISTORIQUE DU MENAGE" />
        <View style={s.mb3}>
          {hist.length === 0
            ? <Text style={{fontSize:8,color:P.grisM}}>Aucun historique enregistre.</Text>
            : hist.map((h,i) => (
              <View key={i} style={s.histRow}>
                <Text style={s.histBullet}>-</Text>
                <Text style={s.histDate}>{h.date}</Text>
                <Text style={s.histLabel}>{sf(h.label)}</Text>
              </View>
            ))
          }
        </View>

        {/* ── OBSERVATIONS ── */}
        <SectionBar title="  OBSERVATIONS" />
        <View style={[s.obsBox, s.mb3]}>
          <Text style={s.obsText}>{sf(foyer.observations_complementaires||'Aucune observation.')}</Text>
        </View>

        {/* ── SIGNATURES ── */}
        <View style={s.sigRow}>
          {['Agent collecteur','Chef Fokontany','Cachet officiel'].map((label, i) => (
            <View key={i} style={[s.sigCell, i>0&&s.sigBorder]}>
              <Text style={s.sigTitle}>{label}</Text>
              <View style={s.sigLine} />
              <Text style={s.sigSub}>Signature</Text>
            </View>
          ))}
        </View>

        {/* ── PIED DE PAGE ── */}
        <View style={s.footLine} />
        <Text style={s.footText}>FANISA v2.0  |  Document officiel  |  Ref. {foyer.code_menage}  |  Page 1/1</Text>

      </Page>
    </Document>
  );
}

// ── Chargement données ────────────────────────────────────────────
async function loadHistorique(foyerId: string): Promise<{date:string;label:string}[]> {
  const hist: {date:string;label:string;ts:string}[] = [];
  const {data:docs} = await supabase.from('demandes_documents').select('created_at,nom_document').eq('foyer_id',foyerId).in('statut',['Payé','Archivé']).order('created_at',{ascending:false}).limit(5);
  (docs||[]).forEach((d:any) => hist.push({ts:d.created_at,date:new Date(d.created_at).toLocaleDateString('fr-FR'),label:`${sf(d.nom_document)} - delivre`}));
  const {data:cots} = await supabase.from('cotisations').select('date_paiement,periode').eq('foyer_id',foyerId).not('date_paiement','is',null).order('date_paiement',{ascending:false}).limit(4);
  (cots||[]).forEach((c:any) => { if(c.date_paiement) hist.push({ts:c.date_paiement,date:new Date(c.date_paiement).toLocaleDateString('fr-FR'),label:`Cotisation ${sf(c.periode)} - payee`}); });
  hist.sort((a,b)=>b.ts.localeCompare(a.ts));
  return hist.slice(0,7).map(h=>({date:h.date,label:h.label}));
}

// ── Export public ─────────────────────────────────────────────────
export async function imprimerFicheMenage(foyer: Foyer, membres: Membre[]) {
  const [{data:docs},{data:cots},hist] = await Promise.all([
    supabase.from('demandes_documents').select('nom_document,created_at').eq('foyer_id',foyer.id).in('statut',['Payé','Archivé']).order('created_at',{ascending:false}),
    supabase.from('cotisations').select('statut,periode').eq('foyer_id',foyer.id),
    loadHistorique(foyer.id),
  ]);
  const cotAJour = (cots||[]).some((c:any)=>c.statut==='A jour'||c.statut==='\u00c0 jour');

  const blob = await pdf(
    <FicheMenageDoc foyer={foyer} membres={membres} cotAJour={cotAJour} docs={docs||[]} hist={hist} />
  ).toBlob();
  const buf = await blob.arrayBuffer();
  await telechargerPDF(new Uint8Array(buf), `FICHE_MENAGE_${foyer.code_menage}.pdf`);
}
