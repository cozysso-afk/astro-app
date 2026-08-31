import requests
from bs4 import BeautifulSoup

CASES = [
    ("Yeosu-1991", "34.7604", "127.6622", "9.00", "19910321072600"),
    ("Seoul-2026", "37.5665", "126.9780", "9.00", "20260324142600"),
    ("Tokyo-2026", "35.6762", "139.6503", "9.00", "20260420234900"),
    ("NewYork-2026", "40.7128", "-74.0060", "-4.00", "20260324142600"),
]

for label, lat, lon, utc, ndate in CASES:
    url = (
        "https://www.myhora.com/astrology/thai/calendar-ascendant.aspx"
        f"?aid=40&cid=215&lat={lat}&lon={lon}&ndate={ndate}&pid=1&utc={utc}"
    )
    try:
        response = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
        print("\nNON_THAI_PROBE", label, "HTTP", response.status_code, "BYTES", len(response.content))
        response.raise_for_status()
        response.encoding = response.apparent_encoding or "utf-8"
        text = " ".join(BeautifulSoup(response.text, "html.parser").stripped_strings)
        print("HAS_REQUESTED_COORDS", lat in response.text and lon in response.text)
        for token in (
            "ลัคนา เวลา",
            "อันโตนาทีสามัญ สมผุสอาทิตย์อุทัย",
            "อันโตนาทีสามัญ อาทิตย์อุทัย 06:00น.",
            "เวลานักษัตร",
        ):
            index = text.find(token)
            if index >= 0:
                print(token, text[index:index + 800])
    except Exception as exc:
        print("NON_THAI_PROBE_ERROR", label, type(exc).__name__, str(exc))
