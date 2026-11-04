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

- `index.html`: 두 질문의 화면과 입력 폼
- `styles/style.css`: 원래 디자인과 모바일 레이아웃
- `script.js`: 목록 렌더링, 입력 상태, 주기적 갱신
- `api.js`: Apps Script 조회·저장 요청
- `config.js`: 웹 앱 URL과 갱신 주기
- `apps-script/Code.gs`: Google Sheets 서버 코드의 관리용 사본
- `tests/`: 외부 시트를 변경하지 않는 테스트
- `scripts/deploy.js`: `main` 브랜치를 GitHub Pages에 배포

## Google Sheets 연결

현재 Apps Script 웹 앱은 연결되어 있습니다. 서버 코드를 바꾸면
Google Apps Script 편집기에도 반영하고 새 버전으로 배포해야 합니다.
Git push만으로 Apps Script 서버가 갱신되지는 않습니다.

웹 앱의 실행 사용자는 소유자, 접근 권한은 모든 사용자로 설정합니다.
배포된 `/exec` URL은 `config.js`의 `scriptUrl`에 지정합니다.

답변은 저장 성공 후에만 입력창에서 지워집니다. 같은 입력으로 재시도하면
동일한 요청 ID를 사용하며, 서버는 6시간 동안 중복 저장을 방지합니다.
목록은 탭이 보이는 동안 15초마다 갱신됩니다.

## 배포

변경 사항을 커밋한 뒤 실행합니다.

```sh
npm run deploy
```

이 명령은 `main` 브랜치를 GitHub에 올립니다. `git push origin main`으로도 배포됩니다.
GitHub Settings → Pages에서 Source는 `Deploy from a branch`, Branch는 `main`,
폴더는 `/ (root)`로 지정합니다. 최상위 `index.html`이 기본 홈페이지입니다.
`.nojekyll`은 파일을 정적 사이트로 그대로 배포하도록 지정합니다.

JavaScript나 CSS를 변경할 때는 HTML의 해당 파일 URL 버전도 갱신해
브라우저가 이전 캐시를 사용하지 않도록 합니다.

## 도배 방지

저장은 서버 발급 일회용 토큰(유효기간 10분)이 있어야 가능합니다.
발급 후 2초 이내 제출은 거부하며 화면은 2.5초 대기 후 전송합니다.
브라우저 식별자는 개인정보 대신 임의 UUID를 로컬 저장소에 보관합니다.

- 같은 브라우저: 최소 15초 간격, 10분에 최대 5개 (양쪽 질문 합산)
- 전체: 서버 시간 기준 1분에 최대 30개
- 같은 질문의 동일 닉네임·답변: 6시간 동안 중복 차단
- 링크, HTML 태그, 숨겨진 제어문자, 12자 이상 동일 문자 반복, 글자가 없는 답변 차단
- 숨김 입력칸이 채워진 요청 차단, 기존 길이 제한·수식 입력 방어 유지

토큰이 만료되면 입력을 유지한 채 다시 시도하도록 안내합니다.
이 제한은 Apps Script 캐시에 기반한 도배 억제 장치입니다. 캐시는 조기 삭제될 수 있고,
봇이 브라우저 ID를 바꿀 수도 있으므로 CAPTCHA 수준의 신원 검증이나 DDoS 방어를 보장하지 않습니다.
설정은 `apps-script/Code.gs`에서 조정하며 변경 후 웹 앱 새 버전 배포가 필요합니다.
