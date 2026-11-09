// 곡에 저장하는 TAB 악보.
// 박을 일정한 칸(리듬 단위)으로 나눈 격자다. 칸 하나 = 메트로놈 세분 소리 하나라서
// 재생할 때 소리 번호로 바로 칸을 찾을 수 있다.
//
// cols[i].notes 는 6줄짜리 배열: 0 = 6번줄(저음 E) … 5 = 1번줄. null은 그 줄을 안 침.

import { TUNING } from '../../scales/theory';

export type NotesPerBeat = 1 | 2 | 3 | 4;

/** 한 줄에 적힌 음 하나 */
export interface Note {
  fret: number; // 뮤트(X)면 의미 없음, 이음이면 이어지는 앞 음의 프렛
  dead?: boolean; // X: 소리 없이 긁는 뮤트음
  tie?: boolean; // 이음: 앞 음을 다시 치지 않고 계속 울림. (7) 처럼 표시
  bend?: boolean; // 벤딩(온음 올림) ↑. 이음 음에 붙으면 울리는 도중 그 시점에서 올림
  slide?: boolean; // 다음 음까지 미끄러져 감 ／ ＼
  slideOut?: boolean; // 슬라이드 아웃: 친 뒤 줄을 따라 내려가며 소리를 뺌 (다음 음 없음)
  legato?: boolean; // 다음 음을 피킹 없이 해머링(h)/풀링(p)
}

export type Cell = Note | null;

export interface Column {
  notes: Cell[];
  pm?: boolean; // 팜뮤트 P.M.
  tempo?: number; // 이 칸부터 템포가 바뀜 (원곡 BPM 기준)
  rest?: number; // 이 칸부터 쉼표 (길이 = 칸 수). 쉼표 동안은 소리가 끊긴다
}

export interface TabScore {
  beatsPerBar: number;
  notesPerBeat: NotesPerBeat;
  /** 원곡 템포. 연습 BPM이 이 값에 해당하고, 중간 템포 변경은 이 값에 대한 비율로 따라간다 */
  tempo?: number;
  /** 마디 구분 없이 이어진 칸들. 길이는 항상 한 마디 칸 수의 배수 */
  cols: Column[];
}

export type NoteFlag = 'dead' | 'tie' | 'bend' | 'slide' | 'legato';

export const MAX_FRET = 24;
export const STRING_COUNT = 6;
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
export const RHYTHM_LABEL: Record<NotesPerBeat, string> = {
  1: '4분음표',
  2: '8분음표',
  3: '셋잇단',
  4: '16분음표',
};

export const emptyColumn = (): Column => ({ notes: Array(STRING_COUNT).fill(null) });
export const perBar = (s: TabScore) => s.beatsPerBar * s.notesPerBeat;
export const barCount = (s: TabScore) => s.cols.length / perBar(s);
const hasNotes = (c: Column) => c.notes.some((n) => n !== null);
/** 음도, 팜뮤트도, 템포 표시도 없는 칸 */
export const isBlankColumn = (c: Column) => !hasNotes(c) && !c.pm && !c.tempo && !c.rest;

const copyColumn = (c: Column): Column => ({ ...c, notes: c.notes.map((n) => (n ? { ...n } : null)) });

export function createScore(beatsPerBar = 4, notesPerBeat: NotesPerBeat = 2, bars = 4): TabScore {
  return {
    beatsPerBar,
    notesPerBeat,
    cols: Array.from({ length: beatsPerBar * notesPerBeat * bars }, emptyColumn),
  };
}

export const midiOf = (string: number, fret: number) => TUNING[string] + fret;

/** col보다 앞에서 이 줄의 가장 가까운 음 (없으면 null) */
export function prevNote(s: TabScore, col: number, string: number): { col: number; note: Note } | null {
  for (let i = col - 1; i >= 0; i--) {
    const n = s.cols[i].notes[string];
    if (n) return { col: i, note: n };
  }
  return null;
}

/** col보다 뒤에서 이 줄의 가장 가까운 음 (없으면 null) */
export function nextNote(s: TabScore, col: number, string: number): { col: number; note: Note } | null {
  for (let i = col + 1; i < s.cols.length; i++) {
    const n = s.cols[i].notes[string];
    if (n) return { col: i, note: n };
  }
  return null;
}

/** 이 칸에 적용되는 템포 (원곡 기준). 템포 정보가 없으면 null */
export function tempoAt(s: TabScore, col: number): number | null {
  for (let i = Math.min(col, s.cols.length - 1); i >= 0; i--) {
    const t = s.cols[i].tempo;
    if (t) return t;
  }
  return s.tempo ?? null;
}

// ---------- 편집 (모두 새 객체를 돌려준다) ----------

function withColumn(s: TabScore, col: number, fn: (c: Column) => Column): TabScore {
  const cols = s.cols.slice();
  cols[col] = fn(copyColumn(cols[col]));
  return { ...s, cols };
}

export function setCell(s: TabScore, col: number, string: number, cell: Cell): TabScore {
  const next = withColumn(s, col, (c) => {
    c.notes[string] = cell;
    return c;
  });
  return cell ? cutRestAt(next, col) : next;
}

/** col을 덮고 있는 쉼표 (시작 칸과 길이) */
export function restCovering(s: TabScore, col: number): { col: number; length: number } | null {
  for (let i = col; i >= 0 && col - i < perBar(s) * 4; i--) {
    const r = s.cols[i].rest;
    if (r) return i + r > col ? { col: i, length: r } : null;
  }
  return null;
}

/** 음을 적은 칸에 쉼표가 걸쳐 있으면 쉼표를 그 앞까지로 줄인다 */
function cutRestAt(s: TabScore, col: number): TabScore {
  const r = restCovering(s, col);
  if (!r) return s;
  return withColumn(s, r.col, (c) => {
    if (col > r.col) c.rest = col - r.col;
    else delete c.rest;
    return c;
  });
}

/**
 * 쉼표를 켜고 끈다.
 * - 쉼표가 걸친 칸이면 그 쉼표를 지운다
 * - 빈 칸이면 다음 음(또는 마디 끝)까지 쉼표로 채운다
 * - 음이 있는 칸이면 아무것도 안 한다
 */
export function toggleRest(s: TabScore, col: number): TabScore {
  const cover = restCovering(s, col);
  if (cover) {
    return withColumn(s, cover.col, (c) => {
      delete c.rest;
      return c;
    });
  }
  if (hasNotes(s.cols[col])) return s;
  const barEnd = (Math.floor(col / perBar(s)) + 1) * perBar(s);
  let end = col + 1;
  while (end < barEnd && !hasNotes(s.cols[end]) && !s.cols[end].rest) end++;
  const next = s;
  return withColumn(next, col, (c) => {
    c.rest = end - col;
    return c;
  });
}

/** 숫자를 적는다. 이음·X였던 칸은 보통 음으로 바뀌고, 벤딩·슬라이드·레가토 표시는 유지한다 */
export function setFret(s: TabScore, col: number, string: number, fret: number): TabScore {
  const old = s.cols[col].notes[string];
  const keep = old && !old.dead && !old.tie ? { bend: old.bend, slide: old.slide, slideOut: old.slideOut, legato: old.legato } : {};
  const note: Note = { fret };
  for (const [k, v] of Object.entries(keep)) if (v) note[k as 'bend' | 'slide' | 'slideOut' | 'legato'] = true;
  return setCell(s, col, string, note);
}

/**
 * 기법을 켜고 끈다.
 * - dead(X): 빈 칸이면 X를 넣고, X면 지운다
 * - tie(이음): 앞 음을 이어서 울리게 한다 (앞 음이 없으면 아무것도 안 함)
 * - bend/slide/legato: 지금 음에 표시를 켜고 끈다 (음이 없으면 아무것도 안 함)
 */
export function toggleFlag(s: TabScore, col: number, string: number, flag: NoteFlag): TabScore {
  const cur = s.cols[col].notes[string];
  if (flag === 'dead') {
    return setCell(s, col, string, cur?.dead ? null : { fret: 0, dead: true });
  }
  if (flag === 'tie') {
    if (cur?.tie) return setCell(s, col, string, null);
    const prev = prevNote(s, col, string);
    if (!prev || prev.note.dead) return s;
    return setCell(s, col, string, { fret: prev.note.fret, tie: true });
  }
  if (!cur || cur.dead) return s;
  const next: Note = { ...cur };
  // 슬라이드 버튼은 세 단계: 다음 음으로 슬라이드 → 슬라이드 아웃 → 없음
  if (flag === 'slide') {
    if (next.slide) {
      delete next.slide;
      next.slideOut = true;
    } else if (next.slideOut) {
      delete next.slideOut;
    } else {
      next.slide = true;
      delete next.legato;
    }
    return setCell(s, col, string, next);
  }
  if (next[flag]) delete next[flag];
  else next[flag] = true;
  // 슬라이드와 해머링/풀링은 둘 중 하나만
  if (flag === 'legato' && next.legato) delete next.slide;
  return setCell(s, col, string, next);
}

export function togglePalmMute(s: TabScore, col: number): TabScore {
  return withColumn(s, col, (c) => {
    if (c.pm) delete c.pm;
    else c.pm = true;
    return c;
  });
}

/** 이 칸부터 템포를 바꾼다. null이면 템포 표시를 지운다 */
export function setTempoMark(s: TabScore, col: number, tempo: number | null): TabScore {
  if (col === 0) return { ...s, tempo: tempo ?? undefined };
  return withColumn(s, col, (c) => {
    if (tempo) c.tempo = tempo;
    else delete c.tempo;
    return c;
  });
}

/** bar 뒤에 빈 마디를 넣는다 (bar = -1이면 맨 앞) */
export function insertBar(s: TabScore, afterBar: number): TabScore {
  const n = perBar(s);
  const at = (afterBar + 1) * n;
  const cols = [...s.cols.slice(0, at), ...Array.from({ length: n }, emptyColumn), ...s.cols.slice(at)];
  return { ...s, cols };
}

/** bar를 복제해서 바로 뒤에 붙인다 (템포 표시는 복제하지 않는다) */
export function duplicateBar(s: TabScore, bar: number): TabScore {
  const n = perBar(s);
  const copy = s.cols.slice(bar * n, (bar + 1) * n).map((c) => {
    const d = copyColumn(c);
    delete d.tempo;
    return d;
  });
  const at = (bar + 1) * n;
  return { ...s, cols: [...s.cols.slice(0, at), ...copy, ...s.cols.slice(at)] };
}

/** 마디를 지운다. 마지막 한 마디는 지우지 않고 비운다 */
export function deleteBar(s: TabScore, bar: number): TabScore {
  const n = perBar(s);
  if (barCount(s) <= 1) return { ...s, cols: Array.from({ length: n }, emptyColumn) };
  return { ...s, cols: [...s.cols.slice(0, bar * n), ...s.cols.slice((bar + 1) * n)] };
}

/**
 * 박자(한 마디 박 수)나 리듬 단위(박당 칸 수)를 바꾼다.
 * 이미 적은 음이 새 격자에 정확히 놓이지 않으면(예: 16분음표 자리에 있는 음을 8분음표로) null.
 */
export function reshape(s: TabScore, beatsPerBar: number, notesPerBeat: NotesPerBeat): TabScore | null {
  let cols = s.cols;
  if (notesPerBeat !== s.notesPerBeat) {
    const beats = s.cols.length / s.notesPerBeat;
    const next: Column[] = Array.from({ length: beats * notesPerBeat }, emptyColumn);
    for (let i = 0; i < s.cols.length; i++) {
      if (isBlankColumn(s.cols[i])) continue;
      const pos = (i * notesPerBeat) / s.notesPerBeat;
      if (Math.abs(pos - Math.round(pos)) > 1e-9) return null;
      const moved = copyColumn(s.cols[i]);
      if (moved.rest) {
        const len = (moved.rest * notesPerBeat) / s.notesPerBeat;
        if (Math.abs(len - Math.round(len)) > 1e-9) return null;
        moved.rest = Math.round(len);
      }
      next[Math.round(pos)] = moved;
    }
    cols = next;
  }
  const n = beatsPerBar * notesPerBeat;
  const padded = cols.slice();
  while (padded.length % n !== 0 || padded.length === 0) padded.push(emptyColumn());
  while (padded.length > n && padded.slice(-n).every(isBlankColumn) && padded.slice(-2 * n, -n).every(isBlankColumn)) {
    padded.splice(-n, n);
  }
  return { ...s, beatsPerBar, notesPerBeat, cols: padded };
}

/**
 * 저장된 값(또는 불러온 파일)을 정리한다. 깨진 값은 버리고,
 * 예전 형식(칸이 숫자 배열이던 시절)도 새 형식으로 바꾼다.
 */
export function normalizeScore(raw: unknown): TabScore | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const beatsPerBar = Math.min(12, Math.max(1, Math.round(Number(r.beatsPerBar)) || 4));
  const npb = ([1, 2, 3, 4] as const).find((v) => v === r.notesPerBeat) ?? 2;
  const n = beatsPerBar * npb;
  const tempo = Number(r.tempo) > 0 ? Math.round(Number(r.tempo)) : undefined;

  const toNote = (v: unknown): Cell => {
    if (typeof v === 'number') return v >= 0 && v <= MAX_FRET ? { fret: Math.round(v) } : null;
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    const fret = Number(o.fret);
    if (!o.dead && !(fret >= 0 && fret <= MAX_FRET)) return null;
    const note: Note = { fret: o.dead ? 0 : Math.round(fret) };
    for (const k of ['dead', 'tie', 'bend', 'slide', 'slideOut', 'legato'] as const) if (o[k]) note[k] = true;
    return note;
  };

  const cols: Column[] = (Array.isArray(r.cols) ? r.cols : []).map((c: unknown) => {
    const isLegacy = Array.isArray(c);
    const src = isLegacy ? (c as unknown[]) : ((c as Record<string, unknown>)?.notes as unknown[]);
    const col: Column = {
      notes: Array.from({ length: STRING_COUNT }, (_, i) => toNote(Array.isArray(src) ? src[i] : null)),
    };
    if (!isLegacy && c && typeof c === 'object') {
      const o = c as Record<string, unknown>;
      if (o.pm) col.pm = true;
      if (Number(o.tempo) > 0) col.tempo = Math.round(Number(o.tempo));
      if (Number(o.rest) > 0) col.rest = Math.round(Number(o.rest));
    }
    return col;
  });
  while (cols.length % n !== 0 || cols.length === 0) cols.push(emptyColumn());
  return { beatsPerBar, notesPerBeat: npb, tempo, cols };
}
