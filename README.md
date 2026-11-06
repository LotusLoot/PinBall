# 튕겨라, 용사

구슬을 쏘아 핀에 튕긴 만큼 몬스터를 때리는 핀볼 로그라이크.

## 실행
`index.html`을 크롬이나 엣지로 열면 바로 실행된다. 빌드 도구는 필요 없다.
(글꼴 Jua, Gowun Dodum은 인터넷에서 불러온다. 오프라인이면 기본 글꼴로 보인다.)

## 폴더
- `index.html` 화면 뼈대와 스타일
- `js/data.js` 구슬·유물·몬스터·캐릭터·밸런스 숫자. **숫자 조정은 이 파일만 고치면 된다.**
- `js/util.js` 시드 난수, 저장(localStorage, 버전 번호 포함), Web Audio 효과음 합성
- `js/board.js` 핀 배치 3종, 물리(고정 시간 간격 1/240초), 궤적 미리보기
- `js/battle.js` 전투 규칙, 구슬·유물 효과, 몬스터 행동
- `js/fx.js` 파티클, 숫자 팝업, 흔들림, 히트스톱, 슬로모션
- `js/render.js` 전투 화면 그리기
- `js/run.js` 지도, 노드, 보상, 상점, 이벤트, 판 끝 정산, 해금, 업적
- `js/ui.js` 메뉴 화면
- `js/main.js` 게임 루프, 입력, 화면 크기
- `js/online.js` 친구와 겨루기 (일일 순위표, 명예의 전당, 실시간 레이스, 도전장)
- `js/firebase-config.js` Firebase 설정 값 (직접 붙여 넣기)
- `firestore.rules` Firestore 보안 규칙 (Firebase 콘솔에 붙여 넣기)
- `assets/` 이미지 72장 (WebP). 같은 이름의 파일로 바꾸면 그림이 바뀐다.

## 피해 계산 순서
핀 점수 합(구슬 핀 피해 + 무딘 칼날, 벽 점수) → 배율(크리 +0.5씩, 연쇄 반응, 공명석) → 최종 배수(바구니 ×1.5, 첫 발의 기세 ×2, 저주받은 왕관 ×1.5)

## 조작
화면을 끌어서 조준하고 손을 떼면 발사. 키보드는 ←→로 조준, 스페이스로 발사.

## 친구와 겨루기 서버 설정 (GitHub Pages + Firebase)
1. GitHub에서 새 저장소(Public)를 만들고, 이 폴더 안의 파일을 전부 올린다.
2. 저장소 Settings → Pages → Branch: `main` / `(root)` → Save. 1~2분 뒤 `https://아이디.github.io/저장소이름/` 에서 열린다.
3. https://console.firebase.google.com 에서 프로젝트를 만든다.
4. Authentication → 시작하기 → 로그인 방법 → **익명** 사용 설정. 설정 탭 → 승인된 도메인에 `아이디.github.io` 추가.
5. Firestore Database → 데이터베이스 만들기 (위치 `asia-northeast3` 서울, 프로덕션 모드) → 규칙 탭에 `firestore.rules` 내용을 붙여 넣고 게시.
6. 프로젝트 설정 → 내 앱 → 웹 앱(</>) 등록 → 나오는 `firebaseConfig` 값을 `js/firebase-config.js` 에 붙여 넣고 GitHub에 커밋.
7. 게임 주소를 친구들에게 보낸다. 처음 「친구와 겨루기」를 누르면 이름을 정한다.

### 저장 구조 (Firestore)
- `players/{uid}` 명예의 전당 기록
- `daily/{YYYYMMDD}/scores/{uid}` 일일 도전 순위 (더 높은 점수로만 갱신)
- `race/{YYYYMMDD}/live/{uid}` 실시간 레이스 진행 상황
- `challenges/{id}` 도전장 (시드, 용사), `challenges/{id}/results/{uid}` 도전 기록

### 참고
- 무료 요금제(Spark)로 친구 수십 명은 충분하다 (하루 읽기 5만, 쓰기 2만).
- 점수는 각자의 브라우저가 계산해서 올린다. 친구끼리 즐기는 용도이며, 마음먹고 조작하는 것까지 막지는 못한다.
- 일일 도전과 도전장은 모든 구슬·유물이 나오고 영구 강화가 적용되지 않는 공정 규칙이다. 같은 시드면 지도·적·보상이 같다.
