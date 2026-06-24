import { PDFDocument, degrees } from 'pdf-lib';

export async function imagesToPdf(images: { dataUrl: string; rotation: number }[], options: {
  pageSize: 'A4' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  margin: number; // in points
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const pageSizes = {
    A4: [595.28, 841.89],
    Letter: [612, 792],
    Legal: [612, 1008],
  };
  const [w, h] = pageSizes[options.pageSize];
  const [pageW, pageH] = options.orientation === 'landscape' ? [h, w] : [w, h];

  for (const img of images) {
    const isJpeg = img.dataUrl.startsWith('data:image/jpeg') || img.dataUrl.startsWith('data:image/jpg');
    let dataUrlToUse = img.dataUrl;

    if (img.dataUrl.startsWith('data:image/webp')) {
      dataUrlToUse = await convertWebpToPngDataUrl(img.dataUrl);
    }

    const isNowJpeg = dataUrlToUse.startsWith('data:image/jpeg') || dataUrlToUse.startsWith('data:image/jpg');
    const base64 = dataUrlToUse.split(',')[1];
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    
    const embedded = isNowJpeg
      ? await pdfDoc.embedJpg(bytes)
      : await pdfDoc.embedPng(bytes);

    const page = pdfDoc.addPage([pageW, pageH]);
    const m = options.margin;
    const availW = pageW - 2 * m;
    const availH = pageH - 2 * m;
    const scale = Math.min(availW / embedded.width, availH / embedded.height);
    const imgW = embedded.width * scale;
    const imgH = embedded.height * scale;
    const x = m + (availW - imgW) / 2;
    const y = m + (availH - imgH) / 2;

    page.drawImage(embedded, { x, y, width: imgW, height: imgH, rotate: degrees(img.rotation) });
  }

  return pdfDoc.save();
}

export async function convertWebpToPngDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
}
