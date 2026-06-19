# 셀퍼 제품 광고 — 페이지 조립형 템플릿 시스템 v2 (빌드 스펙)

> 이 문서는 v1(`SHORTFORM_AD_PIPELINE.md`, 고정 9-beat)을 **대체**하는 작업 스펙입니다.
> v1의 9-beat는 폐기가 아니라 이 시스템 안의 **프리셋 하나**로 강등됩니다.
> 기존에 이사 중인 Next.js UI(Remotion 연동 완료, 트렌드 불러오기/선택 구현 완료)를 **업그레이드**하는 작업입니다.
> 미확정 항목은 §12 TODO에 모았습니다 — 임의 진행 금지, 사용자 확인 후 진행.

---

## 0. 확정된 결정 사항 (변경 금지)

| 항목 | 결정 |
|---|---|
| 영상 목적 | 내 제품·서비스 홍보 광고 (TapNow 레퍼런스 포맷) |
| 구조 | 고정 비트 X → **페이지 단위 조립**. 페이지 (+) 자유 추가/삭제, 개수 가변 |
| 페이지 1개 = 1세트 | **① 비주얼 템플릿 + ② 모션(움직임) 템플릿 + ③ 전환 템플릿** (엔드카드 제외) |
| 페이지 소스 타입 | 페이지마다 **이미지형 / 영상형** 중 선택 |
| 이미지 소스 | AI 이미지 생성 API + 업로드·기존 소스 풀 **둘 다** |
| 영상 소스 | 미리 만든 클립 풀에서 재사용 |
| 구성 주체 | **LLM 자동 구성 + 수동 오버라이드 둘 다** |
| 인터페이스 | **기존 Next.js UI 업그레이드** (Remotion Player 미리보기 + 최종 MP4 렌더) |
| 페이지 길이 | 기본 **VO(TTS) 길이 자동** + 수동 오버라이드 |
| 초기 템플릿 규모 | **TapNow 레퍼런스 재현 세트**부터 |
| 엔드카드 | **생략 가능**, 사용 시 여러 엔드카드 템플릿 중 선택 |
| BGM | Suno·Gemini 등 **생성** + **기존 BGM 업로드/선택** 둘 다 |
| 대본 LLM | OpenAI |
| VO TTS | ElevenLabs(가정, §12) |
| 트렌드 | SerpApi `google_trends_trending_now` (UI에 불러오기/선택 이미 구현됨) |
| 파이프라인-UI | 트렌드 선택(기존) → **"대본 생성" → 대본 편집 → "TTS 생성" → 렌더**의 단계적 UI 신규 필요 |
| 저장 | 기존 UI의 저장 방식(DB 등) 따름 |
| 렌더 | 로컬 CLI / Remotion Lambda **둘 다** 선택 가능 |

---

## 1. 도메인 모델 (핵심 개념)

```
Project
 ├─ pages: Page[]            # 순서 있는 리스트, (+)추가/삭제/드래그 정렬
 ├─ endcard?: EndcardConfig  # optional (생략 가능)
 ├─ audio: { bgm?: BgmConfig }
 └─ meta: { topic, fps, width, height, ... }

Page (1세트)
 ├─ sourceType: "image" | "video"
 ├─ source:    imageRef(생성/업로드) | clipRef(클립 풀)
 ├─ visualTemplateId      # ① 레이아웃/디자인 (자막 배너, 타이틀, UI 프레임 등)
 ├─ motionTemplateId      # ② 움직임 방식 (이미지형: Ken Burns 등 / 영상형: 재생+오버레이 모션)
 ├─ transitionTemplateId  # ③ 다음 페이지로의 전환 (마지막 페이지→엔드카드 포함)
 ├─ caption: string        # 화면 자막
 ├─ vo: string             # 내레이션 문장
 ├─ voAudio?: { path, durationSec }   # TTS 결과
 └─ durationOverrideSec?: number      # 있으면 VO 길이 대신 이 값 사용
```

**규칙**
- 페이지 길이(frames) = `durationOverrideSec ?? voAudio.durationSec ?? 템플릿 기본값(예: 3s)` × fps
- `transitionTemplateId`는 "이 페이지가 끝나고 다음으로 넘어갈 때"의 전환. 마지막 페이지의 전환은 엔드카드로(엔드카드 없으면 무시 또는 페이드아웃).
- VO 오디오는 페이지 경계와 무관하게 **연속 재생**(단일 오디오 레인에 순차 배치).

---

## 2. 템플릿 시스템 설계 (코드 레벨)

### 2.1 3개 카테고리 레지스트리

템플릿 추가 = **파일 1개 추가**로 끝나야 한다. 각 템플릿은 다음을 export:

```ts
// src/remotion/templates/types.ts
export interface TemplateMeta {
  id: string;                       // "visual.fullscreen-title"
  category: "visual" | "motion" | "transition";
  name: string;                     // UI 표시명 (한국어)
  thumbnail?: string;               // UI 선택용 썸네일
  compatibleSourceTypes: ("image" | "video")[];  // visual/motion만 해당
  propsSchema: ZodSchema;           // 템플릿별 옵션(zod)
  defaultDurationSec?: number;      // VO 없을 때 기본 길이
}
```

- **visual 템플릿**: `React.FC<{ page, product }>` → 소스 + 자막/타이틀/UI 프레임 레이아웃 렌더.
- **motion 템플릿**: HOC 또는 훅 형태 → `useCurrentFrame()` 기반으로 visual 컨테이너에 transform/opacity 보간 적용. 이미지형에선 Ken Burns류, 영상형에선 오버레이 등장 모션 등.
- **transition 템플릿**: `@remotion/transitions`의 `presentation + timing` 쌍을 반환하는 팩토리. `cut`은 Transition 미삽입으로 처리.

```ts
// src/remotion/templates/registry.ts
export const registry = {
  visual: { [id]: VisualTemplate },
  motion: { [id]: MotionTemplate },
  transition: { [id]: TransitionTemplate },
};
export const catalog = () => /* LLM·UI에 줄 메타데이터 목록 */;
```

`catalog()` 출력은 ① UI 드롭다운 ② LLM 자동 구성 프롬프트, 두 곳에서 동일하게 사용한다(단일 소스).

### 2.2 초기 템플릿 세트 — TapNow 재현

| 카테고리 | id | 설명 | 소스 호환 |
|---|---|---|---|
| visual | `fullscreen-title` | 풀스크린 소스 + 상단 타이틀 배너 (비트1 풍) | image, video |
| visual | `talking-head-caption` | 풀스크린 + 하단 주황 자막 배너 (비트3·8) | video |
| visual | `ui-demo-frame` | 에디터 UI 목업 프레임(소스이미지·영상·프롬프트창 배치) (비트2) | image, video |
| visual | `canvas-grid` | 노트 캔버스/썸네일 그리드 + 자막 배너 (비트4·5) | image |
| visual | `model-selector` | 모델 셀렉터 드롭다운 오버레이 (비트6) | image, video |
| visual | `plain-caption` | 소스 + 자막 배너만 (범용 b-roll, 비트7) | image, video |
| motion | `none` | 정지(영상은 그대로 재생) | image, video |
| motion | `ken-burns-zoom` | 천천히 줌인/아웃 (이미지형 기본) | image |
| motion | `pan` | 좌우/상하 패닝 (캔버스 비트5) | image |
| motion | `shrink-into-ui` | **시그니처**: 풀스크린→축소되며 UI 노출. spring 보간, `ui-demo-frame`과 짝 (비트1→2) | image, video |
| motion | `caption-pop` | 자막 배너 spring 팝인 (다른 모션과 합성 가능 옵션) | image, video |
| transition | `cut` | 컷 (Transition 미삽입) | — |
| transition | `fade` | `fade()` | — |
| transition | `slide` | `slide({direction})` | — |
| transition | `wipe` | `wipe({direction})` | — |
| transition | `zoom-blur` | `zoomBlur()` (엔드카드 직전용) | — |
| transition | `dreamy-zoom` | `dreamyZoom()` | — |
| endcard | `logo-blur-in` | 로고 블러→선명 (TapNow 마지막) | — |
| endcard | `logo-cta` | 로고 + CTA 버튼 문구 | — |

> **주의**: `shrink-into-ui`는 전환(transition) 프리셋으로 구현 불가(프리셋은 레이어 교체용). motion 템플릿으로 페이지 **내부에서** scale/translate를 spring 보간한다.

### 2.3 9-beat 프리셋

위 템플릿 조합으로 `presets/tapnow-9beat.json`을 정의(페이지 9개 배열). UI의 "프리셋에서 시작" 버튼이 이걸 로드 → 이후 자유 편집.

---

## 3. Remotion 동적 컴포지션

페이지 배열을 그대로 순회해 조립한다. 고정 구조 없음.

```tsx
// AdComposition.tsx (의사코드)
const frames = (p: Page) =>
  Math.ceil((p.durationOverrideSec ?? p.voAudio?.durationSec ?? def(p)) * fps);

<AbsoluteFill>
  {/* 오디오 레인 1: VO 순차 배치 */}
  {pages.map((p, i) => p.voAudio && (
    <Sequence key={i} from={offset(i)} durationInFrames={frames(p)}>
      <Audio src={staticFile(p.voAudio.path)} />
    </Sequence>
  ))}
  {/* 오디오 레인 2: BGM (전체, 볼륨 더킹) */}
  {bgm && <Audio src={bgm.path} volume={(f) => duckUnderVO(f)} loop />}

  <TransitionSeries>
    {pages.map((p, i) => (
      <Fragment key={p.id}>
        <TransitionSeries.Sequence durationInFrames={frames(p)}>
          <ApplyMotion motionId={p.motionTemplateId}>
            <Visual templateId={p.visualTemplateId} page={p} product={product} />
          </ApplyMotion>
        </TransitionSeries.Sequence>
        {p.transitionTemplateId !== "cut" && hasNext(i) && (
          <TransitionSeries.Transition {...resolveTransition(p.transitionTemplateId)} />
        )}
      </Fragment>
    ))}
    {endcard && <EndcardSequence config={endcard} />}
  </TransitionSeries>
</AbsoluteFill>
```

- `calculateMetadata`: `durationInFrames = Σ frames(page) (+ endcard)`. 전환이 길이를 줄이므로(TransitionSeries 특성) 전환 프레임 합산 보정 포함.
- props는 DB에서 읽은 Project 객체 그대로 (zod 검증 후) 주입. **Player(UI 미리보기)와 렌더(local/lambda)가 동일 props를 사용**해야 한다.

---

## 4. Next.js UI 업그레이드 스펙

기존: Remotion Player/렌더 연동 완료, 트렌드 불러오기·선택 완료. **추가할 것:**

### 4.1 페이지 편집기 (핵심 신규)
- 페이지 리스트(세로 카드 or 타임라인 썸네일): **(+) 추가**, 삭제, 드래그 정렬, 복제.
- 페이지 인스펙터(선택 시 우측 패널):
  - 소스 타입 토글(이미지형/영상형) → 소스 선택기(이미지: AI 생성 버튼 + 소스 풀 / 영상: 클립 풀)
  - 템플릿 3종 드롭다운(visual / motion / transition) → `catalog()` 기반, 썸네일 표시, `compatibleSourceTypes` 필터링
  - caption / vo 텍스트 편집
  - 길이: "VO 자동" 배지 + 수동 오버라이드 입력
- 변경 즉시 Remotion Player 반영(같은 props 객체).

### 4.2 단계적 파이프라인 UI (신규)
트렌드 선택(기존) 이후를 스텝퍼로:
1. **대본 생성** 버튼 → OpenAI가 pages[] 초안 생성(개수·템플릿·caption·vo 자동 선택) → 편집기에 로드
2. 사용자 검토·수정 (자유 편집)
3. **TTS 생성** 버튼 → 페이지별 VO 생성·길이 측정 → 길이 자동 반영, 페이지별 재생성 버튼
4. **렌더** 버튼 → target(local/lambda) 선택 → 진행률 → MP4 다운로드/미리보기

각 스텝은 독립 재실행 가능(대본만 다시, 특정 페이지 TTS만 다시).

### 4.3 BGM 패널 (신규)
- 탭 A: **생성** → Suno / Gemini(Lyria) 등 프롬프트 입력 → 생성 → 트랙 저장 (§12 API 확정 필요)
- 탭 B: **라이브러리** → 업로드 + 기존 트랙 선택
- 공통: 볼륨, VO 더킹 on/off, 루프

### 4.4 엔드카드 패널 (신규)
- on/off 토글(생략 가능) + 엔드카드 템플릿 선택 + 진입 전환 선택.

### 4.5 백엔드
- Project/Page CRUD: **기존 UI의 저장 계층(DB) 확장** → 구현 전 기존 스키마 파악 필수(§10 0단계).
- 렌더 API: 기존 렌더 연동 재사용하되 `target: "local" | "lambda"` 분기 추가.

---

## 5. LLM 자동 구성 (compose)

- 입력: 선택된 트렌드 주제 + `product.json`(가치제안·CTA) + **템플릿 카탈로그(catalog())** + 제약(총 길이 목표, 페이지 수 범위 예 5~10, 자막 ≤20자, VO 페이지당 2~4초 분량).
- 출력(Structured Outputs, zod 검증): `pages[]` — 각 페이지의 sourceType, 템플릿 3종 id(카탈로그 내 id만 허용), caption, vo, (영상형이면) 클립 topics 힌트.
- 클립/이미지 실제 배정은 LLM이 아니라 **clip-select 로직**이 수행: topics 매칭 → generic 폴백. 이미지형 페이지는 "AI 생성 프롬프트 제안"까지 LLM이 출력하되 생성 실행은 사용자 버튼.
- 톤 가이드: TapNow류 구어체 후킹, 과장·효능 단정 금지 규칙 프롬프트 명시.

---

## 6. 오디오 사양

- **VO**: 페이지별 TTS(ElevenLabs 가정) → `durationSec` 측정(ffprobe/get-audio-duration) → 페이지 길이 기본값.
- **BGM**: 단일 트랙, 영상 전체 루프, VO 구간 볼륨 더킹(예: 0.25 ↔ 0.6, 프레임 기반 보간).
- 수동 길이 오버라이드가 VO보다 짧으면: VO 잘림 경고 표시(자르지 않고 경고만 → 정책 §12).

---

## 7. 트렌드 (기존 구현 유지)

- SerpApi `google_trends_trending_now` geo=KR → UI에 불러오기/선택 이미 구현됨. 변경 없음.
- 무료 티어 절약: 일 1~2회 호출 + 자체 캐시 12h 유지 권장.

---

## 8. 렌더

- 동일 Project props로 두 경로:
  - local: `@remotion/renderer` `renderMedia()` (Next.js 서버 라우트 또는 별도 CLI)
  - lambda: `@remotion/lambda` `renderMediaOnLambda()` (사전 deploySite/deployFunction)
- UI 렌더 버튼에서 target 선택. CLI 단독 실행 경로도 유지(자동화/배치용).

---

## 9. 데이터 검증

- 모든 경계(LLM 출력, UI 저장, 렌더 props)에서 zod 스키마 단일 정의(`schema.ts`) 재사용.
- 템플릿 id는 registry에 존재하는지 런타임 검증. motion/visual은 `compatibleSourceTypes` 검사.

---

## 10. 빌드 순서 (Claude Code 작업 단계)

0. **기존 코드 파악(필수 선행)**: Next.js UI의 디렉터리 구조, DB 스키마/ORM, Remotion 연동 방식(Player 위치, 렌더 트리거), 트렌드 기능 위치를 먼저 읽고 요약 → 사용자 확인 후 진행.
1. `schema.ts`(Project/Page/템플릿 zod) + 템플릿 레지스트리 골격(`types.ts`, `registry.ts`, `catalog()`).
2. 동적 `AdComposition`(§3) + `calculateMetadata` → 더미 Project JSON으로 Player에서 확인.
3. TapNow 재현 템플릿 세트(§2.2) 구현 → visual 6종 → motion 5종(특히 `shrink-into-ui`) → transition 6종 → endcard 2종. 각각 더미 데이터로 개별 확인.
4. 9-beat 프리셋 JSON 작성 → 프리셋 로드로 TapNow 광고 1편 재현 렌더(마일스톤).
5. UI: 페이지 편집기(리스트 + 인스펙터 + Player 연동) → DB CRUD 포함.
6. UI: 단계적 파이프라인(대본 생성 → TTS) + OpenAI compose(§5) + TTS 모듈.
7. UI: BGM 패널(라이브러리 먼저, 생성 API는 확정 후) + 엔드카드 패널.
8. 렌더 target 분기(local/lambda) + CLI 경로.
9. 클립 풀 매니페스트/clip-select, 이미지 생성 연동(§12 확정 후).

> 각 단계 산출물은 Player로 즉시 확인 가능한 상태 유지. 3~4가 1차 마일스톤("TapNow 재현 1편").

---

## 11. v1에서 승계되는 사항

- 9-beat 분석표·전환 매핑(`shrink-into-ui`는 프리셋 불가, 직접 보간) → §2.2에 반영됨.
- SerpApi 절약 전략, OpenAI Structured Outputs, VO 기반 동적 길이, 환경변수 구성.
- `product.json` / 클립 매니페스트 개념(저장 위치만 DB로 이동 가능).

---

## 12. TODO — 확정 필요 (임의 진행 금지)

- [ ] **기존 Next.js 코드 구조**: DB/ORM 종류, Remotion 연동 방식, 렌더가 이미 local인지 lambda인지. (0단계에서 파악 후 사용자 확인)
- [ ] **TTS 제공자**: ElevenLabs 가정. 한국어 보이스·요금 확인 또는 대체(OpenAI TTS 등).
- [ ] **BGM 생성 API**: Suno 공식 API 접근 가능 여부/요금, Gemini(Lyria) 엔드포인트·라이선스(상업적 사용) 확인 필요. 미확정 시 라이브러리(업로드)만 먼저.
- [ ] **AI 이미지 생성 API**: 어떤 제공자(OpenAI 이미지, 기타)·비용.
- [ ] **페이지 수 범위·총 길이 목표**: LLM compose 제약값(예: 5~10페이지, 30~45초).
- [ ] **VO보다 짧은 수동 길이 정책**: 경고만 vs 오디오 트림 vs 배속.
- [ ] **클립 풀 실물**: 보유 클립 목록과 role/topics 태깅.
- [ ] **제품 정보**: product.json 실제 값(제품명/가치제안/CTA/브랜드 컬러·로고).
- [ ] **대본 LLM 모델**: OpenAI 모델 확정.
- [ ] **Lambda**: AWS 계정/리전/버킷 준비 여부.
- [ ] **광고 표현 규정 체크리스트**: 과장·비교광고 금지 문구 가이드.
