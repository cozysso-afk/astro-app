from pathlib import Path

p=Path('personal_marriage_v1.py')
s=p.read_text()
old='''        for b in names[i + 1:]:\n            if a.endswith("ruler") and b.endswith("ruler") and points[a] == points[b]:\n                continue\n            dist = _angle_distance(points[a], points[b])\n'''
new='''        for b in names[i + 1:]:\n            # A house-ruler label can point to the very same natal planet already present\n            # in this list (for example Venus and 7th_ruler). That is one point, not a\n            # real conjunction, so never manufacture a 0° self-aspect from aliases.\n            same_physical_point = _angle_distance(points[a], points[b]) < 1e-9\n            if same_physical_point and (a.endswith("ruler") or b.endswith("ruler")):\n                continue\n            dist = _angle_distance(points[a], points[b])\n'''
if old not in s: raise SystemExit('natal aspect alias anchor missing')
s=s.replace(old,new,1)
p.write_text(s)

p=Path('tests/test_personal_marriage_v1.py')
s=p.read_text()
marker='def test_personal_marriage_never_accepts_more_than_one_year():'
insert='''def test_personal_marriage_does_not_create_ruler_alias_self_aspects():\n    result = build_personal_marriage(\n        birth_date=date(1991, 3, 21), birth_time=time(7, 26), latitude=34.7604, longitude=127.6622,\n        utc_offset_hours=9.0, start_date=date(2026, 9, 4), end_date=date(2026, 9, 12),\n    )\n    for row in result["natal_aspects"]:\n        assert not (row["orb"] == 0 and (row["a"].endswith("ruler") or row["b"].endswith("ruler")))\n\n\n'''
if marker not in s: raise SystemExit('personal test anchor missing')
if 'does_not_create_ruler_alias_self_aspects' not in s:
    s=s.replace(marker,insert+marker,1)
p.write_text(s)
