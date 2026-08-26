from pathlib import Path

APP = Path("app.py")
text = APP.read_text(encoding="utf-8")

start_marker = "def _render_fortune_archive():\n"
end_marker = "\n\n# ============================================================\n# 9. RETURN / DAILY MOON EVENTS\n"

start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit("archive renderer markers not found")

new_func = '''def _render_fortune_archive():
    st.markdown("### 📚 운세 저장함")
    st.caption("일일 AI 해설은 최대 90일 · 주간은 최근 26개 · 월간은 최근 18개를 이 기기에 보관해. 저장본을 읽는 동안 Gemini API 비용은 들지 않아.")
    if st.button("↻ 저장함 새로고침",use_container_width=True,key="fortune_archive_refresh"):
        st.session_state["_fortune_archive_read_nonce"]=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)+1
        st.rerun()

    daily=_read_daily_archive_entries()
    periods=_read_period_archive_entries()
    if daily is None or periods is None:
        st.caption("📚 이 기기에 저장된 운세를 확인하는 중...")
        return

    items=[]
    for entry in daily or []:
        result=entry.get("result",{}) if isinstance(entry,dict) else {}
        meta=result.get("archive_meta",{}) if isinstance(result,dict) else {}
        d=str(meta.get("date") or "")
        if not d:
            continue
        try:
            parsed=date.fromisoformat(d)
        except Exception:
            continue
        items.append({
            "type":"daily",
            "sort":d,
            "date_obj":parsed,
            "label":f"🌙 {d} · 일일 AI 해설",
            "entry":entry,
        })

    for entry in periods or []:
        if not isinstance(entry,dict):
            continue
        kind=entry.get("period")
        start=str(entry.get("start") or "")
        end=str(entry.get("end") or "")
        try:
            start_dt=date.fromisoformat(start)
            end_dt=date.fromisoformat(end)
        except Exception:
            continue
        if kind=="weekly":
            label=f"📅 {start} ~ {end} · 주간"
        elif kind=="monthly":
            label=f"🌕 {start_dt.year}년 {start_dt.month}월 · 월간"
        else:
            continue
        items.append({
            "type":kind,
            "sort":start,
            "date_obj":start_dt,
            "end_obj":end_dt,
            "label":label,
            "entry":entry,
        })

    if not items:
        st.info("아직 저장된 운세가 없어. 일일 AI 해설을 열거나 주간/월간 리포트를 보면 자동으로 저장돼.")
        return

    filter_label=st.selectbox("종류",["일일","주간","월간","전체"],key="fortune_archive_filter")
    wanted={"일일":"daily","주간":"weekly","월간":"monthly"}.get(filter_label)
    scoped=[x for x in items if not wanted or x["type"]==wanted]
    scoped.sort(key=lambda x:x["sort"],reverse=True)
    if not scoped:
        st.info("이 종류의 저장된 운세는 아직 없어.")
        return

    def choose_year(rows,key_suffix):
        years=sorted({x["date_obj"].year for x in rows},reverse=True)
        return st.selectbox("연도",years,key=f"fortune_archive_year_{key_suffix}")

    item=None

    if filter_label=="일일":
        year=choose_year(scoped,"daily")
        year_rows=[x for x in scoped if x["date_obj"].year==year]
        months=sorted({x["date_obj"].month for x in year_rows},reverse=True)
        month=st.selectbox("월",months,format_func=lambda m:f"{m}월",key="fortune_archive_month_daily")
        month_rows=[x for x in year_rows if x["date_obj"].month==month]
        month_rows.sort(key=lambda x:x["date_obj"],reverse=True)
        labels=[]
        for x in month_rows:
            d=x["date_obj"]
            labels.append(f"{d.month}월 {d.day}일 ({WEEKDAY_KO[d.weekday()]})")
        chosen=st.selectbox("날짜",labels,key="fortune_archive_day_daily")
        item=month_rows[labels.index(chosen)]

    elif filter_label=="주간":
        year=choose_year(scoped,"weekly")
        year_rows=[x for x in scoped if x["date_obj"].year==year]
        year_rows.sort(key=lambda x:x["date_obj"],reverse=True)
        labels=[]
        for x in year_rows:
            s=x["date_obj"]; e=x["end_obj"]
            labels.append(
                f"{s.month}/{s.day}({WEEKDAY_KO[s.weekday()]}) ~ "
                f"{e.month}/{e.day}({WEEKDAY_KO[e.weekday()]})"
            )
        chosen=st.selectbox("주간",labels,key="fortune_archive_week_weekly")
        item=year_rows[labels.index(chosen)]

    elif filter_label=="월간":
        year=choose_year(scoped,"monthly")
        year_rows=[x for x in scoped if x["date_obj"].year==year]
        year_rows.sort(key=lambda x:x["date_obj"].month,reverse=True)
        months=[x["date_obj"].month for x in year_rows]
        month=st.selectbox("월",months,format_func=lambda m:f"{m}월",key="fortune_archive_month_monthly")
        item=next(x for x in year_rows if x["date_obj"].month==month)

    else:
        labels=[x["label"] for x in scoped]
        chosen=st.selectbox("최근 저장 기록",labels,key="fortune_archive_choice_all")
        item=scoped[labels.index(chosen)]

    if not item:
        return

    if item["type"]=="daily":
        result=dict(item["entry"].get("result",{}))
        result["cache_source"]="archive"
        render_ai_overview(result)
        return

    entry=item["entry"]
    st.markdown(f"<div class='period-range'><strong>{html.escape(item['label'])}</strong></div>",unsafe_allow_html=True)
    topics=entry.get("topics",{}) if isinstance(entry.get("topics"),dict) else {}
    for key in AI_TOPIC_ORDER:
        body=topics.get(key)
        if body:
            st.markdown(f"<div class='ast-card'><div class='ast-title'>{TOPIC_SPECS[key]['icon']} {DISPLAY_LABELS[key]}</div><div class='ast-body'>{body}</div></div>",unsafe_allow_html=True)
    market=entry.get("market",{}) if isinstance(entry.get("market"),dict) else {}
    if market:
        st.markdown("#### 📈 주식·투자")
        for label,body in market.items():
            st.markdown(f"<div class='event-pill'><strong>{html.escape(str(label))}</strong> · {body}</div>",unsafe_allow_html=True)
    st.caption("📦 저장된 계산 리포트야. 이 화면을 다시 보는 건 API 호출이 아니야.")
'''

text = text[:start] + new_func + text[end:]
APP.write_text(text, encoding="utf-8")
print("archive period selector v6.3.1 patch applied")
