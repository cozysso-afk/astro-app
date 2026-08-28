from pathlib import Path

P=Path('app.py')
s=P.read_text(encoding='utf-8')
changed=False

old_period='''st.markdown('<div class="astro-nav-label">기간 운세</div>',unsafe_allow_html=True)\n_nav_period=st.columns(4,gap="small")\nfor _i,_label in enumerate(["오늘","주간","월간","연간"]):\n    if _nav_period[_i].button(_label,key=f"main_nav_period_{_i}",use_container_width=True,type="primary" if main_view==_label else "secondary"):\n        if main_view!=_label:\n            st.session_state["main_view"]=_label\n            st.rerun()\n\nst.markdown('<div class="astro-nav-label astro-nav-tools">분석 도구</div>',unsafe_allow_html=True)\n_nav_tools=st.columns(4,gap="small")\nfor _i,_label in enumerate(["포춘랩","궁합운","저장함","정밀분석"]):\n    if _nav_tools[_i].button(_label,key=f"main_nav_tool_{_i}",use_container_width=True,type="primary" if main_view==_label else "secondary"):\n        if main_view!=_label:\n            st.session_state["main_view"]=_label\n            st.rerun()'''
new_period='''st.markdown('<div class="astro-nav-label">기간 운세</div>',unsafe_allow_html=True)\nwith st.container(key="astro_period_nav_group"):\n    _nav_period=st.columns(4,gap="small")\n    for _i,_label in enumerate(["오늘","주간","월간","연간"]):\n        if _nav_period[_i].button(_label,key=f"main_nav_period_{_i}",use_container_width=True,type="primary" if main_view==_label else "secondary"):\n            if main_view!=_label:\n                st.session_state["main_view"]=_label\n                st.rerun()\n\nst.markdown('<div class="astro-nav-label astro-nav-tools">분석 도구</div>',unsafe_allow_html=True)\nwith st.container(key="astro_tool_nav_group"):\n    _nav_tools=st.columns(4,gap="small")\n    for _i,_label in enumerate(["포춘랩","궁합운","저장함","정밀분석"]):\n        if _nav_tools[_i].button(_label,key=f"main_nav_tool_{_i}",use_container_width=True,type="primary" if main_view==_label else "secondary"):\n            if main_view!=_label:\n                st.session_state["main_view"]=_label\n                st.rerun()'''
if old_period in s:
    s=s.replace(old_period,new_period,1); changed=True
elif 'astro_period_nav_group' not in s:
    raise SystemExit('nav block not found')

marker='st.markdown(ASTRO_DESIGN_V73_CSS, unsafe_allow_html=True)\n'
if marker not in s:
    # v73 CSS may be rendered just after its string; use string end marker instead
    marker='"""\nst.markdown(ASTRO_DESIGN_V73_CSS, unsafe_allow_html=True)\n'

if 'ASTRO_DESIGN_V74_CSS' not in s:
    render='st.markdown(ASTRO_DESIGN_V73_CSS, unsafe_allow_html=True)\n'
    if render not in s: raise SystemExit('v73 css render marker not found')
    css='''\n\n# ============================================================\n# 0-A4. VISUAL SYSTEM v7.4 · COMPACT MOBILE SEGMENTED NAV\n# ============================================================\nASTRO_DESIGN_V74_CSS = """\n<style>\n/* Only the two primary nav groups are forced to remain 4-up on phones. */\ndiv[class*="st-key-astro_period_nav_group"] [data-testid="stHorizontalBlock"],\ndiv[class*="st-key-astro_tool_nav_group"] [data-testid="stHorizontalBlock"]{\n  display:grid!important;\n  grid-template-columns:repeat(4,minmax(0,1fr))!important;\n  gap:6px!important;\n}\ndiv[class*="st-key-astro_period_nav_group"] [data-testid="column"],\ndiv[class*="st-key-astro_tool_nav_group"] [data-testid="column"]{\n  width:auto!important;\n  min-width:0!important;\n  flex:none!important;\n}\ndiv[class*="st-key-astro_period_nav_group"] button,\ndiv[class*="st-key-astro_tool_nav_group"] button{\n  width:100%!important;\n  min-height:38px!important;\n  height:38px!important;\n  padding:0 4px!important;\n  border-radius:12px!important;\n  font-size:.76rem!important;\n  font-weight:800!important;\n  line-height:1!important;\n  white-space:nowrap!important;\n  box-shadow:none!important;\n}\n.astro-nav-label{\n  margin:9px 2px 5px!important;\n  font-size:.62rem!important;\n  letter-spacing:.10em!important;\n  color:#9a806d!important;\n}\n.astro-nav-tools{margin-top:7px!important}\n@media(max-width:640px){\n  div[class*="st-key-astro_period_nav_group"],\n  div[class*="st-key-astro_tool_nav_group"]{margin-bottom:0!important}\n  div[class*="st-key-astro_period_nav_group"] button,\n  div[class*="st-key-astro_tool_nav_group"] button{\n    min-height:36px!important;height:36px!important;font-size:.72rem!important;border-radius:11px!important;\n  }\n}\n</style>\n"""\nst.markdown(ASTRO_DESIGN_V74_CSS, unsafe_allow_html=True)\n'''
    s=s.replace(render,render+css,1); changed=True

if not changed:
    print('Already applied')
else:
    P.write_text(s,encoding='utf-8')
    print('Applied compact mobile segmented nav v7.4')
