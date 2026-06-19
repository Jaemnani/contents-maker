# Shorts Maker

같은 프롬프트를 **여러 AI에 돌려** 9:16 세로 비교 숏폼을 만드는 로컬 웹앱.
"같은 프롬프트, 다른 AI — 어느 쪽이 더 좋아?"를 시작/본론(상·하 비교)/끝 3단계로 구성해
무음 1080×1920 MP4로 렌더한다. (ko/ja/en 다국어 출력)

OpenRouter / fal.ai / WaveSpeed의 이미지·영상 모델을 한곳에서 사용한다.
렌더는 **Remotion**(React→MP4, 자체 ffmpeg 내장)으로 수행 — 시스템 ffmpeg 불필요.

## 세 영역
- **Wizard (`/`)** — 비교 숏폼: 시작 → 본론 → 끝 단계로 구성하고 렌더(무음, 다국어).
  본론은 "같은 프롬프트" 제약으로 A/B를 고른다. 트렌드 기반 "비교 프롬프트 추천" 포함.
- **광고 메이커 (`/ad`)** — 페이지 조립형 제품 광고 숏폼(`SHORTFORM_TEMPLATE_SYSTEM_V2.md`):
  페이지 = 비주얼+모션+전환 템플릿 조합. LLM 대본 생성 → 편집(Remotion Player 라이브 미리보기)
  → ElevenLabs TTS(VO 길이=페이지 길이) → BGM 덕킹 → **오디오 포함** MP4 렌더.
- **Source Studio (`/studio`)** — 한 프롬프트 × 여러 모델로 소스(이미지/영상)를 미리 생성해 저장.

## 빠른 시작
```bash
npm install
cp .env.example .env.local   # API 키 입력 (절대 커밋 금지)
npm run dev                  # http://localhost:3000
npx remotion studio          # (선택) 컴포지션 프리뷰 — "Short" + "Ad"
```

## 환경변수 (`.env.local`)
- `OPENROUTER_API_KEY` (필수) · `OPENROUTER_SITE_URL` · `OPENROUTER_SITE_NAME`
- `FAL_API_KEY` · `WAVESPEED_API_KEY`
- 트렌드(선택): `YOUTUBE_API_KEY` · `NEWS_API_KEY` · `SERPAPI_KEY`
- 광고 메이커: `ELEVENLABS_API_KEY`(TTS 필수) · `ELEVENLABS_VOICE_ID`(선택) · `AD_COMPOSE_MODEL`(선택, 기본 openai/gpt-4.1)

## 구조
- `lib/openrouter|fal|ws` — 제공자 클라이언트, `lib/models.ts` + `data/models.json` — 모델 레지스트리
- `remotion/` — Remotion 컴포지션: `Short`(3단계 비교) + `ad/`(페이지 조립형 광고)
  - `remotion/ad/templates/meta.ts` — 템플릿 메타(순수 데이터; UI·LLM 카탈로그의 단일 소스, 서버 안전)
  - `remotion/ad/templates/registry.ts` — 메타+컴포넌트 바인딩(브라우저/Remotion 전용)
- `lib/render-remotion/engine.ts` — 프로그래매틱 렌더(번들 캐시, `renderVideo` 공용 코어)
- `lib/ad/` — 광고 도메인: `schema.ts`(zod 단일 스키마) · `store.ts` · `compose.ts`(LLM) · `tts.ts` · `render.ts`
- `lib/storage.ts` · `lib/post/composition.ts` — `outputs/sources` + `outputs/results` 저장
- `app/api/*` — 생성/큐레이션/렌더(SSE) API · `components/wizard|ad/*` — UI
- 디자인 토큰: `docs/DESIGN.md` → `app/globals.css` `@theme`

## 산출물 저장 (`outputs/`, git 미추적)
- `sources/<type>/<ts>/` — 생성 소스 + `index.json`(프롬프트·모델·썸네일)
- `results/<type>/<ts>/` — 비교 숏폼 프로젝트 + `renders/short-<lang>-<ts>.mp4`
- `results/ad/<ts>/` — 광고 프로젝트(`index.json`) + `audio/`(VO mp3) + `renders/ad-ko-<ts>.mp4`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
