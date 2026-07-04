import React from 'react';
import { Document, Page, View, Text, StyleSheet, pdf } from '@react-pdf/renderer';
import { Foyer, Membre } from '../types';
import { supabase } from './supabase';
import { telechargerPDF } from './documents';

const P = {
  bleu:'#1E3A8A', bleuL:'#EFF6FF', vert:'#10B981', vertL:'#ECFDF5',
  orange:'#F59E0B', rouge:'#EF4444', violet:'#8B5CF6', cyan:'#0EA5E9',
  grisF:'#1E293B', grisM:'#64748B', grisL:'#F8FAFC', grisB:'#E2E8F0', blanc:'#FFFFFF',
};

const s = StyleSheet.create({
  page: { fontFamily:'Helvetica', fontSize:8, color:P.grisF, paddingHorizontal:15, paddingVertical:12 },

  // Header
  header: { flexDirection:'row', alignItems:'center', marginBottom:4 },
  fanisaTitle: { fontSize:18, fontFamily:'Helvetica-Bold', color:P.bleu },
  fanisaSub: { fontSize:7.5, color:P.grisM, marginTop:1 },
  docTitle: { fontSize:16, fontFamily:'Helvetica-Bold', color:P.grisF, textAlign:'center' },
  docSub: { fontSize:7.5, color:P.grisM, marginTop:2, textAlign:'center' },
  qrBox: { width:24, height:24, backgroundColor:P.grisL, borderWidth:0.5, borderColor:P.grisB, alignItems:'center', justifyContent:'center', marginBottom:3 },
  menCode: { fontSize:13, fontFamily:'Helvetica-Bold', color:P.bleu, textAlign:'right' },
  menDate: { fontSize:7.5, color:P.grisM, textAlign:'right', marginTop:2 },
  hline: { height:1.5, backgroundColor:P.bleu, marginBottom:5 },

  // Bloc identité haut
  identBlock: { flexDirection:'row', borderWidth:0.5, borderColor:P.grisB, backgroundColor:P.grisL, padding:8, marginBottom:4, alignItems:'flex-start' },
  photoBox: { width:70, height:80, backgroundColor:P.blanc, borderWidth:0.5, borderColor:P.grisB, alignItems:'center', justifyContent:'center', marginRight:10 },
  photoTxt: { fontSize:7, color:P.grisM },
  identInfo: { flex:1 },
  identNom: { fontSize:16, fontFamily:'Helvetica-Bold', color:P.grisF, marginBottom:3 },
  identSub: { fontSize:8, color:P.grisM, marginBottom:2 },
  badgesRow: { flexDirection:'row', gap:4, marginVertical:5 },
  badge: { paddingHorizontal:7, paddingVertical:2.5, borderRadius:10 },
  badgeTxt: { fontSize:7, fontFamily:'Helvetica-Bold', color:P.blanc },
  identMeta: { fontSize:8, color:P.grisM, marginTop:4, borderTopWidth:0.5, borderTopColor:P.grisB, paddingTop:4 },
  scoreBox: { width:52, alignItems:'center', justifyContent:'center', borderWidth:2, padding:5, marginLeft:8 },
  scorePct: { fontSize:20, fontFamily:'Helvetica-Bold', marginBottom:2 },
  scoreLabel: { fontSize:6.5, color:P.grisM, textAlign:'center' },

  // Sections
  sectionRow: { flexDirection:'row', alignItems:'center', marginBottom:5, marginTop:6 },
  sectionBar: { width:3, height:14, backgroundColor:P.bleu, marginRight:7 },
  sectionTitle: { fontSize:9, fontFamily:'Helvetica-Bold', color:P.bleu },
  hlineSect: { height:0.4, backgroundColor:P.grisB, marginBottom:5 },

  // Grille 2 colonnes
  grid: { flexDirection:'row', marginBottom:2 },
  gridLeft: { flex:1 },
  gridRight: { flex:1 },
  row: { flexDirection:'row', marginBottom:4 },
  rowLabel: { width:90, fontSize:8, color:P.grisM },
  rowVal: { flex:1, fontSize:8, fontFamily:'Helvetica-Bold', color:P.grisF },

  // Historique
  histRow: { flexDirection:'row', marginBottom:4, alignItems:'flex-start' },
  histDot: { width:8, height:8, borderRadius:4, backgroundColor:P.bleu, marginRight:6, marginTop:1 },
  histDate: { fontSize:8, fontFamily:'Helvetica-Bold', width:58, color:P.grisF },
  histLabel: { fontSize:8, flex:1, color:P.grisM },

  // Observations
  obsBox: { borderWidth:0.5, borderColor:P.grisB, minHeight:50, padding:7, marginBottom:5 },
  obsTxt: { fontSize:8, color:P.grisM, lineHeight:1.5 },

  // Signatures
  sigTitle: { fontSize:9, fontFamily:'Helvetica-Bold', color:P.bleu, marginBottom:6 },
  sigRow: { flexDirection:'row', gap:8, marginBottom:16 },
  sigBox: { flex:1, height:40, borderWidth:0.5, borderColor:P.grisB },
  sigLabel: { fontSize:7.5, color:P.grisM, textAlign:'center', marginTop:4 },

  // Footer
  footLine: { height:0.5, backgroundColor:P.grisB, marginTop:6, marginBottom:3 },
  footTxt: { fontSize:7, color:P.grisM, textAlign:'center' },
});

// ── Ligne label/valeur ────────────────────────────────────────────
const Row = ({ label, val }: { label: string; val: any }) => (
  <View style={s.row}>
    <Text style={s.rowLabel}>{label}</Text>
    <Text style={s.rowVal}>{String(val || '—').replace(/[^\x00-\xFF]/g,'?')}</Text>
  </View>
);

// ── Section titre ─────────────────────────────────────────────────
const Section = ({ title }: { title: string }) => (
  <View>
    <View style={s.sectionRow}>
      <View style={s.sectionBar} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  </View>
);

const sf = (v: any) => String(v || '—').replace(/[^\x00-\xFF]/g,'?');

// ── Document ──────────────────────────────────────────────────────
function FicheIndividuelleDoc({ membre, foyer, hist }: {
  membre: Membre; foyer: Foyer; hist: { date: string; label: string }[];
}) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('fr-FR');
  const ageVal = membre.date_naissance ? today.getFullYear() - new Date(membre.date_naissance).getFullYear() : null;

  // Score individuel
  let sc = 0, tot = 0;
  const add = (c: boolean, p: number) => { tot += p; if (c) sc += p; };
  add(!!membre.cin, 15); add(!!membre.profession, 10); add(!!membre.telephone, 5);
  add(!!membre.niveau_etude && membre.niveau_etude !== 'Aucun', 10);
  add((membre.vaccination || []).length > 0, 10); add(!!membre.groupe_sanguin, 5);
  add(!!membre.date_naissance, 5); add(!!membre.lieu_naissance, 5);
  add(!membre.est_vulnerable, 10); add(!!membre.relation_chef, 5);
  add((membre.competences || []).length > 0, 10); add(!!membre.revenu_estime || !!membre.revenu_fourchette, 10);
  const score = tot > 0 ? Math.round((sc / tot) * 100) : 0;
  const scoreColor = score >= 70 ? P.bleu : score >= 50 ? P.orange : P.rouge;

  const refDoc = `MEN-${foyer.code_menage}-${String(membre.id).slice(-2).toUpperCase()}`;

  const vaccStr = (membre.vaccination || []).length > 0 ? (membre.vaccination.length > 2 ? 'Complete' : membre.vaccination.join(', ')) : '—';
  const maladies = (membre.maladies_chroniques || []).join(', ') || 'Aucune';
  const allergies = (membre.allergies || []).join(', ') || 'Aucune';
  const competences = (membre.competences || []).join(', ') || '—';
  const langues = (membre.langues || []).join(', ') || '—';
  const formations = (membre.formations_pro || []).join(', ') || '—';
  const vulnerabilites = (membre.vulnerabilite_categories || []).join(', ') || '—';
  const aides = (membre.aides_obtenues || []).join(', ') || 'Aucune';

  const metaLine = [
    ageVal && `${ageVal} ans`,
    membre.sexe === 'M' ? 'Masculin' : membre.sexe === 'F' ? 'Feminin' : '',
    membre.date_naissance && `Ne le ${new Date(membre.date_naissance).toLocaleDateString('fr-FR')}`,
    membre.cin && `CIN: ${membre.cin}`,
    membre.poids && `${membre.poids} kg`,
    membre.taille && `${membre.taille} cm`,
  ].filter(Boolean).join('  |  ');

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── EN-TÊTE ── */}
        <View style={s.header}>
          <View style={{ flex:1 }}>
            <Text style={s.fanisaTitle}>FANISA</Text>
            <Text style={s.fanisaSub}>Gestion du Fokontany</Text>
          </View>
          <View style={{ flex:2 }}>
            <Text style={s.docTitle}>FICHE INDIVIDUELLE</Text>
            <Text style={s.docSub}>Document officiel - Usage administratif</Text>
          </View>
          <View style={{ flex:1, alignItems:'flex-end' }}>
            <View style={s.qrBox}><Text style={{ fontSize:8, fontFamily:'Helvetica-Bold', color:P.grisM }}>QR</Text></View>
            <Text style={s.menCode}>{refDoc}</Text>
            <Text style={s.menDate}>{dateStr}</Text>
          </View>
        </View>
        <View style={s.hline} />

        {/* ── BLOC IDENTITÉ ── */}
        <View style={s.identBlock}>
          <View style={s.photoBox}><Text style={s.photoTxt}>PHOTO</Text></View>
          <View style={s.identInfo}>
            <Text style={s.identNom}>{`${sf(membre.nom).toUpperCase()} ${sf(membre.prenom)}`}</Text>
            <Text style={s.identSub}>
              {sf(membre.relation_chef || (membre.is_chef ? 'Chef de menage' : '—'))}  |  Foyer {foyer.code_menage}  |  {foyer.fokontany ? `Fokontany ${foyer.fokontany}` : ''}
            </Text>
            <View style={s.badgesRow}>
              <View style={[s.badge, { backgroundColor: membre.statut === 'Actif' ? P.vert : P.orange }]}>
                <Text style={s.badgeTxt}>{sf(membre.statut)}</Text>
              </View>
              {membre.est_vulnerable && <View style={[s.badge, { backgroundColor: P.orange }]}><Text style={s.badgeTxt}>Vulnerable</Text></View>}
              {(membre as any).cotisation_a_jour && <View style={[s.badge, { backgroundColor: P.cyan }]}><Text style={s.badgeTxt}>Cotisation a jour</Text></View>}
              {membre.niveau_priorite === 'Critique' && <View style={[s.badge, { backgroundColor: P.rouge }]}><Text style={s.badgeTxt}>Priorite critique</Text></View>}
            </View>
            <Text style={s.identMeta}>{metaLine}</Text>
          </View>
          <View style={[s.scoreBox, { borderColor: scoreColor }]}>
            <Text style={[s.scorePct, { color: scoreColor }]}>{score}%</Text>
            <Text style={s.scoreLabel}>Score{'\n'}FANISA</Text>
          </View>
        </View>

        {/* ── ÉTAT CIVIL & DOCUMENTS ── */}
        <Section title="ETAT CIVIL & DOCUMENTS" />
        <View style={s.hlineSect} />
        <View style={s.grid}>
          <View style={s.gridLeft}>
            <Row label="Lieu de naissance" val={membre.lieu_naissance} />
            <Row label="Situation" val={membre.situation_matrimoniale} />
            <Row label="Date CIN" val={membre.date_cin ? new Date(membre.date_cin).toLocaleDateString('fr-FR') : '—'} />
            <Row label="CIN Duplicata" val={membre.cin_est_duplicata ? `Oui (${membre.cin_duplicata_date ? new Date(membre.cin_duplicata_date).toLocaleDateString('fr-FR') : '—'})` : 'Non'} />
            <Row label="Religion" val={membre.religion} />
            <Row label="Adresse" val={foyer.adresse} />
          </View>
          <View style={s.gridRight}>
            <Row label="Nationalite" val={membre.nationalite || 'Malagasy'} />
            <Row label="CIN" val={membre.cin} />
            <Row label="Passeport" val={'—'} />
            <Row label="Telephone" val={membre.telephone} />
            <Row label="Email" val={membre.email} />
            <Row label="Contact urgence" val={membre.contact_urgence_nom ? `${membre.contact_urgence_nom} (${membre.contact_urgence_telephone || '—'})` : '—'} />
          </View>
        </View>

        {/* ── SITUATION ÉCONOMIQUE ── */}
        <Section title="SITUATION ECONOMIQUE" />
        <View style={s.hlineSect} />
        <View style={s.grid}>
          <View style={s.gridLeft}>
            <Row label="Profession" val={membre.profession} />
            <Row label="Employeur" val={membre.employeur} />
            <Row label="Activite sec." val={membre.activite_secondaire} />
            <Row label="Compte bancaire" val={membre.compte_bancaire ? 'Oui' : 'Non'} />
          </View>
          <View style={s.gridRight}>
            <Row label="Revenu mensuel" val={membre.revenu_estime ? `${Number(membre.revenu_estime).toLocaleString('fr-FR')} Ar` : membre.revenu_fourchette} />
            <Row label="Regime" val={membre.regime_emploi || membre.situation_emploi} />
            <Row label="Secteur" val={membre.secteur_activite || membre.secteur} />
            <Row label="e-Poketra" val={membre.e_poketra ? 'Oui' : 'Non'} />
          </View>
        </View>

        {/* ── ÉDUCATION & COMPÉTENCES ── */}
        <Section title="EDUCATION & COMPETENCES" />
        <View style={s.hlineSect} />
        <View style={s.grid}>
          <View style={s.gridLeft}>
            <Row label="Niveau" val={membre.niveau_etude} />
            <Row label="Competences" val={competences} />
            <Row label="Langues" val={langues} />
          </View>
          <View style={s.gridRight}>
            <Row label="Diplome" val={membre.diplome} />
            <Row label="Formation" val={formations} />
            <Row label="Filiere" val={membre.filiere_etudes} />
          </View>
        </View>

        {/* ── SANTÉ & PRÉVENTION ── */}
        <Section title="SANTE & PREVENTION" />
        <View style={s.hlineSect} />
        <View style={s.grid}>
          <View style={s.gridLeft}>
            <Row label="Groupe sanguin" val={membre.groupe_sanguin} />
            <Row label="Vaccination" val={vaccStr} />
            <Row label="Maladies chr." val={maladies} />
            <Row label="Hypertension" val={sf(membre.hypertension)} />
            <Row label="Diabete" val={sf(membre.diabete)} />
            {membre.poids && <Row label="Poids" val={`${membre.poids} kg`} />}
            {membre.taille && <Row label="Taille" val={`${membre.taille} cm`} />}
          </View>
          <View style={s.gridRight}>
            <Row label="Allergies" val={allergies} />
            <Row label="Handicap" val={membre.handicap_oui ? (membre.handicap_types?.join(', ') || 'Oui') : 'Aucun'} />
            <Row label="Suivi medical" val={membre.suivi_medical ? 'Oui' : 'Non'} />
            <Row label="Traitement" val={membre.traitement_regulier ? 'Oui' : 'Non'} />
            <Row label="Statut vaccinal" val={membre.statut_vaccinal} />
            {membre.sexe === 'F' && membre.grossesse_cours && <Row label="Grossesse" val={`${membre.grossesse_mois || '?'} mois`} />}
          </View>
        </View>

        {/* ── SITUATION SOCIALE ── */}
        <Section title="SITUATION SOCIALE" />
        <View style={s.hlineSect} />
        <View style={s.grid}>
          <View style={s.gridLeft}>
            <Row label="Aide sociale" val={membre.aide_sociale} />
            <Row label="Assurance" val={membre.assurance} />
            <Row label="Vulnerabilite" val={membre.est_vulnerable ? vulnerabilites : 'Non'} />
            <Row label="Aides obtenues" val={aides} />
          </View>
          <View style={s.gridRight}>
            <Row label="Acces eau" val={membre.acces_eau_individuel || foyer.eau_source} />
            <Row label="Internet" val={membre.acces_internet_individuel ? 'Oui (mobile)' : (foyer as any).acces_internet ? 'Oui' : 'Non'} />
            <Row label="Priorite" val={membre.niveau_priorite} />
          </View>
        </View>

        {/* ── PARTICIPATION COMMUNAUTAIRE ── */}
        <Section title="PARTICIPATION COMMUNAUTAIRE" />
        <View style={s.hlineSect} />
        <View style={s.grid}>
          <View style={s.gridLeft}>
            <Row label="Cotisation" val={(membre as any).cotisation_a_jour ? 'A jour' : '—'} />
            <Row label="Reunions" val={membre.reunion_presences} />
          </View>
          <View style={s.gridRight}>
            <Row label="Roles" val={membre.role_communautaire} />
            <Row label="Dernier evt" val={membre.dernier_evenement} />
          </View>
        </View>

        {/* ── HISTORIQUE ── */}
        <Section title="HISTORIQUE" />
        <View style={s.hlineSect} />
        <View style={{ marginBottom:5 }}>
          {hist.length === 0
            ? <Text style={{ fontSize:8, color:P.grisM }}>Aucun historique.</Text>
            : hist.map((h, i) => (
              <View key={i} style={s.histRow}>
                <View style={s.histDot} />
                <Text style={s.histDate}>{h.date}</Text>
                <Text style={s.histLabel}>{sf(h.label)}</Text>
              </View>
            ))
          }
        </View>

        {/* ── OBSERVATIONS ── */}
        <Section title="OBSERVATIONS" />
        <View style={s.obsBox}>
          <Text style={s.obsTxt}>{sf((membre as any).observations || (membre.vulnerabilite_description ? `Vulnerabilite: ${membre.vulnerabilite_description}` : 'RAS'))}</Text>
        </View>

        {/* ── SIGNATURES ── */}
        <Section title="SIGNATURES" />
        <View style={s.sigRow}>
          {['Agent collecteur', 'Chef Fokontany', 'Cachet officiel'].map((l, i) => (
            <View key={i} style={s.sigBox}>
              <Text style={s.sigLabel}>{l}</Text>
            </View>
          ))}
        </View>

        {/* ── PIED DE PAGE ── */}
        <View style={s.footLine} />
        <Text style={s.footTxt}>FANISA v2.0  |  Document officiel  |  Page 1/1  |  Ref. {refDoc}</Text>

      </Page>
    </Document>
  );
}

// ── Chargement historique individuel ─────────────────────────────
export async function loadHistMembre(membreId: string, foyerId: string) {
  const hist: { date: string; label: string; ts: string }[] = [];

  const { data: docs } = await supabase.from('demandes_documents')
    .select('created_at, nom_document').eq('membre_id', membreId)
    .in('statut', ['Payé', 'Archivé']).order('created_at', { ascending: false }).limit(5);
  (docs || []).forEach((d: any) => hist.push({ ts: d.created_at, date: new Date(d.created_at).toLocaleDateString('fr-FR'), label: `${d.nom_document} - delivre` }));

  const { data: cots } = await supabase.from('cotisations')
    .select('date_paiement, periode').eq('foyer_id', foyerId)
    .not('date_paiement', 'is', null).order('date_paiement', { ascending: false }).limit(3);
  (cots || []).forEach((c: any) => {
    if (c.date_paiement) hist.push({ ts: c.date_paiement, date: new Date(c.date_paiement).toLocaleDateString('fr-FR'), label: `Cotisation ${c.periode} - payee` });
  });

  hist.sort((a, b) => b.ts.localeCompare(a.ts));
  return hist.slice(0, 8).map(h => ({ date: h.date, label: h.label }));
}

export { FicheIndividuelleDoc as FicheIndividuelleDocExport };

// ── Export ────────────────────────────────────────────────────────
export async function imprimerFicheIndividuelle(membre: Membre, foyer: Foyer) {
  const hist = await loadHistMembre(membre.id, foyer.id);
  const blob = await pdf(<FicheIndividuelleDoc membre={membre} foyer={foyer} hist={hist} />).toBlob();
  const buf  = await blob.arrayBuffer();
  await telechargerPDF(new Uint8Array(buf), `FICHE_${membre.nom.toUpperCase()}_${membre.prenom}.pdf`);
}
