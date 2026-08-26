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
VALID_KINDS = {"daily", "weekly", "monthly"}

SCHEDULE_TO_KIND = {
    "30 22 * * *": "daily",   # 07:30 KST
    "30 11 * * 0": "weekly",  # Sunday 20:30 KST
    "30 10 * * *": "monthly", # 19:30 KST; workflow guard limits scheduled runs to month-end
}


def next_month(year: int, month: int):
    return (year + 1, 1) if month == 12 else (year, month + 1)


def next_monday(day_value):
    # Monday=0. On Monday itself, use the current Monday; on Sunday this returns tomorrow.
    days_ahead = (7 - day_value.weekday()) % 7
    return day_value + timedelta(days=days_ahead)


def explicit_kind():
    value = (os.getenv("ASTRO_PREGEN_KIND") or "").strip().lower()
    return value if value in VALID_KINDS else ""


def resolve_kind():
    explicit = explicit_kind()
    if explicit:
        return explicit
    return SCHEDULE_TO_KIND.get((os.getenv("GITHUB_EVENT_SCHEDULE") or "").strip(), "")


def target_url(kind: str, now_kst: datetime, manual: bool = False):
    params = {"push_kind": kind, "automation": "1"}
    if kind == "daily":
        params["push_date"] = now_kst.date().isoformat()
    elif kind == "weekly":
        params["push_date"] = next_monday(now_kst.date()).isoformat()
    elif kind == "monthly":
        tomorrow = now_kst.date() + timedelta(days=1)
        # Scheduled monthly prewarm should only occur at month-end. Manual testing is
        # deliberately allowed on any day and previews the coming calendar month.
        if not manual and tomorrow.month == now_kst.month:
            return None
        year, month = next_month(now_kst.year, now_kst.month)
        params["push_year"] = str(year)
        params["push_month"] = str(month)
    else:
        raise ValueError(kind)
    return APP_URL + "?" + urlencode(params)


def all_scopes(page):
    scopes = [page]
    for frame in page.frames:
        if frame is not page.main_frame:
            scopes.append(frame)
    return scopes


def body_text(scope, timeout=1500):
    try:
        return scope.locator("body").inner_text(timeout=timeout)
    except Exception:
        return ""


def maybe_wake_streamlit(page):
    for scope in all_scopes(page):
        for label in ["Yes, get this app back up!", "Get this app back up", "Wake up"]:
            try:
                button = scope.get_by_role("button", name=label, exact=False)
                if button.count() and button.first.is_visible():
                    button.first.click()
                    page.wait_for_timeout(3500)
                    return True
            except Exception:
                pass
    return False


def _find_pin_box(scope):
    candidates = [
        scope.locator('input[placeholder="PIN 입력"]'),
        scope.locator('input[type="password"]'),
        scope.get_by_role("textbox", name="PIN", exact=False),
    ]
    for locator in candidates:
        try:
            if locator.count() and locator.first.is_visible():
                return locator.first
        except Exception:
            pass
    return None


def _app_is_unlocked(page):
    for scope in all_scopes(page):
        text = body_text(scope)
        if "정밀분석" in text and "저장함" in text:
            return True
    return False


def dump_diagnostics(page, reason: str):
    print(f"HEADLESS_DIAGNOSTICS reason={reason}", file=sys.stderr)
    try:
        print(f"url={page.url}", file=sys.stderr)
    except Exception:
        pass
    try:
        print(f"title={page.title(timeout=3000)!r}", file=sys.stderr)
    except Exception as exc:
        print(f"title_error={type(exc).__name__}: {exc}", file=sys.stderr)

    for index, scope in enumerate(all_scopes(page)):
        try:
            scope_url = getattr(scope, "url", "")
        except Exception:
            scope_url = ""
        text = body_text(scope, timeout=2500)
        print(f"scope[{index}] url={scope_url!r}", file=sys.stderr)
        print(f"scope[{index}] body={text[:1800]!r}", file=sys.stderr)
        try:
            inputs = scope.locator("input")
            meta = []
            for i in range(min(inputs.count(), 8)):
                node = inputs.nth(i)
                meta.append({
                    "type": node.get_attribute("type"),
                    "placeholder": node.get_attribute("placeholder"),
                    "aria": node.get_attribute("aria-label"),
                })
            print(f"scope[{index}] inputs={meta!r}", file=sys.stderr)
        except Exception:
            pass


def login_if_needed(page, pin: str):
    deadline = time.time() + 150
    did_mid_diag = False
    while time.time() < deadline:
        maybe_wake_streamlit(page)

        if _app_is_unlocked(page):
            return

        for scope in all_scopes(page):
            pin_box = _find_pin_box(scope)
            if pin_box is None:
                continue
            try:
                pin_box.fill(pin)
                button = scope.get_by_role("button", name="별빛의 운명 열기", exact=False)
                if button.count() and button.first.is_visible():
                    button.first.click()
                else:
                    pin_box.press("Enter")
                page.wait_for_timeout(3500)
                if _app_is_unlocked(page):
                    return
                for check_scope in all_scopes(page):
                    text = body_text(check_scope)
                    if "PIN이 맞지 않습니다" in text:
                        raise RuntimeError("ASTRO_APP_PIN does not match the Streamlit APP_PIN")
            except RuntimeError:
                raise
            except Exception:
                pass

        combined = "\n".join(body_text(scope) for scope in all_scopes(page))
        if "You need access" in combined or "Sign in to continue" in combined:
            raise RuntimeError("Streamlit Cloud access gate blocked the headless browser")
        if "APP_PIN을 먼저 설정" in combined:
            raise RuntimeError("Streamlit app reports APP_PIN is not configured")

        if not did_mid_diag and time.time() > deadline - 100:
            dump_diagnostics(page, "waiting_for_login")
            did_mid_diag = True
        page.wait_for_timeout(1500)

    dump_diagnostics(page, "login_timeout")
    raise RuntimeError("Timed out waiting for the Streamlit PIN form or unlocked app")


def wait_for_report(page, kind: str):
    if kind == "daily":
        markers = [
            "최초 생성 사용량",
            "Gemini API 재호출 0회",
            "같은 계산값의 AI 해설",
            "오늘의 AI 정밀 해설",
        ]
        timeout_seconds = 220
    else:
        markers = [
            "AI PERIOD DEEP INTERPRETATION",
            "저장된 기간 AI 해설 사용",
            "이 기간의 새 AI 해설을 저장했어",
            "기간 AI 심층 해설",
        ]
        timeout_seconds = 330 if kind == "monthly" else 240

    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        combined = "\n".join(body_text(scope, timeout=2500) for scope in all_scopes(page))
        if any(marker in combined for marker in markers):
            return True
        if "GEMINI_API_KEY" in combined and ("설정되지" in combined or "확인해" in combined):
            raise RuntimeError("Streamlit app reports a missing GEMINI_API_KEY")
        if "PIN이 맞지 않습니다" in combined:
            raise RuntimeError("ASTRO_APP_PIN does not match the Streamlit APP_PIN")
        maybe_wake_streamlit(page)
        page.wait_for_timeout(2000)
    dump_diagnostics(page, f"report_timeout_{kind}")
    raise RuntimeError(f"Timed out waiting for {kind} AI report completion")


def main():
    pin = (os.getenv("ASTRO_APP_PIN") or "").strip()
    if not pin:
        print("ASTRO_APP_PIN secret is not configured yet; skipping pre-generation without failing.")
        return 0

    manual = bool(explicit_kind())
    kind = resolve_kind()
    if not kind:
        print("Could not resolve pre-generation kind; skipping.")
        return 0

    now_kst = datetime.now(KST)
    url = target_url(kind, now_kst, manual=manual)
    if url is None:
        print("Monthly scheduled pre-generation fired on a non-last day; skipping.")
        return 0

    print(f"Pre-generating {kind} horoscope in Streamlit server cache.")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                locale="ko-KR",
                timezone_id="Asia/Seoul",
                viewport={"width": 1280, "height": 1400},
            )
            page = context.new_page()
            page.set_default_timeout(15000)
            page.goto(url, wait_until="domcontentloaded", timeout=120000)
            page.wait_for_timeout(5000)
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
