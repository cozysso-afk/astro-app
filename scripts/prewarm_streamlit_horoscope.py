import os
import sys
import time
from datetime import datetime, timedelta
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

KST = ZoneInfo("Asia/Seoul")
APP_URL = "https://astro-app-wmz23ohfhmhrhrz2gg3kej.streamlit.app/"

SCHEDULE_TO_KIND = {
    "30 22 * * *": "daily",   # 07:30 KST
    "30 11 * * 0": "weekly",  # Sunday 20:30 KST
    "30 10 * * *": "monthly", # 19:30 KST; last-day guard below
}


def next_month(year: int, month: int):
    return (year + 1, 1) if month == 12 else (year, month + 1)


def resolve_kind():
    explicit = (os.getenv("ASTRO_PREGEN_KIND") or "").strip().lower()
    if explicit in {"daily", "weekly", "monthly"}:
        return explicit
    return SCHEDULE_TO_KIND.get((os.getenv("GITHUB_EVENT_SCHEDULE") or "").strip(), "")


def target_url(kind: str, now_kst: datetime):
    params = {"push_kind": kind}
    if kind == "daily":
        params["push_date"] = now_kst.date().isoformat()
    elif kind == "weekly":
        # Sunday evening pre-generation prepares Monday-Sunday.
        params["push_date"] = (now_kst.date() + timedelta(days=1)).isoformat()
    elif kind == "monthly":
        tomorrow = now_kst.date() + timedelta(days=1)
        if tomorrow.month == now_kst.month:
            return None
        year, month = next_month(now_kst.year, now_kst.month)
        params["push_year"] = str(year)
        params["push_month"] = str(month)
    else:
        raise ValueError(kind)
    return APP_URL + "?" + urlencode(params)


def maybe_wake_streamlit(page):
    for label in ["Yes, get this app back up!", "Get this app back up", "Wake up"]:
        locator = page.get_by_text(label, exact=False)
        try:
            if locator.count() and locator.first.is_visible():
                locator.first.click()
                page.wait_for_timeout(2500)
                return True
        except Exception:
            pass
    return False


def login_if_needed(page, pin: str):
    deadline = time.time() + 150
    while time.time() < deadline:
        maybe_wake_streamlit(page)
        pin_box = page.locator('input[placeholder="PIN 입력"]')
        try:
            if pin_box.count() and pin_box.first.is_visible():
                pin_box.first.fill(pin)
                button = page.get_by_role("button", name="🌙 별빛의 운명 열기")
                if button.count():
                    button.first.click()
                else:
                    pin_box.first.press("Enter")
                page.wait_for_timeout(3000)
                return
        except Exception:
            pass

        # If the menu already exists, a remembered/session unlock was enough.
        try:
            body = page.locator("body").inner_text(timeout=2000)
            if "정밀분석" in body and "저장함" in body:
                return
        except Exception:
            pass
        page.wait_for_timeout(1500)
    raise RuntimeError("Timed out waiting for the Streamlit PIN form or unlocked app")


def wait_for_report(page, kind: str):
    if kind == "daily":
        markers = [
            "최초 생성 사용량",
            "Gemini API 재호출 0회",
            "같은 계산값의 AI 해설",
        ]
        timeout_seconds = 180
    else:
        markers = [
            "AI PERIOD DEEP INTERPRETATION",
            "저장된 기간 AI 해설 사용",
            "이 기간의 새 AI 해설을 저장했어",
        ]
        timeout_seconds = 300 if kind == "monthly" else 210

    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            body = page.locator("body").inner_text(timeout=3000)
        except Exception:
            body = ""
        if any(marker in body for marker in markers):
            return True
        if "GEMINI_API_KEY" in body and ("설정되지" in body or "확인해" in body):
            raise RuntimeError("Streamlit app reports a missing GEMINI_API_KEY")
        if "PIN이 맞지 않습니다" in body:
            raise RuntimeError("ASTRO_APP_PIN does not match the Streamlit APP_PIN")
        maybe_wake_streamlit(page)
        page.wait_for_timeout(2000)
    raise RuntimeError(f"Timed out waiting for {kind} AI report completion")


def main():
    pin = (os.getenv("ASTRO_APP_PIN") or "").strip()
    if not pin:
        print("ASTRO_APP_PIN secret is not configured yet; skipping pre-generation without failing.")
        return 0

    kind = resolve_kind()
    if not kind:
        print("Could not resolve pre-generation kind; skipping.")
        return 0

    now_kst = datetime.now(KST)
    url = target_url(kind, now_kst)
    if url is None:
        print("Monthly pre-generation fired on a non-last day; skipping.")
        return 0

    print(f"Pre-generating {kind} horoscope in Streamlit server cache.")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(locale="ko-KR", timezone_id="Asia/Seoul")
            page = context.new_page()
            page.set_default_timeout(15000)
            page.goto(url, wait_until="domcontentloaded", timeout=120000)
            login_if_needed(page, pin)
            wait_for_report(page, kind)
            print(f"Pre-generation completed for {kind}; server-side cache should now be warm.")
            context.close()
            browser.close()
    except PlaywrightTimeoutError as exc:
        print(f"Playwright timeout during {kind} pre-generation: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"Pre-generation failed for {kind}: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
