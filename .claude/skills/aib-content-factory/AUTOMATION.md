# AUTOMATION.md — aib-content-factory 자동화 구현 지시서

이 문서는 **VS Code의 Claude Code**가 읽고, `aib-content-factory` 스킬의 6단계 수순을
현재 앱(Next.js 16 + Remotion 4 + TypeScript)에 **점진적으로 자동화**해 구현하기 위한 설계도다.

- 스킬 수순의 근거: 같은 폴더의 `SKILL.md` (6 STEP)
- 카피 말투 규칙: `references/voice.md`
- 숏폼 배포 형식: `references/shortform_distribution.md`
- 브랜드 로고: `assets/aib-lockup-black.png`

이 문서는 **설계 지시서**다. 코드를 지어내 붙이기보다, 아래 구조에 맞춰 기존 파일
(`lib/ad/schema.ts`, `lib/ad/store.ts`, `scripts/ad-auto.mjs`)을 확장하는 방식으로 구현한다.

---

## 0. 대상 아키텍처 (확인된 현황)

- Next.js 16.2.6 App Router + React 19 — 에디터 UI + API 라우트 한 앱
- Remotion 4 — 미리보기 `@remotion/player`, 서버 렌더 `@remotion/bundler`+`@remotion/renderer`
- TypeScript 5 + **zod 4** — `lib/ad/schema.ts`가 LLM출력·저장·렌더 전 구간 단일 검증 경계
- Tailwind 4, sharp, `@remotion/media-parser`, p-limit
- 외부 API(env): OpenRouter(대본LLM·이미지), FAL(이미지/영상/BGM), ElevenLabs·Gemini(TTS), YouTube/뉴스 RSS(트렌드)
- **DB 없음. 파일 기반.** 프로젝트 = `outputs/results/ad/<타임스탬프>/index.json`, 잠금·원자적 쓰기 `lib/ad/store.ts`
- 자동화 러너: `scripts/ad-auto.mjs` (Node, 주기 실행)

---

## 1. 핵심 설계 원칙

### 1-1. STEP = 순수 함수, 개입 = decision 지점
스킬 6 STEP을 각각 독립 함수로 만든다. STEP 사이의 "사람이 정하던 자리"를 **decision 지점**으로 분리한다.
- 함수(콘텐츠 로직)는 자동화 레벨과 무관하게 고정.
- decision을 "누가 넘기느냐"만 레벨에 따라 교체한다 (사람=UI / 러너=규칙).

### 1-2. stage 상태 머신을 index.json에 저장
DB가 없으므로 각 프로젝트 `index.json`에 `stage` 필드를 둔다. 사람과 러너가 **같은 파일·같은 상태**를 공유한다.

```
stage 전이:
 topic_candidates → format_preset → awaiting_source
   → packaged → rendered → awaiting_publish → published

각 화살표 = decision 지점.
awaiting_* 는 "사람 개입이 기본"인 정지 상태.
```

- L0~L1: 화살표를 **UI(사람)** 가 넘김
- L2+: 화살표를 **러너(`ad-auto.mjs`)** 가 자동으로 넘김
- 코드(STEP 함수)는 그대로. 전이 주체만 교체.

### 1-3. zod가 단일 진실
모든 STEP 입출력·저장 데이터는 `lib/ad/schema.ts`의 zod 스키마를 통과해야 한다.
LLM 출력(OpenRouter)도 zod로 파싱·검증한 뒤에만 다음 STEP으로 넘긴다.

---

## 2. 파일 구조 제안 (기존 lib/ad/ 확장)

```
lib/ad/
  schema.ts        (기존) ← 아래 2-1 스키마들 추가
  store.ts         (기존) ← stage 전이 헬퍼 추가 (원자적 쓰기 재사용)
  factory/                 ← 신규: 스킬 6 STEP
    step1-topic.ts         pickTopicCandidates(trends) → TopicCandidate[]
    step2-format.ts        recommendFormats(topic) → FormatPreset
    step3-source.ts        loadSource(input) → Source           (L0: 수동 입력 저장)
    step4-package.ts       packageByType(source, types) → ContentPiece[]
    step5-channel.ts       renderPerChannel(pieces, formats) → ChannelOutput[]
    step6-output.ts        factCheck(pieces) + buildPublishPlan() → PublishPlan
    decision.ts            resolveDecision(project, input) — 사람/러너 공용 진입점
    rules/
      voice.ts             voice.md 규칙을 LLM 프롬프트로 주입하는 빌더
      distribution.ts      shortform_distribution.md 형식을 코드 상수/템플릿으로
  trends.ts        (있으면 재사용) RSS/YouTube 트렌드 수집 → step1 입력
app/api/ad/factory/
  route.ts                 UI가 호출: 현재 stage 조회 + decision 제출
scripts/
  ad-auto.mjs      (기존) ← 자동화 레벨에 따라 decision 자동 호출 로직 추가
```

**원칙:** `references/voice.md`·`references/shortform_distribution.md`의 규칙을 코드에 하드코딩 복붙하지 말고,
`rules/voice.ts`·`rules/distribution.ts`에서 **그 md 파일을 읽어 프롬프트/템플릿으로 변환**한다.
그래야 md만 고치면 동작이 바뀐다(스킬과 코드의 단일 진실 유지).

---

## 2-1. zod 스키마 초안 (schema.ts에 추가)

의미만 정의한다. 실제 타입은 기존 schema.ts 컨벤션(명명·export 방식)에 맞춰 작성할 것.

- **ContentType** = enum: `"lie_speed" | "open_weight" | "opinion_clash"`
  (거짓말·속도 / 오픈웨이트 / 의견대립)
- **Category** = enum: `"ai" | "economy" | "society" | "life_culture" | "it_science" | "world"`
- **TopicCandidate**: `{ title, category, scores:{trend,fit,hook: "high"|"mid"|"low"}, supportedTypes: ContentType[], sourceNote }`
- **FormatKind** = enum: `"text_only" | "card_news" | "single_image" | "shorts" | "ugc_demo"`
- **FormatPreset**: `{ recommended: FormatKind[], selected: FormatKind[] }`  (recommended=기본체크, selected=사람/러너 확정)
- **Source**: `{ kind:"text"|"image", question, modelA:{name,answer}, modelB:{name,answer}, searchMode:"off"|"on", assets: string[] }`
  ※ `searchMode` 필수 — 콘텐츠에 "검색 off/on" 조건을 반드시 명시하기 위함(신뢰성 규칙).
- **ContentPiece**: `{ type: ContentType, hook, body, ctaUrl }`
- **ChannelOutput**: `{ channel: enum, aspectRatio:"9:16"|"4:5", title?, body, tags: string[], parts?: string[] }`
  ※ 스레드·X는 2단이므로 `parts` 사용. 인스타는 `aspectRatio:"4:5"`.
- **FactCheckItem**: `{ claim, treatedAs:"fact"|"model_said", verified:boolean, note }`
- **PublishPlan**: `{ outputs: ChannelOutput[], factCheck: FactCheckItem[], schedule, rotationMemo }`
- **Stage** = enum: `"topic_candidates"|"format_preset"|"awaiting_source"|"packaged"|"rendered"|"awaiting_publish"|"published"`
- **ProjectIndex**(기존 index.json 확장): `{ ...existing, stage: Stage, automationLevel: 0|1|2|3|4, topic?, formatPreset?, source?, pieces?, plan? }`

---

## 3. decision 인터페이스 (사람/러너 공용)

```ts
// decision.ts (의사코드)
resolveDecision(project: ProjectIndex, input?: DecisionInput): Promise<ProjectIndex>
// 현재 stage를 보고 다음 STEP 함수를 실행, stage를 전이시키고 원자적 저장(store.ts).
// input 이 있으면 그 값으로 결정(사람 선택), 없으면 autoResolve(자동 규칙)로 결정.
```

- **UI(app/api/ad/factory/route.ts)**: 사람 선택을 `input`으로 넣어 호출.
- **러너(ad-auto.mjs)**: `input` 없이 호출 → 각 stage의 autoResolve 규칙 사용.
- 두 경로가 **같은 함수**를 부르므로, 자동화는 "input을 안 주는 것"으로 자연히 전환된다.

각 stage의 autoResolve 기본 규칙:
- `topic_candidates` → 스코어(trend>fit>hook 가중) 1위 자동 선택
- `format_preset` → `recommended`를 그대로 `selected`로 확정
- `awaiting_source` → **L3 전까지는 자동 불가**(사람 필수). L3부터 aib.vote 조회로 대체
- `awaiting_publish` → **L4 전까지는 자동 불가**(사람 필수). L4부터 SNS API

---

## 4. 각 STEP 구현 노트

- **STEP1 pickTopicCandidates**: `trends.ts`(RSS/YouTube)에서 6 카테고리 최근 48h 수집 → OpenRouter로 스코어링·유형태깅 → `TopicCandidate[]`. SKILL.md STEP1 규칙(48h 우선, 카테고리 2개↑ 혼합) 준수.
- **STEP2 recommendFormats**: SKILL.md 추천 프리셋(거짓말→쇼츠+글전용 등) 적용. `text_only`는 항상 recommended 포함.
- **STEP3 loadSource**: **L0 구현 = 수동.** UI에서 텍스트/이미지 붙여넣기 받아 `Source`로 저장. 텍스트는 index.json 인라인, 이미지는 `outputs/results/ad/<ts>/assets/`에 sharp로 정규화 저장. `searchMode` 입력 필수. (L3에서 aib.vote 조회 함수로 교체)
- **STEP4 packageByType**: `source.supportedTypes` 중 `selected`와 교차하는 유형만 생성. OpenRouter로 hook/body 생성하되 **voice.ts 규칙 주입**.
- **STEP5 renderPerChannel**: `distribution.ts`의 플랫폼 템플릿으로 ChannelOutput 생성. 인스타 4:5, 스레드·X 2단, 틱톡 AI라벨 플래그. 영상 실물은 Remotion 파이프라인(기존)으로 렌더 — factory는 "어떤 컷/자막/엔드카드(로고 오버레이)"의 **명세(props)**만 만들어 넘긴다.
- **STEP6 factCheck+plan**: 모델 답변의 수치·주장을 FactCheckItem으로 목록화, `treatedAs` 판정. 가능하면 web/RSS로 핵심 수치 1~2개 자동 확인. PublishPlan 완성.

**Remotion 연동 주의:** 카피의 텍스트(자막·숫자)는 Remotion 컴포지션 props로 주입(영상 안에 AI가 글자 그리지 않게). 엔드카드는 `assets/aib-lockup-black.png`를 Remotion에서 이미지 레이어로 오버레이. schema.ts의 렌더 검증 경계를 통과시킨다.

---

## 5. 자동화 성숙도 로드맵 (L0 → L4)

각 레벨은 "바꿀 파일 + 완료 기준"으로 정의. 순서대로 올린다.

- **L0 (현재)**: 전부 사람. 스킬은 문서 참조. factory 미구현.
  - 완료 기준: 없음(시작점)
- **L1 — 생성 자동화**: STEP4·5를 코드로. 사람이 주제·포맷·소재 주면 문구·영상명세 자동 생성.
  - 바꿀 것: `step4-package.ts`, `step5-channel.ts`, `rules/voice.ts`, `rules/distribution.ts`, UI 결과뷰
  - 완료 기준: 소재 붙여넣으면 6채널 문구 + Remotion props가 자동 산출
- **L2 — 선정 자동화**: STEP1·2 autoResolve. 주제·포맷을 러너가 자동 확정.
  - 바꿀 것: `trends.ts`, `step1-topic.ts`, `step2-format.ts`, `decision.ts` autoResolve, `ad-auto.mjs`
  - 완료 기준: 러너가 `awaiting_source`까지 사람 없이 도달
- **L3 — 소재 자동화**: STEP3를 aib.vote 조회로. (aib.vote 내부 API/DB 접근 필요)
  - 바꿀 것: `step3-source.ts`(수동입력 → 자동조회), 관련 env
  - 완료 기준: 질문 자동 생성 → 모델 A/B 답변 자동 수집 → `packaged`까지 무개입
- **L4 — 발행 자동화**: STEP6 publish를 SNS API로. (플랫폼별 API 승인 필요, 난이도 최상)
  - 바꿀 것: 발행 어댑터(YouTube/메타/틱톡/네이버), `ad-auto.mjs` 스케줄러
  - 완료 기준: `awaiting_publish` → `published` 무개입. 인스타 4:5·틱톡 AI라벨 등 플랫폼 규칙 준수.

**진행 원칙:** 한 번에 한 레벨. 각 레벨은 이전 레벨의 함수를 안 건드리고 decision 전이 주체만 바꾼다. autoResolve가 불확실하면 그 stage를 `awaiting_*`로 되돌려 사람에게 넘기는 폴백을 항상 둔다.

---

## 6. 구현 순서 제안 (Claude Code 작업 지시)

1. schema.ts에 §2-1 스키마 추가 (기존 컨벤션 준수, 기존 타입 안 깨기)
2. store.ts에 stage 전이 헬퍼(원자적 쓰기 재사용) 추가
3. `factory/rules/voice.ts`·`distribution.ts` — md 파일 로드 → 프롬프트/템플릿 변환
4. STEP4·5 함수 + UI 결과뷰 → **L1 달성**
5. decision.ts + factory API route → 사람 개입을 명시적 decision으로 정리
6. trends.ts + STEP1·2 autoResolve + ad-auto.mjs → **L2 달성**
7. 이후 L3(aib 조회), L4(발행) 순차

각 단계마다 zod 검증이 통과하는지, 파일 잠금(store.ts)이 러너·UI 동시 접근에서 안전한지 확인할 것.
