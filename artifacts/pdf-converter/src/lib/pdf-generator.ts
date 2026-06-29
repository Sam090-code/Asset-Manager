import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

export interface DocSettings {
  pageSize: 'A4' | 'Letter' | 'Legal' | 'A3' | 'Custom';
  customWidth: number;
  customHeight: number;
  orientation: 'portrait' | 'landscape';
  margins: { top: number; right: number; bottom: number; left: number };
  spacing: number;
  alignment: 'left' | 'center' | 'right';
  backgroundColor: string;
  borderStyle: 'none' | 'thin' | 'medium' | 'thick';
  borderColor: string;
  headerEnabled: boolean;
  headerText: string;
  headerShowDate: boolean;
  footerEnabled: boolean;
  footerText: string;
  pageNumberPos: 'none' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  pageNumberFmt: 'number' | 'page-n' | 'page-n-of-total';
  watermarkEnabled: boolean;
  watermarkText: string;
  watermarkFontSize: number;
  watermarkRotation: number;
  watermarkOpacity: number;
  watermarkPos: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const DEFAULT_SETTINGS: DocSettings = {
  pageSize: 'A4',
  customWidth: 595,
  customHeight: 842,
  orientation: 'portrait',
  margins: { top: 36, right: 36, bottom: 36, left: 36 },
  spacing: 0,
  alignment: 'center',
  backgroundColor: '#ffffff',
  borderStyle: 'none',
  borderColor: '#cccccc',
  headerEnabled: false,
  headerText: '',
  headerShowDate: false,
  footerEnabled: false,
  footerText: '',
  pageNumberPos: 'none',
  pageNumberFmt: 'page-n-of-total',
  watermarkEnabled: false,
  watermarkText: 'CONFIDENTIAL',
  watermarkFontSize: 60,
  watermarkRotation: -45,
  watermarkOpacity: 0.15,
  watermarkPos: 'center',
};

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '').padEnd(6, '0');
  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  ];
}

const PAGE_SIZES: Record<string, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  Legal: [612, 1008],
  A3: [841.89, 1190.55],
};

const BORDER_WIDTHS: Record<string, number> = {
  none: 0, thin: 0.75, medium: 2, thick: 4,
};

export async function generatePdf(
  images: Array<{ processedDataUrl: string }>,
  settings: DocSettings,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const [baseW, baseH] = settings.pageSize === 'Custom'
    ? [settings.customWidth, settings.customHeight]
    : (PAGE_SIZES[settings.pageSize] ?? PAGE_SIZES.A4);

  const [pageW, pageH] = settings.orientation === 'landscape' ? [baseH, baseW] : [baseW, baseH];
  const total = images.length;
  const dateStr = new Date().toLocaleDateString();

  const { top: mt, right: mr, bottom: mb, left: ml } = settings.margins;
  const HEADER_ZONE = settings.headerEnabled ? 28 : 0;
  const FOOTER_ZONE = (settings.footerEnabled || settings.pageNumberPos !== 'none') ? 24 : 0;
  const availW = pageW - ml - mr;
  const availH = pageH - mt - mb - HEADER_ZONE - FOOTER_ZONE;
  const borderW = BORDER_WIDTHS[settings.borderStyle] ?? 0;
  const [bgR, bgG, bgB] = hexToRgb(settings.backgroundColor);

  for (let i = 0; i < images.length; i++) {
    const { processedDataUrl } = images[i];
    const isJpeg = processedDataUrl.includes('data:image/jpeg') || processedDataUrl.includes('data:image/jpg');
    const base64 = processedDataUrl.split(',')[1];
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const embedded = isJpeg ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);

    const page = pdfDoc.addPage([pageW, pageH]);

    // Background
    page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: rgb(bgR, bgG, bgB) });

    // Fit image into available area
    const scale = Math.min(availW / embedded.width, availH / embedded.height);
    const imgW = embedded.width * scale;
    const imgH = embedded.height * scale;
    const imgY = mb + FOOTER_ZONE + (availH - imgH) / 2;
    const imgX = settings.alignment === 'left' ? ml
      : settings.alignment === 'right' ? pageW - mr - imgW
      : ml + (availW - imgW) / 2;

    // Border behind image
    if (borderW > 0) {
      const [bR, bG, bB] = hexToRgb(settings.borderColor);
      page.drawRectangle({
        x: imgX - borderW, y: imgY - borderW,
        width: imgW + borderW * 2, height: imgH + borderW * 2,
        color: rgb(bR, bG, bB),
      });
    }

    page.drawImage(embedded, { x: imgX, y: imgY, width: imgW, height: imgH });

    // Header
    if (settings.headerEnabled) {
      const hY = pageH - mt - 14;
      let hText = settings.headerText || '';
      if (settings.headerShowDate) hText = hText ? `${hText}   ${dateStr}` : dateStr;
      if (hText) {
        page.drawText(hText, { x: ml, y: hY, font, size: 9, color: rgb(0.35, 0.35, 0.35), maxWidth: availW });
      }
      page.drawLine({ start: { x: ml, y: hY - 6 }, end: { x: pageW - mr, y: hY - 6 }, thickness: 0.4, color: rgb(0.8, 0.8, 0.8) });
    }

    // Footer text
    if (settings.footerEnabled && settings.footerText) {
      page.drawText(settings.footerText, { x: ml, y: mb + 7, font, size: 9, color: rgb(0.35, 0.35, 0.35), maxWidth: availW * 0.65 });
    }

    // Page numbers
    if (settings.pageNumberPos !== 'none') {
      const numStr = settings.pageNumberFmt === 'number' ? `${i + 1}`
        : settings.pageNumberFmt === 'page-n' ? `Page ${i + 1}`
        : `Page ${i + 1} of ${total}`;
      const nW = font.widthOfTextAtSize(numStr, 9);
      const nX = settings.pageNumberPos === 'bottom-left' ? ml
        : settings.pageNumberPos === 'bottom-right' ? pageW - mr - nW
        : pageW / 2 - nW / 2;
      page.drawText(numStr, { x: nX, y: mb + 7, font, size: 9, color: rgb(0.4, 0.4, 0.4) });
    }

    // Watermark
    if (settings.watermarkEnabled && settings.watermarkText) {
      const wmText = settings.watermarkText;
      const wmSize = settings.watermarkFontSize;
      const wmAngle = settings.watermarkRotation;
      const wmW = fontBold.widthOfTextAtSize(wmText, wmSize);
      const rad = (wmAngle * Math.PI) / 180;
      let wmX: number, wmY: number;
      if (settings.watermarkPos === 'center') {
        wmX = pageW / 2 - (wmW / 2) * Math.cos(rad) + (wmSize / 2) * Math.sin(rad);
        wmY = pageH / 2 - (wmW / 2) * Math.sin(rad) - (wmSize / 2) * Math.cos(rad);
      } else if (settings.watermarkPos === 'top-left') { wmX = ml + 24; wmY = pageH - mt - 40; }
      else if (settings.watermarkPos === 'top-right') { wmX = pageW - mr - wmW - 24; wmY = pageH - mt - 40; }
      else if (settings.watermarkPos === 'bottom-left') { wmX = ml + 24; wmY = mb + 24; }
      else { wmX = pageW - mr - wmW - 24; wmY = mb + 24; }

      page.drawText(wmText, {
        x: wmX, y: wmY, font: fontBold, size: wmSize,
        color: rgb(0.4, 0.4, 0.4),
        opacity: settings.watermarkOpacity,
        rotate: degrees(wmAngle),
      });
    }
  }

  return pdfDoc.save();
}

export async function processImageItem(item: {
  dataUrl: string; rotation: number; flipH: boolean; flipV: boolean;
  brightness: number; contrast: number; saturation: number;
}): Promise<string> {
  const isDefault = item.rotation === 0 && !item.flipH && !item.flipV
    && item.brightness === 100 && item.contrast === 100 && item.saturation === 100;
  if (isDefault && !item.dataUrl.startsWith('data:image/webp')) return item.dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const rad = (item.rotation * Math.PI) / 180;
      const sin = Math.abs(Math.sin(rad));
      const cos = Math.abs(Math.cos(rad));
      const cw = Math.round(img.width * cos + img.height * sin);
      const ch = Math.round(img.width * sin + img.height * cos);
      const canvas = document.createElement('canvas');
      canvas.width = cw || 1;
      canvas.height = ch || 1;
      const ctx = canvas.getContext('2d')!;
      ctx.save();
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate(rad);
      ctx.scale(item.flipH ? -1 : 1, item.flipV ? -1 : 1);
      ctx.filter = `brightness(${item.brightness / 100}) contrast(${item.contrast / 100}) saturate(${item.saturation / 100})`;
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.src = item.dataUrl;
  });
}
