import { useEffect, useState } from 'react';
import { listSessions, saveSession } from './db';
import { formatClock, formatDuration, loadGoals } from './format';
import { usePractice } from './hooks';
import { practiceSaveFailed, startPractice, stopPractice } from './tracker';
import type { PracticeSession } from './types';
import { todayKey } from '../songs/types';
import './practice.css';

/** 화면 위에 늘 보이는 연습 시작 버튼 / 연습 중 타이머 */
export default function PracticeBar() {
  const practice = usePractice();
  const [ended, setEnded] = useState<{ session: PracticeSession | null } | null>(null);

  const stop = async () => setEnded({ session: await stopPractice() });

  return (
    <>
      {practice.running ? (
        <div className="practice-pill" role="status" aria-live="off">
          <span className="practice-dot" aria-hidden />
          <span className="practice-time" aria-label="연습 시간">
            {formatClock(practice.seconds)}
          </span>
          {practice.auto && <span className="practice-auto">자동</span>}
          <button className="practice-stop" onClick={stop}>
            종료
          </button>
        </div>
      ) : (
        <button className="practice-start" onClick={() => startPractice()}>
          <span className="practice-dot idle" aria-hidden />
          연습 시작
        </button>
      )}
      {ended && <SessionSummary session={ended.session} onClose={() => setEnded(null)} />}
    </>
  );
}

function SessionSummary({ session, onClose }: { session: PracticeSession | null; onClose: () => void }) {
  const [memo, setMemo] = useState('');
  const [todaySeconds, setTodaySeconds] = useState<number | null>(null);
  const [goals] = useState(loadGoals);
  const failed = practiceSaveFailed();

  useEffect(() => {
    if (!session) return;
    const today = todayKey();
    listSessions()
      .then((all) => setTodaySeconds(all.filter((s) => s.date === today).reduce((t, s) => t + s.seconds, 0)))
      .catch(() => {});
  }, [session]);

  const close = async () => {
    if (session && memo.trim()) await saveSession({ ...session, memo: memo.trim() }).catch(() => {});
    onClose();
  };

  const todayMin = todaySeconds === null ? null : Math.floor(todaySeconds / 60);

  return (
    <div className="sheet-backdrop" onClick={close}>
      <div className="sheet-panel" role="dialog" aria-label="연습 종료" onClick={(e) => e.stopPropagation()}>
        {!session ? (
          <>
            <h2>1분이 안 돼서 기록하지 않았어요</h2>
            <button className="sheet-primary" onClick={onClose}>
              확인
            </button>
          </>
        ) : (
          <>
            <h2>{formatDuration(session.seconds)} 연습했어요</h2>
            {failed && <p className="form-error">기기에 저장하지 못했어요. 저장 공간을 확인해 주세요.</p>}
            {todayMin !== null && (
              <p className="sheet-sub">
                오늘 총 {todayMin}분 ·{' '}
                {todayMin >= goals.targetMinutes
                  ? `목표 ${goals.targetMinutes}분 달성!`
                  : todayMin >= goals.minMinutes
                    ? `최소 목표 달성, 목표까지 ${goals.targetMinutes - todayMin}분`
                    : `최소 목표까지 ${goals.minMinutes - todayMin}분`}
              </p>
            )}
            <ul className="session-items">
              {session.items.map((i) => (
                <li key={i.key}>
                  <span className="session-item-label">{i.label}</span>
                  <span className="session-item-meta">
                    {formatDuration(i.seconds)}
                    {i.bpmEnd !== undefined &&
                      (i.bpmStart !== i.bpmEnd ? ` · ${i.bpmStart}→${i.bpmEnd} BPM` : ` · ${i.bpmEnd} BPM`)}
                  </span>
                </li>
              ))}
            </ul>
            <label className="field">
              <span>메모 (선택)</span>
              <textarea
                rows={2}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 벤딩 음정이 불안했음"
              />
            </label>
            <button className="sheet-primary" onClick={close}>
              {memo.trim() ? '메모 저장' : '확인'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
