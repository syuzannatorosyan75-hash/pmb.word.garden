# PMB Word Garden · 배포 패키지

Claude 밖에서도 **같은 화면, 같은 기능**으로 열리도록 만든 묶음이에요.
앱 본문(`index.html`)의 기능 코드는 그대로이고, 아래 파일들만 추가됐어요.

| 파일 | 역할 |
|---|---|
| `index.html` | 앱 본문 (기능 그대로) + 설치용 연결 태그 몇 줄 |
| `claude-shim.js` | Claude 기능 대신 쓰는 어댑터 (다운로드, AI 연결) |
| `config.js` | 설정 (AI 주소 등). 여기만 고치면 돼요 |
| `manifest.webmanifest`, `icon-*.png`, `sw.js` | 앱으로 설치하기, 오프라인 열기 |
| `_headers` | Cloudflare Pages용 캐시 설정 (다른 곳에 올리면 무시돼도 괜찮아요) |
| `ai-proxy/worker.js` | AI 기능을 위한 중계기 (무료 Gemini 또는 Claude API) |
| `backend/worker.js` | 온라인 계정·기기 간 동기화·회원 목록을 위한 저장소 (Cloudflare D1, 무료) |

## 그대로 되는 것
- 단어장, 퀴즈, 발음, 번역, 밤/낮 테마, 애니메이션 전부
- PDF 단어장·테스트지·학습 리포트, 카드 이미지, 백업 파일 **다운로드**
- 가입·로그인 (이 기기 안에 저장)
- 설치해서 앱처럼 열기, 한 번 연 뒤에는 인터넷 없이도 열기

## 달라지는 것 (솔직하게)
1. **온라인 계정은 5단계 설정이 필요해요.** 설정하지 않으면 계정과 단어는 지금 쓰는 기기의 브라우저에만 저장돼요(백업 파일로 옮길 수 있어요). 설정하면 Claude 안과 같은 방식으로 다른 기기에서 같은 이름·숫자로 로그인하고, 선생님은 회원 목록을 볼 수 있어요.
2. **AI 기능은 설정이 필요해요.** AI로 채우기, 사진으로 단어 추가, 헷갈리는 단어 설명은 `ai-proxy` 배포와 무료 AI 키가 있어야 켜져요. 설정 전에는 "이 화면에서는 AI를 쓸 수 없어요"라고 안내돼요.
3. 계정 화면의 "이 기기 전용 모드" 안내 끝 문장은 Claude 기준 문구라서, Claude 밖에서는 무시해 주세요.

## 1단계 · 호스팅하기 (무료, HTTPS 자동)

**방법 A. Cloudflare Pages (추천)**
개인·학원 운영 모두 무료로 쓸 수 있고 트래픽 제한이 없는 정적 호스팅이에요. (Vercel 무료 플랜은 개인·비영리 전용이라 수강료를 받는다면 피하세요.)
1. cloudflare.com 가입 → 대시보드의 **Workers & Pages** → **Create** → **Pages** → **Upload assets**
2. 프로젝트 이름을 정해요 (예: `pmb-word-garden`)
3. 이 폴더의 **파일들을 전부** 올리고 Deploy
4. `https://pmb-word-garden.pages.dev` 같은 주소가 생기면 완료
(화면 이름은 바뀔 수 있어요. 직접 업로드 메뉴가 안 보이면 방법 B를 쓰세요.)

**방법 B. GitHub Pages**
1. github.com에서 **공개(Public)** 저장소를 새로 만들고 파일을 업로드
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)` 저장
3. `https://계정이름.github.io/저장소이름` 주소로 접속

> 공개 주소는 누구나 열 수 있어요. 단어 데이터는 서버에 올라가지 않으니 파일 자체에는 개인정보가 없어요.

## 2단계 · 앱처럼 설치하기
- **안드로이드 Chrome**: 오른쪽 위 ⋮ → **앱 설치** (또는 홈 화면에 추가)
- **아이폰 Safari**: 공유 버튼 → **홈 화면에 추가**
- **PC Chrome·Edge**: 주소창 오른쪽의 설치 아이콘

설치하면 주소창 없이 전체 화면으로 열려요.

## 3단계 · AI 기능 켜기 (무료)
무료 Google Gemini API를 씁니다. 결제 수단 없이 키만 있으면 되고, 아래 무료 한도 안에서 개인 학습 정도는 충분해요. 앱의 Claude 모델과는 답변 스타일이 조금 다를 수 있어요.

1. **API 키 발급**: aistudio.google.com 에 Google 계정으로 로그인 → **Get API key** → 키 만들기. 키를 복사해 두세요.
2. **사용할 모델 이름 확인**: AI Studio의 모델 목록에서 이름에 `flash`가 들어간 무료 모델을 고르세요. 처음에는 `gemini-flash-latest`로 두면 됩니다. 무료 한도와 모델 이름은 자주 바뀌니, 안 되면 AI Studio에서 최신 이름을 확인하세요.
3. **Worker 만들기**: Cloudflare → **Workers & Pages** → **Create** → **Worker** → 코드 편집기에 `ai-proxy/worker.js` 내용을 붙여넣고 Deploy (Cloudflare 무료 플랜으로 충분해요)
4. Worker의 **Settings → Variables and Secrets**에 입력
   - `AI_PROVIDER` : `openai`
   - `AI_URL` : `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
   - `AI_MODEL` : `gemini-flash-latest` (또는 2번에서 확인한 이름)
   - `AI_KEY` : 1번에서 받은 키 (**Secret**으로 저장)
   - `ALLOW_ORIGIN` : 앱 주소 (예: `https://pmb-word-garden.pages.dev`)
5. `config.js`의 `aiEndpoint`에 Worker 주소(예: `https://pmb-ai.계정이름.workers.dev`)를 넣고 파일을 다시 업로드
6. 사진으로 단어 추가도 그대로 쓸 수 있어요 (`aiImages: true`).

**알아 두실 점**
- 무료 한도를 넘으면 AI가 "응답하지 못했어요"라고 안내돼요. 하루 사용량이 많으면 다음 날 다시 되는 경우가 많아요.
- Google 무료 등급은 약관상 입력 내용이 제품 개선에 쓰일 수 있어요. 단어 학습 요청에는 개인정보가 들어가지 않지만, 사진을 올릴 때는 개인정보가 찍히지 않게 주의해 주세요.
- 유료로 바꾸고 싶으면 `AI_PROVIDER`를 `anthropic`으로 두고 `AI_MODEL`을 `claude-sonnet-5-5`로 바꾸면 Claude 모델을 쓸 수 있어요 (API 키는 console.anthropic.com에서 발급, 사용한 만큼 요금이 나가요).

## 4단계 · 백업 습관
계정과 단어장은 기기마다 따로 저장돼요. 주 1회 정도 앱에서 **백업**을 눌러 파일을 보관하세요.

## 5단계 · 온라인 계정·회원 관리 (무료, 선택)
Cloudflare D1은 무료 플랜으로 소규모 학원 규모는 충분해요. 정확한 한도는 대시보드에서 확인하세요.

1. Cloudflare → **Workers & Pages** → **D1** → **Create database** → 이름을 `pmb-db`로 정해요
2. **Workers & Pages** → **Create** → **Worker** → 이름 `pmb-backend` → 코드 편집기에 `backend/worker.js` 내용을 붙여넣고 Deploy
3. 이 Worker의 **Settings → Bindings → Add → D1 database**: 변수 이름을 **`DB`**로 두고 `pmb-db` 선택
4. 같은 화면의 **Variables and Secrets**
   - `ALLOW_ORIGIN` : 앱 주소 (예: `https://pmb-word-garden.pages.dev`)
   - `OWNER_KEY` : 선생님만 아는 긴 문자열 (**Secret**, 20자 이상 무작위로)
5. `config.js`의 `backendUrl`에 Worker 주소(예: `https://pmb-backend.계정이름.workers.dev`)를 넣고 앱 파일을 다시 업로드

**선생님 기기 등록**: 앱 주소 뒤에 `#owner=OWNER_KEY`를 붙여 한 번 열면 이 기기가 선생님 기기로 기억되고, 주소에서는 지워져요. 그 뒤 앱의 회원 목록에서 가입자와 이름을 볼 수 있어요. 이 주소는 다른 사람에게 보내지 마세요.

**꼭 알아 두실 점 (Claude 안과 다른 부분)**
- Claude 안에서는 로그인한 사람만 데이터를 쓸 수 있어요. 여기서는 **앱 주소와 저장소 주소를 아는 누구나 저장소에 요청을 보낼 수 있어요.** 회원 목록은 선생님 열쇠 없이는 볼 수 없게 막아 두었지만, 쓰기는 막지 않았어요.
- 이 때문에 Cloudflare 대시보드에서 `pmb-backend`에 **Rate limiting** 규칙을 켜 두는 것을 권해요(무료 플랜에도 기본 규칙이 있어요). 가입자가 많아지면 한 번 점검해 주세요.
- 회원의 이메일과 생년월일 확인값이 저장돼요. 가입 화면에 개인정보 안내 문구를 준비하고, 요청이 있을 때 삭제해 줄 수 있어야 해요.
- 이 저장소는 동작을 Claude 안에서 쓰는 것과 같게 맞췄지만, 보안 수준은 Claude 플랫폼보다 낮아요. 학원 규모로 쓰는 것을 전제로 해 주세요.

