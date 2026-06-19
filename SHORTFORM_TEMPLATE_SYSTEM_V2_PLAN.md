# shorts_maker — v2 페이지 조립형 광고 시스템 (SHORTFORM_TEMPLATE_SYSTEM_V2 구현 플랜)

> **이전 페이즈 완료(as-built)**: 3단계 비교 위자드(P0~P8) → Remotion 렌더 전면 전환(R0~R4) → 트렌드+LLM 큐레이션(T0~T1) 모두 구현·브라우저 검증 완료. 상세는 git 이력/이전 플랜 참조.
> 이 문서는 **신규 워크스트림**: 셀퍼 제품 광고용 페이지 조립형 템플릿 시스템(v2 스펙)을 기존 앱에 추가한다.

## Context
사용자가 `SHORTFORM_TEMPLATE_SYSTEM_V2.md` 스펙을 제시: 고정 9-beat가 아닌 **페이지 단위 조립**으로 제품 광고 숏폼(TapNow 레퍼런스, 9:16)을 만든다. 페이지 1개 = ①비주얼 템플릿 + ②모션 템플릿 + ③전환 템플릿 + 소스(이미지/클립) + caption/VO. 페이지 길이는 VO(TTS) 길이가 기본 결정. LLM이 트렌드 주제+제품 정보+템플릿 카탈로그로 pages[]를 자동 구성하고, 사용자가 편집 후 TTS→렌더. 기존 앱은 Remotion 연동·트렌드 기능이 이미 있으므로 이를 업그레이드한다.

## 확정 결정 (사용자 Q&A)
| 항목 | 결정 |
|---|---|
| 기존 비교 위자드와 관계 | **새 모드로 공존** — 새 라우트 `/ad`, 기존 위자드·Source Studio 유지, 인프라(저장·생성·트렌드·렌더) 공유 |
| 대본 LLM | **OpenRouter 경유 OpenAI 모델** (`openai/gpt-4.1` 기본, `AD_COMPOSE_MODEL` env로 교체) — 기존 클라이언트/키 재사용 |
| VO TTS | **ElevenLabs** (`ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID`) — 어댑터로 분리해 교체 가능 |
| 마일스톤 | **최대한 잘게 쪼개기** — 매 스텝 독립 검증(typecheck + 런타임 관찰) |
| 언어 | v1은 **ko 단일** (caption/vo는 LocalizedText 아닌 단일 문자열) |
| BGM 생성 API·Lambda·클립 매니페스트 | **후순위** (BGM은 라이브러리/업로드만, 렌더는 로컬만) |
| VO보다 짧은 수동 길이 | **경고만** (자르지 않음, UI 배지) |

## 사전 검증된 사실
- `@remotion/player@4.0.473`·`@remotion/media-parser@4.0.473` 이미 node_modules에 전이 설치(버전 일치) → 직접 의존성으로 승격만.
- `assets/bgm/track.mp3`, `assets/brand/logo.png` 존재 → `public/`으로 복사해 BGM 라이브러리·엔드카드 로고 시드.
- `app/api/file/route.ts` MIME 맵에 `.mp3` 없음 → 추가 필요.
- `listCompositions()`가 `outputs/results/` 전체를 스캔 → `ad/` 프로젝트가 비교 위자드 최근목록에 새어 들어감 → **`stages` 없는 entry 스킵 필터 필수**(Step 9).
- zod 4.4.3: `z.toJSONSchema` 사용 가능(compose의 json_schema response_format에 활용).

## 아키텍처 요약
- **단일 스키마**: `lib/ad/schema.ts` (클라이언트 안전, zod) — AdProject/AdPage/PageSource/AdEndcard/AdBgm/AdProduct/ComposeOutput. 모든 경계(LLM 출력·UI 저장·렌더 props)에서 `parseAdProject()` 재사용.
  - `AdPage = { id, sourceType, source, visualTemplateId, motionTemplateId, transitionTemplateId, caption, vo, voAudio?{path,durationSec,hash}, durationOverrideSec?, imagePrompt?, clipQuery? }`
  - `PageSource = {kind:"none"} | {kind:"asset", ref: AssetRef} | {kind:"upload", path}` — 기존 `AssetRef`(lib/composition-types.ts) 재사용.
- **저장**: `lib/ad/store.ts` (server-only) — `outputs/results/ad/<ts>/index.json`, projectId=`ad/<ts>`, `lib/post/composition.ts` 패턴 미러(timestamp/safe는 `@/lib/storage` 재사용). VO mp3는 `.../audio/page-<id>-<hash8>.mp3` (hash=sha256(voiceId+vo) 앞 8자 — 변경 없으면 스킵, 스테일 정리).
- **템플릿 레지스트리**: `remotion/ad/templates/` — 파일 1개=템플릿 1개, `meta: TemplateMeta {id, category, name(한글), compatibleSourceTypes, defaultDurationSec?, describe(영문 1줄→LLM용)}` + 컴포넌트/팩토리 export. `registry.ts`의 `catalog()`(JSON-safe 메타만)가 **UI 드롭다운과 LLM 프롬프트의 단일 소스**. 전 파일 브라우저 안전(Player에서 import).
  - 초기 세트: visual 6(fullscreen-title, talking-head-caption[video], ui-demo-frame, canvas-grid[image], model-selector, plain-caption) / motion 5(none, ken-burns-zoom[image], pan[image], shrink-into-ui(시그니처: 풀스크린→spring 축소→UI 프레임 안착), caption-pop) / transition 6(cut=Transition 미삽입, fade, slide, wipe, zoom-blur, dreamy-zoom — `@remotion/transitions/*` 재사용) / endcard 2(logo-blur-in, logo-cta).
- **AdComposition** (`remotion/ad/AdComposition.tsx`): TransitionSeries로 pages 순회(모션 래퍼→비주얼), 오디오는 시리즈 **밖** 2개 레인 — ①VO: 페이지 오프셋별 `<Sequence><Audio>` (VO가 페이지보다 길면 다음 페이지로 흘러감=경고만 정책), ②BGM: `<Audio loop volume={f=>bgmVolumeAt(f)}>` (VO 구간 0.6→0.25 덕킹, ~9프레임 램프). `remotion/Root.tsx`에 `<Composition id="Ad">` 추가 등록(기존 "Short"와 공존, calculateMetadata=adTotalFrames).
- **프레임 수학**: `remotion/ad/lib/timeline.ts` (순수 함수) — `pageFrames = (override ?? voAudio.durationSec ?? visual 기본 3s)×30`, 전환은 `min(요청, 양쪽 페이지-1)`로 클램프, `adTotalFrames = Σpages − Σ전환겹침 (+endcard)`, `voIntervals`/`bgmVolumeAt`.
- **Player 미리보기**: `components/ad/PlayerPreview.tsx` — `dynamic(()=>import("@remotion/player"), {ssr:false})`, `inputProps={{project, assetBase:""}}`(상대 `/api/file`), 서버 렌더는 origin assetBase — 기존 `assetUrl` 패턴 그대로. `serverExternalPackages`에 remotion/player 추가 금지.
- **VO 길이 측정**: `@remotion/media-parser`의 `parseMedia({src, reader: nodeReader, fields:{slowDurationInSeconds:true}})` — 동일 벤더·동일 버전, 신규 서드파티 0.
- **LLM compose**: `lib/ad/compose.ts` — OpenRouter `openai/gpt-4.1`, `response_format: json_schema(z.toJSONSchema(ComposeOutput))` → 실패 시 `json_object` 폴백, `max_tokens 8000`, `lib/topic/curate.ts`의 truncation-recovery `parseJson`을 `lib/openrouter/json.ts`로 추출해 공유. 미존재 템플릿 id는 안전 기본값으로 **코어션**(visual→plain-caption, motion→none, transition→cut) + 한글 경고 반환, 유효 페이지 0개일 때만 1회 재시도. 제약: 5~10페이지·총 30~45초·caption ≤20자·VO 2~4초·과장/효능 단정 금지.
- **TTS**: `/api/ad/tts` 페이지 단위 POST(클라이언트가 순차 배치, 개별 재생성=동일 엔드포인트), 서버 `pLimit(2)`, ElevenLabs `eleven_flash_v2_5`/`mp3_44100_128`, hash 일치 시 no-op.
- **렌더**: `lib/render-remotion/engine.ts`에서 제네릭 `renderVideo({compositionId, inputProps, outAbs, muted})` 추출(기존 `renderRemotion`은 동작 불변 래퍼), `lib/ad/render.ts`는 id="Ad"·**muted:false**·`renders/ad-ko-<ts>.mp4`. `/api/ad/render`는 기존 SSE 이벤트 형태 복제.
- **UI**: `app/ad/page.tsx`(생성: tapnow-9beat 프리셋|빈 프로젝트 + 주제 입력 + TopicSuggest 재사용 + 최근 목록) → `components/ad/AdEditor.tsx`(Wizard의 compRef+400ms 디바운스 저장+busy 락 패턴 복제). PipelineBar(대본 생성→TTS→렌더 상태), PageList(추가/복제/삭제/**위·아래 버튼** — dnd 의존성 없음), PageInspector(소스타입 토글, SourceChooser ai|upload|pool(HistoryPicker 재사용), 카탈로그 기반 Select 3종(compatibleSourceTypes 필터·전환 시 비호환 id 기본값 코어션), caption/vo, 길이 오버라이드+VO 초과 경고 배지, VO 재생성+`<audio>` 미리듣기), PlayerPreview, BgmPanel(생성 탭은 "준비 중" 비활성/라이브러리+업로드), EndcardPanel, ProductPanel, AdRenderPanel. 디자인: docs/DESIGN.md 토큰·custom Select 준수.
- **프리셋**: `lib/ad/presets/tapnow-9beat.ts` — 9페이지 + product 시드 팩토리.

## 빌드 순서 (잘게 쪼갠 스텝 — 각각 typecheck+검증, 보고는 한글)
**[R]** = dev 서버 재시작 필요.

**Step 0. 플랜 루트 저장**: 이 플랜을 `SHORTFORM_TEMPLATE_SYSTEM_V2_PLAN.md`로 저장소 루트에 저장(사용자 요청). 스펙 원문(`SHORTFORM_TEMPLATE_SYSTEM_V2.md`)도 루트에 저장.

**Phase 1 — 기반 + 빠른 가시화**
1. **의존성+env+mp3 서빙** [R]: package.json에 `@remotion/player`/`@remotion/media-parser` ^4.0.473 추가, `lib/env.ts`에 getElevenLabsKey/getElevenLabsVoiceId, `.env.example` 갱신, `/api/file` MIME에 `.mp3`/`.wav`. 검증: npm i·tsc·dev 부팅.
2. **스키마**: `lib/ad/schema.ts` (zod4, `z.record(z.string(), z.unknown())` 주의). 검증: tsc.
3. **타임라인 수학+템플릿 타입**: `remotion/ad/types.ts`, `remotion/ad/lib/timeline.ts` (순수·브라우저 안전). 검증: tsc.
4. **최소 템플릿+레지스트리**: plain-caption / motion none / transition cut·fade / SourceLayer(없으면 그라데이션, `<Img>`/`<OffthreadVideo muted>`) / registry+catalog. 검증: tsc.
5. **AdComposition 첫 가동**: AdComposition + default-props(더미 3페이지) + Root.tsx에 id="Ad" 등록. 검증: `npx remotion studio`에서 "Ad" 재생(페이드 전환·caption 스타일).
6. **나머지 visual 5종**: fullscreen-title, talking-head-caption, ui-demo-frame, canvas-grid, model-selector. 검증: Studio에서 id 바꿔가며 각각 확인.
7. **나머지 motion·transition·endcard**: ken-burns-zoom/pan/shrink-into-ui/caption-pop, slide/wipe/zoom-blur/dreamy-zoom, logo-blur-in/logo-cta(`assets/brand/logo.png`→`public/brand/` 복사), endcard를 AdComposition에 연결. 검증: Studio.
8. **프리셋**: `lib/ad/presets/tapnow-9beat.ts`. 검증: tsc(+Step 10에서 실사용).

**Phase 2 — 영속화 + UI 셸 + 라이브 미리보기**
9. **스토어+CRUD API** [R]: `lib/ad/store.ts`, `/api/ad/project`(create{preset}|save|GET), `lib/client/ad.ts`. **`listCompositions()`에 stages 없는 entry 스킵 필터 추가**. 검증: curl create→`outputs/results/ad/<ts>/index.json` 9페이지, 기존 `/` 최근목록에 ad 미노출.
10. **/ad 랜딩+에디터 셸**: `app/ad/page.tsx`(프리셋/빈 생성+주제+TopicSuggest+최근), `components/ad/AdEditor.tsx`(디바운스 저장), `app/page.tsx` 헤더에 `광고 메이커 →` 링크. 검증: 브라우저 생성·편집·새로고침 영속.
11. **Player 미리보기**: PlayerPreview 마운트. 검증: `/ad`에서 프리셋 재생·스크럽, 길이=adTotalFrames, Pretendard 렌더.
12. **PageList+PageInspector**: 추가/복제/삭제/위아래, 카탈로그 Select 3종(소스타입 전환 시 코어션), caption/vo, 길이 오버라이드+VO 초과 경고. 검증: 모든 편집이 Player에 즉시 반영, 재정렬 시 전환 위치 정상.
13. **소스 해결**: `/api/ad/page-image`(stage-bg 미러, `generateImageSources` 재사용 9:16) + SourceChooser(ai|upload|pool=HistoryPicker modality 연동). 검증: 이미지 생성/풀 선택/업로드가 미리보기에 표시, 비디오 클립 muted 재생.

**Phase 3 — 파이프라인: 대본 → TTS → 오디오 → 렌더**
14. **LLM compose** [R]: `lib/openrouter/json.ts` 추출(curate.ts 갱신), `lib/ad/compose.ts`, `/api/ad/compose`, PipelineBar 대본 생성 버튼(덮어쓰기 confirm+경고 표시). 검증: curl로 5~10페이지·id 전부 카탈로그 내·caption ≤20자, UI에서 페이지 재구성+재생.
15. **TTS+VO 레인** [R]: `lib/ad/tts.ts`, `/api/ad/tts`, PipelineBar 배치+Inspector 개별 재생성/미리듣기. 검증: mp3 생성·durationSec≈실제·페이지 길이가 VO 추종·Player에서 올바른 오프셋 재생·동일 텍스트 no-op·변경 시 스테일 교체.
16. **BGM+덕킹**: `assets/bgm/track.mp3`→`public/bgm/`, BgmPanel(라이브러리+업로드, 생성 탭 비활성), BGM 레인 완성. 검증: VO 구간 0.6→0.25 부드러운 램프.
17. **Endcard+Product 패널**: 토글·템플릿·진입 전환 / 제품 정보 편집. 검증: 총 길이·마지막 비주얼 변화, product가 다음 compose에 반영.
18. **렌더** [R]: engine.ts 제네릭 추출(기존 동작 불변), `lib/ad/render.ts`(muted:false), `/api/ad/render` SSE, AdRenderPanel. 검증: VO+BGM **소리 포함** mp4 생성·길이 일치, 기존 비교 컴포지션 렌더 무회귀 확인.
19. **마감·가드**: 저장 경계 zod 에러 표면화, 전환>페이지 길이 클램프 경고, 빈 풀 안내문("Source Studio에서 클립을 먼저 생성하세요"), caption 카운터, README에 `/ad` 추가. 검증: tsc+lint+전체 파이프라인 수동 1회(트렌드→대본→편집→TTS→렌더).

## 재사용 (정확한 경로)
- `@/lib/storage` timestamp/safe/safeOutputsPath · `@/lib/post/composition.ts` 패턴(미러) · `@/lib/post/source-gen.ts` generateImageSources · `@/lib/openrouter/client.ts` OPENROUTER_BASE/authHeaders/toError · `@/lib/topic/curate.ts` parseJson(→`lib/openrouter/json.ts`로 추출) · `@/remotion/lib/{fonts,style,util}.ts` ensureFonts/textCss/COVER/assetUrl · `@/components/ui/Select` · `@/components/wizard/{HistoryPicker,TopicSuggest}` · `@/lib/client/wizard.ts` uploadFile/fileUrl · `/api/{upload,file,sources}` 그대로.

## 리스크·완화
- Player×Turbopack: remotion 코어는 클라이언트 안전 — serverExternalPackages에 추가 금지, 템플릿 파일은 server-only 모듈 import 금지. dynamic(ssr:false).
- TransitionSeries: 페이지 1개·endcard 없음 케이스 처리, 전환프레임은 이웃 페이지-1로 클램프, cut=미삽입.
- LLM 드리프트/잘림: json_schema→json_object 폴백, max_tokens 8000, truncation recovery, id 코어션 — curate.ts에서 검증된 기법.
- ElevenLabs 비용/지연: 페이지 단위+pLimit(2)+hash 스킵+flash 모델.
- `/api/file` Range 미지원: VO mp3 작아서 무방, Safari `<audio>` 스크럽 문제 시 후속 추가.

## 보류(후속, 스펙 §12 잔여)
- BGM 생성 API(Suno/Lyria) 확정 · Remotion Lambda · 클립 풀 role/topics 매니페스트 · 광고 표현 규정 체크리스트 정밀화 · 프로젝트별 voice 선택 · `/api/ad/bgm-list` 디렉터리 스캔.

## 검증(종단)
트렌드 선택 → 대본 생성(5~10페이지) → 페이지 편집(템플릿 3종 변경이 Player에 반영) → TTS(페이지 길이=VO) → BGM 덕킹 확인 → 로컬 렌더 → **오디오 포함** 9:16 mp4 다운로드·재생. 기존 비교 위자드(`/`)와 Source Studio(`/studio`) 무회귀.
