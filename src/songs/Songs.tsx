import { useEffect, useState } from 'react';
import { listSongs, requestPersistentStorage, saveSong } from './db';
import { songFromFile } from './songFile';
import { progressOf, type Song } from './types';
import SongDetail from './SongDetail';
import SongEditor from './SongEditor';
import './songs.css';

type View =
  | { kind: 'list' }
  | { kind: 'detail'; id: string }
  | { kind: 'edit'; id: string | null };

export default function Songs() {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [importError, setImportError] = useState<string | null>(null);

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    try {
      const song = await songFromFile(file);
      await saveSong(song);
      setSongs((list) => [song, ...(list ?? [])]);
      setView({ kind: 'detail', id: song.id });
    } catch (e) {
      setImportError(e instanceof Error ? e.message : '곡 파일을 불러오지 못했어요');
    }
  };

  useEffect(() => {
    requestPersistentStorage();
    listSongs()
      .then(setSongs)
      .catch(() => setLoadError(true));
  }, []);

  // 화면이 바뀌면 맨 위부터 보이게
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view.kind]);

  const upsert = (song: Song) =>
    setSongs((list) => [song, ...(list ?? []).filter((s) => s.id !== song.id)]);

  const remove = (id: string) => setSongs((list) => (list ?? []).filter((s) => s.id !== id));

  if (loadError) {
    return (
      <p className="songs-empty">
        곡 목록을 불러오지 못했어요. 브라우저의 비공개(시크릿) 모드에서는 저장 공간을 쓸 수 없을 수 있어요.
      </p>
    );
  }
  if (!songs) return null;

  const find = (id: string) => songs.find((s) => s.id === id);

  if (view.kind === 'edit') {
    const song = view.id ? find(view.id) : undefined;
    return (
      <SongEditor
        song={song}
        onCancel={() => setView(song ? { kind: 'detail', id: song.id } : { kind: 'list' })}
        onSaved={(saved) => {
          upsert(saved);
          setView({ kind: 'detail', id: saved.id });
        }}
        onDeleted={(id) => {
          remove(id);
          setView({ kind: 'list' });
        }}
      />
    );
  }

  if (view.kind === 'detail') {
    const song = find(view.id);
    if (song) {
      return (
        <SongDetail
          song={song}
          onBack={() => setView({ kind: 'list' })}
          onEdit={() => setView({ kind: 'edit', id: song.id })}
          onChange={upsert}
        />
      );
    }
  }

  return (
    <section className="songs">
      <button className="song-add" onClick={() => setView({ kind: 'edit', id: null })}>
        + 곡 추가
      </button>
      <label className="song-import">
        곡 파일 불러오기
        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            void importFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      {importError && (
        <p className="form-error" role="alert">
          {importError}
        </p>
      )}

      {songs.length === 0 ? (
        <p className="songs-empty">
          연습할 곡을 추가해 보세요. 악보 사진이나 PDF와 함께 지금 치는 BPM, 목표 BPM을 저장할 수 있어요.
        </p>
      ) : (
        <ul className="song-list">
          {songs.map((song) => {
            const progress = progressOf(song);
            return (
              <li key={song.id}>
                <button className="song-card" onClick={() => setView({ kind: 'detail', id: song.id })}>
                  <span className="song-card-head">
                    <span className="song-card-title">{song.title}</span>
                    {song.artist && <span className="song-card-artist">{song.artist}</span>}
                  </span>
                  <span className="song-card-bpm">
                    <strong>{song.practiceBpm}</strong>
                    {song.targetBpm ? ` / ${song.targetBpm}` : ''} BPM
                    {song.tab && <span className="song-card-sheets">TAB</span>}
                    {song.sheets.length > 0 && <span className="song-card-sheets">악보 {song.sheets.length}</span>}
                  </span>
                  {progress !== null && (
                    <span className="progress" aria-hidden>
                      <span
                        className={`progress-fill ${progress >= 1 ? 'done' : ''}`}
                        style={{ width: `${progress * 100}%` }}
                      />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
