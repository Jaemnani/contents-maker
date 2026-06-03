#!/usr/bin/env python3
"""
OpenRouter 모델 인벤토리 생성기 (콘텐츠 종류 × 티어 × 비용).

산출물:
  - model-inventory.md   : 사람이 검토할 비용/티어 표 (텍스트/이미지/영상)
  - data/models.json     : 레지스트리 시드(검토 후 lib/models.ts 로 반영)

티어(대분류)는 객관적 성능 벤치마크가 API에 없어 **가격대(price band)를 프록시**로 사용한다.
대시보드에서 티어만 고르면 그 티어의 하위 모델을 랜덤 선택(= '매일 다른 AI'). 직접 선택도 가능.

OpenRouter의 /api/v1/models, /api/v1/videos/models 는 공개 엔드포인트(키 불필요).
사용: ../venv_common/bin/python scripts/fetch-inventory.py
"""
import json
import os
import urllib.request
from datetime import datetime, timezone

BASE = "https://openrouter.ai/api/v1"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TEXT_EXCLUDE = ("guard", "embed", "moderation", "rerank", "tts", "whisper",
                "ocr", "codestral", "devstral", "-coder", "-code")
TEXT_TOP_PER_PROVIDER = 4
PRIMARY_PROVIDERS = ["openai", "anthropic", "google", "x-ai", "deepseek",
                     "meta-llama", "qwen", "mistralai", "moonshotai", "z-ai"]

TEXT_EST_OUT_TOKENS = 4600   # 5변형 1회(KO) 출력 토큰 추정
TEXT_EST_IN_TOKENS = 400
VIDEO_EST_DURATION = 15

# 이미지 1장당 대략 비용(USD) — OpenRouter pricing 필드가 이미지 출력 토큰 단가를 노출하지 않아
# 측정/공개가 기반의 근사값(보수적으로 올림). 실측 비용은 생성 후 usage.cost 로 정확히 표시됨.
# gemini-2.5-flash-image 는 실측($0.039). 나머지는 근사 → model-inventory.md 에서 조정 가능.
IMAGE_UNIT_USD = {
    "google/gemini-2.5-flash-image": 0.04,
    "google/gemini-3.1-flash-image-preview": 0.05,
    "google/gemini-3-pro-image-preview": 0.14,
    "openai/gpt-5-image-mini": 0.06,
    "openai/gpt-5-image": 0.19,
    "openai/gpt-5.4-image-2": 0.19,
}

TIER_LABEL = {"premium": "프리미엄", "standard": "표준", "budget": "저가", "free": "무료"}
TIER_ORDER = ["premium", "standard", "budget", "free"]
CHEAPEST = {"text": 5, "image": 2, "video": 2}


def get(path):
    req = urllib.request.Request(f"{BASE}{path}", headers={"User-Agent": "contents-maker-inventory"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def per_million(x):
    v = f(x)
    return round(v * 1_000_000, 4) if v is not None else None


def provider_of(mid):
    return mid.split("/", 1)[0] if "/" in mid else mid


def text_est(p):
    pin, pout = f(p.get("prompt")), f(p.get("completion"))
    if pin is None or pout is None:
        return None
    return round(pin * TEXT_EST_IN_TOKENS + pout * TEXT_EST_OUT_TOKENS, 4)


def text_tier(est):
    if est is None:
        return "standard"
    if est == 0:
        return "free"
    if est < 0.01:
        return "budget"
    if est < 0.05:
        return "standard"
    return "premium"


def image_tier(out_pm):
    if out_pm is None:
        return "standard"
    return "premium" if out_pm >= 8 else "budget"


def vid_per_sec(skus, res):
    for k in (f"text_to_video_duration_seconds_{res}",
              f"duration_seconds_without_audio_{res}",
              f"duration_seconds_{res}",
              "duration_seconds_without_audio", "duration_seconds"):
        if k in skus:
            return f(skus[k])
    ck = f"cents_per_video_output_second_{res}"
    if ck in skus:
        return f(skus[ck]) / 100
    return None


def vid_estimate(skus, durations, supported_res):
    """(추정$ 또는 None, 표기문자열, 토큰제여부)"""
    if "video_tokens" in skus:
        return None, f"토큰제 ${per_million(skus['video_tokens'])}/Mtok", True
    dur = min(VIDEO_EST_DURATION, max(durations)) if durations else VIDEO_EST_DURATION
    order = [r for r in ("1080p", "720p", "480p") if r in (supported_res or [])] or ["1080p", "720p", "480p"]
    for res in order:
        ps = vid_per_sec(skus, res)
        if ps is not None:
            return round(ps * dur, 3), f"${ps}/s({res})×{dur}s = ${round(ps*dur,3)}", False
    return None, "?", False


def video_tier(est, is_token):
    if is_token or est is None:
        return "standard"
    if est < 1.0:
        return "budget"
    if est < 1.5:
        return "standard"
    return "premium"


def main():
    models = get("/models").get("data", [])
    videos = get("/videos/models")
    videos = videos.get("data", videos) if isinstance(videos, dict) else videos

    text_models, image_models = [], []
    for m in models:
        out = (m.get("architecture", {}) or {}).get("output_modalities") or []
        if m["id"] == "openrouter/auto":
            continue
        if "image" in out:
            image_models.append(m)
        elif out == ["text"] and not any(p in m["id"] for p in TEXT_EXCLUDE):
            text_models.append(m)

    # 텍스트: 제공사별 최신 top N
    by_provider = {}
    for m in text_models:
        by_provider.setdefault(provider_of(m["id"]), []).append(m)
    curated_text = []
    for prov in PRIMARY_PROVIDERS:
        lst = sorted(by_provider.get(prov, []), key=lambda x: x.get("created", 0), reverse=True)
        curated_text.extend(lst[:TEXT_TOP_PER_PROVIDER])

    # 엔트리 정규화 (tier·metric 부여)
    text_entries, image_entries, video_entries = [], [], []
    for m in curated_text:
        p = m.get("pricing", {}) or {}
        est = text_est(p)
        text_entries.append({
            "id": m["id"], "provider": provider_of(m["id"]),
            "pricing": {"prompt": p.get("prompt"), "completion": p.get("completion")},
            "context": m.get("context_length"),
            "estPerRunKO": est, "tier": text_tier(est),
            "inPerM": per_million(p.get("prompt")), "outPerM": per_million(p.get("completion")),
        })
    for m in sorted(image_models, key=lambda x: x.get("created", 0), reverse=True):
        p = m.get("pricing", {}) or {}
        out_pm = per_million(p.get("completion"))
        image_entries.append({
            "id": m["id"], "provider": provider_of(m["id"]),
            "pricing": {"image": p.get("image"), "prompt": p.get("prompt"), "completion": p.get("completion")},
            "imagePrice": f(p.get("image")), "inPerM": per_million(p.get("prompt")), "outPerM": out_pm,
            "imageUnitUsd": IMAGE_UNIT_USD.get(m["id"]),  # 대략 1장당 USD (실측은 생성 후)
            "jaTextQuality": "good" if ("gemini" in m["id"] or "seedream" in m["id"]) else "unknown",
            "tier": image_tier(out_pm),
        })
    for m in videos:
        skus = m.get("pricing_skus", {}) or {}
        dur = m.get("supported_durations") or []
        est, est_str, is_token = vid_estimate(skus, dur, m.get("supported_resolutions"))
        video_entries.append({
            "id": m["id"], "provider": provider_of(m["id"]),
            "resolutions": m.get("supported_resolutions"), "aspectRatios": m.get("supported_aspect_ratios"),
            "durations": dur, "sizes": m.get("supported_sizes"), "generateAudio": m.get("generate_audio"),
            "pricingSkus": skus, "est15s": est, "estStr": est_str, "tokenBased": is_token,
            "tier": video_tier(est, is_token),
        })

    # 최저가 프리셋 (테스트용) — :free 모델은 provider 측 "Out of credits"로 불안정해 제외하고
    # 실제로 동작하는 '최저가 유료' 모델을 선택한다.
    def cheapest(entries, key, n):
        ranked = sorted(
            [e for e in entries if e.get(key) is not None and e[key] > 0 and not e["id"].endswith(":free")],
            key=lambda e: e[key],
        )
        return [e["id"] for e in ranked[:n]]
    presets = {
        "text": cheapest(text_entries, "estPerRunKO", CHEAPEST["text"]),
        "image": cheapest(image_entries, "imageUnitUsd", CHEAPEST["image"]),
        "video": cheapest(video_entries, "est15s", CHEAPEST["video"]),
    }

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    L = [f"# OpenRouter 모델 인벤토리 (종류 × 티어 × 비용)", "",
         f"- 생성: {now} · 라이브 API 기반 · 전체 {len(models)}개",
         f"- 티어(대분류)는 **가격대 프록시** (성능 벤치마크는 API 미제공). 대시보드에서 티어 선택 시 하위 랜덤.",
         f"- 가격: 텍스트 USD/1M토큰 · **5변형1회(KO)** = 출력 ~{TEXT_EST_OUT_TOKENS}토큰 가정 1회 호출 / 영상 USD/초",
         f"- 🧪 = 최저가 프리셋(테스트용) 포함 모델", ""]

    def tier_groups(entries):
        g = {t: [] for t in TIER_ORDER}
        for e in entries:
            g[e["tier"]].append(e)
        return g

    # 텍스트
    L += ["## 텍스트 (단일 출력)", ""]
    g = tier_groups(text_entries)
    for t in TIER_ORDER:
        if not g[t]:
            continue
        L += [f"### {TIER_LABEL[t]} 티어", "", "| 모델 ID | 입력$/1M | 출력$/1M | 컨텍스트 | 5변형1회(KO)$ | |",
              "|---|--:|--:|--:|--:|:--:|"]
        for e in sorted(g[t], key=lambda x: (x["estPerRunKO"] if x["estPerRunKO"] is not None else 0)):
            mark = "🧪" if e["id"] in presets["text"] else ""
            L.append(f"| `{e['id']}` | {e['inPerM']} | {e['outPerM']} | {e['context'] or '?'} | {e['estPerRunKO']} | {mark} |")
        L.append("")

    # 이미지
    L += ["## 이미지 (생성 가능 — 전체 6)", ""]
    g = tier_groups(image_entries)
    for t in TIER_ORDER:
        if not g[t]:
            continue
        L += [f"### {TIER_LABEL[t]} 티어", "", "| 모델 ID | ≈1장$(근사) | 출력$/1M | 일본어 | |",
              "|---|--:|--:|:--:|:--:|"]
        for e in sorted(g[t], key=lambda x: (x["imageUnitUsd"] if x["imageUnitUsd"] is not None else 0)):
            mark = "🧪" if e["id"] in presets["image"] else ""
            unit = f"≈{e['imageUnitUsd']}" if e["imageUnitUsd"] is not None else "?"
            L.append(f"| `{e['id']}` | {unit} | {e['outPerM']} | {e['jaTextQuality']} | {mark} |")
        L.append("")

    # 영상
    L += ["## 영상 (생성 가능 — 전체 14)", ""]
    g = tier_groups(video_entries)
    for t in TIER_ORDER:
        if not g[t]:
            continue
        L += [f"### {TIER_LABEL[t]} 티어", "", "| 모델 ID | 해상도 | 9:16 | 길이(s) | 음성 | 15s 예상 | |",
              "|---|---|:--:|---|:--:|--:|:--:|"]
        for e in sorted(g[t], key=lambda x: (x["est15s"] if x["est15s"] is not None else 999)):
            mark = "🧪" if e["id"] in presets["video"] else ""
            res = ",".join(e["resolutions"] or [])
            ar = "✅" if "9:16" in (e["aspectRatios"] or []) else "—"
            d = e["durations"]
            ds = f"{min(d)}–{max(d)}" if d else "?"
            au = "✅" if e["generateAudio"] else "—"
            L.append(f"| `{e['id']}` | {res} | {ar} | {ds} | {au} | {e['estStr']} | {mark} |")
        L.append("")

    with open(os.path.join(ROOT, "model-inventory.md"), "w") as fh:
        fh.write("\n".join(L))

    seed = {"generatedAt": now,
            "counts": {"all": len(models), "text": len(text_models), "image": len(image_models), "video": len(videos)},
            "tiers": TIER_ORDER, "tierLabels": TIER_LABEL, "cheapestPresets": presets,
            "text": text_entries, "image": image_entries, "video": video_entries}
    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    with open(os.path.join(ROOT, "data", "models.json"), "w") as fh:
        json.dump(seed, fh, ensure_ascii=False, indent=2)

    print(f"wrote model-inventory.md & data/models.json")
    print("cheapest presets:", json.dumps(presets, ensure_ascii=False))


if __name__ == "__main__":
    main()
