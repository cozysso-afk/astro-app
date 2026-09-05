# Saju calculation audit V5

## Scope

V5 closes natal Four-Pillars boundary cases that were not fully covered by the earlier solar-term regression pack.

The calculation policy is intentionally split by what the quantity represents:

- **Year and month pillars:** selected by the absolute astronomical LiChun/Jie instant. The legal birth instant is normalized to `lunar_python`'s UTC+8 solar-term frame before `getYearInGanZhiExact()` / `getMonthInGanZhiExact()` semantics are used.
- **Day and hour pillars:** selected from the app's effective local clock. When longitude is known this is local apparent (true) solar time; otherwise legal local time is used and precision is downgraded.
- **Late Zi policy:** `EightChar.setSect(2)`. From 23:00 through 23:59 the day pillar remains on the current civil day. `lunar_python`'s built-in hour-stem convention is retained: the late-Zi hour stem is derived from the next-day stem.

This prevents true-solar wall-clock correction from accidentally moving the astronomical instant at which a natal year/month pillar changes.

## External references

### Hong Kong Observatory — Heavenly Stems and Earthly Branches

https://www.hko.gov.hk/en/gts/time/stemsandbranches.htm

Used for:

- the 60 Gan-Zhi cycle;
- Zi hour = 23:00–01:00;
- year-stem → month-stem table;
- day-stem → hour-stem table (Five Rats / 五鼠遁 relationship).

### National Astronomical Observatory of Japan — 2024 solar terms

https://eco.mtk.nao.ac.jp/koyomi/yoko/2024/rekiyou242.html

Published 2024 LiChun as 4 February 17:27 Japan Standard Time (UTC+9), independently agreeing at minute precision with the second-level HKO/Beijing reference already frozen in V2 (`2024-02-04 17:26:53+09:00`).

### Independent day-pillar cross-checks

https://nihonkoyomi.com/2024/3/31/

https://nihonkoyomi.com/2024/4/1/

These list:

- 2024-03-31 = `甲午` day;
- 2024-04-01 = `乙未` day.

They are used only as fixed regression provenance, not queried by CI.

### lunar_python implementation provenance

https://github.com/6tail/lunar-python

The V5 tests explicitly lock the product's chosen `sect=2` behavior so that a future dependency upgrade cannot silently change the late-Zi convention.

## Fixed regression cases

1. **Complete Four Pillars gold** — 2024-04-01 12:00 UTC+9 at 135E:
   - `甲辰 / 丁卯 / 乙未 / 壬午`
2. **Seoul LiChun boundary** — 2024-02-04 at 126.978E:
   - 17:20 UTC+9 → `癸卯 / 乙丑`
   - 17:30 UTC+9 → `甲辰 / 丙寅`
3. **True-solar date crossover** — 2024-04-01 00:30 UTC+9 at 120E:
   - apparent solar date becomes 2024-03-31;
   - day/hour become `甲午 / 丙子` under the chosen late-Zi convention.
4. **Late/early Zi rollover** around 2024-03-31/04-01 at 135E:
   - 23:xx keeps `甲午` day;
   - 00:xx changes to `乙未` day;
   - both retain `丙子` hour under the chosen convention.

## CI behavior

`tests/test_saju_natal_boundary_v5.py` is part of the required `Western + Saju + Thai gold regression` status check. CI uses only static expectations and local calculation dependencies; it does not depend on external websites at run time.
