// 악보 파일 준비(사진 축소)와 PDF 렌더링.

import { newId, type SheetMeta } from './types';

const MAX_IMAGE_SIDE = 2400;
const SMALL_IMAGE_BYTES = 1.5 * 1024 * 1024;

export const isPdf = (file: File) =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

/**
 * 고른 파일을 저장할 형태로 바꾼다.
 * 폰 카메라 사진은 수 MB라서 긴 변 2400px JPEG로 줄여 저장 공간을 아낀다.
 */
export async function prepareSheet(file: File): Promise<{ meta: SheetMeta; blob: Blob }> {
  const base = { id: newId(), name: file.name || '악보' };
  if (isPdf(file)) return { meta: { ...base, kind: 'pdf' }, blob: file };
  if (!file.type.startsWith('image/')) {
    throw new Error(`${file.name}: 사진이나 PDF만 넣을 수 있어요`);
  }
  return { meta: { ...base, kind: 'image' }, blob: await shrinkImage(file) };
}

async function shrinkImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // 디코딩 못 하는 형식이면 원본 그대로
  }
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= SMALL_IMAGE_BYTES) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; // 투명 PNG가 검게 나오지 않게
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
  return blob && blob.size < file.size ? blob : file;
}

type PdfJs = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfJs> | null = null;

/** pdf.js는 크기가 커서 PDF 악보를 처음 열 때만 불러온다. */
function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfjsPromise;
}

/**
 * PDF의 모든 쪽을 container 안에 캔버스로 그린다.
 * 폰 브라우저(특히 iOS)는 PDF를 iframe으로 잘 보여주지 못해서 직접 렌더링한다.
 * signal이 취소되면 그리기를 멈춘다.
 */
export async function renderPdf(blob: Blob, container: HTMLElement, signal: AbortSignal) {
  const pdfjs = await loadPdfJs();
  if (signal.aborted) return;
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  try {
    const doc = await task.promise;
    const cssWidth = Math.max(320, container.clientWidth);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    for (let n = 1; n <= doc.numPages; n++) {
      if (signal.aborted) return;
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
      const canvas = document.createElement('canvas');
      canvas.className = 'sheet-page';
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.setAttribute('aria-label', `${n}쪽`);
      container.appendChild(canvas);
      await page.render({ canvas, viewport }).promise;
      page.cleanup();
    }
  } finally {
    task.destroy().catch(() => {});
  }
}
