import { useEffect, useRef, useState } from 'react';
import { getSheet } from './db';
import { renderPdf } from './sheetFiles';
import type { SheetMeta } from './types';

type Status = 'loading' | 'ready' | 'error';

/**
 * 저장된 악보 한 개(사진 또는 PDF 전체 쪽)를 화면 너비에 맞춰 보여준다.
 * 부모에서 sheet.id를 key로 주므로 악보가 바뀌면 새로 마운트된다.
 */
export default function SheetView({ sheet }: { sheet: SheetMeta }) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    const ctrl = new AbortController();
    const pdfBox = pdfRef.current;
    let url: string | null = null;

    getSheet(sheet.id)
      .then(async (blob) => {
        if (!blob) throw new Error('missing');
        if (ctrl.signal.aborted) return;
        if (sheet.kind === 'image') {
          url = URL.createObjectURL(blob);
          setImageUrl(url);
        } else if (pdfBox) {
          pdfBox.replaceChildren();
          await renderPdf(blob, pdfBox, ctrl.signal);
        }
        if (!ctrl.signal.aborted) setStatus('ready');
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setStatus('error');
      });

    return () => {
      ctrl.abort();
      if (url) URL.revokeObjectURL(url);
      pdfBox?.replaceChildren();
    };
  }, [sheet.id, sheet.kind]);

  return (
    <figure className="sheet">
      {sheet.kind === 'image' && imageUrl && (
        <img className="sheet-page" src={imageUrl} alt={sheet.name} />
      )}
      {sheet.kind === 'pdf' && <div ref={pdfRef} className="sheet-pdf" />}
      {status === 'loading' && <p className="sheet-status">악보 불러오는 중…</p>}
      {status === 'error' && <p className="sheet-status">이 악보를 열지 못했어요 ({sheet.name})</p>}
    </figure>
  );
}
