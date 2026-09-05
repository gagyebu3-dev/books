# 내 서재 — 독서 기록 PWA

폰에 설치해서 오프라인으로도 쓸 수 있는 개인용 독서 기록 앱이에요.
데이터는 이 앱을 여는 폰의 브라우저 안에만 저장돼요 (다른 사람과 공유되지 않아요).

## 파일 구성
```
reading-app/
  index.html
  style.css
  app.js
  manifest.json
  service-worker.js
  icons/
```

## 1. 무료 호스팅에 올리기 (둘 중 하나만 하면 돼요)

### 방법 A — GitHub Pages (가장 흔한 방법)
1. github.com 에서 새 저장소(Repository)를 만들어요. (Public이면 충분해요)
2. 이 폴더 안의 파일들을 전부 그 저장소에 업로드해요.
   - GitHub 웹사이트에서 "Add file → Upload files"로 드래그해서 올려도 돼요.
3. 저장소의 **Settings → Pages**로 들어가서
   - Source를 "Deploy from a branch"로, Branch를 `main` / `(root)`로 설정하고 저장해요.
4. 몇 분 후 `https://내아이디.github.io/저장소이름/` 링크가 생겨요.

### 방법 B — Netlify (가입 없이도 가능, 더 간단함)
1. https://app.netlify.com/drop 접속
2. `reading-app` 폴더 전체를 그대로 화면에 드래그 앤 드롭
3. 자동으로 `https://아무이름.netlify.app` 링크가 생성돼요.

## 2. 폰에 설치하기
1. 위에서 만든 링크를 폰 브라우저로 열어요.
   - **안드로이드(Chrome)**: 우측 상단 메뉴 → "앱 설치" 또는 "홈 화면에 추가"
   - **아이폰(Safari)**: 하단 공유 버튼(⬆️) → "홈 화면에 추가"
2. 홈 화면에 "내 서재" 아이콘이 생겨요. 탭하면 브라우저 주소창 없이 전체 화면 앱처럼 열려요.
3. 한 번 열어둔 뒤에는 인터넷이 없어도 계속 쓸 수 있어요 (오프라인 캐싱 적용됨).

## 참고
- HTTPS가 필요해요 (GitHub Pages, Netlify 모두 자동으로 HTTPS를 제공해요).
- 앱을 다른 폰이나 브라우저에서 열면 그 기기에는 데이터가 없어요 (기기별 저장이라서요). 여러 기기에서 동기화하려면 별도 백엔드가 필요한데, 필요하시면 말씀해 주세요.
- 아이콘/색상/문구를 바꾸고 싶으면 `manifest.json`과 `style.css`, `icons/` 폴더를 수정하면 돼요.
