import os
import re
from pathlib import Path

CONFIG = Path("push-config.js")
app_id = (os.getenv("ONESIGNAL_APP_ID") or "").strip()

if not app_id:
    raise SystemExit("ONESIGNAL_APP_ID secret is missing")
if not re.fullmatch(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", app_id):
    raise SystemExit("ONESIGNAL_APP_ID does not look like a OneSignal UUID")

text = CONFIG.read_text(encoding="utf-8")
pattern = r'(oneSignalAppId:\s*)"[^"]*"'
replacement = rf'\1"{app_id}"'
new_text, count = re.subn(pattern, replacement, text, count=1)
if count != 1:
    raise SystemExit("oneSignalAppId setting not found in push-config.js")

if new_text == text:
    print("OneSignal client App ID already configured")
else:
    CONFIG.write_text(new_text, encoding="utf-8")
    print("Configured public OneSignal App ID in push-config.js")
