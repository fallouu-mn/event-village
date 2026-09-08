import { QRCodeWriter, BarcodeFormat, EncodeHintType } from '@zxing/library';

export interface TicketPdfData {
    ticketNumber: string;
    eventTitle: string;
    eventSubtitle?: string;
    organizerName?: string;
    categoryName: string;
    priceFormatted: string;
    dateFormatted: string;
    timeFormatted: string;
    venue: string;
    city: string;
    ownerName: string;
    ownerPhoneOrEmail?: string;
    qrPayload: string;
    status: string;
    securityVersion?: number;
}

/**
 * Encode un texte UTF-8 en caractères compatibles WinAnsi/PDF standard.
 */
function escapePdfText(str: string): string {
    if (!str) return '';
    const clean = str
        .replace(/[\u00A0\u202F\u2000-\u200A]/g, ' ')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
    
    // Normalisation des accents fréquents en français pour le jeu de caractères standard PDF Helvetica
    return clean
        .replace(/é/g, '\xE9')
        .replace(/è/g, '\xE8')
        .replace(/ê/g, '\xEA')
        .replace(/ë/g, '\xEB')
        .replace(/à/g, '\xE0')
        .replace(/â/g, '\xE2')
        .replace(/ä/g, '\xE4')
        .replace(/î/g, '\xEE')
        .replace(/ï/g, '\xEF')
        .replace(/ô/g, '\xF4')
        .replace(/ö/g, '\xF6')
        .replace(/ù/g, '\xF9')
        .replace(/û/g, '\xFB')
        .replace(/ü/g, '\xFC')
        .replace(/ç/g, '\xE7')
        .replace(/É/g, '\xC9')
        .replace(/È/g, '\xC8')
        .replace(/Ê/g, '\xCA')
        .replace(/À/g, '\xC0')
        .replace(/Ç/g, '\xC7')
        .replace(/’/g, "'")
        .replace(/–/g, '-')
        .replace(/—/g, '--')
        .replace(/«/g, '"')
        .replace(/»/g, '"');
}

export class TicketPdfService {
    /**
     * Génère un fichier PDF 100% vectoriel, léger, haute-fidélité et imprimable
     * pour le billet officiel Event Village.
     */
    public static async generateTicketPdf(data: TicketPdfData): Promise<Buffer> {
        // 1. Génération de la matrice QR Code vectorielle
        const qrWriter = new QRCodeWriter();
        const hints = new Map();
        hints.set(EncodeHintType.MARGIN, 1);
        
        const bitMatrix = qrWriter.encode(
            data.qrPayload || data.ticketNumber,
            BarcodeFormat.QR_CODE,
            33,
            33,
            hints
        );

        const matrixWidth = bitMatrix.getWidth();
        const matrixHeight = bitMatrix.getHeight();

        // 2. Dimensions A4 en points (1 pt = 1/72 inch) : 595.28 x 841.89 pt
        const pageWidth = 595.28;
        const pageHeight = 841.89;

        // Position de la carte billet
        const cardX = 50;
        const cardWidth = pageWidth - 100; // 495.28 pt
        const cardHeight = 640;
        const cardY = (pageHeight - cardHeight) / 2; // Centrage vertical

        // Construction du stream d'instructions graphiques PDF
        let stream = '';

        // Fond de page neutre
        stream += 'q\n';
        stream += '0.97 0.98 0.99 rg\n'; // Fond #F8F9FA
        stream += `0 0 ${pageWidth} ${pageHeight} re f\n`;

        // Carte Principale (Fond blanc avec bordure et ombre douce)
        stream += '1 1 1 rg\n'; // Blanc
        stream += '0.85 0.88 0.92 RG\n'; // Bordure subtile
        stream += '1.5 w\n';
        stream += `${cardX} ${cardY} ${cardWidth} ${cardHeight} re B\n`;

        // ── EN-TÊTE DU BILLET : Sunset Coral Event Village ───────────────────────
        const headerHeight = 110;
        const headerY = cardY + cardHeight - headerHeight;
        stream += '1 0.34 0.13 rg\n'; // #FF5722 Sunset Coral
        stream += `${cardX} ${headerY} ${cardWidth} ${headerHeight} re f\n`;

        // Accent Gradient Bar (Rose)
        stream += '1 0.24 0.41 rg\n'; // #FF3D68
        stream += `${cardX} ${headerY} ${cardWidth} 6 re f\n`;

        // Logo & Titre Header
        stream += 'BT\n';
        stream += '/F2 16 Tf\n';
        stream += '1 1 1 rg\n';
        stream += `${cardX + 24} ${cardY + cardHeight - 34} Td\n`;
        stream += `(EVENT VILLAGE) Tj\n`;
        stream += 'ET\n';

        stream += 'BT\n';
        stream += '/F1 9 Tf\n';
        stream += '1 1 1 rg\n';
        stream += `${cardX + 24} ${cardY + cardHeight - 48} Td\n`;
        stream += `(BILLET OFFICIEL D'ACCES -- BILLETTERIE SECURISEE) Tj\n`;
        stream += 'ET\n';

        // Badge Statut
        stream += 'BT\n';
        stream += '/F2 10 Tf\n';
        stream += '1 1 1 rg\n';
        stream += `${cardX + cardWidth - 110} ${cardY + cardHeight - 38} Td\n`;
        stream += `(STATUT: ${escapePdfText(data.status)}) Tj\n`;
        stream += 'ET\n';

        // Titre de l'événement dans le Header
        stream += 'BT\n';
        stream += '/F2 15 Tf\n';
        stream += '1 1 1 rg\n';
        stream += `${cardX + 24} ${cardY + cardHeight - 82} Td\n`;
        stream += `(${escapePdfText(data.eventTitle.slice(0, 48))}) Tj\n`;
        stream += 'ET\n';

        if (data.organizerName || data.eventSubtitle) {
            const org = data.organizerName || data.eventSubtitle || '';
            stream += 'BT\n';
            stream += '/F1 10 Tf\n';
            stream += '1 1 1 rg\n';
            stream += `${cardX + 24} ${cardY + cardHeight - 98} Td\n`;
            stream += `(Organise par: ${escapePdfText(org.slice(0, 50))}) Tj\n`;
            stream += 'ET\n';
        }

        // ── PERFORATION EN POINTILLÉS ──────────────────────────────────────────
        const dashY = headerY - 18;
        stream += 'q\n';
        stream += '[4 4] 0 d\n';
        stream += '0.75 0.80 0.85 RG\n';
        stream += '1 w\n';
        stream += `${cardX + 16} ${dashY} m ${cardX + cardWidth - 16} ${dashY} l S\n`;
        stream += 'Q\n';

        // ── GRILLE DES INFORMATIONS D'ACCÈS (2 Colonnes) ─────────────────────────
        const infoStartY = dashY - 32;

        // Ligne 1 : Date & Heure
        stream += 'BT\n/F1 9 Tf\n0.45 0.52 0.60 rg\n';
        stream += `${cardX + 28} ${infoStartY} Td\n(DATE DE L'EVENEMENT) Tj\nET\n`;
        stream += 'BT\n/F2 12 Tf\n0.06 0.09 0.16 rg\n';
        stream += `${cardX + 28} ${infoStartY - 16} Td\n(${escapePdfText(data.dateFormatted)}) Tj\nET\n`;

        stream += 'BT\n/F1 9 Tf\n0.45 0.52 0.60 rg\n';
        stream += `${cardX + 260} ${infoStartY} Td\n(HEURE D'ACCES) Tj\nET\n`;
        stream += 'BT\n/F2 12 Tf\n0.06 0.09 0.16 rg\n';
        stream += `${cardX + 260} ${infoStartY - 16} Td\n(${escapePdfText(data.timeFormatted)}) Tj\nET\n`;

        // Ligne 2 : Lieu & Emplacement / Catégorie
        const line2Y = infoStartY - 48;
        stream += 'BT\n/F1 9 Tf\n0.45 0.52 0.60 rg\n';
        stream += `${cardX + 28} ${line2Y} Td\n(LIEU ET SALLE) Tj\nET\n`;
        stream += 'BT\n/F2 12 Tf\n0.06 0.09 0.16 rg\n';
        stream += `${cardX + 28} ${line2Y - 16} Td\n(${escapePdfText(`${data.venue}, ${data.city}`.slice(0, 36))}) Tj\nET\n`;

        stream += 'BT\n/F1 9 Tf\n0.45 0.52 0.60 rg\n';
        stream += `${cardX + 260} ${line2Y} Td\n(CATEGORIE / FORMULE) Tj\nET\n`;
        stream += 'BT\n/F2 12 Tf\n1 0.34 0.13 rg\n'; // Orange
        stream += `${cardX + 260} ${line2Y - 16} Td\n(${escapePdfText(data.categoryName)}) Tj\nET\n`;

        // Ligne 3 : Porteur / Titulaire & Prix
        const line3Y = line2Y - 48;
        stream += 'BT\n/F1 9 Tf\n0.45 0.52 0.60 rg\n';
        stream += `${cardX + 28} ${line3Y} Td\n(TITULAIRE DU BILLET) Tj\nET\n`;
        stream += 'BT\n/F2 12 Tf\n0.06 0.09 0.16 rg\n';
        stream += `${cardX + 28} ${line3Y - 16} Td\n(${escapePdfText(data.ownerName)}) Tj\nET\n`;

        stream += 'BT\n/F1 9 Tf\n0.45 0.52 0.60 rg\n';
        stream += `${cardX + 260} ${line3Y} Td\n(PRIX DU BILLET) Tj\nET\n`;
        stream += 'BT\n/F2 12 Tf\n0.06 0.09 0.16 rg\n';
        stream += `${cardX + 260} ${line3Y - 16} Td\n(${escapePdfText(data.priceFormatted)}) Tj\nET\n`;

        // Ligne 4 : Numéro officiel de billet
        const line4Y = line3Y - 44;
        stream += '0.94 0.96 0.98 rg\n'; // Box récapitulative
        stream += `${cardX + 24} ${line4Y - 10} ${cardWidth - 48} 26 re f\n`;

        stream += 'BT\n/F2 10 Tf\n0.20 0.25 0.35 rg\n';
        stream += `${cardX + 36} ${line4Y - 2} Td\n(NUMERO DE BILLET :  ${escapePdfText(data.ticketNumber)}) Tj\nET\n`;

        // ── SECTION CENTRALE : QR CODE VECTORIEL HAUTE DÉFINITION ───────────────
        const qrBoxSize = 160;
        const qrBoxX = cardX + (cardWidth - qrBoxSize) / 2;
        const qrBoxY = cardY + 75;

        // Cadre blanc protecteur du QR Code
        stream += '1 1 1 rg\n';
        stream += '0.85 0.88 0.92 RG\n';
        stream += '1 w\n';
        stream += `${qrBoxX - 10} ${qrBoxY - 10} ${qrBoxSize + 20} ${qrBoxSize + 20} re B\n`;

        // Rendu pixel par pixel vectoriel du QR code
        const cellSize = qrBoxSize / matrixWidth;
        stream += 'q\n';
        stream += '0.06 0.09 0.16 rg\n'; // Noir charbon #0f172a

        for (let y = 0; y < matrixHeight; y++) {
            for (let x = 0; x < matrixWidth; x++) {
                if (bitMatrix.get(x, y)) {
                    const px = qrBoxX + x * cellSize;
                    // En PDF, y=0 est en bas, donc inversion de l'axe vertical
                    const py = qrBoxY + (matrixHeight - 1 - y) * cellSize;
                    stream += `${px.toFixed(2)} ${py.toFixed(2)} ${cellSize.toFixed(2)} ${cellSize.toFixed(2)} re f\n`;
                }
            }
        }
        stream += 'Q\n';

        // Légende sous le QR Code
        stream += 'BT\n';
        stream += '/F2 9 Tf\n';
        stream += '0.06 0.09 0.16 rg\n';
        stream += `${cardX + (cardWidth / 2) - 85} ${qrBoxY - 24} Td\n`;
        stream += `(SCAN UNIQUE OFFICIEL AUX PORTES) Tj\n`;
        stream += 'ET\n';

        // ── PIED DE CARTE & SÉCURITÉ ─────────────────────────────────────────────
        const footerY = cardY + 16;
        stream += 'q\n';
        stream += '0.85 0.88 0.92 RG\n';
        stream += '0.75 w\n';
        stream += `${cardX + 24} ${footerY + 22} m ${cardX + cardWidth - 24} ${footerY + 22} l S\n`;
        stream += 'Q\n';

        stream += 'BT\n';
        stream += '/F1 7.5 Tf\n';
        stream += '0.45 0.52 0.60 rg\n';
        stream += `${cardX + 28} ${footerY + 10} Td\n`;
        stream += `(Ce document officiel certifie votre droit d'acces. Presentez-le imprime ou sur smartphone.) Tj\n`;
        stream += 'ET\n';

        stream += 'BT\n';
        stream += '/F1 7.5 Tf\n';
        stream += '0.45 0.52 0.60 rg\n';
        stream += `${cardX + 28} ${footerY} Td\n`;
        stream += `(Event Village Senegal -- Plateforme officielle de billetterie -- support@event-village.sn) Tj\n`;
        stream += 'ET\n';

        // Sceau de sécurité / Version
        if (data.securityVersion) {
            stream += 'BT\n';
            stream += '/F2 7.5 Tf\n';
            stream += '0.35 0.40 0.50 rg\n';
            stream += `${cardX + cardWidth - 110} ${footerY} Td\n`;
            stream += `(SEC-VER: v${data.securityVersion}) Tj\n`;
            stream += 'ET\n';
        }

        // Fin de l'environnement graphique
        stream += 'Q\n';

        // 3. Assemblage des objets PDF selon la spécification PDF-1.4
        const streamLength = Buffer.byteLength(stream, 'latin1');

        const objects: string[] = [];
        // Obj 1: Catalog
        objects[1] = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj';
        // Obj 2: Pages
        objects[2] = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj';
        // Obj 3: Page
        objects[3] = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj`;
        // Obj 4: Content Stream
        objects[4] = `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}\nendstream\nendobj`;
        // Obj 5: Helvetica Font
        objects[5] = '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj';
        // Obj 6: Helvetica-Bold Font
        objects[6] = '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj';

        let body = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
        const xrefOffsets: number[] = [0];

        for (let i = 1; i <= 6; i++) {
            xrefOffsets[i] = Buffer.byteLength(body, 'latin1');
            body += objects[i] + '\n';
        }

        const startXref = Buffer.byteLength(body, 'latin1');
        body += 'xref\n';
        body += '0 7\n';
        body += '0000000000 65535 f \n';
        for (let i = 1; i <= 6; i++) {
            const offsetStr = String(xrefOffsets[i]).padStart(10, '0');
            body += `${offsetStr} 00000 n \n`;
        }

        body += 'trailer\n';
        body += '<< /Size 7 /Root 1 0 R >>\n';
        body += 'startxref\n';
        body += `${startXref}\n`;
        body += '%%EOF\n';

        return Buffer.from(body, 'latin1');
    }
}
