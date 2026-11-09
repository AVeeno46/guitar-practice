"""TuxGuitar PDF → guitar-practice TAB (16분음표 격자) 변환기.

PDF 안의 도형으로 리듬을 다시 만든다.
- 기둥(오선 아래 세로선) + 빔 층수(1층 8분, 2층 16분), 점(점음표)
- 쉼표 모양(8분/4분/16분 쉼표, 2·온쉼표 사각형)
숫자는 가장 가까운 기둥(박)에 붙이고, 이음 호·벤딩 화살표·슬라이드 선·P.M.·템포를 더한다.
마디마다 길이가 정확히 16칸(4/4)인지 검사해서 결과와 함께 보고한다.
"""
import json
import sys
from collections import defaultdict

import pdfplumber

SRC = sys.argv[1]
OUT = sys.argv[2]
REPORT = sys.argv[3] if len(sys.argv) > 3 else None

PER_BAR = 16  # 4/4, 16분음표 격자


def dedupe(objs, keyf):
    seen, out = set(), []
    for o in objs:
        k = keyf(o)
        if k in seen:
            continue
        seen.add(k)
        out.append(o)
    return out


def r1(v):
    return round(v, 1)


def page_staffs(p):
    hl = [l for l in p.lines if abs(l['top'] - l['bottom']) < 0.5 and l['x1'] - l['x0'] > 100]
    ys = sorted(set(r1(l['top']) for l in hl))
    groups = []
    for y in ys:
        if groups and y - groups[-1][-1] < 7:
            groups[-1].append(y)
        else:
            groups.append([y])
    return [g for g in groups if len(g) == 6]


def tokens_in(chars):
    """같은 줄에 붙어 있는 글자를 묶는다: '12', 'X', '(7)'"""
    chars = sorted(chars, key=lambda c: c['x0'])
    toks = []
    for c in chars:
        if toks and c['x0'] - toks[-1]['x1'] < 1.2:
            toks[-1]['text'] += c['text']
            toks[-1]['x1'] = c['x1']
        else:
            toks.append({'text': c['text'], 'x0': c['x0'], 'x1': c['x1']})
    for t in toks:
        t['cx'] = (t['x0'] + t['x1']) / 2
    return toks


def parse_token(text):
    t = text.strip()
    if not t:
        return None
    if t.upper() == 'X':
        return {'dead': True, 'fret': 0}
    tie = t.startswith('(') and t.endswith(')')
    digits = t.strip('()')
    if not digits.isdigit():
        return None
    n = {'fret': int(digits)}
    if tie:
        n['tie'] = True
    return n


def main():
    pdf = pdfplumber.open(SRC)
    bars = []  # 각 마디: {'events': [...], 'pm': set(), 'tempo': int|None, 'label': str}
    problems = []
    # 마디를 넘어가는 이음 호 처리용
    pending_ties = []  # (bar_index, string, from_fret)

    for pi, p in enumerate(pdf.pages):
        lines = dedupe(p.lines, lambda l: (r1(l['x0']), r1(l['top']), r1(l['x1']), r1(l['bottom'])))
        rects = dedupe(p.rects, lambda r: (r1(r['x0']), r1(r['top']), r1(r['x1']), r1(r['bottom'])))
        curves = dedupe(p.curves, lambda c: (r1(c['x0']), r1(c['top']), r1(c['x1']), r1(c['bottom'])))
        chars = p.chars

        for st in page_staffs(p):
            top, bot = st[0], st[-1]
            gap = (bot - top) / 5
            # 줄 y: st[0] = 1번줄(e, index 5) … st[5] = 6번줄(E, index 0)
            def string_of(y, st=st):
                k = min(range(6), key=lambda i: abs(st[i] - y))
                return 5 - k, abs(st[k] - y)

            def line_y(string, st=st):
                return st[5 - string]

            # ---- 마디선 ----
            xs = [l['x0'] for l in lines if abs(l['x0'] - l['x1']) < 0.5 and 28 < l['bottom'] - l['top'] < 29.5 and abs(l['top'] - top) < 1.5]
            xs += [r['x0'] for r in rects if 28 < r['height'] < 29.5 and abs(r['top'] - top) < 1.5]
            xs += [r['x1'] for r in rects if 28 < r['height'] < 29.5 and abs(r['top'] - top) < 1.5]
            xs = sorted(xs)
            barx = []
            for x in xs:
                if not barx or x - barx[-1] > 4:
                    barx.append(x)
                else:
                    barx[-1] = max(barx[-1], x)
            # 마디 번호(빨간 작은 숫자)로 마디 시작 위치 확인
            numchars = [c for c in chars if c['size'] < 5.5 and c['text'].isdigit() and top - 8 < c['top'] < top - 2]
            labels = tokens_in(numchars)

            # ---- 이 오선의 요소들 ----
            stems = sorted(set(r1(l['x0']) for l in lines if abs(l['x0'] - l['x1']) < 0.5 and abs((l['bottom'] - l['top']) - 11.5) < 0.3 and bot < l['top'] < bot + 6))
            half_stems = sorted(set(r1(l['x0']) for l in lines if abs(l['x0'] - l['x1']) < 0.5 and abs((l['bottom'] - l['top']) - 5.7) < 0.3 and bot + 7 < l['top'] < bot + 10))
            beams = [r for r in rects if bot + 9 < r['top'] < bot + 16 and r['height'] < 2]
            dots = [c for c in curves if abs((c['x1'] - c['x0']) - 2.2) < 0.2 and abs((c['bottom'] - c['top']) - 2.2) < 0.2 and bot + 5 < c['top'] < bot + 20]
            rests = []
            for c in curves:
                w, h = c['x1'] - c['x0'], c['bottom'] - c['top']
                if not (top - 2 < c['top'] < bot):
                    continue
                if 3.0 <= w <= 3.6 and abs(h - 6.2) < 0.3:
                    rests.append((c['x0'] + w / 2, 2))  # 8분 쉼표
                elif 3.3 <= w <= 3.6 and abs(h - 9.7) < 0.3:
                    rests.append((c['x0'] + w / 2, 4))  # 4분 쉼표
                elif 4.1 <= w <= 4.4 and abs(h - 9.7) < 0.3:
                    rests.append((c['x0'] + w / 2, 1))  # 16분 쉼표
                elif 4.6 <= w <= 5.4 and 1.6 <= h <= 2.6:
                    # 납작한 사각형: 줄에 매달리면 온쉼표, 줄 위에 얹히면 2분쉼표
                    hangs = min(abs(c['top'] - y) for y in st) < 0.6
                    rests.append((c['x0'] + w / 2, 16 if hangs else 8))
            for r in rects:  # 2분·온쉼표: 오선 안의 납작한 사각형
                if top + 4 < r['top'] < bot - 4 and 2.5 < r['height'] < 4 and 4 < r['width'] < 12:
                    # 3번째 줄(위에서) 아래에 붙으면 온쉼표, 위에 얹히면 2분쉼표
                    mid_line = st[2]
                    rests.append((r['x0'] + r['width'] / 2, 16 if r['top'] >= mid_line - 0.5 else 8))
            arcs = [c for c in curves if (c['bottom'] - c['top']) < 0.3 and 3.5 < (c['x1'] - c['x0']) < 14 and top - 4 < c['top'] < bot + 4]
            heads = [c for c in curves if abs((c['x1'] - c['x0']) - 2.2) < 0.2 and abs((c['bottom'] - c['top']) - 1.4) < 0.2 and top - 12 < c['top'] < bot]
            diags = [l for l in lines if abs(l['x0'] - l['x1']) > 1 and abs(l['top'] - l['bottom']) > 1 and top - 2 < l['top'] and l['bottom'] < bot + 2]
            notechars = [c for c in chars if 5.5 < c['size'] < 6.5 and top - 4 < c['top'] < bot + 2]
            by_string = defaultdict(list)
            for c in notechars:
                s, d = string_of(c['top'] + c['height'] / 2)
                if d < gap / 2:
                    by_string[s].append(c)
            toks = []
            for s, cs in by_string.items():
                for t in tokens_in(cs):
                    t['string'] = s
                    toks.append(t)
            pmchars = [c for c in chars if c['size'] < 5.5 and c['text'] == 'P' and top - 16 < c['top'] < top]
            tempochars = [c for c in chars if c['size'] < 5.5 and top - 16 < c['top'] < top - 8]

            for bi in range(len(barx) - 1):
                x0, x1 = barx[bi], barx[bi + 1]
                inb = lambda x: x0 < x < x1
                label = next((t['text'] for t in labels if x0 - 3 < t['x0'] < x0 + 12), None)
                events = []
                for sx in stems:
                    if not inb(sx):
                        continue
                    lv = set()
                    for b in beams:
                        if b['x0'] - 0.4 <= sx <= b['x1'] + 0.4:
                            lv.add(round(b['top'] - bot, 0))
                    dur = {0: 4, 1: 2, 2: 1}.get(len(lv), 1)
                    events.append({'x': sx, 'dur': dur, 'notes': {}, 'rest': False})
                for sx in half_stems:
                    if inb(sx):
                        events.append({'x': sx, 'dur': 8, 'notes': {}, 'rest': False})
                # 점: 가장 가까운 기둥(양쪽 7 이내)의 길이를 1.5배
                for d in dots:
                    dx = d['x0'] + 1.1
                    if not inb(dx):
                        continue
                    cand = [e for e in events if abs(e['x'] - dx) < 7 and not e.get('dotted')]
                    if cand:
                        e = min(cand, key=lambda e: abs(e['x'] - dx))
                        e['dur'] = e['dur'] * 3 // 2
                        e['dotted'] = True
                for rx, dur in rests:
                    if not inb(rx):
                        continue
                    if any(rx < d['x0'] < rx + 7 and d['top'] < bot + 8 for d in dots):
                        dur = dur * 3 // 2
                    events.append({'x': rx, 'dur': dur, 'notes': {}, 'rest': True})
                events.sort(key=lambda e: e['x'])
                # 숫자 → 가장 가까운 기둥. 기둥이 없는 숫자(온음표·2분음표 일부)는 따로 모은다
                stemless = []
                for t in toks:
                    if not inb(t['cx']):
                        continue
                    n = parse_token(t['text'])
                    if not n:
                        problems.append(f"마디 {label}: 읽을 수 없는 글자 {t['text']}")
                        continue
                    cand = [e for e in events if not e['rest']]
                    e = min(cand, key=lambda e: abs(e['x'] - t['cx'])) if cand else None
                    if e is None or abs(e['x'] - t['cx']) > 6:
                        g = next((g for g in stemless if abs(g['x'] - t['cx']) < 4), None)
                        if not g:
                            g = {'x': t['cx'], 'dur': 0, 'notes': {}, 'rest': False, 'stemless': True}
                            stemless.append(g)
                        g['notes'][t['string']] = n
                    else:
                        e['notes'][t['string']] = n
                events.extend(stemless)
                events.sort(key=lambda e: e['x'])
                missing = PER_BAR - sum(e['dur'] for e in events)
                if missing > 0:
                    if stemless:
                        # 기둥 없는 음이 남은 길이를 나눠 갖는다 (보통 하나: 온음표/2분음표)
                        for g in stemless:
                            g['dur'] = missing // len(stemless)
                    else:
                        # 숨은 이음 음(앞 마디에서 이어짐) 또는 빈 자리: 가장 넓은 빈 곳에 채운다
                        xs_ = [x0] + [e['x'] for e in events] + [x1]
                        gaps = [(xs_[i + 1] - xs_[i], i) for i in range(len(xs_) - 1)]
                        _, gi = max(gaps)
                        fx = x0 + 1 if gi == 0 else events[gi - 1]['x'] + 1
                        events.append({'x': fx, 'dur': missing, 'notes': {}, 'rest': False, 'filler': True})
                        events.sort(key=lambda e: e['x'])
                total = sum(e['dur'] for e in events)
                bar = {'events': events, 'label': label, 'pm': [], 'tempo': None, 'page': pi + 1, 'x0': x0, 'x1': x1}
                if total != PER_BAR:
                    problems.append(f"마디 {label}: 길이 {total}/16 (쪽 {pi + 1})")
                # P.M.
                for c in pmchars:
                    if inb(c['x0'] + 4):
                        cand = [e for e in events if not e['rest']]
                        if cand:
                            e = min(cand, key=lambda e: abs(e['x'] - (c['x0'] + 4)))
                            e['pm'] = True
                # 템포 (= 숫자)
                tt = tokens_in([c for c in tempochars if x0 - 20 < c['x0'] < x1])
                for t in tt:
                    digits = ''.join(ch for ch in t['text'] if ch.isdigit())
                    if digits and int(digits) >= 30:
                        bar['tempo'] = int(digits)
                bar['arcs'] = [a for a in arcs if x0 - 2 < a['x0'] < x1]
                bar['arcs_in'] = [a for a in arcs if a['x0'] <= x0 + 2 and a['x1'] > x0]  # 앞 줄에서 넘어온 호의 꼬리
                bar['heads'] = [h for h in heads if inb(h['x0'])]
                bar['diags'] = [d for d in diags if inb(min(d['x0'], d['x1']))]
                bar['string_of'] = string_of
                bar['line_y'] = line_y
                bars.append(bar)

    # ---- 마디 번호 확인 ----
    for i, b in enumerate(bars):
        if b['label'] and b['label'].isdigit() and int(b['label']) != i + 1:
            problems.append(f"마디 순서 불일치: {i + 1}번째 마디에 번호 {b['label']}")

    # ---- 칸으로 펼치기 ----
    cols = []
    ev_at = {}  # (bar, event_index) -> col index
    for bi, b in enumerate(bars):
        pos = 0
        base = bi * PER_BAR
        bar_cols = [{'notes': [None] * 6} for _ in range(PER_BAR)]
        for ei, e in enumerate(b['events']):
            if pos >= PER_BAR:
                break
            c = bar_cols[pos]
            for s, n in e['notes'].items():
                c['notes'][s] = dict(n)
            if e.get('pm'):
                c['pm'] = True
            if e['rest']:
                c['rest'] = e['dur']  # 쉼표: 시작 칸에 길이(칸 수)
            ev_at[(bi, ei)] = base + pos
            e['col'] = base + pos
            pos += e['dur']
        if b['tempo'] and bi > 0:
            bar_cols[0]['tempo'] = b['tempo']
        cols.extend(bar_cols)

    def note_events(bi):
        return [e for e in bars[bi]['events'] if not e['rest'] and 'col' in e]

    # ---- 이음·레가토 호 ----
    # 호가 줄 위에 정확히 있으면 해머링·풀링 호(숫자 위), 두 줄 사이에 있으면 바로 위 줄 음의 이음 호
    tie_count = legato_count = 0
    for bi, b in enumerate(bars):
        so, ly = b['string_of'], b['line_y']
        evs = note_events(bi)
        for a in b['arcs']:
            y = a['top']
            s_on, d_on = so(y)
            s_tie, d_tie = so(y - 2.9)
            string = s_on if d_on < 0.8 else s_tie
            src = [e for e in evs if e['x'] <= a['x0'] + 2 and e['notes']]
            from_prev = False
            if src:
                src = max(src, key=lambda e: e['x'])
            elif bi > 0 and note_events(bi - 1):
                src = [e for e in note_events(bi - 1) if e['notes']][-1]  # 앞 마디에서 넘어온 이음
                from_prev = True
            else:
                continue
            if string not in src['notes']:
                # 가장 가까운 줄의 음으로
                string = min(src['notes'].keys(), key=lambda s_: min(abs(ly(s_) - y), abs(ly(s_) + 2.9 - y)))
            later = [e for e in evs if e['x'] > src['x'] + 1 and e['x'] <= a['x1'] + 6] if not from_prev else evs[:1]
            if later:
                tgt = min(later, key=lambda e: e['x'])
            else:
                nxt = note_events(bi + 1) if bi + 1 < len(bars) else []
                tgt = nxt[0] if nxt else None
            if not tgt or 'col' not in tgt or 'col' not in src:
                continue
            sn = cols[src['col']]['notes'][string]
            if not sn:
                continue
            tn = cols[tgt['col']]['notes'][string]
            if tn is None or tn.get('tie') or (tn.get('fret') == sn.get('fret') and not tn.get('dead') and d_on >= 0.8):
                cols[tgt['col']]['notes'][string] = {'fret': sn['fret'], 'tie': True}
                tie_count += 1
            else:
                sn['legato'] = True
                legato_count += 1

    # ---- 벤딩 화살표 ----
    bend_count = 0
    bend_bars = []
    for bi, b in enumerate(bars):
        evs = note_events(bi)
        for h in b['heads']:
            hx = h['x0'] + 1.1
            src = [e for e in evs if e['x'] <= hx + 1 and e['notes']]
            if not src:
                continue
            src = max(src, key=lambda e: e['x'])
            # 화살표 시작점(아래쪽)과 가장 가까운 줄의 음
            ly = b['line_y']
            s = min(src['notes'].keys(), key=lambda s_: abs(ly(s_) - (h['top'] + 0.7)))
            n = cols[src['col']]['notes'][s]
            if n and not n.get('dead'):
                n['bend'] = True  # 이음 음에 붙으면: 울리는 중에 그 시점에서 벤딩
                bend_count += 1
                bend_bars.append(bi + 1)

    # ---- 슬라이드 선 ----
    slide_count = 0
    for bi, b in enumerate(bars):
        so = b['string_of']
        evs = note_events(bi)
        for d in b['diags']:
            if abs(d['x1'] - d['x0']) < 2.5:
                continue  # 벤딩 화살표 머리
            lx = min(d['x0'], d['x1'])
            ym = (d['top'] + d['bottom']) / 2
            s, dist = so(ym)
            src = [e for e in evs if e['x'] <= lx + 1 and s in e['notes']]
            if not src:
                continue
            src = max(src, key=lambda e: e['x'])
            n = cols[src['col']]['notes'][s]
            if n and not n.get('dead'):
                n['slide'] = True
                n.pop('legato', None)
                slide_count += 1

    # 이음으로 표시된 칸 프렛 정리 (괄호 숫자가 따로 적혀 있어도 이음으로)
    for i, c in enumerate(cols):
        for s, n in enumerate(c['notes']):
            if n and n.get('tie'):
                for j in range(i - 1, -1, -1):
                    p = cols[j]['notes'][s]
                    if p:
                        n['fret'] = p['fret']
                        break

    tempo = bars[0]['tempo'] or 120
    score = {'beatsPerBar': 4, 'notesPerBeat': 4, 'tempo': tempo, 'cols': [
        {k: v for k, v in c.items() if v} | {'notes': [({k: v for k, v in n.items() if v} if n else None) for n in c['notes']]}
        for c in cols
    ]}
    json.dump(score, open(OUT, 'w'), ensure_ascii=False)

    notes = sum(1 for c in cols for n in c['notes'] if n)
    summary = {
        'bars': len(bars),
        'notes': notes,
        'ties': tie_count,
        'legato': legato_count,
        'bends': bend_count,
        'bend_bars': bend_bars,
        'slides': slide_count,
        'pm_cols': sum(1 for c in cols if c.get('pm')),
        'rests': sum(1 for c in cols if c.get('rest')),
        'tempos': [(i + 1, b['tempo']) for i, b in enumerate(bars) if b['tempo']],
        'problems': problems,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    if REPORT:
        json.dump(summary, open(REPORT, 'w'), ensure_ascii=False, indent=1)


main()
