'use client';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const MARGIN_TOP = 24;
const MARGIN_BOTTOM = 24;
const JPEG_QUALITY = 0.92;

export async function generateReportPdf(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const usableHeight = pageHeight - MARGIN_TOP - MARGIN_BOTTOM;

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight <= usableHeight) {
    pdf.addImage(
      canvas.toDataURL('image/jpeg', JPEG_QUALITY),
      'JPEG',
      0,
      MARGIN_TOP,
      imgWidth,
      imgHeight,
      undefined,
      'FAST',
    );
    pdf.save(filename);
    return;
  }

  const sliceHeightPx = (usableHeight * canvas.width) / pageWidth;
  const elementRect = element.getBoundingClientRect();
  const scaleY = canvas.height / element.scrollHeight;
  const blockBottoms: number[] = [];
  for (const el of element.querySelectorAll<HTMLElement>('[data-pdf-block]')) {
    const r = el.getBoundingClientRect();
    blockBottoms.push((r.bottom - elementRect.top) * scaleY);
  }
  blockBottoms.push(canvas.height);
  blockBottoms.sort((a, b) => a - b);

  let pageStart = 0;
  let pageIndex = 0;
  while (pageStart < canvas.height) {
    const pageLimit = pageStart + sliceHeightPx;
    let pageEnd: number;
    if (pageLimit >= canvas.height) {
      pageEnd = canvas.height;
    } else {
      let largestFitting = 0;
      for (const b of blockBottoms) {
        if (b > pageStart && b <= pageLimit && b > largestFitting) largestFitting = b;
      }
      // ブロック境界が見つからない (= 単一ブロックがページ高を超える) 場合だけ pixel-cut にフォールバック
      pageEnd = largestFitting > 0 ? largestFitting : pageLimit;
    }

    const h = pageEnd - pageStart;
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = h;
    const sctx = sliceCanvas.getContext('2d');
    if (!sctx) break;
    sctx.fillStyle = '#ffffff';
    sctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    sctx.drawImage(canvas, 0, -pageStart);
    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(
      sliceCanvas.toDataURL('image/jpeg', JPEG_QUALITY),
      'JPEG',
      0,
      MARGIN_TOP,
      imgWidth,
      (h * imgWidth) / canvas.width,
      undefined,
      'FAST',
    );

    pageStart = pageEnd;
    pageIndex += 1;
  }

  pdf.save(filename);
}
