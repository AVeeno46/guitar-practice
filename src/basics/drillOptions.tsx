// 기본기 연습 설정 줄에서 같이 쓰는 선택지
import { NOTE_VALUE_LABEL, type Direction, type NotesPerBeat } from './chromatic';

export const DIRECTION_OPTIONS: { value: Direction; label: string }[] = [
  { value: 'updown', label: '왕복' },
  { value: 'up', label: '올라가기' },
  { value: 'down', label: '내려가기' },
];

export const NOTES_PER_BEAT_OPTIONS = ([1, 2, 3, 4] as NotesPerBeat[]).map((n) => ({
  value: n,
  label: (
    <>
      {n}음 <span className="chip-sub">{NOTE_VALUE_LABEL[n]}</span>
    </>
  ),
}));
