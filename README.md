# WMLAlive Archive

Google Sheets의 `WMLAlive`, `WMLNAlive` 탭을 사용하는 답변 아카이브입니다.
각 탭의 `Nickname`, `Content` 열을 읽고 저장하며, GitHub Pages에서 제공합니다.

사이트: https://suhyouri.github.io/tellmeyourmoment/

## 실행과 검증

Node.js 18 이상과 Python 3가 필요합니다. 외부 npm 의존성은 없습니다.

```sh
npm start       # http://localhost:8000
npm test        # API 요청 및 Apps Script 저장 로직 검증
```

## 파일 구조

- `public/index.html`: 두 질문의 화면과 입력 폼
- `public/styles/style.css`: 원래 디자인과 모바일 레이아웃
- `public/script.js`: 목록 렌더링, 입력 상태, 주기적 갱신
- `public/api.js`: Apps Script 조회·저장 요청
- `public/config.js`: 웹 앱 URL과 갱신 주기
- `apps-script/Code.gs`: Google Sheets 서버 코드의 관리용 사본
- `tests/`: 외부 시트를 변경하지 않는 테스트
- `scripts/deploy.js`: `public/`을 GitHub Pages 브랜치에 배포

## Google Sheets 연결

현재 Apps Script 웹 앱은 연결되어 있습니다. 서버 코드를 바꾸면
Google Apps Script 편집기에도 반영하고 새 버전으로 배포해야 합니다.
Git push만으로 Apps Script 서버가 갱신되지는 않습니다.

웹 앱의 실행 사용자는 소유자, 접근 권한은 모든 사용자로 설정합니다.
배포된 `/exec` URL은 `public/config.js`의 `scriptUrl`에 지정합니다.

답변은 저장 성공 후에만 입력창에서 지워집니다. 같은 입력으로 재시도하면
동일한 요청 ID를 사용하며, 서버는 6시간 동안 중복 저장을 방지합니다.
목록은 탭이 보이는 동안 15초마다 갱신됩니다.

## 배포

변경 사항을 커밋하고 GitHub에 반영한 뒤 실행합니다.

```sh
git push origin main
npm run deploy
```

배포 명령은 커밋된 `public/`만 `gh-pages` 브랜치에 올립니다.
이후 GitHub의 Pages 배포 작업이 완료되면 사이트에 적용됩니다.
JavaScript나 CSS를 변경할 때는 HTML의 해당 파일 URL 버전도 갱신해
브라우저가 이전 캐시를 사용하지 않도록 합니다.

새 저장소를 만들 때 GitHub Settings → Pages에서 Source는 `Deploy from a branch`,
Branch는 `gh-pages`, 폴더는 `/ (root)`로 지정합니다.
`main` 최상위 폴더에는 화면용 index.html이 없으므로 배포 대상으로 사용하지 않습니다.
