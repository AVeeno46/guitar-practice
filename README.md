# 기타 연습

혼자 쓰는 기타 연습 웹앱. 폰에서는 홈 화면에 추가해 앱처럼, PC에서는 브라우저로 사용한다.

## 기능 계획

- [x] 메트로놈: BPM, 박자, 세분, 탭 템포, 강박
- [x] 곡: 악보(PDF/사진) + 연습 BPM·목표 BPM, 악보 보며 쓰는 미니 메트로놈, 날짜별 BPM 진행
- [ ] 연습 기록: 타이머, 날짜별 연습 시간, 곡별 BPM 진행
- [ ] 연습 루틴: 항목별 시간과 BPM을 순서대로 진행
- [x] 스케일: 펜타토닉(마이너/메이저) 지판표, 5개 포지션 박스 테두리, 블루 노트, 음 누르면 소리
- [ ] 코드 사전, 다른 스케일(메이저/마이너/모드)
- [ ] Supabase로 기기 간 기록 동기화

## 데이터 저장

- 메트로놈 설정: `localStorage` (`gp.metronome`)
- 곡과 악보 파일: IndexedDB `guitar-practice` (`songs`, `sheets` 저장소). 폰 사진은 긴 변 2400px JPEG로 줄여 저장한다.
- PDF 악보는 pdf.js로 직접 그린다(iOS에서도 모든 쪽이 보이도록). pdf.js는 PDF를 처음 열 때만 불러온다.

## 개발

```bash
npm install
npm run dev     # 개발 서버
npm run build   # 배포용 빌드 (dist/)
```

배포는 Vercel에서 이 저장소를 연결하면 된다 (Framework: Vite, 설정 변경 불필요).
