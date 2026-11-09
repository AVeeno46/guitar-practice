import { useState } from 'react';
import { exportBackup, lastBackupAt, restoreBackup } from '../backup';

const STALE_DAYS = 14;

function formatAgo(ms: number, now: number): string {
  const days = Math.floor((now - ms) / 86_400_000);
  const d = new Date(ms);
  const date = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  if (days <= 0) return `오늘 (${date})`;
  return `${days}일 전 (${date})`;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'exported'; text: string }
  | { kind: 'restored'; text: string };

/** 기록 탭 맨 아래: 데이터 전체를 파일로 내보내고 되살리기 */
export default function BackupBlock() {
  const [last, setLast] = useState(lastBackupAt);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  // 화면을 연 시각 기준으로 '며칠 전'을 계산한다
  const [now, setNow] = useState(() => Date.now());
  const busy = status.kind === 'busy';
  const stale = last === null || now - last > STALE_DAYS * 86_400_000;

  const doExport = async () => {
    setStatus({ kind: 'busy', text: '백업 파일을 만드는 중…' });
    try {
      const s = await exportBackup();
      setLast(lastBackupAt());
      setNow(Date.now());
      setStatus({
        kind: 'exported',
        text: `곡 ${s.songs}개 · 악보 파일 ${s.sheets}개 · 연습 기록 ${s.sessions}개를 담았어요. 파일 앱이나 클라우드에 보관해 두세요.`,
      });
    } catch {
      setStatus({ kind: 'error', text: '백업 파일을 만들지 못했어요' });
    }
  };

  const doRestore = async (file: File | undefined) => {
    if (!file) return;
    setStatus({ kind: 'busy', text: '백업을 불러오는 중…' });
    try {
      const r = await restoreBackup(file);
      const parts = [
        r.songsAdded && `새 곡 ${r.songsAdded}개`,
        r.songsUpdated && `바뀐 곡 ${r.songsUpdated}개`,
        r.sessionsAdded && `연습 기록 ${r.sessionsAdded}개`,
      ].filter(Boolean);
      setStatus({
        kind: 'restored',
        text: parts.length ? `${parts.join(', ')}를 가져왔어요.` : '새로 가져올 곡이나 기록은 없었어요. 설정은 백업 값으로 맞췄어요.',
      });
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof Error ? e.message : '백업을 불러오지 못했어요' });
    }
  };

  return (
    <div className="log-block backup-block">
      <h3>데이터 백업</h3>
      <p className="backup-desc">
        곡·악보·연습 기록·설정은 이 기기 안에만 저장돼요. 브라우저 데이터를 지우거나 기기를 바꾸기 전에 파일로 백업해 두세요.
      </p>
      <p className={`backup-last ${stale ? 'stale' : ''}`}>
        마지막 백업: {last ? formatAgo(last, now) : '아직 없음'}
      </p>
      <div className="backup-actions">
        <button className="backup-button primary" onClick={() => void doExport()} disabled={busy}>
          백업 파일 만들기
        </button>
        <label className={`backup-button ${busy ? 'disabled' : ''}`}>
          백업에서 복원
          <input
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={(e) => {
              void doRestore(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <p className="backup-hint">복원은 지금 데이터를 지우지 않고 합쳐요. 같은 곡은 더 최근에 고친 쪽이 남아요.</p>
      {status.kind !== 'idle' && (
        <p className={`backup-status ${status.kind}`} role={status.kind === 'error' ? 'alert' : 'status'}>
          {status.text}
          {status.kind === 'restored' && (
            <>
              {' '}
              <button className="link-button inline" onClick={() => location.reload()}>
                새로고침해서 적용
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
