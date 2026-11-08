# TuxGuitar PDF → TAB 변환기

TuxGuitar에서 인쇄한(Print to PDF) TAB 악보 PDF를 이 앱의 TAB 형식(16분음표 격자, 4/4)으로 바꾼다.
PDF 안의 도형으로 리듬을 다시 만든다: 기둥·빔(8분/16분)·점·쉼표, 숫자 위치, 이음/해머링 호,
벤딩 화살표, 슬라이드 선, P.M., 템포 표시.

```bash
pip install pdfplumber
python3 parse.py 악보.pdf score.json report.json
```

- `score.json`: 앱의 `TabScore` (곡 파일의 `song.tab`에 넣는다)
- `report.json` / 표준 출력: 마디 수, 음 개수, 기법 개수, 그리고 **길이가 16칸이 아닌 마디 등 문제 목록**

곡 파일로 만들기:

```json
{ "format": "guitar-practice/song", "version": 1,
  "song": { "title": "...", "artist": "...", "practiceBpm": 120, "targetBpm": 190, "memo": "", "tab": <score.json> } }
```

앱의 곡 탭 → "곡 파일 불러오기"로 넣는다.

한계: 4/4와 16분음표 격자만, 셋잇단·32분음표·박자 변경은 지원하지 않는다.
변환한 악보는 개인 연습용으로만 쓰고, 저작권이 있는 악보 데이터는 이 저장소에 올리지 않는다.
