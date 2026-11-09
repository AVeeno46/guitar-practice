/**
 * 파일을 폰에서는 공유 시트(카카오톡, 파일 앱, AirDrop 등)로, 안 되면 다운로드로 내보낸다.
 * 공유 창을 사용자가 닫은 경우는 실패로 치지 않는다.
 */
export async function shareOrDownload(blob: Blob, name: string, title: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'shared';
      // 공유가 막혀 있으면 다운로드로
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
