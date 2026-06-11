import { StyleSheet } from '@react-pdf/renderer';

// ============================================================
// PALETA DE COLORES
// ============================================================
export const COLORS = {
  // Photocan
  amber: '#E89A1F',
  amberDeep: '#C97F0E',
  amberLight: '#FBE9C9',
  amberBg: '#FFF7E6',

  // Neutrales
  black: '#0A0A0A',
  text: '#1F1F1F',
  textMuted: '#6B6B6B',
  textLight: '#9A9A9A',

  // UI
  bg: '#FFFFFF',
  bgSubtle: '#FAFAFA',
  border: '#E5E5E5',
  borderStrong: '#CCCCCC',

  // Status
  green: '#16A34A',
  red: '#DC2626',
  blue: '#2563EB',
};

// ============================================================
// STYLES BASE
// ============================================================
export const styles = StyleSheet.create({
  // ─── Página y layout ───
  page: {
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 50,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 1.4,
  },

  // ─── Header (en cada página) ───
  header: {
    position: 'absolute',
    top: 20,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerOrgName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.text,
  },
  headerFolio: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontFamily: 'Helvetica',
  },

  // ─── Footer (en cada página) ───
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
  },
  footerText: {
    fontSize: 8,
    color: COLORS.textLight,
  },

  // ─── Portada ───
  coverWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  coverEyebrow: {
    fontSize: 9,
    color: COLORS.amber,
    letterSpacing: 2,
    marginBottom: 24,
  },
  coverTitle: {
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.black,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 1.2,
  },
  coverSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 60,
  },
  coverForLabel: {
    fontSize: 8,
    color: COLORS.textMuted,
    letterSpacing: 2,
    marginBottom: 6,
    textAlign: 'center',
  },
  coverClientName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  coverClientLegal: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  coverMessage: {
    marginTop: 50,
    padding: 16,
    backgroundColor: COLORS.bgSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    maxWidth: 380,
  },
  coverMessageLabel: {
    fontSize: 8,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  coverMessageText: {
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 1.5,
  },

  // ─── Section header (capas) ───
  sectionWrapper: {
    marginBottom: 28,
  },
  sectionEyebrow: {
    fontSize: 8,
    color: COLORS.amber,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.black,
    marginBottom: 16,
  },

  // ─── Texto de contenido ───
  contentText: {
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 1.6,
    marginBottom: 8,
  },
  contentParagraph: {
    marginBottom: 8,
  },
  contentList: {
    marginLeft: 12,
    marginBottom: 8,
  },
  contentListItem: {
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 1.5,
    marginBottom: 4,
    flexDirection: 'row',
  },
  contentBullet: {
    width: 10,
    fontSize: 10,
    color: COLORS.amber,
  },
  contentListItemText: {
    flex: 1,
  },

  // ─── Deliverables ───
  deliverableCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 14,
    marginBottom: 10,
  },
  deliverableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  deliverableNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.amberBg,
    borderWidth: 1,
    borderColor: COLORS.amberLight,
    fontSize: 9,
    color: COLORS.amberDeep,
    textAlign: 'center',
    paddingTop: 5,
    fontFamily: 'Helvetica-Bold',
  },
  deliverableBody: {
    flex: 1,
    paddingTop: 1,
  },
  deliverableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  deliverableName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.text,
  },
  deliverableTag: {
    fontSize: 7,
    color: COLORS.textMuted,
    letterSpacing: 1,
    backgroundColor: COLORS.bgSubtle,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  deliverableDesc: {
    fontSize: 9.5,
    color: COLORS.textMuted,
    lineHeight: 1.5,
    marginBottom: 4,
  },
  deliverableMeta: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontFamily: 'Helvetica',
  },
  deliverableComposition: {
    marginTop: 8,
    paddingLeft: 10,
    borderLeftWidth: 1.5,
    borderLeftColor: COLORS.amberLight,
  },
  deliverableCompositionLabel: {
    fontSize: 7.5,
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  deliverableCompositionItem: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginBottom: 2,
    flexDirection: 'row',
    gap: 6,
  },
  deliverableCompQty: {
    color: COLORS.amberDeep,
    fontFamily: 'Helvetica-Bold',
    width: 28,
  },

  // ─── Investment / Tabla ───
  investmentTable: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgSubtle,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  tableHeaderText: {
    fontSize: 8,
    color: COLORS.textMuted,
    letterSpacing: 1,
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
  },
  tableCellLeft: {
    flex: 2,
    fontSize: 10,
    color: COLORS.text,
  },
  tableCellMid: {
    flex: 1,
    fontSize: 9.5,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  tableCellRight: {
    flex: 1,
    fontSize: 10,
    color: COLORS.text,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
  },

  // ─── Resumen económico ───
  summaryBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 3,
  },
  summaryLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  summaryValue: {
    fontSize: 10,
    color: COLORS.text,
    fontFamily: 'Helvetica-Bold',
  },
  summarySubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  summarySubLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  summarySubValue: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  summaryDivider: {
    height: 0.5,
    backgroundColor: COLORS.border,
    marginVertical: 6,
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1.5,
    borderTopColor: COLORS.amber,
  },
  summaryTotalLabel: {
    fontSize: 12,
    color: COLORS.text,
    fontFamily: 'Helvetica-Bold',
  },
  summaryTotalValue: {
    fontSize: 22,
    color: COLORS.amberDeep,
    fontFamily: 'Helvetica-Bold',
  },

  // ─── Bonificaciones ───
  bonusBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.amberBg,
    borderWidth: 0.5,
    borderColor: COLORS.amberLight,
    borderRadius: 4,
  },
  bonusLabel: {
    fontSize: 8,
    color: COLORS.amberDeep,
    letterSpacing: 1.5,
    marginBottom: 6,
    fontFamily: 'Helvetica-Bold',
  },
  bonusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  bonusName: {
    fontSize: 10,
    color: COLORS.amberDeep,
  },
  bonusValue: {
    fontSize: 10,
    color: COLORS.amberDeep,
    fontFamily: 'Helvetica-Bold',
  },
});
