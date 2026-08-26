import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")
ONESIGNAL_ENDPOINT = "https://api.onesignal.com/notifications"
LAUNCHER_URL = "https://cozysso-afk.github.io/astro-app/"

SCHEDULE_TO_KIND = {
    "0 23 * * *": "daily",   # 08:00 KST
    "0 12 * * 0": "weekly",  # Sunday 21:00 KST
    "0 11 * * *": "monthly", # 20:00 KST; last-day guard below
}


def next_month(year: int, month: int):
    return (year + 1, 1) if month == 12 else (year, month + 1)


def resolve_kind():
    explicit = (os.getenv("ASTRO_PUSH_KIND") or "").strip().lower()
    if explicit in {"daily", "weekly", "monthly"}:
        return explicit
    schedule = (os.getenv("GITHUB_EVENT_SCHEDULE") or "").strip()
    return SCHEDULE_TO_KIND.get(schedule, "")


def build_message(kind: str, now_kst: datetime):
    params = {"from": "push", "kind": kind}
    if kind == "daily":
        title = "🌙 오늘의 별빛 운세"
        body = "오늘의 정밀 일일운세와 AI 해설을 확인해봐."
        name = f"astro-daily-{now_kst:%Y-%m-%d}"
    elif kind == "weekly":
        title = "📅 이번 주 별빛 운세"
        body = "7일 흐름과 분야별 주간 AI 해설을 확인할 시간이야."
        name = f"astro-weekly-{now_kst:%Y-%m-%d}"
    elif kind == "monthly":
        tomorrow = now_kst.date() + timedelta(days=1)
        # Scheduled every day because cron has no portable 'last day of month'.
        if tomorrow.month == now_kst.month:
            return None
        year, month = next_month(now_kst.year, now_kst.month)
        params.update({"year": str(year), "month": str(month)})
        title = f"🌕 {month}월 별빛 운세"
        body = "새달의 월간 흐름과 분야별 AI 해설을 미리 확인해봐."
        name = f"astro-monthly-{year:04d}-{month:02d}"
    else:
        raise ValueError(f"Unknown push kind: {kind}")

    return {
        "title": title,
        "body": body,
        "name": name,
        "url": LAUNCHER_URL + "?" + urlencode(params),
    }


def main():
    app_id = (os.getenv("ONESIGNAL_APP_ID") or "").strip()
    api_key = (os.getenv("ONESIGNAL_APP_API_KEY") or "").strip()
    if not app_id or not api_key:
        print("OneSignal secrets are not configured yet; skipping push without failing the workflow.")
        return 0

    kind = resolve_kind()
    if not kind:
        print("Could not resolve push kind; skipping.")
        return 0

    now_kst = datetime.now(KST)
    message = build_message(kind, now_kst)
    if message is None:
        print("Monthly schedule fired on a non-last day; skipping.")
        return 0

    payload = {
        "app_id": app_id,
        "target_channel": "push",
        "included_segments": ["Subscribed Users"],
        "name": message["name"],
        "headings": {"en": message["title"]},
        "contents": {"en": message["body"]},
        "url": message["url"],
        "data": {"astro_kind": kind},
    }
    encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        ONESIGNAL_ENDPOINT,
        data=encoded,
        method="POST",
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": f"Key {api_key}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            body = response.read().decode("utf-8", errors="replace")
            print(f"OneSignal HTTP {response.status}: {body}")
            if response.status < 200 or response.status >= 300:
                return 1
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        print(f"OneSignal HTTP {exc.code}: {error_body}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"OneSignal request failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
