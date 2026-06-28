import { supabase } from './supabase';
import { Membre, Foyer } from '../types';
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, degrees } from 'pdf-lib';

export interface Parcelle { id: string; numero_lot: string; titre_foncier?: string; cadastre_ref?: string; superficie_m2?: number; gps_lat?: number; gps_lng?: number; adresse?: string; fokontany?: string; usage?: string; historique_subdivision?: string; notes?: string; photo_url?: string; }
export interface Batiment { id: string; parcelle_id: string; foyer_id?: string; reference_batiment: string; type_batiment: string; etat: string; superficie_m2?: number; nombre_niveaux?: number; materiaux_mur?: string; materiaux_toiture?: string; annee_construction?: number; notes?: string; }
export interface TitulaireFoncier { id: string; parcelle_id: string; type_titulaire: string; nom?: string; prenom?: string; cin?: string; telephone?: string; adresse?: string; notes?: string; }
export interface Detenteur { id: string; parcelle_id: string; membre_id?: string; foyer_id?: string; type_detention: string; nom?: string; prenom?: string; cin?: string; telephone?: string; date_debut_occupation?: string; document_detenu?: string; notes?: string; }
export interface MiseEnValeur { id: string; parcelle_id: string; maison?: boolean; cloture?: boolean; cultures?: boolean; elevage?: boolean; eau?: boolean; electricite?: boolean; commerce?: boolean; annee_debut?: number; description?: string; }

// ── Config ───────────────────────────────────────────────────
export interface ConfigFokontany {
  code_fokontany: string; code_quartier: string; code_carreau: string;
  nom_fokontany: string; nom_quartier: string; nom_commune: string;
  nom_district: string; nom_region?: string; chef_fokontany: string;
}
export async function getConfig(): Promise<ConfigFokontany> {
  const { data } = await supabase.from('config_fokontany').select('*').single();
  return data || { code_fokontany: 'AMB', code_quartier: 'TSA', code_carreau: 'C01', nom_fokontany: 'Ambodisaina', nom_quartier: 'Tsararivotra', nom_commune: 'Toamasina', nom_district: 'Toamasina II', nom_region: 'Atsinanana', chef_fokontany: 'Chef du Fokontany' };
}
export async function updateConfig(config: Partial<ConfigFokontany>) {
  await supabase.from('config_fokontany').update(config).eq('id', 1);
}

// ── Référence ────────────────────────────────────────────────
export async function genererReference(codeType: string, config: ConfigFokontany): Promise<{ reference: string; numero: number }> {
  const annee = new Date().getFullYear();
  const { data } = await supabase.from('documents_generes').select('numero_sequentiel').eq('code_type', codeType).eq('annee', annee).order('numero_sequentiel', { ascending: false }).limit(1);
  const numero = (data?.[0]?.numero_sequentiel || 0) + 1;
  return { reference: `${config.code_fokontany}-${config.code_quartier}-${config.code_carreau}-${codeType}-${annee}-${String(numero).padStart(4, '0')}`, numero };
}
export async function enregistrerDocument(codeType: string, reference: string, numero: number, membreId?: string, foyerId?: string, snapshot?: any) {
  await supabase.from('documents_generes').insert({ reference, code_type: codeType, membre_id: membreId || null, foyer_id: foyerId || null, annee: new Date().getFullYear(), numero_sequentiel: numero, donnees_snapshot: snapshot || null });
}

// ── Clean ────────────────────────────────────────────────────
function clean(t: string | undefined | null): string {
  if (!t) return '-';
  return t.replace(/[\u00e0-\u00e2]/g,'a').replace(/[\u00e8-\u00ea]/g,'e').replace(/[\u00ec-\u00ee]/g,'i').replace(/[\u00f2-\u00f4]/g,'o').replace(/[\u00f9-\u00fb]/g,'u').replace(/\u00e7/g,'c').replace(/[\u00c0-\u00c2]/g,'A').replace(/[\u00c8-\u00ca]/g,'E').replace(/[\u00cc-\u00ce]/g,'I').replace(/[\u00d2-\u00d4]/g,'O').replace(/[\u00d9-\u00db]/g,'U').replace(/\u00c7/g,'C').replace(/\u00e9/g,'e').replace(/\u00c9/g,'E').replace(/\u00ef/g,'i').replace(/\u00eb/g,'e').replace(/\u0153/g,'oe').replace(/\u0152/g,'OE').replace(/[\u2014\u2013]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u202f\u00a0\u2009\u200b]/g,' ').replace(/[^\x20-\xFF]/g,' ').trim() || '-';
}
function wrap(text: string, maxChars: number): string[] {
  const t = clean(text); const words = t.split(' '); const lines: string[] = []; let cur = '';
  for (const w of words) { if ((cur+' '+w).trim().length > maxChars) { lines.push(cur.trim()); cur = w; } else cur = (cur+' '+w).trim(); }
  if (cur) lines.push(cur); return lines.length ? lines : ['-'];
}

// ── Couleurs ─────────────────────────────────────────────────
const C = {
  indigo: rgb(0.24,0.21,0.75), dark: rgb(0.08,0.10,0.18), mid: rgb(0.30,0.34,0.44),
  light: rgb(0.58,0.64,0.73), bg: rgb(0.97,0.98,1.00), white: rgb(1,1,1),
  border: rgb(0.87,0.90,0.95), green: rgb(0.09,0.53,0.22), greenBg: rgb(0.88,0.99,0.91),
  red: rgb(0.75,0.10,0.10), redBg: rgb(1.00,0.93,0.93), gold: rgb(0.65,0.45,0.00),
  goldBg: rgb(1.00,0.97,0.85), amber: rgb(0.60,0.30,0.00),
};

function dt(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color: ReturnType<typeof rgb>) {
  page.drawText(clean(text), { x, y, size, font, color });
}

// ════════════════════════════════════════════════════════════
// FORMAT 1 : A5 PAYSAGE (210×148mm) — Certificats principaux
// ════════════════════════════════════════════════════════════
// A5 paysage en points PDF : 595 × 420
const A5L = { W: 595, H: 420 };

function drawHeaderA5L(page: PDFPage, config: ConfigFokontany, bold: PDFFont, reg: PDFFont, codeDoc: string, nomDoc: string, reference: string) {
  const { W, H } = A5L;
  const m = 20;

  // Bande supérieure indigo
  page.drawRectangle({ x: 0, y: H - 28, width: W, height: 28, color: C.indigo });

  // Colonne gauche — Fokontany (haut gauche obligatoire)
  dt(page, `FOKONTANY ${clean(config.nom_fokontany).toUpperCase()}`, m, H - 11, bold, 7, C.white);
  dt(page, `Qrt. ${clean(config.nom_quartier)} - Carreau ${config.code_carreau}`, m, H - 19, reg, 6, rgb(0.8,0.8,1));

  // Centre — Logo simplifié République
  const cx = W / 2;
  page.drawRectangle({ x: cx - 18, y: H - 25, width: 36, height: 22, color: rgb(0.35,0.30,0.82), borderRadius: 2 });
  dt(page, 'F', cx - 4, H - 15, bold, 14, C.white);

  // Colonne droite — Référence (haut droit obligatoire)
  dt(page, reference, W - m - 110, H - 11, bold, 6.5, C.white);
  dt(page, `${config.nom_commune} - ${config.nom_district}`, W - m - 110, H - 19, reg, 5.5, rgb(0.8,0.8,1));

  // Titre document
  const tY = H - 42;
  page.drawRectangle({ x: m, y: tY - 2, width: W - m * 2, height: 18, color: rgb(0.95,0.96,1.0), borderColor: C.indigo, borderWidth: 0.5, borderRadius: 2 });
  dt(page, `[${codeDoc}]  ${nomDoc.toUpperCase()}`, cx - nomDoc.length * 3.2, tY + 3, bold, 8.5, C.indigo);

  // Ligne séparatrice
  page.drawLine({ start: { x: m, y: tY - 4 }, end: { x: W - m, y: tY - 4 }, thickness: 0.4, color: C.border });
}

function drawFooterA5L(page: PDFPage, config: ConfigFokontany, reg: PDFFont, bold: PDFFont, reference: string, validite?: string) {
  const { W, H } = A5L;
  const m = 20;
  const fY = 42;

  page.drawLine({ start: { x: m, y: fY + 12 }, end: { x: W - m, y: fY + 12 }, thickness: 0.4, color: C.border });

  // QR code placeholder
  page.drawRectangle({ x: m, y: fY - 32, width: 40, height: 40, color: C.bg, borderColor: C.border, borderWidth: 0.8 });
  // Simuler QR code avec petits carrés
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    if ((r + c) % 2 === 0 || r === 0 || r === 4 || c === 0 || c === 4) {
      page.drawRectangle({ x: m + 3 + c * 6.5, y: fY - 28 + r * 6.5, width: 5.5, height: 5.5, color: C.dark });
    }
  }
  dt(page, 'QR', m + 12, fY - 38, reg, 5, C.mid);

  // Zone signature droite
  const sx = W - 180;
  dt(page, `Ambodisaina, le ${new Date().toLocaleDateString('fr-FR')}`, sx, fY + 8, reg, 6.5, C.mid);
  dt(page, 'Le Chef du Fokontany', sx + 10, fY - 4, bold, 7, C.dark);
  dt(page, clean(config.chef_fokontany), sx + 10, fY - 13, reg, 7, C.mid);
  page.drawLine({ start: { x: sx, y: fY - 26 }, end: { x: W - m, y: fY - 26 }, thickness: 0.5, color: C.border });
  dt(page, '(Signature et cachet officiel)', sx + 20, fY - 34, reg, 5.5, C.light);

  // Centre footer
  dt(page, validite ? `Valide jusqu\'au : ${validite}` : '', m + 55, fY + 2, reg, 6, C.mid);
  dt(page, `Genere automatiquement par FANISA v2.0`, m + 55, fY - 8, reg, 5.5, C.light);
  dt(page, `${reference}`, m + 55, fY - 18, reg, 5.5, C.light);
}

function boxA5(page: PDFPage, label: string, value: string, x: number, y: number, w: number, reg: PDFFont, bold: PDFFont) {
  page.drawRectangle({ x, y: y - 18, width: w, height: 20, color: C.bg, borderColor: C.border, borderWidth: 0.4, borderRadius: 2 });
  dt(page, label.toUpperCase(), x + 3, y - 1, reg, 5.5, C.light);
  dt(page, clean(value), x + 3, y - 11, bold, 8, C.dark);
}

// ════════════════════════════════════════════════════════════
// FORMAT 2 : A4 PORTRAIT — Déclarations et dossiers
// ════════════════════════════════════════════════════════════
const A4P = { W: 595, H: 842 };

function drawHeaderA4P(page: PDFPage, config: ConfigFokontany, bold: PDFFont, reg: PDFFont, codeDoc: string, nomDoc: string, reference: string) {
  const { W, H } = A4P;
  const m = 36;

  // Bande supérieure
  page.drawRectangle({ x: 0, y: H - 32, width: W, height: 32, color: C.indigo });
  dt(page, `FOKONTANY ${clean(config.nom_fokontany).toUpperCase()}`, m, H - 13, bold, 9, C.white);
  dt(page, `Qrt. ${clean(config.nom_quartier)} - Carreau ${config.code_carreau} - ${config.nom_commune}`, m, H - 22, reg, 7, rgb(0.8,0.8,1));

  // Logo centre
  page.drawRectangle({ x: W/2 - 22, y: H - 28, width: 44, height: 24, color: rgb(0.35,0.30,0.82), borderRadius: 3 });
  dt(page, 'F', W/2 - 5, H - 17, bold, 16, C.white);

  // Référence droite
  dt(page, reference, W - m - 130, H - 13, bold, 7, C.white);
  dt(page, `${config.nom_district} - ${config.nom_region || 'Atsinanana'}`, W - m - 130, H - 22, reg, 6.5, rgb(0.8,0.8,1));

  // Titre
  page.drawRectangle({ x: m, y: H - 62, width: W - m*2, height: 24, color: C.indigo, borderRadius: 3 });
  dt(page, `[${codeDoc}]  ${nomDoc.toUpperCase()}`, W/2 - nomDoc.length * 3.8, H - 49, bold, 10, C.white);

  page.drawLine({ start: { x: m, y: H - 68 }, end: { x: W - m, y: H - 68 }, thickness: 0.4, color: C.border });
}

function drawFooterA4P(page: PDFPage, config: ConfigFokontany, reg: PDFFont, bold: PDFFont, reference: string, W = 595, H = 842) {
  const m = 36;
  const fY = 60;

  page.drawLine({ start: { x: m, y: fY + 15 }, end: { x: W - m, y: fY + 15 }, thickness: 0.4, color: C.border });

  // QR code placeholder
  page.drawRectangle({ x: m, y: fY - 40, width: 48, height: 48, color: C.bg, borderColor: C.border, borderWidth: 0.8 });
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
    if ((r+c)%2===0 || r===0 || r===5 || c===0 || c===5) page.drawRectangle({ x: m+3+c*7, y: fY-36+r*7, width: 6, height: 6, color: C.dark });
  }
  dt(page, 'QR FANISA', m + 8, fY - 48, reg, 5, C.mid);

  // Signatures
  const sig1x = m + 60, sig2x = W/2 + 10;
  dt(page, 'Le declarant', sig1x, fY + 10, bold, 7.5, C.dark);
  page.drawLine({ start: { x: sig1x, y: fY - 8 }, end: { x: sig1x + 130, y: fY - 8 }, thickness: 0.5, color: C.border });
  dt(page, 'Le Chef du Fokontany', sig2x, fY + 10, bold, 7.5, C.dark);
  dt(page, clean(config.chef_fokontany), sig2x, fY - 2, reg, 7, C.mid);
  page.drawLine({ start: { x: sig2x, y: fY - 14 }, end: { x: W - m, y: fY - 14 }, thickness: 0.5, color: C.border });
  dt(page, '(Signature et cachet)', sig2x + 25, fY - 24, reg, 6, C.light);

  // Bas de page
  dt(page, `Genere automatiquement par FANISA v2.0  |  ${reference}  |  ${new Date().toLocaleDateString('fr-FR')}`, m + 60, 12, reg, 6, C.light);
}

// ════════════════════════════════════════════════════════════
// FORMAT 3 : A4 PAYSAGE — Fiches techniques et rapports
// ════════════════════════════════════════════════════════════
const A4L = { W: 842, H: 595 };

function drawHeaderA4L(page: PDFPage, config: ConfigFokontany, bold: PDFFont, reg: PDFFont, codeDoc: string, nomDoc: string, reference: string) {
  const { W, H } = A4L;
  const m = 30;
  page.drawRectangle({ x: 0, y: H - 30, width: W, height: 30, color: C.indigo });
  dt(page, `FOKONTANY ${clean(config.nom_fokontany).toUpperCase()}`, m, H - 12, bold, 9, C.white);
  dt(page, `${config.nom_quartier} - ${config.nom_commune}`, m, H - 21, reg, 7, rgb(0.8,0.8,1));
  page.drawRectangle({ x: W/2 - 22, y: H - 26, width: 44, height: 22, color: rgb(0.35,0.30,0.82), borderRadius: 3 });
  dt(page, 'F', W/2 - 5, H - 17, bold, 14, C.white);
  dt(page, reference, W - m - 130, H - 12, bold, 7, C.white);
  dt(page, `[${codeDoc}] ${nomDoc.toUpperCase()}`, W - m - 130, H - 21, reg, 6.5, rgb(0.8,0.8,1));
  page.drawLine({ start: { x: m, y: H - 34 }, end: { x: W - m, y: H - 34 }, thickness: 0.4, color: C.border });
}

function drawFooterA4L(page: PDFPage, reg: PDFFont, reference: string) {
  const { W } = A4L;
  dt(page, `Genere automatiquement par FANISA v2.0  |  ${reference}  |  ${new Date().toLocaleDateString('fr-FR')}`, 30, 10, reg, 6, C.light);
}

// Helpers tableaux
function tableHeader(page: PDFPage, cols: {label: string; x: number; w: number}[], y: number, bold: PDFFont, W: number, m: number) {
  page.drawRectangle({ x: m, y: y - 14, width: W - m*2, height: 16, color: C.indigo, borderRadius: 2 });
  cols.forEach(c => dt(page, c.label, c.x + 3, y - 4, bold, 7, C.white));
  return y - 14;
}
function tableRow(page: PDFPage, vals: string[], cols: {x: number}[], y: number, reg: PDFFont, bold: PDFFont, isFirst: boolean, bg: ReturnType<typeof rgb>, W: number, m: number) {
  page.drawRectangle({ x: m, y: y - 13, width: W - m*2, height: 14, color: bg });
  vals.forEach((v, i) => dt(page, clean(v), (cols[i]?.x || 0) + 3, y - 4, isFirst ? bold : reg, 7.5, C.dark));
  return y - 13;
}

// ════════════════════════════════════════════════════════════
// DOCUMENTS FORMAT A5 PAYSAGE
// ════════════════════════════════════════════════════════════

// CR — Certificat de Résidence
export async function genererCR(membre: Membre, foyer: Foyer, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { W, H } = A5L;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('CR', config);
  const m = 20;
  drawHeaderA5L(page, config, bold, reg, 'CR', 'Certificat de Residence', reference);

  let y = H - 56;
  const age = membre.date_naissance ? Math.abs(new Date(Date.now()-new Date(membre.date_naissance).getTime()).getUTCFullYear()-1970) : null;
  const intro = `Le soussigne Chef du Fokontany ${clean(config.nom_fokontany)} certifie que la personne ci-dessous reside dans notre Fokontany.`;
  wrap(intro, 90).forEach(l => { dt(page, l, m, y, reg, 7.5, C.dark); y -= 10; });
  y -= 4;

  const col2 = (W - m*2) / 2;
  const boxes = [
    {l:'Nom', v:membre.nom, w:col2-4}, {l:'Prenom(s)', v:membre.prenom, w:col2-4},
    {l:'Date de naissance', v:membre.date_naissance?new Date(membre.date_naissance).toLocaleDateString('fr-FR'):'-', w:col2-4},
    {l:'Lieu de naissance', v:membre.lieu_naissance||'-', w:col2-4},
    {l:'Numero CIN', v:membre.cin||'-', w:col2-4}, {l:'Age', v:age?`${age} ans`:'-', w:col2-4},
  ];
  page.drawRectangle({ x: m, y: y - boxes.length/2*22-6, width: W-m*2, height: boxes.length/2*22+10, color: C.bg, borderColor: C.border, borderWidth: 0.4, borderRadius: 3 });
  boxes.forEach((b,i) => boxA5(page, b.l, b.v, m+(i%2)*col2+4, y-Math.floor(i/2)*22-4, b.w, reg, bold));
  y -= Math.ceil(boxes.length/2)*22+14;

  // Adresse
  page.drawRectangle({ x: m, y: y-16, width: W-m*2, height: 18, color: rgb(0.93,0.97,1), borderColor: C.indigo, borderWidth: 0.5, borderRadius: 2 });
  dt(page, 'ADRESSE :', m+4, y-3, bold, 7, C.indigo);
  const adr = [foyer.adresse, foyer.identification_logement?`LOT ${foyer.identification_logement}${foyer.numero_maison?'-'+foyer.numero_maison:''}`:null, `Fkt ${config.nom_fokontany}`].filter(Boolean).join(' | ');
  dt(page, adr, m+60, y-3, bold, 7.5, C.dark);
  dt(page, `Code menage : ${foyer.code_menage}`, m+4, y-11, reg, 6.5, C.mid);
  y -= 24;

  dt(page, 'En foi de quoi, le present certificat est delivre pour servir et valoir ce que de droit.', m, y-4, reg, 7, C.dark);
  drawFooterA5L(page, config, reg, bold, reference);
  await enregistrerDocument('CR', reference, numero, membre.id, foyer.id, {nom:membre.nom, prenom:membre.prenom});
  return await pdf.save();
}

// CVI — Certificat de Vie Individuelle
export async function genererCVI(membre: Membre, foyer: Foyer, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { W, H } = A5L;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('CVI', config);
  const m = 20; const col2 = (W - m*2) / 2;
  drawHeaderA5L(page, config, bold, reg, 'CVI', 'Certificat de Vie Individuelle', reference);

  let y = H - 56;
  const age = membre.date_naissance ? Math.abs(new Date(Date.now()-new Date(membre.date_naissance).getTime()).getUTCFullYear()-1970) : null;
  dt(page, `Le Chef du Fokontany ${clean(config.nom_fokontany)} certifie que la personne ci-dessous est en vie a ce jour.`, m, y, reg, 7.5, C.dark);
  y -= 14;

  // Zone photo + infos
  page.drawRectangle({ x: m, y: y-90, width: W-m*2, height: 96, color: C.bg, borderColor: C.border, borderWidth: 0.4, borderRadius: 3 });
  page.drawRectangle({ x: m+4, y: y-86, width: 55, height: 70, color: C.white, borderColor: C.border, borderWidth: 0.8 });
  dt(page, 'PHOTO', m+16, y-52, reg, 6, C.light);
  const fx = m + 66;
  dt(page, 'NOM ET PRENOM', fx, y-6, reg, 5.5, C.light);
  dt(page, `${membre.nom} ${membre.prenom}`, fx, y-15, bold, 9.5, C.dark);
  const pairs = [
    ['Date naissance', membre.date_naissance?new Date(membre.date_naissance).toLocaleDateString('fr-FR'):'-'],
    ['CIN', membre.cin||'N/A'], ['Age', age?`${age} ans`:'-'],
    ['Statut', membre.statut],
  ];
  pairs.forEach(([l,v],i) => {
    dt(page, l, fx+(i%2)*(col2-50), y-28-Math.floor(i/2)*18, reg, 5.5, C.light);
    dt(page, clean(v), fx+(i%2)*(col2-50), y-37-Math.floor(i/2)*18, bold, 7.5, C.dark);
  });
  y -= 102;
  page.drawRectangle({ x: m, y: y-14, width: W-m*2, height: 16, color: rgb(0.93,0.97,1), borderColor: C.indigo, borderWidth: 0.4, borderRadius: 2 });
  dt(page, `Adresse : ${clean(foyer.adresse||'')} - Fkt ${config.nom_fokontany}  |  ${foyer.code_menage}`, m+4, y-4, reg, 7, C.dark);
  y -= 22;
  dt(page, 'En foi de quoi, le present certificat est delivre pour servir et valoir ce que de droit.', m, y-2, reg, 7, C.dark);
  drawFooterA5L(page, config, reg, bold, reference);
  await enregistrerDocument('CVI', reference, numero, membre.id, foyer.id);
  return await pdf.save();
}

// CEL — Certificat de Célibat
export async function genererCEL(membre: Membre, foyer: Foyer, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { W, H } = A5L;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('CEL', config);
  const m = 20; const col2 = (W-m*2)/2;
  drawHeaderA5L(page, config, bold, reg, 'CEL', 'Certificat de Celibat', reference);

  let y = H - 56;
  const age = membre.date_naissance ? Math.abs(new Date(Date.now()-new Date(membre.date_naissance).getTime()).getUTCFullYear()-1970) : null;
  dt(page, `Le Chef du Fokontany ${clean(config.nom_fokontany)} atteste que la personne ci-dessous est celibataire a ce jour.`, m, y, reg, 7.5, C.dark);
  y -= 14;
  const boxes = [
    {l:'Nom', v:membre.nom},{l:'Prenom(s)', v:membre.prenom},
    {l:'Date de naissance', v:membre.date_naissance?new Date(membre.date_naissance).toLocaleDateString('fr-FR'):'-'},
    {l:'Lieu de naissance', v:membre.lieu_naissance||'-'},
    {l:'CIN', v:membre.cin||'N/A'},{l:'Age', v:age?`${age} ans`:'-'},
    {l:'Adresse', v:foyer.adresse||'-'},{l:'Fokontany', v:config.nom_fokontany},
  ];
  page.drawRectangle({ x: m, y: y-boxes.length/2*22-6, width: W-m*2, height: boxes.length/2*22+10, color: C.bg, borderColor: C.border, borderWidth: 0.4, borderRadius: 3 });
  boxes.forEach((b,i) => boxA5(page, b.l, b.v, m+(i%2)*col2+4, y-Math.floor(i/2)*22-4, col2-8, reg, bold));
  y -= Math.ceil(boxes.length/2)*22+14;
  dt(page, 'En foi de quoi, le present certificat est delivre pour servir et valoir ce que de droit.', m, y-4, reg, 7, C.dark);
  drawFooterA5L(page, config, reg, bold, reference);
  await enregistrerDocument('CEL', reference, numero, membre.id, foyer.id);
  return await pdf.save();
}

// BC — Certificat de Bonne Conduite
export async function genererBC(membre: Membre, foyer: Foyer, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { W, H } = A5L;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('BC', config);
  const m = 20; const col2 = (W-m*2)/2;
  drawHeaderA5L(page, config, bold, reg, 'BC', 'Certificat de Bonne Conduite', reference);

  let y = H - 56;
  dt(page, `Le Chef du Fokontany ${clean(config.nom_fokontany)} atteste que la personne ci-dessous est de bonne vie et moeurs et n'a fait l'objet d'aucune plainte.`, m, y, reg, 7.5, C.dark);
  y -= 12; dt(page, '', m, y, reg, 7.5, C.dark); y -= 6;
  const boxes = [
    {l:'Nom', v:membre.nom},{l:'Prenom(s)', v:membre.prenom},
    {l:'Date de naissance', v:membre.date_naissance?new Date(membre.date_naissance).toLocaleDateString('fr-FR'):'-'},
    {l:'CIN', v:membre.cin||'N/A'},
    {l:'Adresse', v:foyer.adresse||'-'},{l:'Fokontany', v:config.nom_fokontany},
  ];
  page.drawRectangle({ x: m, y: y-boxes.length/2*22-6, width: W-m*2, height: boxes.length/2*22+10, color: C.bg, borderColor: C.border, borderWidth: 0.4, borderRadius: 3 });
  boxes.forEach((b,i) => boxA5(page, b.l, b.v, m+(i%2)*col2+4, y-Math.floor(i/2)*22-4, col2-8, reg, bold));
  y -= Math.ceil(boxes.length/2)*22+14;
  dt(page, 'En foi de quoi, le present certificat est delivre pour servir et valoir ce que de droit.', m, y-4, reg, 7, C.dark);
  drawFooterA5L(page, config, reg, bold, reference);
  await enregistrerDocument('BC', reference, numero, membre.id, foyer.id);
  return await pdf.save();
}

// FAS — Attestation de Travail
export async function genererFAS(membre: Membre, foyer: Foyer, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { W, H } = A5L;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('FAS', config);
  const m = 20; const col2 = (W-m*2)/2;
  drawHeaderA5L(page, config, bold, reg, 'FAS', 'Fanamarinana Asa - Attestation de Travail', reference);

  let y = H - 56;
  dt(page, `Le Chef du Fokontany ${clean(config.nom_fokontany)} atteste que la personne ci-dessous exerce une activite dans notre Fokontany.`, m, y, reg, 7.5, C.dark);
  y -= 14;
  const boxes = [
    {l:'Nom', v:membre.nom},{l:'Prenom(s)', v:membre.prenom},
    {l:'CIN', v:membre.cin||'N/A'},{l:'Activite principale', v:membre.profession||'-'},
    {l:'Statut professionnel', v:(membre as any).statut_professionnel||'-'},{l:'Employeur', v:membre.employeur||'-'},
    {l:'Adresse activite', v:foyer.adresse||'-'},{l:'Fokontany', v:config.nom_fokontany},
  ];
  page.drawRectangle({ x: m, y: y-boxes.length/2*22-6, width: W-m*2, height: boxes.length/2*22+10, color: C.bg, borderColor: C.border, borderWidth: 0.4, borderRadius: 3 });
  boxes.forEach((b,i) => boxA5(page, b.l, b.v, m+(i%2)*col2+4, y-Math.floor(i/2)*22-4, col2-8, reg, bold));
  y -= Math.ceil(boxes.length/2)*22+14;
  dt(page, 'En foi de quoi, la presente attestation est delivree pour servir et valoir ce que de droit.', m, y-4, reg, 7, C.dark);
  drawFooterA5L(page, config, reg, bold, reference);
  await enregistrerDocument('FAS', reference, numero, membre.id, foyer.id);
  return await pdf.save();
}

// COT — Certificat d'Occupation de Terrain (A5L)
export async function genererCOT(parcelle: Parcelle, detenteur: Detenteur, config: ConfigFokontany, anciennete?: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { W, H } = A5L;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('COT', config);
  const m = 20; const col3 = (W-m*2)/3; const col2 = (W-m*2)/2;
  drawHeaderA5L(page, config, bold, reg, 'COT', "Certificat d'Occupation de Terrain", reference);

  let y = H - 56;
  dt(page, `Le Chef du Fokontany ${clean(config.nom_fokontany)} certifie que la personne designee occupe le terrain ci-dessous.`, m, y, reg, 7.5, C.dark);
  y -= 14;
  const tBoxes = [{l:'Lot',v:parcelle.numero_lot},{l:'Superficie',v:parcelle.superficie_m2?`${parcelle.superficie_m2} m2`:'-'},{l:'Usage',v:parcelle.usage||'-'},{l:'Adresse',v:parcelle.adresse||'-'},{l:'Fokontany',v:parcelle.fokontany||config.nom_fokontany},{l:'GPS',v:parcelle.gps_lat?`${parcelle.gps_lat?.toFixed(4)}`:'-'}];
  page.drawRectangle({ x: m, y: y-tBoxes.length/3*22-6, width: W-m*2, height: tBoxes.length/3*22+10, color: C.bg, borderColor: C.border, borderWidth: 0.4, borderRadius: 3 });
  tBoxes.forEach((b,i) => boxA5(page, b.l, b.v, m+(i%3)*col3+4, y-Math.floor(i/3)*22-4, col3-8, reg, bold));
  y -= Math.ceil(tBoxes.length/3)*22+14;
  const oBoxes = [{l:'Nom',v:detenteur.nom||'-'},{l:'Prenom',v:detenteur.prenom||'-'},{l:'CIN',v:detenteur.cin||'-'},{l:'Type detention',v:detenteur.type_detention},{l:'Depuis',v:anciennete||(detenteur.date_debut_occupation?new Date(detenteur.date_debut_occupation).toLocaleDateString('fr-FR'):'-')},{l:'Telephone',v:detenteur.telephone||'-'}];
  page.drawRectangle({ x: m, y: y-oBoxes.length/3*22-6, width: W-m*2, height: oBoxes.length/3*22+10, color: rgb(0.93,0.97,1), borderColor: C.indigo, borderWidth: 0.4, borderRadius: 3 });
  oBoxes.forEach((b,i) => boxA5(page, b.l, b.v, m+(i%3)*col3+4, y-Math.floor(i/3)*22-4, col3-8, reg, bold));
  y -= Math.ceil(oBoxes.length/3)*22+14;
  dt(page, 'En foi de quoi, le present certificat est delivre pour servir et valoir ce que de droit.', m, y-4, reg, 7, C.dark);
  drawFooterA5L(page, config, reg, bold, reference);
  await enregistrerDocument('COT', reference, numero);
  return await pdf.save();
}

// ADF — Attestation de Détention Foncière (A5L)
export async function genererADF(parcelle: Parcelle, detenteur: Detenteur, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { W, H } = A5L;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('ADF', config);
  const m = 20; const col2 = (W-m*2)/2; const col3 = (W-m*2)/3;
  drawHeaderA5L(page, config, bold, reg, 'ADF', 'Attestation de Detention Fonciere', reference);

  let y = H - 56;
  dt(page, `Le Chef du Fokontany ${clean(config.nom_fokontany)} atteste que la personne ci-dessous est reconnue comme detenteur du terrain identifie.`, m, y, reg, 7.5, C.dark);
  y -= 14;
  [{l:'Lot',v:parcelle.numero_lot},{l:'Superficie',v:parcelle.superficie_m2?`${parcelle.superficie_m2} m2`:'-'},{l:'Titre foncier',v:parcelle.titre_foncier||'Non titre'},{l:'Adresse',v:parcelle.adresse||'-'},{l:'Fokontany',v:parcelle.fokontany||config.nom_fokontany},{l:'GPS',v:parcelle.gps_lat?`${parcelle.gps_lat?.toFixed(4)}, ${parcelle.gps_lng?.toFixed(4)}`:'-'}].reduce((y2,b,i)=>{boxA5(page,b.l,b.v,m+(i%3)*col3+4,y2-Math.floor(i/3)*22-4,col3-8,reg,bold);return y2;},y);
  page.drawRectangle({ x: m, y: y-2*22-10, width: W-m*2, height: 2*22+14, color: C.bg, borderColor: C.border, borderWidth: 0.4, borderRadius: 3 });
  y -= 2*22+14;
  [{l:'Nom',v:detenteur.nom||'-'},{l:'Prenom',v:detenteur.prenom||'-'},{l:'CIN',v:detenteur.cin||'-'},{l:'Qualite',v:detenteur.type_detention},{l:'Document detenu',v:detenteur.document_detenu||'-'},{l:'Depuis',v:detenteur.date_debut_occupation?new Date(detenteur.date_debut_occupation).toLocaleDateString('fr-FR'):'-'}].forEach((b,i)=>boxA5(page,b.l,b.v,m+(i%3)*col3+4,y-Math.floor(i/3)*22-4,col3-8,reg,bold));
  page.drawRectangle({ x: m, y: y-2*22-10, width: W-m*2, height: 2*22+14, color: rgb(0.93,0.97,1), borderColor: C.indigo, borderWidth: 0.4, borderRadius: 3 });
  y -= 2*22+18;
  dt(page, 'En foi de quoi, la presente attestation est delivree pour servir et valoir ce que de droit.', m, y-4, reg, 7, C.dark);
  drawFooterA5L(page, config, reg, bold, reference);
  await enregistrerDocument('ADF', reference, numero);
  return await pdf.save();
}

// APB — Attestation de Propriété de Bâtiment (A5L)
export async function genererAPB(parcelle: Parcelle, batiment: Batiment, proprietaire: {nom?:string;prenom?:string;cin?:string;telephone?:string;lien?:string}, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { W, H } = A5L;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('APB', config);
  const m = 20; const col3 = (W-m*2)/3;
  drawHeaderA5L(page, config, bold, reg, 'APB', 'Attestation de Propriete de Batiment', reference);

  let y = H - 56;
  dt(page, `Le Chef du Fokontany ${clean(config.nom_fokontany)} atteste que la personne ci-dessous est proprietaire declare du batiment.`, m, y, reg, 7.5, C.dark);
  y -= 14;
  const batBoxes = [{l:'Ref. batiment',v:batiment.reference_batiment},{l:'Type',v:batiment.type_batiment},{l:'Etat',v:batiment.etat},{l:'Superficie',v:batiment.superficie_m2?`${batiment.superficie_m2} m2`:'-'},{l:'Lot parcelle',v:parcelle.numero_lot},{l:'Adresse',v:parcelle.adresse||'-'}];
  page.drawRectangle({ x: m, y: y-2*22-10, width: W-m*2, height: 2*22+14, color: C.bg, borderColor: C.border, borderWidth: 0.4, borderRadius: 3 });
  batBoxes.forEach((b,i) => boxA5(page, b.l, b.v, m+(i%3)*col3+4, y-Math.floor(i/3)*22-4, col3-8, reg, bold));
  y -= 2*22+16;
  const pBoxes = [{l:'Nom',v:proprietaire.nom||'-'},{l:'Prenom',v:proprietaire.prenom||'-'},{l:'CIN',v:proprietaire.cin||'-'},{l:'Telephone',v:proprietaire.telephone||'-'},{l:'Lien avec parcelle',v:proprietaire.lien||'-'}];
  page.drawRectangle({ x: m, y: y-2*22-10, width: W-m*2, height: 2*22+14, color: rgb(0.93,0.97,1), borderColor: C.indigo, borderWidth: 0.4, borderRadius: 3 });
  pBoxes.forEach((b,i) => boxA5(page, b.l, b.v, m+(i%3)*col3+4, y-Math.floor(i/3)*22-4, col3-8, reg, bold));
  y -= 2*22+18;
  page.drawRectangle({ x: m, y: y-14, width: W-m*2, height: 16, color: C.goldBg, borderColor: C.gold, borderWidth: 0.4, borderRadius: 2 });
  dt(page, 'Note : Ce document atteste la propriete declaree du batiment uniquement — la propriete fonciere peut etre differente.', m+4, y-4, reg, 6, C.gold);
  y -= 20;
  dt(page, 'En foi de quoi, la presente attestation est delivree pour servir et valoir ce que de droit.', m, y-4, reg, 7, C.dark);
  drawFooterA5L(page, config, reg, bold, reference);
  await enregistrerDocument('APB', reference, numero);
  return await pdf.save();
}

// AMV — Attestation de Mise en Valeur (A5L)
export async function genererAMV(parcelle: Parcelle, valeur: MiseEnValeur, detenteur: Detenteur, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { W, H } = A5L;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('AMV', config);
  const m = 20; const col3 = (W-m*2)/3;
  drawHeaderA5L(page, config, bold, reg, 'AMV', 'Attestation de Mise en Valeur', reference);

  let y = H - 56;
  dt(page, `Le Chef du Fokontany ${clean(config.nom_fokontany)} atteste que le terrain LOT ${clean(parcelle.numero_lot)} a fait l'objet d'investissements par le detenteur reconnu.`, m, y, reg, 7.5, C.dark);
  y -= 12;
  [{l:'Lot',v:parcelle.numero_lot},{l:'Superficie',v:parcelle.superficie_m2?`${parcelle.superficie_m2} m2`:'-'},{l:'Detenteur',v:`${detenteur.nom||'-'} ${detenteur.prenom||''}`}].forEach((b,i) => boxA5(page, b.l, b.v, m+i*col3+4, y-4, col3-8, reg, bold));
  y -= 26;
  page.drawRectangle({ x: m, y: y-18, width: W-m*2, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, 'ELEMENTS DE MISE EN VALEUR CONSTATES', m+4, y-5, bold, 7.5, C.white);
  y -= 20;
  const elems = [{k:'maison',l:'Maison / Batiment'},{k:'cloture',l:'Cloture'},{k:'cultures',l:'Cultures'},{k:'elevage',l:'Elevage'},{k:'eau',l:'Installation eau'},{k:'electricite',l:'Electricite'},{k:'commerce',l:'Commerce'}];
  const eW = (W-m*2)/2 - 4;
  elems.forEach((el,i) => {
    const ok = !!(valeur as any)[el.k];
    const ex = m+(i%2)*((W-m*2)/2)+4, ey = y-Math.floor(i/2)*18-4;
    page.drawRectangle({ x: ex, y: ey-12, width: eW, height: 14, color: ok?C.greenBg:rgb(0.97,0.97,0.97), borderColor: ok?C.green:C.border, borderWidth: 0.4, borderRadius: 2 });
    dt(page, ok?`[OUI]  ${el.l}`:`[ - ]  ${el.l}`, ex+4, ey-3, ok?bold:reg, 7, ok?C.green:C.light);
  });
  y -= Math.ceil(elems.length/2)*18+8;
  if (valeur.annee_debut) { dt(page, `Debut des investissements : ${valeur.annee_debut}`, m, y-4, reg, 7, C.mid); y -= 12; }
  dt(page, 'En foi de quoi, la presente attestation est delivree pour servir et valoir ce que de droit.', m, y-4, reg, 7, C.dark);
  drawFooterA5L(page, config, reg, bold, reference);
  await enregistrerDocument('AMV', reference, numero);
  return await pdf.save();
}

// ════════════════════════════════════════════════════════════
// DOCUMENTS FORMAT A4 PORTRAIT
// ════════════════════════════════════════════════════════════

// CVC — Certificat de Vie Collective
export async function genererCVC(foyer: Foyer, membres: Membre[], config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { W, H } = A4P;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('CVC', config);
  const m = 36; const chef = membres.find(m2=>m2.is_chef);
  drawHeaderA4P(page, config, bold, reg, 'CVC', 'Certificat de Vie Collective', reference);

  let y = H - 82;
  dt(page, `Le Chef du Fokontany ${clean(config.nom_fokontany)} certifie que les personnes ci-dessous cohabitent et constituent un menage.`, m, y, reg, 9, C.dark);
  y -= 20;
  page.drawRectangle({ x: m, y: y-34, width: W-m*2, height: 38, color: rgb(0.93,0.97,1), borderColor: C.indigo, borderWidth: 0.5, borderRadius: 4 });
  dt(page, 'CHEF DE MENAGE', m+8, y-6, bold, 8, C.indigo);
  dt(page, chef?`${chef.nom} ${chef.prenom}`:'Non defini', m+8, y-18, bold, 11, C.dark);
  dt(page, `Code : ${foyer.code_menage}  |  ${foyer.adresse||''}  |  Fkt ${config.nom_fokontany}`, m+8, y-28, reg, 8, C.mid);
  y -= 48;

  const cols = [{label:'N°',x:m},{label:'Nom et Prenom',x:m+24},{label:'Date naissance',x:m+190},{label:'Relation',x:m+280},{label:'Statut',x:m+360},{label:'CIN',x:m+430}];
  let tableY = tableHeader(page, cols, y, bold, W, m);
  const membresOrd = [...membres.filter(x=>x.is_chef),...membres.filter(x=>!x.is_chef)];
  membresOrd.forEach((mb,idx) => {
    tableY = tableRow(page,[String(idx+1),`${mb.nom} ${mb.prenom}`,mb.date_naissance?new Date(mb.date_naissance).toLocaleDateString('fr-FR'):'-',mb.relation_chef,mb.statut,mb.cin||'-'],cols,tableY,reg,bold,idx===0,idx%2===0?C.bg:C.white,W,m);
  });
  page.drawRectangle({ x: m, y: tableY-14, width: W-m*2, height: 16, color: rgb(0.93,0.97,1) });
  dt(page, `Total : ${membres.length} membre(s)`, m+8, tableY-4, bold, 8.5, C.indigo);
  y = tableY - 30;
  dt(page, 'En foi de quoi, le present certificat est delivre pour servir et valoir ce que de droit.', m, y, reg, 9, C.dark);
  drawFooterA4P(page, config, reg, bold, reference);
  await enregistrerDocument('CVC', reference, numero, chef?.id, foyer.id);
  return await pdf.save();
}

// CM — Composition du Ménage (A4P)
export async function genererCM(foyer: Foyer, membres: Membre[], config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { W, H } = A4P;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('CM', config);
  const m = 36; const chef = membres.find(m2=>m2.is_chef);
  drawHeaderA4P(page, config, bold, reg, 'CM', 'Composition du Menage', reference);

  let y = H - 82;
  page.drawRectangle({ x: m, y: y-34, width: W-m*2, height: 38, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
  const col3 = (W-m*2)/3;
  [{l:'Code menage',v:foyer.code_menage},{l:'Fokontany',v:config.nom_fokontany},{l:'Statut',v:foyer.statut}].forEach((b,i)=>{dt(page,b.l,m+i*col3+4,y-8,reg,7,C.light);dt(page,clean(b.v),m+i*col3+4,y-18,bold,9,C.dark);});
  dt(page, foyer.adresse||'-', m+4, y-28, reg, 8, C.mid);
  y -= 50;
  const cols = [{label:'N°',x:m},{label:'Nom et Prenom',x:m+24},{label:'Date naissance',x:m+190},{label:'Sexe',x:m+275},{label:'Relation',x:m+310},{label:'Statut',x:m+390},{label:'Profession',x:m+445}];
  let tableY = tableHeader(page, cols, y, bold, W, m);
  [...membres.filter(x=>x.is_chef),...membres.filter(x=>!x.is_chef)].forEach((mb,idx)=>{
    tableY = tableRow(page,[String(idx+1),`${mb.nom} ${mb.prenom}`,mb.date_naissance?new Date(mb.date_naissance).toLocaleDateString('fr-FR'):'-',mb.sexe,mb.relation_chef,mb.statut,mb.profession||'-'],cols,tableY,reg,bold,idx===0,idx%2===0?C.bg:C.white,W,m);
  });
  page.drawRectangle({ x: m, y: tableY-14, width: W-m*2, height: 16, color: rgb(0.93,0.97,1) });
  dt(page, `Total membres : ${membres.length}  |  Hommes : ${membres.filter(mb=>mb.sexe==='M').length}  |  Femmes : ${membres.filter(mb=>mb.sexe==='F').length}`, m+8, tableY-4, bold, 8, C.indigo);
  drawFooterA4P(page, config, reg, bold, reference);
  await enregistrerDocument('CM', reference, numero, chef?.id, foyer.id);
  return await pdf.save();
}

// FM — Fiche Ménage (A4P)
export async function genererFM(foyer: Foyer, membres: Membre[], config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { W, H } = A4P;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('FM', config);
  const m = 36; const col3 = (W-m*2)/3; const chef = membres.find(m2=>m2.is_chef);
  drawHeaderA4P(page, config, bold, reg, 'FM', 'Fiche Menage Complete', reference);

  let y = H - 82;
  const sections = [
    { title: '1. IDENTIFICATION', color: C.indigo, boxes: [{l:'Code menage',v:foyer.code_menage},{l:'Fokontany',v:config.nom_fokontany},{l:'Statut',v:foyer.statut},{l:'Adresse',v:foyer.adresse||'-'},{l:'LOT',v:foyer.identification_logement?(foyer.numero_maison?`LOT ${foyer.identification_logement}-${foyer.numero_maison}`:`LOT ${foyer.identification_logement}`):'-'},{l:'Chef de menage',v:chef?`${chef.nom} ${chef.prenom}`:'-'}] },
    { title: '2. LOGEMENT', color: C.indigo, boxes: [{l:'Type logement',v:foyer.type_logement||'-'},{l:'Pieces',v:foyer.nombre_pieces?.toString()||'-'},{l:'Superficie',v:foyer.superficie_m2?`${foyer.superficie_m2} m2`:'-'},{l:'Toiture',v:(foyer.materiaux_toiture||[foyer.materiau_toiture]).filter(Boolean).join(', ')||'-'},{l:'Mur',v:(foyer.materiaux_mur||[foyer.materiau_mur]).filter(Boolean).join(', ')||'-'},{l:'Statut occupant',v:foyer.statut_occupant||'-'}] },
    { title: '3. CONDITIONS DE VIE', color: C.indigo, boxes: [{l:'Source eau',v:foyer.eau_source||'-'},{l:'Eau potable',v:foyer.eau_potable===true?'Oui':foyer.eau_potable===false?'Non':'-'},{l:'Electricite',v:foyer.a_electricite===true?'Oui':'Non'},{l:'Toilette',v:foyer.toilette_type||'-'},{l:'Internet',v:foyer.acces_internet===true?'Oui':'Non'},{l:'Dechets',v:foyer.dechets_mode||'-'}] },
  ];
  for (const s of sections) {
    page.drawRectangle({ x: m, y: y-18, width: W-m*2, height: 20, color: s.color, borderRadius: 2 });
    dt(page, s.title, m+8, y-4, bold, 8, C.white);
    y -= 22;
    const h = Math.ceil(s.boxes.length/3)*26+8;
    page.drawRectangle({ x: m, y: y-h, width: W-m*2, height: h+4, color: C.bg, borderColor: C.border, borderWidth: 0.4, borderRadius: 3 });
    s.boxes.forEach((b,i)=>{dt(page,b.l,m+(i%3)*col3+8,y-Math.floor(i/3)*26-8,reg,6.5,C.light);dt(page,clean(b.v),m+(i%3)*col3+8,y-Math.floor(i/3)*26-18,bold,8,C.dark);});
    y -= h+12;
  }
  page.drawRectangle({ x: m, y: y-18, width: W-m*2, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, `4. MEMBRES (${membres.length})`, m+8, y-4, bold, 8, C.white);
  y -= 22;
  const cols = [{label:'N°',x:m},{label:'Nom Prenom',x:m+24},{label:'Naissance',x:m+185},{label:'Relation',x:m+270},{label:'Statut',x:m+350},{label:'Activite',x:m+420}];
  let tableY = tableHeader(page, cols, y, bold, W, m);
  [...membres.filter(x=>x.is_chef),...membres.filter(x=>!x.is_chef)].forEach((mb,idx)=>{
    if (tableY < 100) return;
    tableY = tableRow(page,[String(idx+1),`${mb.nom} ${mb.prenom}`,mb.date_naissance?new Date(mb.date_naissance).toLocaleDateString('fr-FR'):'-',mb.relation_chef,mb.statut,mb.profession||'-'],cols,tableY,reg,bold,idx===0,idx%2===0?C.bg:C.white,W,m);
  });
  drawFooterA4P(page, config, reg, bold, reference);
  await enregistrerDocument('FM', reference, numero, chef?.id, foyer.id);
  return await pdf.save();
}

// FFD — Déclaration de Décès (A4P)
export async function genererFFD(membre: Membre, foyer: Foyer, config: ConfigFokontany, dateDeces?: string, lieuDeces?: string, declarant?: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { W, H } = A4P;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('FFD', config);
  const m = 36; const col2 = (W-m*2)/2;
  drawHeaderA4P(page, config, bold, reg, 'FFD', 'Fanambarana Fahafatesana - Declaration de Deces', reference);

  let y = H - 88;
  page.drawRectangle({ x: m, y: y-18, width: W-m*2, height: 20, color: rgb(0.92,0.92,0.92), borderColor: C.mid, borderWidth: 0.5, borderRadius: 3 });
  dt(page, 'DECLARATION OFFICIELLE DE DECES', W/2-80, y-5, bold, 9, C.dark);
  y -= 30;
  dt(page, `Nous, Chef du Fokontany ${clean(config.nom_fokontany)}, declarons avoir enregistre le deces de la personne suivante.`, m, y, reg, 9, C.dark);
  y -= 20;
  const age = membre.date_naissance ? Math.abs(new Date(Date.now()-new Date(membre.date_naissance).getTime()).getUTCFullYear()-1970) : null;
  const boxes = [{l:'Nom du defunt',v:membre.nom},{l:'Prenom(s)',v:membre.prenom},{l:'Date de naissance',v:membre.date_naissance?new Date(membre.date_naissance).toLocaleDateString('fr-FR'):'-'},{l:'Lieu de naissance',v:membre.lieu_naissance||'-'},{l:'Age au deces',v:age?`${age} ans`:'-'},{l:'CIN',v:membre.cin||'-'},{l:'Adresse',v:foyer.adresse||'-'},{l:'Date du deces',v:dateDeces||'A preciser'},{l:'Lieu du deces',v:lieuDeces||'A preciser'},{l:'Declarant',v:declarant||'A preciser'}];
  page.drawRectangle({ x: m, y: y-Math.ceil(boxes.length/2)*34-10, width: W-m*2, height: Math.ceil(boxes.length/2)*34+14, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
  boxes.forEach((b,i)=>{dt(page,b.l,m+(i%2)*col2+8,y-Math.floor(i/2)*34-10,reg,7,C.light);dt(page,clean(b.v),m+(i%2)*col2+8,y-Math.floor(i/2)*34-22,bold,9.5,C.dark);});
  y -= Math.ceil(boxes.length/2)*34+22;
  dt(page, 'En foi de quoi, la presente declaration est etablie pour servir et valoir ce que de droit.', m, y, reg, 9, C.dark);
  drawFooterA4P(page, config, reg, bold, reference);
  await enregistrerDocument('FFD', reference, numero, membre.id, foyer.id);
  return await pdf.save();
}

// PCG — Prise en Charge et Garde (A4P)
export async function genererPCG(membre: Membre, foyer: Foyer, config: ConfigFokontany, responsable?: Membre): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { W, H } = A4P;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('PCG', config);
  const m = 36; const col2 = (W-m*2)/2;
  drawHeaderA4P(page, config, bold, reg, 'PCG', 'Prise en Charge et Garde', reference);

  let y = H - 88;
  dt(page, `Le Chef du Fokontany ${clean(config.nom_fokontany)} atteste que la personne ci-dessous est prise en charge par le responsable indique.`, m, y, reg, 9, C.dark);
  y -= 22;
  for (const [title, boxes] of [
    ['PERSONNE PRISE EN CHARGE', [{l:'Nom',v:membre.nom},{l:'Prenom',v:membre.prenom},{l:'Date naissance',v:membre.date_naissance?new Date(membre.date_naissance).toLocaleDateString('fr-FR'):'-'},{l:'CIN',v:membre.cin||'N/A'},{l:'Relation',v:membre.relation_chef},{l:'Adresse',v:foyer.adresse||'-'}]],
    ['RESPONSABLE / GARDIEN', responsable?[{l:'Nom',v:responsable.nom},{l:'Prenom',v:responsable.prenom},{l:'CIN',v:responsable.cin||'-'},{l:'Telephone',v:responsable.telephone||'-'},{l:'Relation',v:responsable.relation_chef},{l:'Adresse',v:foyer.adresse||'-'}]:[{l:'Responsable',v:'A definir'},{l:'CIN',v:'-'},{l:'Telephone',v:'-'},{l:'Relation',v:'-'}]],
  ] as any[]) {
    page.drawRectangle({ x: m, y: y-18, width: W-m*2, height: 20, color: C.indigo, borderRadius: 2 });
    dt(page, title, m+8, y-5, bold, 8.5, C.white);
    y -= 22;
    page.drawRectangle({ x: m, y: y-Math.ceil(boxes.length/2)*32-8, width: W-m*2, height: Math.ceil(boxes.length/2)*32+12, color: C.bg, borderColor: C.border, borderWidth: 0.4, borderRadius: 4 });
    boxes.forEach((b: any,i: number)=>{dt(page,b.l,m+(i%2)*col2+8,y-Math.floor(i/2)*32-10,reg,7,C.light);dt(page,clean(b.v),m+(i%2)*col2+8,y-Math.floor(i/2)*32-21,bold,9,C.dark);});
    y -= Math.ceil(boxes.length/2)*32+16;
  }
  dt(page, 'En foi de quoi, le present acte est delivre pour servir et valoir ce que de droit.', m, y, reg, 9, C.dark);
  drawFooterA4P(page, config, reg, bold, reference);
  await enregistrerDocument('PCG', reference, numero, membre.id, foyer.id);
  return await pdf.save();
}

// JOR — JOROLAVA (A4P)
export async function genererJOR(parcelle: Parcelle, detenteur: Detenteur, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { W, H } = A4P;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('JOR', config);
  const m = 36; const col2 = (W-m*2)/2;
  drawHeaderA4P(page, config, bold, reg, 'JOR', 'JOROLAVA - Reconnaissance Locale d\'Occupation', reference);

  let y = H - 88;
  page.drawRectangle({ x: m, y: y-22, width: W-m*2, height: 26, color: C.goldBg, borderColor: C.gold, borderWidth: 1, borderRadius: 3 });
  dt(page, 'JOROLAVA - Document de reconnaissance locale d\'occupation fonciere', m+8, y-6, bold, 9, C.gold);
  dt(page, 'Ce document ne constitue pas un titre de propriete — valable dans les limites du Fokontany uniquement.', m+8, y-16, reg, 7.5, C.amber);
  y -= 34;
  dt(page, `Nous, Chef du Fokontany ${clean(config.nom_fokontany)}, reconnaissons la personne ci-dessous comme detenteur reconnu localement.`, m, y, reg, 9, C.dark);
  y -= 20;
  for (const [title, boxes, bg, bc] of [
    ['1. IDENTIFICATION DU TERRAIN', [{l:'Lot',v:parcelle.numero_lot},{l:'Superficie',v:parcelle.superficie_m2?`${parcelle.superficie_m2} m2`:'-'},{l:'Adresse',v:parcelle.adresse||'-'},{l:'Usage',v:parcelle.usage||'-'}], C.bg, C.border],
    ['2. DETENTEUR RECONNU', [{l:'Nom',v:detenteur.nom||'-'},{l:'Prenom',v:detenteur.prenom||'-'},{l:'CIN',v:detenteur.cin||'-'},{l:'Telephone',v:detenteur.telephone||'-'},{l:'Type de detention',v:detenteur.type_detention},{l:'Document detenu',v:detenteur.document_detenu||'-'}], C.bg, C.border],
  ] as any[]) {
    page.drawRectangle({ x: m, y: y-18, width: W-m*2, height: 20, color: C.indigo, borderRadius: 2 });
    dt(page, title, m+8, y-5, bold, 8.5, C.white);
    y -= 22;
    page.drawRectangle({ x: m, y: y-Math.ceil(boxes.length/2)*34-8, width: W-m*2, height: Math.ceil(boxes.length/2)*34+12, color: bg, borderColor: bc, borderWidth: 0.5, borderRadius: 4 });
    boxes.forEach((b: any,i: number)=>{dt(page,b.l,m+(i%2)*col2+8,y-Math.floor(i/2)*34-10,reg,7,C.light);dt(page,clean(b.v),m+(i%2)*col2+8,y-Math.floor(i/2)*34-22,bold,9.5,C.dark);});
    y -= Math.ceil(boxes.length/2)*34+18;
  }
  if (detenteur.date_debut_occupation) {
    page.drawRectangle({ x: m, y: y-22, width: W-m*2, height: 26, color: C.goldBg, borderColor: C.gold, borderWidth: 0.5, borderRadius: 3 });
    dt(page, `ANCIENNETE D\'OCCUPATION : Depuis le ${new Date(detenteur.date_debut_occupation).toLocaleDateString('fr-FR')}`, m+8, y-8, bold, 9.5, C.gold);
    dt(page, `Soit environ ${new Date().getFullYear() - new Date(detenteur.date_debut_occupation).getFullYear()} ans d'occupation continue`, m+8, y-18, reg, 8, C.amber);
    y -= 34;
  }
  dt(page, 'En foi de quoi, le present JOROLAVA est delivre pour servir et valoir ce que de droit.', m, y, reg, 9, C.dark);
  drawFooterA4P(page, config, reg, bold, reference);
  await enregistrerDocument('JOR', reference, numero);
  return await pdf.save();
}

// DRF — Demande de Régularisation Foncière (A4P)
export async function genererDRF(parcelle: Parcelle, detenteur: Detenteur|null, titulaire: TitulaireFoncier|null, batiments: Batiment[], valeur: MiseEnValeur|null, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { W, H } = A4P;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('DRF', config);
  const m = 36; const col2 = (W-m*2)/2; const col3 = (W-m*2)/3;
  drawHeaderA4P(page, config, bold, reg, 'DRF', 'Demande de Regularisation Fonciere', reference);

  let y = H - 88;
  dt(page, `Le soussigne Chef du Fokontany ${clean(config.nom_fokontany)} certifie l'exactitude des informations et appuie la demande de regularisation.`, m, y, reg, 9, C.dark);
  y -= 20;
  for (const [title, boxes, cols] of [
    ['1. PARCELLE', [{l:'Lot',v:parcelle.numero_lot},{l:'Superficie',v:parcelle.superficie_m2?`${parcelle.superficie_m2} m2`:'-'},{l:'GPS',v:parcelle.gps_lat?`${parcelle.gps_lat?.toFixed(4)}`:'-'},{l:'Adresse',v:parcelle.adresse||'-'},{l:'Titre foncier',v:parcelle.titre_foncier||'Non titre'},{l:'Usage',v:parcelle.usage||'-'}], 3],
    ['2. TITULAIRE FONCIER', titulaire?[{l:'Type',v:titulaire.type_titulaire},{l:'Nom',v:`${titulaire.nom||'-'} ${titulaire.prenom||''}`},{l:'CIN',v:titulaire.cin||'-'}]:[{l:'Titulaire',v:'Non renseigne'},{l:'Type',v:'Inconnu'},{l:'CIN',v:'-'}], 3],
    ['3. DETENTEUR RECONNU', detenteur?[{l:'Nom',v:`${detenteur.nom||'-'} ${detenteur.prenom||''}`},{l:'CIN',v:detenteur.cin||'-'},{l:'Qualite',v:detenteur.type_detention},{l:'Depuis',v:detenteur.date_debut_occupation?new Date(detenteur.date_debut_occupation).toLocaleDateString('fr-FR'):'-'}]:[{l:'Detenteur',v:'Non renseigne'},{l:'CIN',v:'-'},{l:'Qualite',v:'-'},{l:'Depuis',v:'-'}], 2],
  ] as any[]) {
    page.drawRectangle({ x: m, y: y-18, width: W-m*2, height: 20, color: C.indigo, borderRadius: 2 });
    dt(page, title, m+8, y-5, bold, 8.5, C.white);
    y -= 22;
    const c = cols===3?col3:col2;
    const rows = Math.ceil(boxes.length/cols);
    page.drawRectangle({ x: m, y: y-rows*28-8, width: W-m*2, height: rows*28+12, color: C.bg, borderColor: C.border, borderWidth: 0.4, borderRadius: 4 });
    boxes.forEach((b: any,i: number)=>{dt(page,b.l,m+(i%cols)*c+8,y-Math.floor(i/cols)*28-10,reg,7,C.light);dt(page,clean(b.v),m+(i%cols)*c+8,y-Math.floor(i/cols)*28-20,bold,9,C.dark);});
    y -= rows*28+16;
  }
  if (batiments.length>0) {
    page.drawRectangle({ x: m, y: y-18, width: W-m*2, height: 20, color: C.indigo, borderRadius: 2 });
    dt(page, `4. BATIMENTS (${batiments.length})`, m+8, y-5, bold, 8.5, C.white);
    y -= 22;
    batiments.slice(0,3).forEach(b=>{page.drawRectangle({x:m,y:y-16,width:W-m*2,height:17,color:C.bg,borderColor:C.border,borderWidth:0.3,borderRadius:2});dt(page,`${b.reference_batiment}  -  ${b.type_batiment}  -  ${b.etat}${b.superficie_m2?`  -  ${b.superficie_m2} m2`:''}`,m+8,y-5,reg,8.5,C.dark);y-=18;});
  }
  if (valeur) {
    const mvItems = ['maison','cloture','cultures','elevage','eau','electricite','commerce'].filter(k=>!!(valeur as any)[k]);
    if (mvItems.length>0) { dt(page, `Mise en valeur : ${mvItems.join(', ')}${valeur.annee_debut?` (depuis ${valeur.annee_debut})`:''}`, m, y-10, reg, 8.5, C.dark); y-=20; }
  }
  dt(page, 'Je certifie l\'exactitude des informations ci-dessus et appuie la presente demande de regularisation.', m, y-8, reg, 9, C.dark);
  drawFooterA4P(page, config, reg, bold, reference);
  await enregistrerDocument('DRF', reference, numero);
  return await pdf.save();
}

// ════════════════════════════════════════════════════════════
// DOCUMENTS FORMAT A4 PAYSAGE
// ════════════════════════════════════════════════════════════

// FP — Fiche Parcellaire (A4L)
export async function genererFP(parcelle: Parcelle, titulaire: TitulaireFoncier|null, detenteur: Detenteur|null, batiments: Batiment[], valeur: MiseEnValeur|null, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { W, H } = A4L;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('FP', config);
  const m = 30; const col4 = (W-m*2)/4; const col3 = (W-m*2)/3; const col2 = (W-m*2)/2;
  drawHeaderA4L(page, config, bold, reg, 'FP', 'Fiche Parcellaire Complete', reference);

  let y = H - 48;

  // Bandeau lot
  page.drawRectangle({ x: m, y: y-22, width: W-m*2, height: 24, color: rgb(0.93,0.97,1), borderColor: C.indigo, borderWidth: 0.8, borderRadius: 3 });
  dt(page, `LOT ${parcelle.numero_lot}`, m+8, y-6, bold, 12, C.indigo);
  dt(page, parcelle.adresse||'', m+100, y-6, reg, 9, C.dark);
  if (parcelle.superficie_m2) dt(page, `${parcelle.superficie_m2} m²`, W-m-80, y-6, bold, 10, C.indigo);
  dt(page, parcelle.usage||'', W-m-80, y-16, reg, 8, C.mid);
  y -= 30;

  // 4 colonnes — 4 acteurs
  const sections4 = [
    { title: 'PARCELLE', color: C.indigo, items: [{l:'Titre foncier',v:parcelle.titre_foncier||'Non titre'},{l:'Cadastre',v:parcelle.cadastre_ref||'-'},{l:'GPS lat.',v:parcelle.gps_lat?.toFixed(5)||'-'},{l:'GPS lng.',v:parcelle.gps_lng?.toFixed(5)||'-'},{l:'Fokontany',v:parcelle.fokontany||config.nom_fokontany}] },
    { title: 'TITULAIRE FONCIER', color: rgb(0.55,0.40,0.05), items: titulaire?[{l:'Type',v:titulaire.type_titulaire},{l:'Nom',v:`${titulaire.nom||'-'} ${titulaire.prenom||''}`},{l:'CIN',v:titulaire.cin||'-'},{l:'Tel.',v:titulaire.telephone||'-'}]:[{l:'Statut',v:'Non renseigne'}] },
    { title: 'DETENTEUR JOROLAVA', color: C.indigo, items: detenteur?[{l:'Qualite',v:detenteur.type_detention},{l:'Nom',v:`${detenteur.nom||'-'} ${detenteur.prenom||''}`},{l:'CIN',v:detenteur.cin||'-'},{l:'Depuis',v:detenteur.date_debut_occupation?new Date(detenteur.date_debut_occupation).toLocaleDateString('fr-FR'):'-'}]:[{l:'Statut',v:'Non renseigne'}] },
    { title: 'MISE EN VALEUR', color: rgb(0.05,0.45,0.15), items: valeur?[{l:'Maison',v:valeur.maison?'OUI':'NON'},{l:'Cloture',v:valeur.cloture?'OUI':'NON'},{l:'Cultures',v:valeur.cultures?'OUI':'NON'},{l:'Elevage',v:valeur.elevage?'OUI':'NON'},{l:'Electricite',v:valeur.electricite?'OUI':'NON'},{l:'Depuis',v:valeur.annee_debut?.toString()||'-'}]:[{l:'Statut',v:'Non renseigne'}] },
  ];
  const blockH = 120;
  sections4.forEach((s,i) => {
    const bx = m+i*col4;
    page.drawRectangle({ x: bx, y: y-16, width: col4-6, height: 18, color: s.color, borderRadius: 2 });
    dt(page, s.title, bx+4, y-5, bold, 7, C.white);
    page.drawRectangle({ x: bx, y: y-16-blockH, width: col4-6, height: blockH, color: C.bg, borderColor: C.border, borderWidth: 0.4, borderRadius: 2 });
    s.items.forEach((item,j) => { dt(page,item.l,bx+4,y-30-j*18,reg,6,C.light); dt(page,clean(item.v),bx+4,y-40-j*18,bold,7.5,C.dark); });
  });
  y -= blockH+24;

  // Tableau bâtiments
  if (batiments.length > 0) {
    page.drawRectangle({ x: m, y: y-16, width: W-m*2, height: 18, color: C.indigo, borderRadius: 2 });
    dt(page, `BATIMENTS (${batiments.length})`, m+4, y-5, bold, 8, C.white);
    y -= 18;
    const bcols = [{label:'Reference',x:m},{label:'Type',x:m+100},{label:'Etat',x:m+200},{label:'Superficie',x:m+280},{label:'Niveaux',x:m+360},{label:'Construction',x:m+430},{label:'Mur',x:m+520},{label:'Toiture',x:m+620}];
    let tableY = tableHeader(page, bcols, y, bold, W, m);
    batiments.forEach((b,idx) => {
      tableY = tableRow(page,[b.reference_batiment,b.type_batiment,b.etat,b.superficie_m2?`${b.superficie_m2}m2`:'-',String(b.nombre_niveaux||1),String(b.annee_construction||'-'),b.materiaux_mur||'-',b.materiaux_toiture||'-'],bcols,tableY,reg,bold,false,idx%2===0?C.bg:C.white,W,m);
    });
    y = tableY - 10;
  }
  drawFooterA4L(page, reg, reference);
  await enregistrerDocument('FP', reference, numero);
  return await pdf.save();
}

// FB — Fiche Bâtiment (A4L)
export async function genererFB(parcelle: Parcelle, batiment: Batiment, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { W, H } = A4L;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('FB', config);
  const m = 30; const col3 = (W-m*2)/3; const col2 = (W-m*2)/2;
  drawHeaderA4L(page, config, bold, reg, 'FB', 'Fiche Batiment Complete', reference);

  let y = H - 48;
  page.drawRectangle({ x: m, y: y-22, width: W-m*2, height: 24, color: rgb(0.93,0.97,1), borderColor: C.indigo, borderWidth: 0.8, borderRadius: 3 });
  dt(page, `REF. ${batiment.reference_batiment}`, m+8, y-6, bold, 12, C.indigo);
  dt(page, `${batiment.type_batiment}  |  ${batiment.etat}  |  LOT ${parcelle.numero_lot}`, m+130, y-6, reg, 9, C.dark);
  if (batiment.superficie_m2) dt(page, `${batiment.superficie_m2} m²`, W-m-80, y-6, bold, 10, C.indigo);
  y -= 32;

  const boxes = [{l:'Type batiment',v:batiment.type_batiment},{l:'Etat',v:batiment.etat},{l:'Superficie',v:batiment.superficie_m2?`${batiment.superficie_m2} m2`:'-'},{l:'Niveaux',v:String(batiment.nombre_niveaux||1)},{l:'Annee construction',v:String(batiment.annee_construction||'-')},{l:'Materiaux mur',v:batiment.materiaux_mur||'-'},{l:'Materiaux toiture',v:batiment.materiaux_toiture||'-'},{l:'Lot parcelle',v:parcelle.numero_lot},{l:'Adresse',v:parcelle.adresse||'-'}];
  page.drawRectangle({ x: m, y: y-Math.ceil(boxes.length/3)*28-10, width: W-m*2, height: Math.ceil(boxes.length/3)*28+14, color: C.bg, borderColor: C.border, borderWidth: 0.4, borderRadius: 4 });
  boxes.forEach((b,i)=>{dt(page,b.l,m+(i%3)*col3+8,y-Math.floor(i/3)*28-10,reg,6.5,C.light);dt(page,clean(b.v),m+(i%3)*col3+8,y-Math.floor(i/3)*28-20,bold,8.5,C.dark);});
  y -= Math.ceil(boxes.length/3)*28+18;

  // Zone photo
  page.drawRectangle({ x: W-m-160, y: y-120, width: 160, height: 110, color: C.bg, borderColor: C.border, borderWidth: 0.8 });
  dt(page, 'PHOTO DU BATIMENT', W-m-140, y-60, reg, 7, C.light);

  if (batiment.notes) {
    dt(page, 'OBSERVATIONS :', m, y-6, bold, 8, C.indigo);
    y -= 16;
    wrap(batiment.notes, 80).forEach(l=>{dt(page,l,m,y,reg,8.5,C.dark);y-=12;});
  }
  drawFooterA4L(page, reg, reference);
  await enregistrerDocument('FB', reference, numero);
  return await pdf.save();
}

// IFT — Ticket IFT (A5L)
export async function genererIFT(parcelle: Parcelle, batiment: Batiment|null, titulaire: TitulaireFoncier|null, detenteur: Detenteur|null, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { W, H } = A5L;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('IFT', config);
  const m = 20;
  drawHeaderA5L(page, config, bold, reg, 'IFT', 'Ticket IFT - Impot Foncier', reference);

  const col2 = (W-m*2)/2;
  let y = H - 60;

  // Côté gauche — Terrain
  page.drawRectangle({ x: m, y: y-130, width: col2-6, height: 135, color: C.bg, borderColor: C.border, borderWidth: 0.4, borderRadius: 3 });
  dt(page, 'TERRAIN', m+4, y-6, bold, 7.5, C.indigo);
  [{l:'Lot',v:parcelle.numero_lot},{l:'Superficie',v:parcelle.superficie_m2?`${parcelle.superficie_m2} m2`:'-'},{l:'Adresse',v:parcelle.adresse||'-'},{l:'Usage',v:parcelle.usage||'-'},{l:'Titre foncier',v:parcelle.titre_foncier||'Non titre'}].forEach((b,i)=>{dt(page,b.l,m+4,y-20-i*20,reg,6,C.light);dt(page,clean(b.v),m+4,y-29-i*20,bold,7.5,C.dark);});

  // Côté droit — Détenteur/Titulaire
  page.drawRectangle({ x: m+col2, y: y-130, width: col2-6, height: 135, color: rgb(0.93,0.97,1), borderColor: C.indigo, borderWidth: 0.4, borderRadius: 3 });
  dt(page, 'DETENTEUR / PROPRIETAIRE', m+col2+4, y-6, bold, 7.5, C.indigo);
  const dInfo = detenteur?[{l:'Nom',v:`${detenteur.nom||'-'} ${detenteur.prenom||''}`},{l:'CIN',v:detenteur.cin||'-'},{l:'Qualite',v:detenteur.type_detention},{l:'Depuis',v:detenteur.date_debut_occupation?new Date(detenteur.date_debut_occupation).toLocaleDateString('fr-FR'):'-'}]:titulaire?[{l:'Nom',v:`${titulaire.nom||'-'} ${titulaire.prenom||''}`},{l:'CIN',v:titulaire.cin||'-'},{l:'Type',v:titulaire.type_titulaire}]:[{l:'Statut',v:'Non renseigne'}];
  dInfo.forEach((b,i)=>{dt(page,b.l,m+col2+4,y-20-i*20,reg,6,C.light);dt(page,clean(b.v),m+col2+4,y-29-i*20,bold,7.5,C.dark);});
  y -= 140;

  // Statut JOROLAVA
  const hasJOR = !!detenteur;
  page.drawRectangle({ x: m, y: y-18, width: 180, height: 20, color: hasJOR?C.greenBg:C.redBg, borderColor: hasJOR?C.green:C.red, borderWidth: 0.5, borderRadius: 3 });
  dt(page, hasJOR?'STATUT JOROLAVA : OUI':'STATUT JOROLAVA : NON', m+4, y-5, bold, 8, hasJOR?C.green:C.red);

  if (batiment) {
    page.drawRectangle({ x: m+190, y: y-18, width: W-m*2-190, height: 20, color: C.bg, borderColor: C.border, borderWidth: 0.4, borderRadius: 3 });
    dt(page, `Bat: ${batiment.reference_batiment}  |  ${batiment.type_batiment}  |  ${batiment.etat}`, m+194, y-6, reg, 7.5, C.dark);
  }
  drawFooterA5L(page, config, reg, bold, reference);
  await enregistrerDocument('IFT', reference, numero);
  return await pdf.save();
}

export async function telechargerPDF(bytes: Uint8Array, nomFichier: string) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomFichier; a.click();
  URL.revokeObjectURL(url);
}

export const DOCUMENTS_ADMIN = [
  { code: 'CR',  nom: 'Certificat de Résidence',       description: "Atteste la résidence",                 icon: '🏠', niveau: 'membre', format: 'A5 Paysage' },
  { code: 'CVI', nom: 'Certificat de Vie Individuelle', description: "Atteste qu'une personne est en vie",   icon: '✅', niveau: 'membre', format: 'A5 Paysage' },
  { code: 'CVC', nom: 'Certificat de Vie Collective',   description: "Atteste qu'un ménage vit ensemble",    icon: '👨‍👩‍👧‍👦', niveau: 'foyer', format: 'A4 Portrait' },
  { code: 'CEL', nom: 'Certificat de Célibat',          description: "Atteste le célibat",                   icon: '💍', niveau: 'membre', format: 'A5 Paysage' },
  { code: 'BC',  nom: 'Certificat de Bonne Conduite',   description: "Atteste la bonne moralité",            icon: '⭐', niveau: 'membre', format: 'A5 Paysage' },
  { code: 'CM',  nom: 'Composition du Ménage',          description: "Liste officielle des membres",         icon: '📋', niveau: 'foyer', format: 'A4 Portrait' },
  { code: 'FM',  nom: 'Fiche Ménage',                   description: "Fiche détaillée du ménage",            icon: '📄', niveau: 'foyer', format: 'A4 Portrait' },
  { code: 'FFD', nom: 'Déclaration de Décès',           description: "Fanambarana Fahafatesana",             icon: '🕊️', niveau: 'membre', format: 'A4 Portrait' },
  { code: 'FAS', nom: 'Attestation de Travail',         description: "Fanamarinana Asa",                     icon: '💼', niveau: 'membre', format: 'A5 Paysage' },
  { code: 'PCG', nom: 'Prise en Charge et Garde',       description: "Atteste la garde d'une personne",      icon: '🤝', niveau: 'membre', format: 'A4 Portrait' },
] as const;

export const DOCUMENTS_FONCIERS = [
  { code: 'COT', nom: "Certificat d'Occupation de Terrain", description: "Atteste l'occupation",              icon: '🌍', besoin: ['parcelle','detenteur'], format: 'A5 Paysage' },
  { code: 'JOR', nom: 'JOROLAVA',                           description: "Reconnaissance locale d'occupation", icon: '📜', besoin: ['parcelle','detenteur'], format: 'A4 Portrait' },
  { code: 'ADF', nom: 'Attestation de Détention Foncière',  description: "Identifie le détenteur reconnu",     icon: '🤝', besoin: ['parcelle','detenteur'], format: 'A5 Paysage' },
  { code: 'APB', nom: "Attestation de Propriété de Bâtiment",description:"Propriétaire déclaré du bâtiment",  icon: '🏗️', besoin: ['parcelle','batiment'],  format: 'A5 Paysage' },
  { code: 'AMV', nom: 'Attestation de Mise en Valeur',      description: "Justifie les investissements",       icon: '🌿', besoin: ['parcelle','detenteur','valeur'], format: 'A5 Paysage' },
  { code: 'FP',  nom: 'Fiche Parcellaire',                  description: "Fiche complète de la parcelle",      icon: '📋', besoin: ['parcelle'],              format: 'A4 Paysage' },
  { code: 'FB',  nom: 'Fiche Bâtiment',                     description: "Fiche complète du bâtiment",         icon: '🏠', besoin: ['parcelle','batiment'],   format: 'A4 Paysage' },
  { code: 'DRF', nom: 'Demande de Régularisation Foncière', description: "Prépare le dossier régularisation",  icon: '📑', besoin: ['parcelle'],              format: 'A4 Portrait' },
  { code: 'IFT', nom: 'Ticket IFT',                         description: "Prépare la fiscalité foncière",      icon: '🏷️', besoin: ['parcelle'],             format: 'A5 Paysage' },
] as const;
