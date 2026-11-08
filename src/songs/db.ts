// 곡과 악보 파일을 기기 안의 IndexedDB에 저장한다.
// 악보 사진·PDF는 localStorage에 담기엔 커서 Blob 그대로 별도 저장소에 둔다.

import { done, openDb, request, STORES } from '../db';
import type { SheetMeta, Song } from './types';

const SONGS = STORES.songs;
const SHEETS = STORES.sheets;

export async function listSongs(): Promise<Song[]> {
  const db = await openDb();
  const songs = await request(db.transaction(SONGS).objectStore(SONGS).getAll() as IDBRequest<Song[]>);
  return songs.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getSheet(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  return request(db.transaction(SHEETS).objectStore(SHEETS).get(id) as IDBRequest<Blob | undefined>);
}

/**
 * 곡 정보와 악보 파일 변경을 한 번에 저장한다.
 * 중간에 실패하면 아무것도 바뀌지 않는다.
 */
export async function saveSong(
  song: Song,
  added: { meta: SheetMeta; blob: Blob }[] = [],
  removedSheetIds: string[] = [],
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([SONGS, SHEETS], 'readwrite');
  const sheets = tx.objectStore(SHEETS);
  for (const { meta, blob } of added) sheets.put(blob, meta.id);
  for (const id of removedSheetIds) sheets.delete(id);
  tx.objectStore(SONGS).put(song);
  await done(tx);
}

export async function deleteSong(song: Song): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([SONGS, SHEETS], 'readwrite');
  const sheets = tx.objectStore(SHEETS);
  for (const s of song.sheets) sheets.delete(s.id);
  tx.objectStore(SONGS).delete(song.id);
  await done(tx);
}

/** 브라우저가 저장 공간이 부족할 때 데이터를 지우지 않도록 요청한다. */
export function requestPersistentStorage() {
  navigator.storage?.persisted?.().then((ok) => {
    if (!ok) navigator.storage.persist?.().catch(() => {});
  }).catch(() => {});
}
