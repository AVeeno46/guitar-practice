import { useState, type FormEvent } from 'react';
import { BPM_MAX, BPM_MIN, clampBpm } from '../metronome/engine';
import { deleteSong, saveSong } from './db';
import { prepareSheet } from './sheetFiles';
import { newId, todayKey, withPracticeBpm, type SheetMeta, type Song } from './types';

interface Props {
  song?: Song;
  onCancel: () => void;
  onSaved: (song: Song) => void;
  onDeleted: (id: string) => void;
}

/** 편집 중인 악보 항목. 새로 고른 파일은 저장 전까지 blob을 들고 있는다. */
interface DraftSheet {
  meta: SheetMeta;
  blob?: Blob;
}

const parseBpm = (text: string): number | null => {
  const n = Number(text);
  return text.trim() && Number.isFinite(n) && n > 0 ? clampBpm(n) : null;
};

export default function SongEditor({ song, onCancel, onSaved, onDeleted }: Props) {
  const [title, setTitle] = useState(song?.title ?? '');
  const [artist, setArtist] = useState(song?.artist ?? '');
  const [practice, setPractice] = useState(String(song?.practiceBpm ?? 60));
  const [target, setTarget] = useState(song?.targetBpm ? String(song.targetBpm) : '');
  const [memo, setMemo] = useState(song?.memo ?? '');
  const [sheets, setSheets] = useState<DraftSheet[]>(() => (song?.sheets ?? []).map((meta) => ({ meta })));
  const [adding, setAdding] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    setError(null);
    setAdding((n) => n + list.length);
    for (const file of list) {
      try {
        const prepared = await prepareSheet(file);
        setSheets((s) => [...s, prepared]);
      } catch (e) {
        setError(e instanceof Error ? e.message : `${file.name}을 추가하지 못했어요`);
      } finally {
        setAdding((n) => n - 1);
      }
    }
  };

  const move = (index: number, delta: number) =>
    setSheets((s) => {
      const next = [...s];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const practiceBpm = parseBpm(practice);
    const targetBpm = target.trim() ? parseBpm(target) : null;
    if (!title.trim()) return setError('곡 제목을 입력해 주세요');
    if (practiceBpm === null) return setError(`연습 BPM은 ${BPM_MIN}~${BPM_MAX} 사이 숫자로 입력해 주세요`);
    if (target.trim() && targetBpm === null) return setError('목표 BPM이 올바르지 않아요');

    const now = Date.now();
    let next: Song = {
      id: song?.id ?? newId(),
      title: title.trim(),
      artist: artist.trim(),
      practiceBpm: song?.practiceBpm ?? practiceBpm,
      targetBpm,
      memo: memo.trim(),
      sheets: sheets.map((s) => s.meta),
      tab: song?.tab ?? null, // 편집 폼에 없는 TAB 악보는 그대로 둔다
      bpmLog: song?.bpmLog ?? [{ date: todayKey(), bpm: practiceBpm }],
      createdAt: song?.createdAt ?? now,
      updatedAt: now,
    };
    if (song && practiceBpm !== song.practiceBpm) next = withPracticeBpm(next, practiceBpm);

    const added = sheets.filter((s): s is Required<DraftSheet> => !!s.blob);
    const kept = new Set(sheets.map((s) => s.meta.id));
    const removed = (song?.sheets ?? []).filter((s) => !kept.has(s.id)).map((s) => s.id);

    setSaving(true);
    setError(null);
    try {
      await saveSong(next, added, removed);
      onSaved(next);
    } catch {
      setError('저장하지 못했어요. 기기 저장 공간이 부족할 수 있어요.');
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!song) return;
    if (!confirmDelete) return setConfirmDelete(true);
    try {
      await deleteSong(song);
      onDeleted(song.id);
    } catch {
      setError('삭제하지 못했어요.');
    }
  };

  return (
    <form className="song-editor" onSubmit={submit} noValidate>
      <div className="detail-bar">
        <button type="button" className="link-button" onClick={onCancel}>
          취소
        </button>
        <span className="detail-bar-title">{song ? '곡 편집' : '새 곡'}</span>
        <button type="submit" className="link-button strong" disabled={saving || adding > 0}>
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>

      <label className="field">
        <span>제목</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: Blackbird" autoFocus={!song} />
      </label>
      <label className="field">
        <span>아티스트 (선택)</span>
        <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="예: The Beatles" />
      </label>
      <div className="field-row">
        <label className="field">
          <span>지금 연습 BPM</span>
          <input type="number" inputMode="numeric" min={BPM_MIN} max={BPM_MAX} value={practice} onChange={(e) => setPractice(e.target.value)} />
        </label>
        <label className="field">
          <span>목표 BPM (선택)</span>
          <input type="number" inputMode="numeric" min={BPM_MIN} max={BPM_MAX} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="원곡 템포" />
        </label>
      </div>
      <label className="field">
        <span>메모 (선택)</span>
        <textarea rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="카포 위치, 어려운 구간, 튜닝 등" />
      </label>

      <div className="field">
        <span>악보</span>
        {sheets.length > 0 && (
          <ul className="draft-sheets">
            {sheets.map((s, i) => (
              <li key={s.meta.id}>
                <span className="draft-kind">{s.meta.kind === 'pdf' ? 'PDF' : '사진'}</span>
                <span className="draft-name">{s.meta.name}</span>
                <button type="button" className="icon-button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="위로">
                  ↑
                </button>
                <button type="button" className="icon-button" disabled={i === sheets.length - 1} onClick={() => move(i, 1)} aria-label="아래로">
                  ↓
                </button>
                <button type="button" className="icon-button" onClick={() => setSheets((list) => list.filter((x) => x !== s))} aria-label="빼기">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="sheet-buttons">
          <label className="file-button">
            사진 찍기
            <input type="file" accept="image/*" capture="environment" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </label>
          <label className="file-button">
            파일 고르기
            <input type="file" accept="image/*,application/pdf,.pdf" multiple onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </label>
        </div>
        {adding > 0 && <p className="detail-note">악보 준비 중…</p>}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {song && (
        <button type="button" className={`delete-button ${confirmDelete ? 'armed' : ''}`} onClick={remove}>
          {confirmDelete ? '한 번 더 누르면 곡과 악보가 삭제돼요' : '곡 삭제'}
        </button>
      )}
    </form>
  );
}
