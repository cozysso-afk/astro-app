from pathlib import Path
p=Path('web/src/AppNext.tsx')
s=p.read_text(encoding='utf-8')
s=s.replace("{ai.data.reunion_reading?.bottom_line&&<div className=\"reunion-ai-deep\">", "{isReunion&&ai.data.reunion_reading?.bottom_line&&<div className=\"reunion-ai-deep\">", 1)
s=s.replace("      if (relationshipPurpose === 'reunion') await runReunionTiming()", "      if (selectedTool === 'compatibility' && relationshipPurpose === 'reunion') await runReunionTiming()", 1)
p.write_text(s, encoding='utf-8')
