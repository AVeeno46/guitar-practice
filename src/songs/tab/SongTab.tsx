import { useEffect, useRef, useState } from 'react';
import { pluck } from '../../scales/pluck';
import {
  MAX_FRET,
  RHYTHM_LABEL,
  STRING_NAMES,
  barCount,
  createScore,
  deleteBar,
  duplicateBar,
  insertBar,
  midiOf,
  perBar,
  reshape,
  restCovering,
  setCell,
  setFret,
  setTempoMark,
  toggleFlag,
  togglePalmMute,
  toggleRest,
  type NoteFlag,
  type NotesPerBeat,
  type TabScore,
} from './score';
import TabStaff, { type Cell } from './TabStaff';
import type { LoopRange, PlayOptions } from './useTabPlayer';
import { SPEED_STEP } from './useTabPlayer';
import './tab.css';

interface Props {
  score: TabScore | null;
  onScoreChange: (score: TabScore | null) => void;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  loop: LoopRange | null;
  onLoopChange: (loop: LoopRange | null) => void;
  options: PlayOptions;
  onOptionsChange: (o: PlayOptions) => void;
  player: { running: boolean; cursor: number; countIn: number; pass: number; scale: number };
  targetBpm: number | null;
  practiceBpm: number;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

const BEAT_CHOICES = [2, 3, 4, 5, 6, 7];
const RHYTHM_CHOICES: NotesPerBeat[] = [1, 2, 3, 4];
const TWO_DIGIT_MS = 1500;
/** PC 단축키: X 뮤트, T 이음, H 해머링/풀링, S 슬라이드, B 벤딩, M 팜뮤트, R 쉼표 */
const TECH_KEYS: Record<string, NoteFlag | 'pm' | 'rest'> = {
  x: 'dead',
  t: 'tie',
  h: 'legato',
  s: 'slide',
  b: 'bend',
  m: 'pm',
  r: 'rest',
};
const AUTO_ADVANCE_WAIT_MS = 900;

export default function SongTab(props: Props) {
  const { score, editing } = props;
  if (!score) return <CreateTab onCreate={(s) => {
    props.onScoreChange(s);
    props.onEditingChange(true);
  }} />;
  return editing ? <TabEditor {...props} score={score} /> : <TabPractice {...props} score={score} />;
}

// ---------- 처음 만들기 ----------

function CreateTab({ onCreate }: { onCreate: (s: TabScore) => void }) {
  const [beats, setBeats] = useState(4);
  const [rhythm, setRhythm] = useState<NotesPerBeat>(2);
  return (
    <div className="tab-create">
      <h3>TAB 악보 만들기</h3>
      <p className="muted">줄과 프렛 숫자로 악보를 적고, 메트로놈에 맞춰 따라 치거나 소리로 들어볼 수 있어요.</p>
      <div className="tab-option-row">
        <span className="scale-row-title">박자</span>
        <div className="scale-chips">
          {[3, 4, 6].map((b) => (
            <button key={b} className={`scale-chip wide ${beats === b ? 'selected' : ''}`} onClick={() => setBeats(b)}>
              {b}/4
            </button>
          ))}
        </div>
      </div>
      <div className="tab-option-row">
        <span className="scale-row-title">가장 짧은 음</span>
        <div className="scale-chips">
          {([2, 4] as NotesPerBeat[]).map((r) => (
            <button key={r} className={`scale-chip wide ${rhythm === r ? 'selected' : ''}`} onClick={() => setRhythm(r)}>
              {RHYTHM_LABEL[r]}
            </button>
          ))}
        </div>
      </div>
      <p className="tab-help">나중에 편집 화면의 ‘박자·리듬’에서 바꿀 수 있어요.</p>
      <button className="sheet-primary" onClick={() => onCreate(createScore(beats, rhythm, 4))}>
        만들기
      </button>
    </div>
  );
}

// ---------- 연습(보기) ----------

function TabPractice({
  score,
  onEditingChange,
  loop,
  onLoopChange,
  options,
  onOptionsChange,
  player,
  targetBpm,
  practiceBpm,
  zoom,
  onZoomChange,
}: Props & { score: TabScore }) {
  const tapBar = (bar: number) => {
    if (!loop || loop.from !== loop.to) onLoopChange({ from: bar, to: bar });
    else if (bar === loop.from) onLoopChange(null);
    else onLoopChange({ from: Math.min(bar, loop.from), to: Math.max(bar, loop.from) });
  };
  const toggle = (k: keyof PlayOptions) => onOptionsChange({ ...options, [k]: !options[k] });

  const loopLabel = loop
    ? loop.from === loop.to
      ? `${loop.from + 1}마디 반복`
      : `${loop.from + 1}~${loop.to + 1}마디 반복`
    : null;

  return (
    <div className="tab-section">
      <div className="tab-toolbar">
        <h3>TAB 악보</h3>
        <ZoomControl zoom={zoom} onChange={onZoomChange} />
        <button className="link-button" onClick={() => onEditingChange(true)}>
          ✎ 편집
        </button>
      </div>

      <div className="tab-options">
        <button className={`scale-chip wide toggle ${options.sound ? 'on' : ''}`} onClick={() => toggle('sound')} aria-pressed={options.sound}>
          ♪ 음 소리
        </button>
        <div className="click-choice" role="group" aria-label="메트로놈 클릭">
          <span>클릭</span>
          {[0, ...clickChoices(score.notesPerBeat)].map((n) => {
            const on = n === 0 ? !options.click : options.click && (options.clicks ?? 1) === n;
            return (
              <button
                key={n}
                className={`scale-chip ${on ? 'selected' : ''}`}
                onClick={() => onOptionsChange({ ...options, click: n !== 0, clicks: n || options.clicks })}
                aria-pressed={on}
                aria-label={n === 0 ? '클릭 끄기' : `한 박에 클릭 ${n}번`}
              >
                {n === 0 ? '끔' : n}
              </button>
            );
          })}
        </div>
        <button className={`scale-chip wide toggle ${options.speedUp ? 'on' : ''}`} onClick={() => toggle('speedUp')} aria-pressed={options.speedUp}>
          반복마다 +{SPEED_STEP} BPM
        </button>
      </div>

      <div className="drill-status" aria-live="polite">
        {player.countIn > 0 ? (
          <span className="drill-countin">준비 {player.countIn}</span>
        ) : player.running ? (
          <span className="drill-live">
            ● 따라 치는 중{player.pass > 0 ? ` · ${player.pass + 1}번째` : ''}
            {player.scale !== 1 && (
              <span className="muted"> · 이 구간 {Math.round(practiceBpm * player.scale)} BPM</span>
            )}
          </span>
        ) : (
          <span className="muted">마디 번호를 누르면 그 구간만 반복해요. 두 번째로 누른 마디까지 구간이 넓어져요.</span>
        )}
        {loopLabel && (
          <span className="loop-chip">
            {loopLabel}
            <button onClick={() => onLoopChange(null)} aria-label="구간 반복 해제">
              ✕
            </button>
          </span>
        )}
        {options.speedUp && targetBpm && practiceBpm < targetBpm ? (
          <span className="muted"> · 목표 {targetBpm}까지 올려요</span>
        ) : null}
      </div>

      <TabStaff score={score} editing={false} cursor={player.cursor} selection={null} loop={loop} onBarTap={tapBar} zoom={zoom} />
    </div>
  );
}

// ---------- 편집 ----------

function TabEditor({ score, onScoreChange, onEditingChange, zoom, onZoomChange }: Props & { score: TabScore }) {
  const [sel, setSel] = useState<Cell>({ col: 0, string: 0 });
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const history = useRef<TabScore[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const lastInput = useRef<{ col: number; string: number; time: number } | null>(null);
  const advanceTimer = useRef<number | null>(null);
  const live = useRef({ score, sel });
  useEffect(() => {
    live.current = { score, sel };
  }, [score, sel]);

  const n = perBar(score);
  const selColumn = score.cols[Math.min(sel.col, score.cols.length - 1)];
  const selNote = selColumn.notes[sel.string];
  const inRest = !!restCovering(score, Math.min(sel.col, score.cols.length - 1));
  const [tempoSheet, setTempoSheet] = useState(false);
  const bar = Math.floor(sel.col / n);
  const beat = Math.floor((sel.col % n) / score.notesPerBeat);
  const sub = (sel.col % n) % score.notesPerBeat;

  const commit = (next: TabScore) => {
    history.current.push(live.current.score);
    if (history.current.length > 100) history.current.shift();
    setCanUndo(true);
    live.current.score = next;
    onScoreChange(next);
  };

  const undo = () => {
    const prev = history.current.pop();
    setCanUndo(history.current.length > 0);
    if (!prev) return;
    live.current.score = prev;
    onScoreChange(prev);
    setSel((s) => ({ col: Math.min(s.col, prev.cols.length - 1), string: s.string }));
  };

  const clearAdvance = () => {
    if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
  };

  /** 오른쪽 칸으로. 끝이면 빈 마디를 하나 붙인다 */
  const moveRight = () => {
    clearAdvance();
    lastInput.current = null;
    const { score: s, sel: c } = live.current;
    if (c.col + 1 >= s.cols.length) commit(insertBar(s, barCount(s) - 1));
    const next = { col: c.col + 1, string: c.string };
    live.current.sel = next;
    setSel(next);
  };

  const move = (dCol: number, dString: number) => {
    if (dCol > 0) return moveRight();
    clearAdvance();
    lastInput.current = null;
    setSel((c) => {
      const next = {
        col: Math.max(0, Math.min(live.current.score.cols.length - 1, c.col + dCol)),
        string: Math.max(0, Math.min(5, c.string + dString)),
      };
      live.current.sel = next;
      return next;
    });
  };

  const typeDigit = (d: number) => {
    clearAdvance();
    const { score: s, sel: c } = live.current;
    const curNote = s.cols[c.col].notes[c.string];
    const cur = curNote && !curNote.dead && !curNote.tie ? curNote.fret : null;
    const li = lastInput.current;
    let value = d;
    // 같은 칸에서 1·2 다음에 바로 숫자를 누르면 두 자리 (예: 1, 2 → 12)
    if (li && li.col === c.col && li.string === c.string && Date.now() - li.time < TWO_DIGIT_MS && cur !== null && cur <= 2) {
      const two = cur * 10 + d;
      if (two <= MAX_FRET) value = two;
    }
    commit(setFret(s, c.col, c.string, value));
    pluck(midiOf(c.string, value));
    const canExtend = value <= 2 && value === d;
    lastInput.current = canExtend ? { ...c, time: Date.now() } : null;
    if (autoAdvance) {
      if (canExtend) advanceTimer.current = window.setTimeout(moveRight, AUTO_ADVANCE_WAIT_MS);
      else moveRight();
    }
  };

  const clearCell = () => {
    clearAdvance();
    lastInput.current = null;
    const { score: s, sel: c } = live.current;
    if (s.cols[c.col].notes[c.string] !== null) commit(setCell(s, c.col, c.string, null));
  };

  const flag = (f: NoteFlag) => {
    clearAdvance();
    lastInput.current = null;
    const { score: s, sel: c } = live.current;
    const next = toggleFlag(s, c.col, c.string, f);
    if (next !== s) commit(next);
  };

  const rest = () => {
    clearAdvance();
    lastInput.current = null;
    const { score: s, sel: c } = live.current;
    const next = toggleRest(s, c.col);
    if (next !== s) commit(next);
  };

  const palmMute = () => {
    const { score: s, sel: c } = live.current;
    commit(togglePalmMute(s, c.col));
  };

  const selectCell = (c: Cell) => {
    clearAdvance();
    lastInput.current = null;
    live.current.sel = c;
    setSel(c);
    const f = live.current.score.cols[c.col].notes[c.string];
    if (f && !f.dead) pluck(midiOf(c.string, f.fret));
  };

  useEffect(() => clearAdvance, []);

  // PC 키보드: 숫자, 화살표, Backspace/Delete, Ctrl+Z, Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        typeDigit(Number(e.key));
      } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
        e.preventDefault();
        move(1, 0);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        move(-1, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        move(0, 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        move(0, -1);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        clearCell();
      } else if (!e.ctrlKey && !e.metaKey && TECH_KEYS[e.key.toLowerCase()]) {
        e.preventDefault();
        const k = TECH_KEYS[e.key.toLowerCase()];
        if (k === 'pm') palmMute();
        else if (k === 'rest') rest();
        else flag(k);
      } else if (e.key === 'Escape') {
        onEditingChange(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const barOp = (fn: (s: TabScore, bar: number) => TabScore, nextCol?: (s: TabScore) => number) => {
    const next = fn(live.current.score, bar);
    commit(next);
    const col = Math.min(next.cols.length - 1, nextCol ? nextCol(next) : sel.col);
    setSel({ col, string: sel.string });
  };

  return (
    <div className="tab-section editing">
      <div className="tab-toolbar">
        <h3>TAB 편집</h3>
        <ZoomControl zoom={zoom} onChange={onZoomChange} />
        <button className="link-button strong" onClick={() => onEditingChange(false)}>
          완료
        </button>
      </div>

      <div className="tab-barops">
        <span className="tab-selinfo">
          {bar + 1}마디 · {beat + 1}박{score.notesPerBeat > 1 ? `-${sub + 1}` : ''} · {STRING_NAMES[sel.string]}줄
        </span>
        <button className="scale-chip" onClick={() => barOp((s, b) => insertBar(s, b), () => (bar + 1) * n)}>
          + 마디
        </button>
        <button className="scale-chip" onClick={() => barOp((s, b) => duplicateBar(s, b), () => (bar + 1) * n + (sel.col % n))}>
          마디 복제
        </button>
        <button className="scale-chip" onClick={() => barOp((s, b) => deleteBar(s, b), (s) => Math.min(sel.col, s.cols.length - 1))}>
          마디 삭제
        </button>
        <button className="scale-chip" onClick={() => setTempoSheet(true)}>
          템포 변경
        </button>
        <button className="scale-chip" onClick={() => setShowSettings(true)}>
          박자·리듬
        </button>
      </div>

      <TabStaff score={score} editing cursor={-1} selection={sel} loop={null} onCellTap={selectCell} zoom={zoom} />

      <p className="tab-help">
        칸을 누르고 숫자를 입력해요. 같은 칸에서 1·2 다음 숫자를 바로 누르면 두 자리(예: 12). 한 칸에 여러 줄을 적으면 동시에 치는 음(코드)이에요.
        h/p·슬라이드는 다음 음까지 이어지는 표시라 앞 음에 붙여요. 슬라이드를 한 번 더 누르면 슬라이드 아웃(친 뒤 내려가며 소리 빼기). (이음)은 앞 음을 다시 치지 않고 계속 울리는 칸이에요.
        쉼표는 빈 칸에서 누르면 다음 음 전까지 채워져요.
      </p>

      {/* 아래에 붙어 있는 입력 패드 */}
      <div className="tab-pad" role="group" aria-label="TAB 입력 패드">
        <div className="pad-grid tech">
          {(
            [
              ['dead', 'X', '뮤트음'],
              ['tie', '(이음)', '앞 음 이어서 울림'],
              ['legato', 'h/p', '해머링·풀링'],
              ['slide', '슬라이드', '슬라이드'],
              ['bend', '벤딩', '벤딩'],
            ] as const
          ).map(([f, text, aria]) => {
            const on = !!selNote?.[f] || (f === 'slide' && !!selNote?.slideOut);
            return (
              <button key={f} className={`pad-key tech ${on ? 'on' : ''}`} onClick={() => flag(f)} aria-label={aria} aria-pressed={on}>
                {f === 'slide' && selNote?.slideOut ? '슬라이드 아웃' : text}
              </button>
            );
          })}
          <button className={`pad-key tech ${selColumn.pm ? 'on' : ''}`} onClick={palmMute} aria-label="팜뮤트" aria-pressed={!!selColumn.pm}>
            P.M.
          </button>
          <button className={`pad-key tech ${inRest ? 'on' : ''}`} onClick={rest} aria-label="쉼표" aria-pressed={inRest}>
            쉼표
          </button>
        </div>
        <div className="pad-grid">
          {[1, 2, 3, 4, 5].map((d) => (
            <button key={d} className="pad-key" onClick={() => typeDigit(d)}>
              {d}
            </button>
          ))}
          <button className="pad-key action" onClick={clearCell} aria-label="지우기">
            ✕
          </button>
          {[6, 7, 8, 9, 0].map((d) => (
            <button key={d} className="pad-key" onClick={() => typeDigit(d)}>
              {d}
            </button>
          ))}
          <button className="pad-key action" onClick={undo} disabled={!canUndo} aria-label="되돌리기">
            ↶
          </button>
          <button className="pad-key nav" onClick={() => move(-1, 0)} aria-label="왼쪽 칸">
            ←
          </button>
          <button className="pad-key nav" onClick={() => move(0, 1)} aria-label="위 줄">
            ↑
          </button>
          <button className="pad-key nav" onClick={() => move(0, -1)} aria-label="아래 줄">
            ↓
          </button>
          <button className="pad-key nav wide" onClick={() => move(1, 0)} aria-label="오른쪽 칸">
            →
          </button>
          <button
            className={`pad-key toggle ${autoAdvance ? 'on' : ''}`}
            onClick={() => setAutoAdvance(!autoAdvance)}
            aria-pressed={autoAdvance}
          >
            자동
            <br />
            이동
          </button>
        </div>
      </div>

      {tempoSheet && (
        <TempoSheet
          bar={bar}
          current={bar === 0 ? (score.tempo ?? null) : (score.cols[bar * n].tempo ?? null)}
          onApply={(t) => {
            commit(setTempoMark(live.current.score, bar * n, t));
            setTempoSheet(false);
          }}
          onClose={() => setTempoSheet(false)}
        />
      )}

      {showSettings && (
        <ShapeSheet
          score={score}
          onApply={(next) => {
            commit(next);
            setSel({ col: 0, string: sel.string });
            setShowSettings(false);
          }}
          onDelete={() => {
            onScoreChange(null);
            onEditingChange(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function ShapeSheet({
  score,
  onApply,
  onDelete,
  onClose,
}: {
  score: TabScore;
  onApply: (s: TabScore) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [beats, setBeats] = useState(score.beatsPerBar);
  const [rhythm, setRhythm] = useState<NotesPerBeat>(score.notesPerBeat);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const apply = () => {
    const next = reshape(score, beats, rhythm);
    if (!next) {
      setError(`지금 적힌 음 중에 ${RHYTHM_LABEL[rhythm]} 자리에 맞지 않는 음이 있어서 바꿀 수 없어요.`);
      return;
    }
    onApply(next);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-panel" role="dialog" aria-label="박자와 리듬" onClick={(e) => e.stopPropagation()}>
        <h2>박자·리듬</h2>
        <div className="tab-option-row">
          <span className="scale-row-title">박자</span>
          <div className="scale-chips">
            {BEAT_CHOICES.map((b) => (
              <button key={b} className={`scale-chip ${beats === b ? 'selected' : ''}`} onClick={() => setBeats(b)}>
                {b}/4
              </button>
            ))}
          </div>
        </div>
        <div className="tab-option-row">
          <span className="scale-row-title">한 칸</span>
          <div className="scale-chips">
            {RHYTHM_CHOICES.map((r) => (
              <button key={r} className={`scale-chip wide ${rhythm === r ? 'selected' : ''}`} onClick={() => setRhythm(r)}>
                {RHYTHM_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
        <p className="tab-help">이미 적은 음은 같은 박 위치 그대로 옮겨져요.</p>
        {error && <p className="form-error">{error}</p>}
        <button className="sheet-primary" onClick={apply}>
          적용
        </button>
        <button className={`delete-button ${confirmDelete ? 'armed' : ''}`} onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}>
          {confirmDelete ? '한 번 더 누르면 TAB 악보가 삭제돼요' : 'TAB 악보 삭제'}
        </button>
      </div>
    </div>
  );
}

function TempoSheet({
  bar,
  current,
  onApply,
  onClose,
}: {
  bar: number;
  current: number | null;
  onApply: (tempo: number | null) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(current ? String(current) : '');
  const parsed = Number(value);
  const valid = value.trim() === '' || (parsed >= 20 && parsed <= 400);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-panel" role="dialog" aria-label="템포 변경" onClick={(e) => e.stopPropagation()}>
        <h2>{bar === 0 ? '원곡 템포' : `${bar + 1}마디부터 템포`}</h2>
        <p className="tab-help">
          {bar === 0
            ? '악보에 적힌 원래 빠르기예요. 연습 BPM이 이 템포에 해당하고, 중간에 템포가 바뀌는 구간은 같은 비율로 따라가요.'
            : '이 마디부터 빠르기가 바뀌어요(원곡 기준). 비우면 템포 변경을 지워요.'}
        </p>
        <label className="field">
          <span>BPM</span>
          <input type="number" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder="예: 95" autoFocus />
        </label>
        {!valid && <p className="form-error">20~400 사이로 적어 주세요</p>}
        <button className="sheet-primary" disabled={!valid} onClick={() => onApply(value.trim() ? Math.round(parsed) : null)}>
          적용
        </button>
      </div>
    </div>
  );
}

export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 2;

/** 악보 크기 −/+ (10%씩) */
function ZoomControl({ zoom, onChange }: { zoom: number; onChange: (z: number) => void }) {
  const step = (d: number) => onChange(Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom + d)) * 10) / 10);
  return (
    <div className="zoom-control" role="group" aria-label="악보 크기">
      <button onClick={() => step(-0.1)} disabled={zoom <= ZOOM_MIN} aria-label="악보 작게">
        −
      </button>
      <span>{Math.round(zoom * 100)}%</span>
      <button onClick={() => step(0.1)} disabled={zoom >= ZOOM_MAX} aria-label="악보 크게">
        +
      </button>
    </div>
  );
}

/** 한 박을 나누는 칸 수로 고를 수 있는 클릭 간격: 16분음표 격자면 1·2·4, 셋잇단이면 1·3 */
function clickChoices(npb: number): number[] {
  return [1, 2, 3, 4].filter((n) => n <= npb && npb % n === 0);
}
