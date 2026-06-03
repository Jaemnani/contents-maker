# Shorts Maker

같은 프롬프트를 **여러 AI에 돌려** 9:16 세로 비교 숏폼을 만드는 로컬 웹앱.
"같은 프롬프트, 다른 AI — 어느 쪽이 더 좋아?"를 시작/본론(상·하 비교)/끝 3단계로 구성해
무음 1080×1920 MP4로 렌더한다. (ko/ja/en 다국어 출력)

OpenRouter / fal.ai / WaveSpeed의 이미지·영상 모델을 한곳에서 사용한다.

## 두 영역
- **Source Studio (`/studio`)** — 한 프롬프트 × 여러 모델로 소스(이미지/영상)를 미리 생성해 저장.
- **Wizard (`/`)** — 시작 → 본론 → 끝 단계로 구성하고 렌더. 소스는 즉석 생성하거나 히스토리에서 불러온다.
  본론은 "같은 프롬프트" 제약으로 A/B를 고른다.

## 빠른 시작
```bash
npm install
cp .env.example .env.local   # API 키 입력 (절대 커밋 금지)
npm run dev                  # http://localhost:3000
```
ffmpeg / ffprobe 가 PATH에 있어야 한다(영상 합성·썸네일).

## 환경변수 (`.env.local`)
- `OPENROUTER_API_KEY` (필수) · `OPENROUTER_SITE_URL` · `OPENROUTER_SITE_NAME`
- `FAL_API_KEY` · `WAVESPEED_API_KEY`
- `FFMPEG_PATH` · `FFPROBE_PATH` (기본: PATH의 ffmpeg/ffprobe)

## 구조
- `lib/openrouter|fal|ws` — 제공자 클라이언트, `lib/models.ts` + `data/models.json` — 모델 레지스트리
- `lib/render/*` — FFmpeg 렌더 엔진(카드 + 본론 3종 레이아웃: split/panels/headline, 무음)
- `lib/storage.ts` · `lib/post/composition.ts` — `outputs/sources` + `outputs/results` 저장
- `app/api/*` — 생성/합성/렌더(SSE) API · `components/wizard/*` — 위자드 UI
- 디자인 토큰: `docs/DESIGN.md` → `app/globals.css` `@theme`

## 산출물 저장 (`outputs/`, git 미추적)
- `sources/<type>/<ts>/` — 생성 소스 + `index.json`(프롬프트·모델·썸네일)
- `results/<type>/<ts>/` — 프로젝트(구성 `index.json`) + `renders/short-<lang>-<ts>.mp4`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
