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

// ── CAISSE — Point d'entrée unique pour toutes les opérations payantes ──
export interface OperationCaisseInput {
  module_origine: string;        // 'Documents' | 'Cotisations' | 'Foncier' | 'Légalisation' | ...
  type_prestation: string;       // 'Certificat de Résidence', 'Cotisation Janvier 2026', ...
  reference_document?: string;   // référence générée par le module (ex: AMB-TSA-C01-CR-2026-0001)
  membre_id?: string;
  foyer_id?: string;
  nom_beneficiaire: string;
  montant: number;
  quantite?: number;
  metadata?: any;                // données spécifiques au module (ex: bytes du PDF en attente, periode cotisation...)
}

export async function creerOperationCaisse(input: OperationCaisseInput): Promise<string | null> {
  const { data, error } = await supabase.from('operations_caisse').insert({
    module_origine: input.module_origine,
    type_prestation: input.type_prestation,
    reference_document: input.reference_document || null,
    membre_id: input.membre_id || null,
    foyer_id: input.foyer_id || null,
    nom_beneficiaire: input.nom_beneficiaire,
    montant: input.montant,
    quantite: input.quantite || 1,
    statut: 'En attente de paiement',
    metadata: input.metadata || null,
  }).select().single();
  if (error) { console.error('creerOperationCaisse error', error); return null; }
  return data?.id || null;
}

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


// ── Logos intégrés (base64) ───────────────────────────────────
const LOGO_COMMUNE_B64 = "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";
const LOGO_REPUB_B64 = "iVBORw0KGgoAAAANSUhEUgAAALQAAAB2CAYAAABh7bmNAABJCElEQVR4nO29d5wlx3Xf+62qDjdPzrMzO5szcgYIgmAOFkVSIk3JlGVL8rNlm5T0JNvys2w/Pz/LCrYkK1CPkkhRIkWRBBMIgMg5b97F5p2ZnZxvDh2q6v1xZxdgggiaNrmD+eGD3Z07fauru3996tSp3zklrLWWdaxjjUD+sDuwjnX8ILFO6HWsKawTeh1rCuuEXseawjqh17GmsE7odawprBN6HWsK64T+nrAeqr9csE7o7wJrDS8TWfwwu7KO14B1Qn8LmgunljCq0giqrFvnywvrhP4WWGuJ45hCcYkgqAJindOXEdYJvQprm26GlJLDB5/n0a/+LWlPgbXrfL6MsE5ommRe/Rej42fxfYeulhaefeoZEGLVn17H5QDnh92BHwUIAcZYhBCMnj9PqbBMV7adHXuvxFi7PiW8jLBuoVdhrUUISUdHByuFAtXI0NbRA0KsE/oywrqF5mJkw2AtTE3O8uY730l7W5Yo0vjKYsV64O5ywbqFBsCilGJubo6F+SVaW7oolQOiKEYKgbXrdL5csE5oLlpowdjYGOlMmmTSJ5VKUS6XmZ+fR0rxiuPW8aOMdUIDQjQJOzc3R1dXN0Iq8vkVXNdlamqKkydPorVGCLFO6h9xrBOaJqGjKKRYLDEw0E+pmEcIQTqdZvPmzQRBwKFDh6jX6wghMGY9jPejitc9oS+6G/l8gTAM6enpplQukkwmgSbZN2/eTHt7O4cOHWJ2dhYpX/e37UcW609mFQsLC/i+TyaToVwu4/v+N1nirq4uhoaGOHv2LMeOHSOOYwCMMetuyI8Q1gm9irm5OTo7OwEIggDP87DWfpM1bmlpYc+ePZRKJV544QXK5TIAWusfSp/X8e143RP64oRwfmGBwQ2D1Go1LBbHcS5ZaCEEWmustXiex759+/A8jxdeeIHFxUWMMd9E6nWL/cPD65rQF4lXqVaoVCv09vWxuLyEkBJjDMaYS5ENx3HQWhPHMVJKdu3aRU9PD8eOHWNmZoZqtUqpVCKO40vfWSf2/368rlcKm8vdgoWFBYQQtLW2MTY2Ri6Xw9imb9xoNFBKIYTAcRyCICAMQ5LJJJs3byadTjM6OkqlUqG3t5darYbrurS1tSGl/CZSXxwN1vG/Dq9rC30RC/MLtLS04HsepVKJtrY2lFR4nkcQBNRqNeI4xhhzKfrRaDSIooje3l527drF0tISo6OjAFSrVSYmJsjn84RhiBDiO8ewrWVdnPqDxTqhaU4I+/r6CKOQIAhIJVOXfObW1lYqlQrVapWVlRWMMSQSCeI4Jo5joigil8uxZ88egiC4ROowDMnn88zOzjI5OUmj0XjZQluIsYTaICK7ql81TXI3/7meVPB94nVNaCklURSRz+cZ6O0jv5LHkQrf84jjGK01ruuSyWSoVqtEUcT58+ex1uK6LkEQXDoukUiwd+9eAKampjDGUCwWEVISBiGHjx5ldHyMer3ePLcVeI6ioiwFExEFEbExRNZSF1B/RT/X/fHvHa9bQl8kSD6fJwgC+vr7WVxcJJfLXfJ9pZQ0Gg06OjpI+D6JhI/WmnPnzuK6LtZaoii6RGrHcdizZw9KKUqlEi0tLUxNTmIxDA8Psbi0xKGDBxm/ME5laopz9z6IXVwmpzxc38cVCmEsMgpx4uhSfuM6vne8rieFAEtLS6RSKVKpJMvLy/T29hDHUdO/XSWUMZqOrk6Wl1bo6enhwoULjI2NMTS0gTAMCcMI3/dWoyKwd+8eXnrpBCsrK4yMjDA2NkaiXGZoeIigXGVpJc/yuVH2/7P/iys6RnDfcR2Zt11P196dtAwO4uNd6p81q/2wFkMzGeFSbHx9kvltEK/X+tDWNvnw6COP0mg0eMc738H99z/IFfv24fkeFosQ4DgujnKRUhDHAfVGSBzFjI2dJZlooae3E2NihADfT+B7SUChHMnp0ycpl8ts2rSJhaUl8oU8/d099A8NM/ngwxz8mY+yNXSpRVViz8Ed6KW8ayO5N9zI0C030rtnF+lsju+kxtYAxiCsRapXDLTf9DS/i5DbWqx4uUSDANaK6Pt1aaGbsYUYgWRpcYktWzdTrS+hlKG1pQ2FwMoiQThLpTyLRGLCGjgVGmEC6aQYHEiwsmSYm5+kpa0LVyWoVEpEfoznuzh4bN++nfHxcU6ePEn/4CB9fQMszS9QqtRpSaYZzvWQ0CFJm8A0NMnZKomJ/Zy99xGecTWt/Rto3ThEdtMgbZs30rJtB239A+R6+0i2teLkPKSUmDhEK0W8ykgJSAsOEmG5ZMn1KtsVFqE1aINWEiGaycBGycueEJd7/78/2BgpIhoNQ75SpG94mEqlQXt7hUrxy0ycP0x9ZYF6YwLlLCBEDdcmARdtLPU6RKYLq9oJRAbP30FX1zV09XRhRUyoJJ5OktRZNm7cSDKZ4PTZ82SzObq6u4kaEQXfciQZ0DmzyNZkKykngRGWHi9Br9tJ2UZMz60wN/o0s4+E1LHEeCScJJ3dPQwNDtMxPMDgR3+KzltuBg1K0DTK2iAsGGUveSVCCAzNSacxAscqHNfFERADIREeFlA/vOfyA8DrzuWw1mKNRgiH2alJnn7mXu540x7OHP86y4uHSXmLtKWgu8fQmsviCI1SIVoZ4noO1CLCeMRlSSOokc/nWFwJmVtOYd3t9G28mYGR28i1dyKkRkkH13NZXFnh1MnTOELQ2dFFXFzmhY98jHh6EgdLLpFl0GuhRXkkY4ErBdqJ0QgiDZG1NIhQApS1mDiC0NDo6GD7v/0Ynf/HTyCkQTZihO+BdNCAWJ0LCCEQsQUlMbLpXTRKBfTsMuneLuKWBF4IeN7fcQd/tPE6I7TBrMZ4pQoZPf0oxw98noTzEv2tIX2DSVIpged0cX62xuLCHCNDLQhnmZOjvcxcSLNlexVpIZtMUC0toytp9l7lExQLTI7HjC8pArmdzXs/RN/I9UgZ4SsXIX0W80uMnj2P5/qEC3Oc/Nh/oCfUqDCkVKtSNzFSOaTdBL1+hkGZwLESZSRY0DJGKIsWERoNWLyGYkkpuH4PM0GNoNqgZWM/m+68kf47bie3YQiZ8JvmO7QEKyuMP/cc8/c9ijx2BnN+FvVjd3DDH/3fKByEd3kP2q8PQhvAarRoNCdEUYWjRz/H+dN3s72vypbhMtVqO4mWXoq1MhPjm5DeGGl3gSB22DRc5qkXQJs0jrSEJiST6GYlb/A8w3C3Q7Ek2D1k8BIR47OWyTFBbsPb2XTVe0j6nfgqgU44LCwuU5lf5NDnP8c3/vt/42qvne1OgvZsCyJ2Kdar5IMqRgnaVIKBZAst1sXVllhHGAlWCYywIAxWCaQVUGmwFASUhcY4Eh3HpIc30nfNFZQdjbUCUa8yd2GciWMnSZuIK9MbSNZr1H7ybVzz6T9AANK9vAl9eff+e4QlxmBRUpFf3s+zj38KUX2aN1/RxWIpwbmKoLrcoHIiTWd3mkLxGQY6BdsHepgNT5NMJnjTtT7SaS6mOMphpTHDzLwlKGdZnklSKBY5RxtzNUl7OubtN2Y4e/pznPvGHIN3/hxOS5Js2E9XZw/DbS3cc/YkAKNOjQldpT1fYZffxlWJTvxUJzO2zlJc42ywQpv12OhkcT0Ha1dXFJHEViMjgxASlUrQnk2jdEhkNAnXxZ9fpvXgCaQOqM4v4whFryfJZjoIdUzgS6pxzIY9W5GuQyMOSf5wH9X/NNY4oW2zxJcAbUqMn32Cg0//KUNtK+y7spd6IFgutLO4EKPiJZLJE2RaIm7dliJJgrhSpKvTJ6xU0aaLqbmIVNajVXmkEgFX7YO44VIsa8rLGeYm6xTKgqQwzDWyJDuH2Nb5DQ4/fJBdN/97otYY7XbRmsnwwY99lLEXDqKXF0gon3bjcaGe51RjhV2ZLq52uhiUCWacKlWrmdFV2q2L73hY0yx+I1ajFsY2w3fKCLLKpRhF2ChEe5bFOE9XXx+eMjjLdZR0qSiDluDhUDYSvVREAJ69/NfZLv8reBVcnAxZbTly4H6efeL32DWwxA3bckzPr5D3t2NcRZtZYNemErfdmqKnI4Gpd1LWlnw4R2G+Fxm7BPUkM4tQClyqdYfjx2qE9TSjZytMzLqItOCa3S57+8r4CY/nj85zfHoa3drPjs0uJ5/9z0TV41QrC8wtVdhx59v4J7/2G7RqS2gaLOkyjuuR8H2O5af5Sv4kL1GkM5Fli9tCu5ciFhBajZDim8JxF+FYcA20JlLk/CRJ6RHXI+JIo3yf2FPNiSWGZGTwYoMVkjAImg2sgTj0miL0Jc2DBkwNYy2NRsDzz32Wc4c/yU3bGrSnc5xbSZMa3MrooWfocha57aY6/V11pucM5eAqQmvRJoNIZmkEVYyTBEokhUJqByvLiKQLOsLxEwT1gHyhysRCzA3XJ7hyW0ifH6CsZnJxO9P5dq7dE3L8md/Di2eIygGzo5NE9z7GrblBMkKxomLO1ZcIG3Va/Qxn4zJfKZ7j3vIocyKgBY+0BFdoIMKKEE8IXKWaITpjQAgcJL4B1wg8I0k1IFgo4KdS2KRHw8TUdUxFagJlCN0k6TtvASBaAyuPa4rQF2FFjLUKieTg/s8xcebPuHJLCdd0c2q8hanFBC89VWbHJodNW8+wuOTSMD2I6gxZt0Fg+lFhFsemIa4gsESmgbVJjHGoBwI/FVGvC+ohWFMnlfbxOwPGzsbE5Ty33hAwnEsze+4UQpUYK2TYtbHC6JHfp7W7wgv/9T9RefYQW1v7eZO/ATe2BAqmdJWyCWhLt1LCcLC+wBcLp3lULlLzBFoCFlwkUkgkTWkqQry8MGhZVfAJpJKUCyWqxQrp1hwi4WKsRSLQtQC1cwv9b7mN2ELCXP50uPyv4NsgMDZGKJ+XDn2DydN/xc7BAj0dLmcmDeVGhtrKWa6/cpL2riT1xl4CWWMpX6e7tYXK8kukvE60SeHKDhwnS9hIgIJG6BAjiLVDJpWlGrgU6pDK+tAIyGYrzC/UaMu0Uy6l2bbb5ards9RWysSJHDIcoTe9zJnT/w07s0wU1ilXArb5PexIdpAyYB3FclQnCkPam2t9LBLy1PIYzxSnmHJiGgkXLRTWrK78SYVSCrtqqQUCISXCSpR1Sbsp6otlGpU6yWwGIQSekBSCkLYPvAUn10JkzJrQQa05QltrUCrB2Pgox45/noH2Oboynew/EZLqaiHlT3LN1ohsMsfYmEddbaKz50pUw7CiPUgVkNVJnHSOus1QDlJMzAjKjQq5tm7qQcT58wssTrsUigqRsWhrGOmGhbMwvCNLqCXFVIJj00mGe/awczimNDbK4fF5lFejPdjPtp/dRtCfZSasManr3JwdZMTNorUmkFCJGk1rKwRGa4yUHIgKPL4wytl6npJjQV5cBvz2bBi5+gtpJY6RJHCpLRUxtQClFLU4oNGRoe1tNyMsWATaXXc5foSwKrUUgrAWcOS5L5PyzrB1yMGUJJ6/nYnpUa4cLtDmJzh7NqB14yYWlkrYRivdGzdTDufAGWK5MokjFMrpoBGlaVQzlEouff1l3FCxvFhjaraI8FO0eEkyGUsx0nh+knQmpOIZTo0W8BI+0yuK7vYU/S2LtPfUSbZuJiE34PQcYfDDb6FQWWBUV3DqkhtyvbQJRYRBSkGEISkkLoIQQ0PAtIzYX5nnUHmeSRMRSQcZN7UZF5V4Aos1BisNxtFYGWNFhCMFuqpR2kcHluTmjbRv3Ya1FiMtq5KnyxpriNACa0EKweHjz1MqPM/2zhpBxeVCsYZSk1wz2CArBDWRQ2QCzh18gv7WPioNgUr0kPV2MzeRwNhNVMtzuK4mmfCxOoEpQWd2EUeWKVciPMehp9uQcw1xOeKl03ly/S1UwhSnp+r09rbSKJUpluaJbMzGngy5uIUXjjcYrYzTqmbovSNHcusIshKzYCt0Oiluyg7QYgU1ZYmFwRpLAknCCBJWYIRgQTc4E+R5oTTFqdoKZQUNAaGEUEFdQc2BWFqEaCrrrDBYSTNmLRyIDW07NqHSaQg1rl0TQY61QWiLuRSiK1fyHD3xIO2tk/S3SuZmHRaCHP1tLls7GsRunaNnZnBUJ3uGujj4zL3MVy5QKZ+htXUHVtYJGiGFUp04WKQ15yBkEht6CCsIdcD8Yp10ykXJGrVageJSiLQJKnGFhbKHn9jA8kKDlpYG7V0B58dWSGd8ursMKrlA/8aduHIXsvsYgz9xE+3Wp+LUCSK42uvhymRnUw0nJIEwaGvxaYbkPANIyBMxZaocqc5xoDTLjI4xQiKMxTHgxhZpmkswF3MaBRaExhAj0KBWNdbaIswacKBZI4QGg10tOXD8xHGC/EmG+itMlhsUyyDjIlGjQFWlWIja2T3iszSRZ3wmYvuVGaZOrDA1Xkb6J9m+awfl+ixRmMIEMV3tWWLrM7poOXZWMb/QRltbFz0bWqk0PJZXNIValb7eJL29FuUIystlNg656NBhabHO5h056qkU2QHJkCM4tT/ixZki1o7SdUMW0S0IKg2KUYyKLNfl+rjWy+FogxUQCIMREiUlvpX4RiKtILSaijTMxSFjlTKjYZElGRIpgSskrpBIIVY9MYGQIGXT9VYJh+VjZ2GlhEkoGmptkHpNEFpYhVCWODacP/MCrekFBtNtBHmXmkjhUGFDb5azFyxGDSGTV7F1TxeZbMzYsQae8Th3tpWD+2dw3Srbd22jHhc4eSrkscfOEMlTbN9tSJoqm3oL3HhlJ8vzMDmnWCy6dHSkGRlpZWEJxqdjZDbB3HQRZWJ27MngJTX54mYW8xkGBwvoap5M+xItaUu6Yx511SZaRIJyWGXO1iA23JoeYKfKYAFHSrQyKAEeAk/QtNhC0rARy6LBJCUOlud4Nj/FC8UZDgUrnNNVVoRGuxLXGKS2xFgMIa6fIDx9nuXnn0criYwERlz+dFgTS9/WgFCKhfl55mdOsW9zFc9mSbcNkEt4tMUNgkaDagTnX1rAbUkw3NtDz0AbpWCZg8fG8dMdyAu7eLwyxg237KO85GPlWa6+JkVLOo0jQyAEJ2CltIWGLXD2fImMN8L2PYtcWC5z7kILxmaYX56nbaPH0JZ2ZqZrzE1B7JxhuPt2GmqJ7g0hlcVOJrRisK1BcGUL33i+TDHhUkhUSO0YINPZhT8jcQ5M0FcMKCuNsRfDzYKLeeJCQGQjKmgcFKE2VHXMYlTFqTukpWJDMsdgKocnBCaOcCwkraKz3ODCXV/j2rfdiVxN8bq81dBrhdBYBILJ0TGC2hLDXSnmFvM8fb5IX3snQ0OGSrlGGEo2bssyt+Jx6OwyAz0tjGzeztWpTs4emeHU+PP06i7uv+9Z9m322LGjHcIlbDVGmxShW6RiXKZmqvT3t3PLdUUmzp9jYqKNQjREuVJExXV27+omnUnz/JESWGjtyiFExPmJF9mxu0Eiaxk9l6d/UwM/PQl7BvmbQQ8SHmUngjbNhhv70XGGns0tzN5/kpGJAgmp0PZS0tSqhgMcoXCQWAmR1WANFolFUkNSrpaYaARsyGXpTSZJRALHSDq8DMcfe5Hq1AyZDQNoHYG8vCm9JgiNaC6mTF2YJO1pEilNi++wo2wJo0V8laK9X5LLaiZnpujShtaWHNVKhUoZdu/KsnXDCMcmHF46NMvVm3Ls2FogrFikTGBdi9SWyKYZPVtnz84kc5WYdDlmU6+H40bUFzxak2VuvHYDpVrImfOnyaVaEaElzC+TTjns2VMlkfSopy1vub1MZzc0FgP6ezfib+xiKV/G0Qo9uUL11ATellbGN2Zx3nMl4WdeIFWoI6S6lLHuCtUUKVkL1iBXw3YWS2wNVhiM0CBdQhNRKi4wVpWkUbT6aYb9JLnOXpx0CzULKdwf7nP8AeDyJ7S1CCmo1EKWCtPk0gG+p2lJVLi51SfSWRq1CmfONUgmsgz0JPBkioXlBmeKM0yejlkec2kfzDA0tBFKMTs21IjzHjJRwEiDUFliEdGoKzb0CrBl8uUkXVmF1cv0tGWI42VaNm6lWBllasLiWJ+gVmW4t5W0b6nVGsxOGhxZZdvWFhxjscsJpBS0OVV6e3wWjcEWK1ijWZxcItOSoBbHvNTiEf34lez9wvMka5qEVCjdDNM5l+ZxAi0AIZvuw2qmOMpghUZZSygsdRtTjAxzYZVJYemo5thbzON3ZAniGGkdhLDN/gl52SWWX/aEbioWoFgqUw8LdLZoUi5EGKyu4BiD4/ioRIJircHCShVtllksNrgwb4iNR1xxKD+1TO/GeW6/oRNHRlgtsUagGxlqQQU36eI5Gbq7ihSCJI1KiBQuCAdPCJItK5wczzI55+KYHL7Ko6ixkswTJup4HgxuSJNNREizDIRIFNKLSLplenrbObI8h3AdnEAgy5roQgmZS1CxdU61+uj37OamL53GRDENx+BZiRECYyxGGDxcHCMQpumUKCRGg3YsVdegjMHRYKUhsAYrJYvH9/P7730/P/uJP6H/hmsJtUYrcKzACsvltqndZU/oiyhXSkRxnUTaQbl1pM0Se6DjCj6wecjFGoc4UlhiZucEXekU5bBMEFco5B2MNLRmQDckQmmkSFAsVNEypL3DJ7BltHWox3UcSiQ9gW44SMeQ9SVuHOBGBVpbi2STDTIJh6FhQTbjYnUDEZcwMQjjIISLdRMIqng0yHlZ8BU2rYhljJt2MTpENywqnSAI65wd6aXzVsvgY8foUJJMqKgIg6TpEysEUohLE8dQgLSWZNzUdoDAOoJAWcIgJJAWTyUoHnuJ337P+/nI7/0XrvzJ9xMaB5CIZpT6h/tgXyPWDKHDqI6UMa4f4/ma5WmHSEl62yREgiCqYY2DsQ4iNgy1Jhhu18SuoBKmiEny9PNT+KqIjHIYVcRojygM6ehraS4tO3WUbWNhuUxPuwUTooWLJCZha8jGWd5waydJV5JNGhAWE5aIGxqJAuOA9RDSI1+RLOQVw1uzxDrCKg1tCURfhpRwcH2X0AMTBuA5uChkMeLF6zrxqiM0Do/RaHMoyaaWJBVLBhuGdGyQxuJa0I6DI1wCYyg5IQ3l0JCK0LEkVAJrDTGGVumTWCnwOz/1Ef55xuWmv/cTmEgj5eoqzmWENUDoptMRhxFKQcKVCOGxUnYpxhGd3QlkYLDCwyIRprm60Ig0koBKNc2ho3V2bTd0pjuwNkLYEKEFVhsSiRTFQo1UTwpXK6raoRFG7NnoQhwgcRHGYKTLbFymsx5x4JDkjuu78VkGKVCy2UcrHYwNsa6lGmUYmxX0DLbR0CvErkJ1t+I6TTehFEeYhCLR0oaNYhqNACchsZUaM2/ayfl2yfi5KVQ2R4jGiUJ2LmsGq4K2uiAXQmwtU75mOiuYSAlWfAiTDsJTyHqMZwXaapxI064VYknhpLPN2ypo+tA/zEf7fWANELoJYQQSgRIelaokcrPkqzWWa2W6fRAxSGtopn0bhLRYKTEEdPQOYJwCbdk26mGRFqURsYfwY7CWahhjpEHqFMv1kFQSlAowoaQ5kLsEdZdS6KICAY4PXhVBBFYi8DEohPWQMqAegCXLUr3GhbEajptopk3lA4TjEUUG6yqEsIQx2EhDJSDSDsSWE/kF9r3rJvoPn2bs+VMolSB0HQ73K85GglRN41qBMIayK6gk3OaLDGgpsEIg0h41Y0ELhKvIxzHpwS4yI9tWbyiY5rhyWWHNEFo5DgaPmDRaeNRqmkpZIGUaK+oIEYMQzUpDGDAx1gqU0LS1pTGOJJ1NYY1DXS3jW4mOoFSq0LOxBa0rSKeVQqFBe4sAvRpesBbruOQLIa0JTaQdvHSM1BGoixbuYtHFiOautSmKRY/FfAm251ipaCIlsfUG1bAKysMmfayjIG7GmpVQ6CiCSBNWqpx84Th777yKSFmmnjmNkilUbImspZhwEQJiYYhF8yX2Dc16HAmfTHcHleU8ohGCBQdBHIQMDY7Q39ONjmOkVJelPPrycpC+I5qUSSZ8rPCIRYrI+kgng5AZyjWNcn2EsEhpgRghLbge4KOEg3QrZDuGifQSXnI7kXCxIqZcilCOQyrlYImoB4ZqQ9HRYrFB1ByWbbNA4/xKyIbuHNq6yEyEIy7Wfb6IVXmmiIkDBZFPKmWRyiVfUHipLF4mi5dINsUWBggtxGAbGl0Lm5M+K3CET3W+zLHH97Ph2p3k9vah4zpWSSJPYh2Boy2ZmiJTc3BjReBCLMHGGieTIpFIYKNmDWxjLVZrunt7yKUzzSTcyy1et4o1QOgm0ukUrpMkCH20dsilUwShYmGphlAhQjUQNENVTe2vixQuaSeNbSwg04psr2Zhchab2ERg63iugw0T6DgCr0E1gJQn8GxEjIs1Akd5lKuCajlioMenEsbkUgLpxs2M89X/sAYtLML1MSKmUJa4nkXZBpUqtHf0k816zZCZ7yOshtBA2CyKLmOBbUSI2CJReF6aaKzEufOTjLz5epL9GVSljBtFhDKm4mpKCWi4zRVEZQWObY4sxYUlolqjqZ0WAtd1wVo6W9suJRXA5UmOy7HP3xG5bI6Ul6Va8VAyQ1i+QL1epdKQaDxCcgjhIqSLlg6RlIQKIgFZz7B4YYLW4Ztw1UlOnDBY5yaSGUnYqBIGHqHdyenxBC1ZjRWCSEQIN0Gs+nj+qGbzcD9R7FEJ6mzKCazWYBXWSqxRCCw141Cst6IJWawKpLRkEjA+X+Lg00fYsaEHEwToMEQGASqKkbFGSoHFYqoNdKWBiAxSa4TyWDw1Q36+wshbb8AO5tDW4IegYtmsRyLCZjzZAgiEtTjaYrTBSIGSEuk4IAV7t2wHmi8hgssuBg1rgNBCCKyxJFNpWtq7qVQTVMIsHX2K7o6QQl4zPZ8jlldSd1yMWkEZgxUNhAqIbY1UUqBXTjE9M8nmq3+MdjXN0SPTLCx1kGod4MjRBoefqOHFefo7BNIqUrKbuXIrDx2cYeNgjo5+n9GxiJ7WMi3JZXRDNiMaJsbaCKRgairk9Ok6pWI/Vqywe9gjDBWnLkSMPfsSZ188SXdrO7paRRiBss3qSHgCmfFwMilsrJGRxhpDaGKclRrLB86wFGo63nwtpjOBsBrhrmbM2maN6eauXhoQKMdBiOYkurk9hgFHsW/Pvkv39HLFZU9oaD4wR7l092ygXE1SbvSRzCZIeRXCoJWphRKxdTGJTcTJNI7fTspLkfKSJJ000hUMb0myeO4lJpdW2HX9LjL9sxw6Umb//oBSLUl3L+zdnqC2lGZmuov9x31Onq6yfVsbG7a4nJ0q4KQFmzb3Y0mhkmnwW8DLgp8lMlmWC4psR5pypZPIQkc6YKkccXCygkikmD+7QFAo0d/Tg9JggwaO5yDTHrQkcHracHMZwjjCOAqsQUWWcLnG0tg8JRvSc/1OglYHKzVKrFr21R29msngTZ//Yoa4kooojki1t7N7xw6Ay3rr5zUT5QDYMDTMoQMtTM9Jdm/upiu7wIUpaMQNqqUyOANMXRgnIRtEMQgr8ZVt1nw2Er+heeKh/YQ3bmZw01bSWcOhg+OMnyzx0tkGaV+jbApSCdp7W7jtugSdLR4Hz0ScOaXYvsXl6JEAGyeRbgg0SSelQNgYJ5FAJCOmzhVJ+pLO9hQPH1nh7FId31UY7bJyboLsUB+JTI7i/CypbArbmaUW1DDWw8sk0bUGWoCoWGKaL7ScrxI4hmC4m9ZbdlN47Ci+FpiLE0xW65ZEMSaIAFCNGJl1IOHy0+/9KTYPbLqsJ4SwRggtnaZF6e9rp6Orj7HxBqUr+tg2tMRSvs5iUZHLTNDVIVFihHz9ACbKUm1IEok6SXxUaGgIwXCHw4tPPM/g9kEGN/eRbk3yM28eJGzk8SQYWSOV28mjBzRzK5NcON3gzESR7uEkF6ZDdBzR1gNOoFHaWd3gymCloKU3x/xshpAq+3aVqNaz3P9iQEhMSqUJdESirYMglyS5oY1EvkBjbBGZ9RFRgKyGRLHBJj1sHCNXyxzowGAKdZTvsZIt0TbUTs91e5h7+hiuWs3o1jRzChsxth6S6GpB4sDefob7u/jo+/4RChdNcyn9csXlO7Z8C5rbFvts27aFIIBTpwZx2zbR2lEiruSYWYyZmBtlYMsGOtv20NES0NFhqJdb8JKQSCgcV9DVm+I9P34zA/2tnNqfZ2k6ZvxCns5OS7qlSCLbwdFzS8wsjTE+HtLbO8x737WVzvYsUZhmYTZExAnSCZ90IkEul6O1rRPlZKiXczTKCXKZmEwu4MAZyeNH6siWgBBN21A/3q4NiK4cUblMargV1eVCqYZfc5uxbynAVaiEj5tNE4lmtSgTRuj5PGq+SnGuBFv7aN89QqxjpGgWhJa2+X+UUDhDXTg7B4iLVX5u39vZ2b2RSOtmytZljDVhoeHiRMaydetWTpw6wuGT42zf3cX23Z2s5Gucm2xW4T8fnGBDXz9pCizmA/xWw1A3RKJKGOVYmKtz4MUZXD/J8FCVgUHB04/F5DIpNm7NcfhgyPEzZd5+Sw9hTTI2U+bwTJVgKc9t17WTzjpEJTCksT6sFDSzC1USiTbKBUkjWGDvdoGIu/mLhydZEhJXewhr0KUa9dEa2lndtXCglb7rtlM4MUG1VCb2PZTjNEveSkGyux3dCDCVBtKArdWxkxLHSzLv5undtxG/UCIYW0LhNEvxCo3veCgEK0dP8eO7buXfvucXiLTBqMszsvFKrBkLDc11jNbWVvbsuoZalOTJ5yzJ5NVs3RjQ05YkqKRoSfjMLYxSz97AheUsDWeG+eUVZqeK5Bdn8ZwScTROpXCe+mJAcXGCLTuTzOdzLBdbyS/4DPX0MTY9Tr6xQhSfpyUu4wnYf3iac2djpmZLzM+XKOcNxbyLK4doNDLUgwa9fQFdHSEPPB8wu20rXe/dhurbgmlNUqyVsPNFZLEGyqVeNSxWCuzYtYnOzjSYmETCQ/gu1vdoCINMJi5ZX5TElALkXBW5UmdeN2i5dieyNQFxvLrBkCJaLmJH52GpyM6rrwIEIU1B0+WONWOhL8ICu3fuYnx8iqNnHqWrK+LWq6+kGhzjxFjM5OwcPd1ZDh09xe6tO+nItHD+5Ek8t4WR3gRhGYa6stQbOV46XOCam7dSrThMh5ZTU3VeGlvgXXe20dnWw+Sk5qp9Kdw4RsluYlknjDWen2FpRXF+rITnu9SqEdqJ6cgWuW53msPn6hxe2ERbi8vWDTEXRIGFQ3XccgjWEFXqiKSHSiUIC4bzosLG67fR2Qg5f2EaJ1DYqsHEBm1iEBarwNim/iMolVH5BFqGFLuTtNyxg/L9R3CLhlhJ4mqD8ugMoDhy5gR2taANayBJds1V8F/VtTE1Ncvnv/q3vPjiXfy7X30bW7rGmTu/n/OTiuV6K8ObRyjn5+nKdlBdcdD2JJ4t41gXoQIqNY9q2ZBtD4gbacaXoHd7PwtTJTZ2z5PFUCp3QmtAqqXSFNJHHsrJ4viS5XKddHIDS7MBQkX0thqu2msYmylw9+PbSHe9h3kzz4HwDPms5vj+U1SOz4MFYyzK89CeQ+xbSIJIumzdsIGisixNzmFnSrhuAhloGsslBAJjQBowrkD0tiM605iMpKOnnfj0FMUXzqJihVjN8olMTGsyx4F7nmRTz0ZiY3Au45AdrEELLQCtIwYH+9mxZReHDx7lb+6a5affN8D2zTUq5RMsFcpMnbrAwHCGlco49TBN1k9RqgeIwKcj47KpR5MeaUGoGCldph+eYCC9m3I0zhUj3SSSRWYLEQvlLKlsO7VqkVxbJxcuFPCjJJIUY6MLOEaQay2yZ18nFyY103Mf4o1vegf7DzzHgG0l1bKPo7VR7NAIT4/NYwIDVYuoNujv7GRzuo8NbZ2kPA/Ppgg7UhxWrZxJTVBYyiN1DI4A4yCsRhoDocVWGzhZn0go8osV2jb148ytEI+u4FqB1gbpuhRWljl65iSbuocx2jQLd1zGWHOEBkC4gKU15dKVyVBYNvyX33+aX/mFK9l7pUcmeYATp8pcOJ5gw/YNbN69gTOHHyMySXyZINYR49MhyEVcKfASHq29OZ54/gjZtGBq0SCiHHWnSiwCKiWFbqTRfpW+AYd6pZXRMyWioMKmbXDjDT2cGisysfgObnnTL5DOpOnp6uTRpx4kuay5IbudoY4+3D0RZw6dYuvQMNdt2s3I0CDd6VakVIRSUK1HuGHAtp4u7sbh3GCJ0oV5SuVpRB0EEmhW8zfVOjSSuF6WsKopuzVyG/ooTJehEiJkcyLtpFO8cPww773tHZf5dLCJNedyAJe2KD558iQryyvMzk4wPz/D4sJZbr9ZcNsVNUrTZ5mZ1kwVfKq6wZ4h8PyQU6dWWC60kWntpsOv0+bHOEpRCgNUMoFwDLGNCCNDUE9SqMSsmGW29TpcsbeFE2cbFEobUf4y+7bF9HfnePGkYDm8nTtu/5f4nofWoJRPtVbhmaee5vz5UaxoxomTySSbh0cY7B8gm83i+T7KcxFSsrKS5/GHHiYKA4pRjXtqh1jM1Zg8PUbh+TkcLTCr22saaxBtaZL9nYQJhyghSGezqPPz1J47haMUoSdxEw49V+zkD37tt/ixLTdeKql2uWJNEtrapnZBqZfl6YcPHOfFA4eZmHqBkQ0V3n5rloQ5hy7NceZ0Aaetmyu2RiSkYHlGc3q2wcnxNhwpeMstOZ47vcxSMcJ1XcI4BkfSla2xra/Ots3tOG0ZCtWQM0cq9Hb1MbxJU7Uej78gacm+j1tu/+lmFVCjUMpvVtynucw8NjbGxIUJWlpaGNk0QjabQ8qXldSCl7fXWFhc5Gtf+xrSQsOJOMAYJ4M5Tj57nPKZORwkWsfNYjRJD6ezBdmZI25JIluS5Koxy48chEbYLH9gInRXljdcfydf/o2P05ZIre6SfHmSek0S+iIublFhiVFScebsGM8deIGzoydwojFuvdawp6eGXy8yPj5HYd4l1Snp36LIup08fGKOpZJHNtSolCXSFkf4xKHEtZI7bm8hkVlgYUUzv2KJY8ngYCsbN6Y5d1pz4EyWnTf8HFfufis2DkA5CNHMcbnYP/h2MdDFfn/T56t1opVSTE5O8uDDD1MKQnp8h2mzzJeKL3HgyRcIJxeb8s8wbuqpXRcyPiQ9yCXIpFJUzk3BchGkxLWaCE1L1xCHv/wkG7v7mhX+L1MrvaYJfREaS2wifOmwvLLEiweOce7UWSZmTtDVuszuEcOWgZCELbIyt8zyckRIDUc6hNojlAqDwBECGwXNHEFXklaKlBOT7XDoH8ySaunhQqHAC4c0ydTf4443fZD2jkG0aSClQnyXQi4XH8HFv7+bOOgi0aWUVKtVXjxwkJdOnEB6AjzDqfwkDz38EGG5ykBnD13tvbS0tOEoSRhG1BtVYmnxfB/biBidGWNpYZqcn+ENt97Jb//6f8V1nG/bjOhywv8eQn/rGb7L/brYEyHMN3/Jfktm22u83/biH8YgVHNX1rNnxzhx6gTnRo+zuDBGJlFlU3/MlsEiPR0NfCmJSjE2CIlNg0jHYA2+L0gmFa7v46fBT2UoFB1OTQacGXfxstdz0+0/w+ZNzdw8ow1Sfb+Rg1cWIBdY+/KFX7Tep0bHePbZ5wiXCqiUQotm9kkmnUEqibYaEzczU4QVCKnQtunuxCamVC7x5jvexBV7r2pWcF19mV5+Ft9n178rvuXZ8vKI9YPAD4jQr2xCfIefX+34V3x6aQj+Xgjwd53ju3zrFcN8FDW4MDHO2OgoM6MXWJibp1K/QDK1QldO0tUpaGutk01HJJ0YpRRRZKhVA1YahvkVy1Ihh5XDjGy8gWuvezODG0YA0CZASe819e219N1iMdqilCQKQs6cH2V6apKWXI6u7m5SqSSu42IRhGFAFDVTxpRSNGp1ZmZnmjryZJJt27aRa8mt1pH+9nN9M7715+/RWr22K/2+2/u+CW2twRj7LdZ0dQrzTZxuWpaLRbebO6Hq1d80DxRCARatNVIqLtbAvLTp+sXvXbrJFms1Qshm0qsBkJeOxTZn+c225SvaWRW7WwNolHJWz6UprawwN59ndmGJ2fk5lpYnKeSXiMIqOm6QVA2kkAg8EokMbe1d9A0Os3HzbjaMbCLpJQFDrC3SCsRqlkmzvy+/pC9fRzNh92V3wzR3IJDi0rFmdWPyV1pLe7HW86p2xazWxZb/k0UWrW1u5mlstHqui/1v3nspJViBtXI1qcKsJh2bb5rg2kuj6eoWexbkKybnxrxcnP6VkFKsXqfBWn2pD01ufO8j3P8Cl+NihvNrGWZXBburcdSX2xGrn8V895D5y7+7tNEm36mElcWYCCm91Z811hrA+baba7ShEdQRUqC1JdIxYb2EoyDX0oLrJgDvFd+IgKBJLpkAu1p56BXNNvsEr7Q4dtUX+s5hMsurWafmY4sRwn3FZ+ZbCA/N+3mxApJqZrCstv1N/bMWi0GKi+TTvGyVnNVr/NY5gMXYECn81Z/C5rVbLrkur2z/1cKBrzRWL3NHYzHfde7xnfCaCW1M820dPf4kT97/RQJbR+sGkCSdbufdH/hHLEyN88xjXyRULsYEREGdweF93HDzHTzxlb/GRBF1G6CBzo4e3vzjv0gQVfjGZ36TpdkVGq7FMS5eUvKGt/0EQ4N7eODzf0woNA0NMrakM2lufucHaM308ZlP/2fe/t5fZMvWK4njANfxee6BLzA5fZy3vfcXuPvTv8W+297F3qvfyvljj/LAV/6afTe+iRvveD8oh+rSNHd95neIVcQH3v9/kukdQcqQR77yF0yfO8DGLdt443s/CiR5/r4/Y3puktvf8Q958MFP8RM/9Uvc/aVP4dmYd37gl9EmRimHRrXEV/7296kuT3Dd7T/J7uvfhgKOPX0fzz/9ZVrbe3nHh3+JZLKVyvIZvvT5j2Niyfv+/q+Q6+wDEfH4/X/F2IkniXQaaetYbWhND3HLW36S7q27cZTg3OEnuO8bn2Bj/07e8/c/hlYJsEUe/fqnOX7wMWKtiWMPJNxw09u49V0fQogM9YULfPWLv4c2ET/2k79Ga9cwRtZ46dCzPH3fZwkaMVJo6lozsGmYD/2Df8/jX/8k9bDKlde9lXvv+ms+8A8+RnvvAM9+4+Mc2f8cb3j/z7Njx7VI63P+xLM8cPcn6B/ewrt+/GOYRJKwPMH9n/1jStUijdCiAKkEV9/8Vq665d1YFPXlOb74ud8mjAPe94FfonVgc9P3F2KV7PBqxvK1z1ZWJxSLs2O8+PhXaG/tYcPGq9gw3MeB577Ig/d9ksXZM7zw+NfYONTDzu3b2LFtB8MjI5QKizz7xNdIZCQjI7sZHtjAkw99msfv+RTPPPJVnnvyAXZfdQvX3fxurr357ZQKS3zpM3/GwvQoLz7+dVpThm07Rti6Y4iTh5/kK1/4S+qVEgcf/SL1+bFmXWQdYa1l4sxRju5/iDAo8+wj91KZn2H8xFP87n/658ROyN5rb6NhLEpI7vnSn/DSwcd46cAR7v7S7+JIAdbh6P6nOX7wGb7wV5/iwS/8LgDHTh7hyIEHCcpLHHr2cZQNOX/0IGeOPdMUCa3uwq2t5dj+hzj54gN87a/+B7q2SKMyy+c/+5ucPPwoh154FB3XkEJw9xf/nCP7H+fYgae556t/hBQ1BIozx5/m2IGHae3qIdfRT1tXH/sPfY3PfvY/4qgGUaPA5/7y3zE/OcFD9/4Nzz/5JRwpmbhwhs9/+vfJdW3gre/7J7z/p3+RvoEt7H/mGWrVKq4QPHD3X3D0wOMcOfQEX7rrvyOkRiG4/7N/wML5g7zj/e/j7R/4h1y7+43MjF6gVily+uRTHDvyBKXlKQ489kVkdYrH7/5T/r8/+R8MbN7Llk37iGNBbCp85jO/xfTEWR645zO8+PTdeEIQ1Rs89djXKdcXGdy+hd7tOymV5vjsX/we1eoKUkju+/KfcOi5Jzhz/EW+8vn/ihKKl0eZvxvfx9J3c9hwPZ9UpoUtu3eR7uhHxnUOPfMCrblu3ASksy1MTywiZZJKpcLVnTvp7EojUi49O/cw0HsjOljGe+xvaVQWwMswuHkPb/+pX7t0JiMqPPz1L2JFTLqtjYWVFVYihbEKlMOOLcO4ypLKtOP4LQghMX4GAXgJj0Q6hbWGjv4cD3zj4+SnCtx03Z38g3/9RzRshLSK2cljPP3ol/gn/+JXUaqP3/vdn+XmN3+ELTtuQijL3htuord/F1/45O8yvOta2jr7WZg9gvJDurt3gnBI+QmkcHjl5MG6Po4QvOEdP8HTzx7h+Xv/irqriUSdN7/jQzzxxJOkkw5zU0d45tH7+Ke/9K/AKP7oD3+dN955JwMjb8IRrfQNXMMHf+Y3Lt2TiIATxw4gSPLsI3/L4uJL/OYfPMK9X/ozvvqlP+b6W38cE4Y4rsM73/1BkpkB7v7cX9LmCXIb+0i5aZbmTvL4w5/nH/+zXyWRTvNbv/kr3PnWH2PjljvYfNVtHH3yq3z9ri9grUaqmA0DGVwX3EQHSSSuI+hsT/Lx3/2/mJ46x8/+03/DG97xCwS1GN93ePzRTzI1eZTf+e+f46F7/pZ7v/yHXHvb23DcLGk3w6bezezZfSMGn2D+ArWaxveTLM0c5YlHPsNHfuHX6ehu5zf/48/zxhM/x+ZdNxDHDZTjgVWvGnn5vrUc1mjiOOYLf/U/sFKjo5BGvcieq/8FF06NoXXM7r07SWTaCBsRXYMbqIVVksrlib/5OJH4NFhFm9fOtW/8IM8/dR9hZYHi4imcpI+QORZXphG2ipUBkW6wbfs+Wgf3IBTY8jwvPvMwWzddi5Sa/OIEC7PnCRuLtHVuREjQcQOkpV6rcN0NbyXelebAow+y5cFPc9NbPgTCcs+X/hKpQ+574D4c4ZCy7dzz5T/io/9mN0I0KNclP/OBf8mpEyf51O//Ols7d2CsIts/wi/+8m+DdIhsA/dbBzspiKslMl0jvP2D13DPX/w/NNyYD/zUr2MDj0jfg8Jw9xc+gWsq3H/vV7DW4EaGe77wN/zCr90OEhr1FWYmj2J1jESzMDZGyklTKU7y8Ff/gpTdwB9+/LeJi3MsT4/xzCNfY9P2LYT1Ciuz4wxuamWwr5WzR5/k+KmjvPPDH+UbX/oMNizx8P334ZGg1SS4528/zi/++i20t7dxyxvewJar70BKwejpF/nUn/xnrrrpI0hHYeMGRhmqJuZt73wnB55/hgfv/TyDG7ezaeftVCqLPPSVT5KzGf7sj/8AUyuQnz3JEw9/mVvf+A5kos4Lz9/Lc4eeAiTB4gy3vf2DuG6ae+/6JNRCHnr06ygnRcZ0cfcX/ge/+O92f8+Ju6+d0La5E4cWGUKZ41//mz+nu38b9eIF/u2vfIQTh0fJJdPoWPDYfXdjhKERV+jo28Sb7ng/pVjxcx/7HTbtuJ4o0ijp4roZZmenePaRu/h/f+1nEYnmDqjLK/PccMsdJFM56sLn8acfQKonMNKllJ9g65bbEL7E85Pc94U/5Wtf/ATV4iJv/4mPQNKjoZMIW6cSpxjYeAs3v/FDeBmfT/zZ75AvVdmybYTnnnuYD//ULzGw9VqgzvK1o3zyU7/N8QOP4Xg5YuOD8PmZj/4GH//Nj3Hi9GF6t2zDIYuTzQAhsZUIksDLUQsnimh4afI1ePe73s9j936CBC43venD3PfFP8dLOBw58AT7n3+Wn/zpjzKw+WoEMDd2jM/+5V9y9uBDZFIuK4sT/N5/+ido6vg6phJK3vuhf8TD93+G5XqFf/HR/0Kc8PFdj+ceuYsv3/VX/Mq//lcMb72KT3zi9+jv6yObTDI5O8b2vbcwdvoATz75NT7w4V9meNtNCBOwPP1G/uITf8jxZ+9j5vwpnn746+w4O0skk4TFZbq7dtDalSWyNbRVGK2o47Hv+ju54c5/wJ/81q/yO//hV/mnv/yfmJ48TX5J88/+5X/GJjIkHMX+J77A/Xf9NVs3b2IlTvPud3+It/34z4O2fPqPfo2jJ86y4/STPPn0A3zwp3+Zwd03YrWgdMN5/vyTv8sLjz/ALXf8ONoYpHj1yfJrj3KYGC0cwvIsSzOnyfZtxfNyyBjyC5Okcu24GY/S0hg6drE6xkQV3HQrufQQheIEHb2DJBLtWAEITaTBETVmJ86Qn59HqATSxjhehoFNuwDL8vI0igipFbGJwdN0de7GELO0Mo5arZSptSGXbcVYRaPeoKu7k9npcRybJtc+QCoNE+dfIo4aZLL9BLbMwNB2pEoAEMVl5idO4Ke7kKaOMdDSPoST8KkW5iitTOM5OboGthNLibURhcVxhI1p69hGLFc1xZFhZvEk2VQ32WwPxfwogjTpjn4qKzM0aks4viRqBHQPbMZ1W1dvcIOJ86dJJ1pAWqL6AkpliUSIjGNkop2unkHmp8aRbkR3/04uToXCWpG5qWl6ejuIdMzkhbNUSssYLfH9FMNbdiIIKZWWGBjZi1JpALStMXX+NKl0mmxHF9Onj1AtrWBEc9wZ2DBMy+BOludGsSYkm+ljJT9Ge9sIiWwnxCtMj59DqAxKxVjlMbBhxyXKBPV5lqfPk2nvo1grkE23kc1txAhDaWUM3fAQnqRWnqdvww48L7VqPBtMXTiJ4yTp6NuMUs3dCRDf3Q6/9ihHHCMchyMv3MOLTz1G54YBquU8fQM76O7tJ9vWSzbjkPAk6cwI+fwi506f4robb/umdqzRCKkI4wZCKlwp+H4GDM23rzVdvKCLHu3Swhke+PoX0FGDcmGS3oHNtHdv5463/uTqkc3QX10bPPXNFTcnx0+xvLDAlde/4Tv2/yIeuPev2LPvJvoHt6z26jvHhSPquCS/5dOLhRw9Yh3iKO8Vn7/6woKJLQaDFgGO8FDSQZsIJV2e+NqfsjA7SWvPCPVikfaNm7jl9vd+U2/iEBzv5bDYt/a8VLjAM089ydvf/dOv2o/veK1xhOO43/ZsxKW/v/P1haaKJ9Pf9Fktjkk4Emn1qjz4O+O1EzqKka7D/ff8CWGxzLs/9EtE1SqOl+ToscOkkpKHv/FJEr7L8Lbb6epKooxD58AmXjx4P2mnA89JsG3XZs6cHeXGG9+C1oYD+x+lvS3NxNgEwhN4yRx7d+/lwFOPIJSiElTZvH07I5v38tyTD+DYFA1dZN8VN9Pdsw2ERiAQq3FmQ4hZDdBHRpNUScZPPsuD932Nn//obxAZzYkT+1mYO4trOmht72Drzt08+eQjuCamEa2wZddNpFItVArTKONzZuwUnu8hI8ttb3s346MnGT91DCeZ5ciLj/DBv/+POT02ShzU8P0kV1/zRg4dfAasJggV+67eQWGpwtjEeZIO2BC2X3UdR48eIuk3FyauvuoW9u9/lrBRJtIBbb2DXHXVnRx45l4acQ0TazZv2cXQ5ivQuEjZLGZwEdoGWKNRMsmn/vjfcMU1N7Dv2rcThSU8z+fkiZPMT4zjuILW9nY2Dm/k6aeeIplM0KhV2XPllXT2b+SJhx9EOZrZqZOkvARX3PhOTh8+iFUuO/aM0NWxhRdeeADw0UJy0003sDw5wYXpGYRycJTP9TfdxtH9T7KSXyLGZdOW7QyPDPPME4/hOhA1auy96hbmF84wNTqOm+hEeobbbnkLx48fIp/PY2JNT98gu664GYRE8eoW+jWH7ezqKlYuleLs6ZN85a5P8zef/xQvHnycqYmnadSmGNqyiYHNm7jy2lsQLpw58RKVlQXCcp6e7l5eOvoEZ84c4PSJ48zPnubC+SOMnT9FpbiECZYZ6O7nyPMPc+LQk7x08EV27rqRHTv28eRDD1FbWqI4u0BbRzdRpcJDX/sqUiliHKzwmJ8d58zpgwSNOhIXhY8jPEBhHYmXCEBmQLUwdeEMvlC0t7XwxIN3MTl+hMMHHmD33i1s376HZx67m5nJ48zMjHHipWepBytcfe1tFJbO8MRDf8NTjz/Azt372LX7StpaslQLRQ7tf5Irr7md6elzHD3wBOWlRVra00TBIvd/9W42juxj367dHHjmMRxHUSosUK3M0NXVzfnjBzi8/xscPfQoQxs2cPU1b+S5xx9iefoMK7MztLW0kcLwwN2fa45CQiAxrCxPcvr485SLeRQ+wroIIej2HY49fh9f/9Jf85W//nPOHjvC4vwZlFqhoyPDi0/ey8mjj3Du5H52X3Et/T3dPP3gFzn43D2UinNcdc0b6OsdJpdq5cSRZxAI9uzeyTOPfp0H7/1rPF9y9XVvwOoGjz/4eZ597C4cU6G9xadenuH0S09z4ugBrrz2Nrbv3MFj93+RhQsnWVw4T3trC0FlgWce+SonDh1EGMlV197O2PnzHDv0OPMz50n6go62JI/f80XCahkl5N9Z4vf7zreplQO279rDe977Yd7/kz/Ntde/CYcUSb8FqyQdXb04SM68dJRk1mdq4gzKCiIdYnSMNoI3v/XdPPCNu3jumft505vfwoWpZZSXIYoEUkTU6yV6hkfoG9nF5h37yOSyzExNENbjZqVlHROHZaBZjFAYy9LMBKdPHqZSLSJWl75fXox1mzWWBeiwRH5+CUf4GMoIGkT1gA0bt9C78To2bb+NTCaNiBs4ysFJJNm+52o6uzeyYesuquUFkr7P0Par6RvaTba1lXpD07dhiO7+7bzvwx8l19FOobhEbH3QEUbXsW7AIw/dw53veBe3vvOnGD0/jiAmipuPqh5WaO8fZvPu2+nZsIvO3jbmZ85TKhfQeBgt0FEZTANpFRJJYXGJ08ePUCyuYKxeXdqHcgRX3f5m3vW+D/Pej/w8m3bsZHJyFOWliEKDMQFxFLFx2266+7cxsut6EolWCoUlBoaG6egaZmTrZiJjSfiSDdt2snHHjbz/7/8zStUi23ddQ0fXBrZu2Uq9UmfTtj2gkoSxoFQqMjczRmdfN93929i89QpyqRQTY5PoSBPFPtYKgqiAl8yy/cob6OjuZ2hkhKXlKVaWl5DCw0QhxtaI4oDvRdfxmp1WIZpeq5/qQDopHDeJKz2UUnheN9Zk2Lr1Rh576G5OH5qkozNBKpkCFOVKmVK+iDEOGIcNI/uIgs/jp5P0DOwkCh+nFGvcZBFkmlS6G6c4g7WWoB6SzLSgUpJqo0SpsEytXiWXy9Jcxm1qAXZfcyu7r3kDlqipIeFiahIoJ0UqOwwYlDCYWFAu1WhojfSa6UqeyGK0ptGo4yXacNwOXBq4vouOwBpDELt0bdhOudDgc5/8A9pafObnZ9h3VSeOk25uZeG3k23rodKYpb6yTL0S0dqW476vfpaFhTlWiv08/ejXcB3F0nyVYr5IHYmb7MEr12nUI5LKIem3k/CzRI0q5ZVlqpUGfqoVaQRCxRhj2bTjKjbtuAqsRZto9V5YVK4fJ92P66TBSaLiEKyiVKyiQw+cLE6qDxnWsNYQRRrhtLBv3xXc9437KBUCJsZfYPOmK3AdHxtLrIV0yxBXXHkLD371a3T2H2Z6cpTbb3sjF0ZHaQQVkD6VUsTV113Dc0/fx913/Rn1oEq2tZuBoW28dOY4lVKRWhUSmS5UMkkUNxfEHCXxs23MzxcpV1YQJsJJZ5Fu0yRh1avy+vvQcjTQ+FCvoNEIvwUpBKGNIY5R1uJ5LuXyHAZNS7adsB7hJdIUCtOY0MXzINHS3EZY2BKOsEQkEMJSzs+irUsi5eF7abSp4zttgCaKG3ieQ71UpRREJFSDTKIFkepsCpYQq4KY5grgJb2CsUQyRsQxJojRKUvSemChXFxBq4hkMo3nZIhNGUdlMHhIXUcYF6tiLC5ShUAGa+pYGSFJUykuIaiRTHlI04dx8kjVQXMvV0Mc5KlWqkg3QTqVwNqmCKtaL+M4KbLZdmqlaaLQxUn5pJIZrBWXNCdal1EqS6wLVApFpEqSyAo81cHfNcBaGwEGbSRWuCgBhmXyy8somyCRclBOCoTE8RIYo4nqVZLJJGHYoFyskkjGqEQXggjXeig3hRYxSjjUSkvUGiVS6XZS6Rxa1yjm81htyWbb8VJZbLBMIV9H+IbWtm4gQaUySb2s8VSCVC6BkTGOTKJkmjAuoKSDMYZCIY80kMnkcNLpphjNqlctt/B9EDrE4CJNc3ZtcVACQhFjkU0ZSQzSEWg0xkgcIdHG4qiL2kRNLARGS5TUCCwxEoHAFXaVChe1ajHSgBSq+bkxKCVX58cGoy1WKqQwTUIjmu4HXBL+YUGLGGkEGEmgGnhGUSwWQMRoGYFWGG0Qot60AtZtDl9GYpXBWoWUMVZ7WBE1F260xHU9hNDoOIDYR7h1jPGxIsRahSOSCNeijQZtkcIipIOQTaWcjjWuA+BhVlPHxEVhkAUrBNp6CEfjCbA4RKYBxkEhQDSPbYp4FFzUTAuaUgAsra2dSCeFRmBFiEtT0WiJ0EYgBc2MGFaVgEahlEIClojQKqSIcUxztNOrCkf3onYaiLRBqhhnVbTVlJ/bZgRKNuMakdFYFK7UiFXnoCno0girmkmV0hKbpiG6SBc0GNlUdgorftCE/p/F3x2K+l/ZjrUGrEDHIS+dPEwYVlAKhFn1tFfXVcWlrIBX4lu13t9JCP9yUOqS8vCVJHtFCxe/cqlF++qCevuKF/Xb8R36ZjQIh517r8JPZMGKV23/O5zxu53s1b/yXfv4WvHaddGvixSsV+KiRtdoi3Iv7xoU3zPsRR01P8h8gx9JvO4I3YRtDseGVYUcaPFyLAQE0jQD/83w2Ks31TzkVbS+Lx/0v74duGSJ9epxavUr4pIPtnaxNgvN/J2wzYUYefExi9VVq5d/L5oO5GsgwPdgF76ntn4A7YjVUUhcFF3aZskCIVlj9Tm/Da9TC72OtYq1/bqu43WHdUKvY01hndDrWFNYJ/Q61hTWCb2ONYV1Qq9jTWGd0OtYU1gn9DrWFNYJvY41hXVCr2NNYZ3Q61hTWCf0OtYU1gm9jjWFdUKvY01hndDrWFNYJ/Q61hTWCb2ONYV1Qq9jTeH/Bw6WDJCVFseJAAAAAElFTkSuQmCC";

function b64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// ── Générateur A5 style template officiel ─────────────────────
// A5 portrait : 420 × 595 pts
const A5P = { W: 420, H: 595 };

async function genererCertificatA5(
  pdf: PDFDocument,
  bold: PDFFont, reg: PDFFont,
  config: ConfigFokontany,
  codeDoc: string,
  titreDoc: string,
  reference: string,
  numero: number,
  membre: Membre,
  foyer: Foyer,
  extraBoxes: {l: string; v: string}[],
  introText: string,
  motif?: string,
  adresseResidence?: string,
  validite?: string
): Promise<void> {
  const { W, H } = A5P;
  const m = 16;
  const page = pdf.addPage([W, H]);

  // ── Fond blanc ──────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.white });

  // ── Logos ───────────────────────────────────────────────────
  try {
    const imgCommune = await pdf.embedPng(b64ToUint8(LOGO_COMMUNE_B64));
    page.drawImage(imgCommune, { x: m, y: H - 68, width: 48, height: 56 });
  } catch(e) {}
  try {
    const imgRepub = await pdf.embedPng(b64ToUint8(LOGO_REPUB_B64));
    page.drawImage(imgRepub, { x: W/2 - 55, y: H - 62, width: 110, height: 50 });
  } catch(e) {}

  // ── Hiérarchie admin gauche (en-tête) ───────────────────────
  const adminLines = [
    'REGION ANTSINANANA',
    `PREFECTURE TOAMASINA`,
    `DISTRICT ${clean(config.nom_district || 'TOAMASINA II')}`,
    `COMMUNE TAMATAVE SUBURBAINE`,
    `FOKONTANY ${clean(config.nom_fokontany).toUpperCase()}`,
    `QUARTIER ${clean(config.nom_quartier).toUpperCase()} CARREAU ${config.code_carreau}`,
  ];
  let ay = H - 14;
  adminLines.forEach(l => { dt(page, l, m, ay, bold, 5.5, C.dark); ay -= 8; });

  // ── Date et ville droite ─────────────────────────────────────
  const dateStr = `${clean(config.nom_fokontany)}, le ${new Date().toLocaleDateString('fr-FR')}`;
  dt(page, dateStr, W - m - 130, H - 14, reg, 6, C.dark);

  // ── Ligne séparatrice sous les logos ────────────────────────
  const sepY = H - 72;
  page.drawLine({ start: { x: m, y: sepY }, end: { x: W - m, y: sepY }, thickness: 0.8, color: C.dark });

  // ── Titre document ───────────────────────────────────────────
  const titleY = sepY - 14;
  dt(page, `[${codeDoc}] ${titreDoc.toUpperCase()}`, W/2 - titreDoc.length * 2.8, titleY, bold, 9, C.dark);
  page.drawLine({ start: { x: W/2 - 60, y: titleY - 3 }, end: { x: W/2 + 60, y: titleY - 3 }, thickness: 0.5, color: C.dark });

  // ── Ref + Date validité ──────────────────────────────────────
  const refY = titleY - 14;
  dt(page, 'Ref.:', m, refY, reg, 6, C.dark);
  dt(page, reference, m, refY - 8, bold, 6, C.indigo);
  dt(page, `Date: ${new Date().toLocaleDateString('fr-FR')}`, m, refY - 16, reg, 6, C.dark);
  if (validite) {
    dt(page, `Date de validite : ${validite}`, W - m - 120, refY, bold, 6, C.dark);
  }
  dt(page, 'Exemplaire : 1/1', W - m - 80, refY - 8, reg, 6, C.dark);

  // ── Texte intro ──────────────────────────────────────────────
  let y = refY - 30;
  const introLines = wrap(introText, 80);
  introLines.forEach(l => { dt(page, l, m, y, reg, 7, C.dark); y -= 10; });
  y -= 6;

  // ── Tableau de données (style template) ──────────────────────
  const age = membre.date_naissance
    ? Math.abs(new Date(Date.now() - new Date(membre.date_naissance).getTime()).getUTCFullYear() - 1970)
    : null;
  const pere_mere = membre.pere_nom || membre.mere_nom
    ? `${membre.pere_nom || ''} / ${membre.mere_nom || ''}`.trim()
    : '-';

  const allBoxes = [
    { l: 'NOM:', v: (membre.nom || '-').toUpperCase() },
    { l: 'PRENOM(S):', v: membre.prenom || '-' },
    { l: 'AGE(S):', v: age ? `${age} ans` : '-' },
    { l: 'SEXE:', v: membre.sexe === 'M' ? 'Masculin' : membre.sexe === 'F' ? 'Feminin' : '-' },
    { l: 'DATE DE NAISSANCE:', v: membre.date_naissance ? new Date(membre.date_naissance).toLocaleDateString('fr-FR') : '-' },
    { l: 'LIEU DE NAISSANCE:', v: membre.lieu_naissance || '-' },
    { l: 'FILS OU FILLE DE:', v: membre.pere_nom || '-' },
    { l: 'ET DE:', v: membre.mere_nom || '-' },
    ...extraBoxes,
    { l: 'NUMERO CIN:', v: membre.cin || '-' },
    { l: 'DATE DU CIN:', v: membre.date_cin ? new Date(membre.date_cin).toLocaleDateString('fr-FR') : '-' },
  ];
  if (motif) allBoxes.push({ l: 'MOTIF:', v: motif });
  if (adresseResidence) allBoxes.push({ l: 'ADRESSE DE RESIDENCE:', v: adresseResidence });

  // Fond du tableau avec couleur légère
  const rowH = 18;
  const col1W = 110;
  const tableH = allBoxes.length * rowH + 8;
  page.drawRectangle({ x: m, y: y - tableH, width: W - m*2, height: tableH, color: rgb(0.97, 0.97, 0.88), borderColor: rgb(0.7, 0.6, 0.2), borderWidth: 0.5, borderRadius: 2 });

  allBoxes.forEach((box, i) => {
    const rowY = y - i * rowH - 6;
    const isOdd = i % 2 === 1;
    if (isOdd) page.drawRectangle({ x: m + 1, y: rowY - rowH + 2, width: W - m*2 - 2, height: rowH, color: rgb(0.95, 0.94, 0.82) });
    dt(page, box.l, m + 4, rowY, reg, 6.5, C.mid);
    dt(page, clean(box.v), m + col1W, rowY, bold, 7.5, C.dark);
  });
  y -= tableH + 10;

  // ── Code ménage ──────────────────────────────────────────────
  const menageText = `Jusqu'a ce jour et inscrit(e) au registre de recensement de population code menage ${foyer.code_menage}`;
  wrap(menageText, 78).forEach(l => { dt(page, l, m, y, reg, 7, C.dark); y -= 10; });
  y -= 4;
  dt(page, 'En foi de quoi, le present certificat est delivre pour servir et valoir ce que de droit.', m, y, reg, 7, C.dark);
  y -= 16;

  // ── Filigrane blason ──────────────────────────────────────────
  try {
    const imgCommune2 = await pdf.embedPng(b64ToUint8(LOGO_COMMUNE_B64));
    page.drawImage(imgCommune2, { x: W/2 - 50, y: y - 40, width: 100, height: 80, opacity: 0.12 });
  } catch(e) {}

  // ── Zone signature ───────────────────────────────────────────
  const sigX = W - m - 120;
  const sigY = y - 8;
  dt(page, `${clean(config.nom_fokontany)}, le ${new Date().toLocaleDateString('fr-FR')}`, sigX - 10, sigY, reg, 6.5, C.dark);
  dt(page, 'Le Chef du Fokontany', sigX, sigY - 12, bold, 7, C.dark);
  dt(page, '', sigX, sigY - 24, reg, 7, C.dark);
  page.drawLine({ start: { x: sigX - 5, y: sigY - 38 }, end: { x: W - m, y: sigY - 38 }, thickness: 0.5, color: C.border });
  dt(page, '(Signature et cachet)', sigX + 10, sigY - 46, reg, 6, C.light);

  // ── QR code (simulé) ─────────────────────────────────────────
  const qrX = m, qrY = sigY - 48;
  page.drawRectangle({ x: qrX, y: qrY - 36, width: 38, height: 38, color: C.white, borderColor: C.dark, borderWidth: 1 });
  for (let r = 0; r < 5; r++) for (let c2 = 0; c2 < 5; c2++) {
    if ((r+c2)%2===0||r===0||r===4||c2===0||c2===4) page.drawRectangle({ x: qrX+3+c2*6.5, y: qrY-33+r*6.5, width: 5.5, height: 5.5, color: C.dark });
  }
  dt(page, 'Authentification du document', qrX + 42, qrY - 8, reg, 5.5, C.mid);
  dt(page, reference, qrX + 42, qrY - 18, reg, 5.5, C.indigo);

  // ── Ligne de découpe + Reçu ───────────────────────────────────
  const cutY = 32;
  page.drawLine({ start: { x: m - 5, y: cutY }, end: { x: W - m + 5, y: cutY }, thickness: 0.5, color: C.dark, dashArray: [3, 3], dashPhase: 0 });
  dt(page, '✂', m - 8, cutY - 2, reg, 10, C.dark);
  dt(page, `RECU  |  N°${(config.prefixe_recu || 'REC').toUpperCase()}-${String(numero).padStart(4,'0')}-${new Date().getFullYear()}  REF DOC : ${reference}  DATE: ${new Date().toLocaleDateString('fr-FR')}  |  Montant : 2000 Ariary  |`, m + 10, cutY - 14, reg, 6, C.dark);
  dt(page, 'Merci pour votre visite !!!', W/2 - 30, cutY - 24, bold, 6, C.dark);
}

// CR — Certificat de Résidence (A5 Portrait officiel)
export async function genererCR(membre: Membre, foyer: Foyer, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { reference, numero } = await genererReference('CR', config);

  const adresseLOT = foyer.identification_logement
    ? `LOT ${foyer.identification_logement}${foyer.numero_maison ? '-' + foyer.numero_maison : ''} ${clean(config.nom_quartier).toUpperCase()} Carreau ${config.code_carreau}`
    : foyer.adresse || '-';

  const validite = new Date(Date.now() + 90*24*60*60*1000).toLocaleDateString('fr-FR');

  const intro = `Le soussigne Chef du Fokontany ${clean(config.nom_fokontany)}, Quartier ${clean(config.nom_quartier)}, certifie que la personne dont l'identite est mentionnee ci-dessous reside bien dans le ressort du Fokontany.`;

  await genererCertificatA5(pdf, bold, reg, config, 'CR', 'CERTIFICAT DE RESIDENCE', reference, numero, membre, foyer,
    [
      { l: 'PROFESSION:', v: membre.profession || '-' },
      { l: 'MOTIF:', v: 'Demande administrative' },
      { l: 'ADRESSE DE RESIDENCE:', v: `${adresseLOT} Fokontany ${clean(config.nom_fokontany)} - ${clean(config.nom_district)}` },
    ],
    intro, undefined, undefined, validite
  );

  await enregistrerDocument('CR', reference, numero, membre.id, foyer.id, {nom: membre.nom, prenom: membre.prenom});
  return await pdf.save();
}

// BC — Certificat de Bonne Conduite (A5 Portrait officiel)
export async function genererBC(membre: Membre, foyer: Foyer, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { reference, numero } = await genererReference('BC', config);

  const validite = new Date(Date.now() + 90*24*60*60*1000).toLocaleDateString('fr-FR');

  const intro = `Le soussigne Chef du Fokontany ${clean(config.nom_fokontany)}, Quartier ${clean(config.nom_quartier)}, certifie que la personne dont l'identite est mentionnee ci-dessous est de bonne moralite, jouit d'une bonne conduite au sein de la communaute, et ne fait l'objet d'aucun reproche connu du fokontany.`;

  await genererCertificatA5(pdf, bold, reg, config, 'CB', 'CERTIFICAT DE BONNE CONDUITE', reference, numero, membre, foyer,
    [
      { l: 'PROFESSION:', v: membre.profession || '-' },
      { l: 'MOTIF:', v: 'Demande administrative' },
    ],
    intro, undefined, undefined, validite
  );

  await enregistrerDocument('BC', reference, numero, membre.id, foyer.id);
  return await pdf.save();
}

// CVI — Certificat de Vie Individuelle (A5 Portrait officiel)
export async function genererCVI(membre: Membre, foyer: Foyer, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { reference, numero } = await genererReference('CVI', config);
  const validite = new Date(Date.now() + 90*24*60*60*1000).toLocaleDateString('fr-FR');
  const intro = `Le soussigne Chef du Fokontany ${clean(config.nom_fokontany)}, Quartier ${clean(config.nom_quartier)}, certifie que la personne dont l'identite est mentionnee ci-dessous est en vie a ce jour et reside dans le ressort du Fokontany.`;
  await genererCertificatA5(pdf, bold, reg, config, 'CVI', 'CERTIFICAT DE VIE INDIVIDUELLE', reference, numero, membre, foyer,
    [{ l: 'CODE MENAGE:', v: foyer.code_menage }],
    intro, undefined, undefined, validite
  );
  await enregistrerDocument('CVI', reference, numero, membre.id, foyer.id);
  return await pdf.save();
}

// CEL — Certificat de Celibat (A5 Portrait officiel)
export async function genererCEL(membre: Membre, foyer: Foyer, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const { reference, numero } = await genererReference('CEL', config);
  const validite = new Date(Date.now() + 90*24*60*60*1000).toLocaleDateString('fr-FR');
  const intro = `Le soussigne Chef du Fokontany ${clean(config.nom_fokontany)}, Quartier ${clean(config.nom_quartier)}, atteste que la personne dont l'identite est mentionnee ci-dessous est de statut celibataire a ce jour selon les registres du Fokontany.`;
  await genererCertificatA5(pdf, bold, reg, config, 'CEL', 'CERTIFICAT DE CELIBAT', reference, numero, membre, foyer,
    [{ l: 'STATUT MATRIMONIAL:', v: 'Celibataire' }],
    intro, undefined, undefined, validite
  );
  await enregistrerDocument('CEL', reference, numero, membre.id, foyer.id);
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

// ── DISPATCHER — génère le PDF correspondant au code document ──
// Utilisé au moment du téléchargement final (après paiement validé), pas à l'aperçu.
// ── Fusionne N exemplaires d'un même document en un seul PDF multi-pages ──
// Important pour la traçabilité : un seul fichier = un seul acte de génération,
// même si l'agent a demandé plusieurs copies physiques.
export async function fusionnerExemplaires(bytesUnique: Uint8Array, nbExemplaires: number): Promise<Uint8Array> {
  if (nbExemplaires <= 1) return bytesUnique;
  const merged = await PDFDocument.create();
  const source = await PDFDocument.load(bytesUnique);
  const nbPages = source.getPageCount();
  for (let ex = 0; ex < nbExemplaires; ex++) {
    const indices = Array.from({ length: nbPages }, (_, i) => i);
    const pages = await merged.copyPages(source, indices);
    pages.forEach(p => merged.addPage(p));
  }
  return await merged.save();
}

export async function genererDocumentParCode(
  code: string,
  config: ConfigFokontany,
  ctx: {
    membre?: Membre; foyer?: Foyer; membresDuFoyer?: Membre[];
    parcelle?: Parcelle; detenteur?: Detenteur; titulaire?: TitulaireFoncier;
    batiments?: Batiment[]; batiment?: Batiment; valeur?: MiseEnValeur;
    extraData?: any;
  }
): Promise<Uint8Array> {
  const { membre, foyer, membresDuFoyer, parcelle, detenteur, titulaire, batiments, batiment, valeur, extraData } = ctx;
  switch (code) {
    case 'CR':  return await genererCR(membre!, foyer!, config);
    case 'CVI': return await genererCVI(membre!, foyer!, config);
    case 'CVC': return await genererCVC(foyer!, membresDuFoyer || [], config);
    case 'CEL': return await genererCEL(membre!, foyer!, config);
    case 'BC':  return await genererBC(membre!, foyer!, config);
    case 'CM':  return await genererCM(foyer!, membresDuFoyer || [], config);
    case 'FM':  return await genererFM(foyer!, membresDuFoyer || [], config);
    case 'FFD': return await genererFFD(membre!, foyer!, config, extraData?.dateDeces, extraData?.lieuDeces, extraData?.declarant);
    case 'FAS': return await genererFAS(membre!, foyer!, config);
    case 'PCG': return await genererPCG(membre!, foyer!, config, membresDuFoyer?.find(m => m.is_chef));
    case 'COT': return await genererCOT(parcelle!, detenteur!, config);
    case 'JOR': return await genererJOR(parcelle!, detenteur!, config);
    case 'ADF': return await genererADF(parcelle!, detenteur!, config);
    case 'APB': return await genererAPB(parcelle!, batiment || (batiments?.[0] as Batiment), {}, config);
    case 'AMV': return await genererAMV(parcelle!, valeur!, detenteur!, config);
    case 'FP':  return await genererFP(parcelle!, titulaire || null, detenteur || null, batiments || [], valeur || null, config);
    case 'FB':  return await genererFB(parcelle!, batiment || (batiments?.[0] as Batiment), config);
    case 'DRF': return await genererDRF(parcelle!, detenteur || null, titulaire || null, batiments || [], valeur || null, config);
    case 'IFT': return await genererIFT(parcelle!, batiment || null, titulaire || null, detenteur || null, config);
    default: throw new Error(`Document non implémenté: ${code}`);
  }
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
