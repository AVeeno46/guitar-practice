// 곡을 파일로 내보내고 불러오기. 기기 사이에 곡(TAB 포함)을 옮길 때 쓴다.
// 사진·PDF 악보 파일은 크기가 커서 넣지 않는다.

import { normalizeScore } from './tab/score';
import { newId, todayKey, type Song } from './types';
import { clampBpm } from '../metronome/engine';

const FORMAT = 'guitar-practice/song';
const VERSION = 1;

interface SongFile {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  song: Pick<Song, 'title' | 'artist' | 'practiceBpm' | 'targetBpm' | 'memo' | 'tab'>;
}

export function songToFile(song: Song): Blob {
  const data: SongFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    song: {
      title: song.title,
      artist: song.artist,
      practiceBpm: song.practiceBpm,
      targetBpm: song.targetBpm,
      memo: song.memo,
      tab: song.tab ?? null,
    },
  };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

export const songFileName = (song: Song) =>
  `${(song.title || '곡').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60)}.guitar-practice.json`;

/**
 * 폰에서는 공유 시트(카카오톡, 파일 앱, AirDrop 등)로, 안 되면 다운로드로 내보낸다.
 * 공유 창을 사용자가 닫은 경우는 실패로 치지 않는다.
 */
export async function exportSong(song: Song): Promise<'shared' | 'downloaded'> {
  const blob = songToFile(song);
  const name = songFileName(song);
  const file = new File([blob], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try {
      await nav.share({ files: [file], title: song.title });
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

/** 파일 내용을 읽어 새 곡으로 만든다. 형식이 맞지 않으면 이유를 담은 Error */
export async function songFromFile(file: File): Promise<Song> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('곡 파일이 아니에요 (JSON 형식이 아님)');
  }
  const d = data as Partial<SongFile>;
  if (!d || d.format !== FORMAT || !d.song || typeof d.song !== 'object') {
    throw new Error('기타 연습 앱에서 내보낸 곡 파일이 아니에요');
  }
  const src = d.song as Record<string, unknown>;
  const title = String(src.title ?? '').trim() || '불러온 곡';
  const practiceBpm = clampBpm(Number(src.practiceBpm) || 60);
  const target = Number(src.targetBpm);
  const tab = src.tab ? normalizeScore(src.tab) : null;
  const now = Date.now();
  return {
    id: newId(),
    title,
    artist: String(src.artist ?? '').trim(),
    practiceBpm,
    targetBpm: target > 0 ? clampBpm(target) : null,
    memo: String(src.memo ?? '').trim(),
    sheets: [],
    tab,
    bpmLog: [{ date: todayKey(), bpm: practiceBpm }],
    createdAt: now,
    updatedAt: now,
  };
}
