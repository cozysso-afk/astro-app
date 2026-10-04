from pathlib import Path

INDEX = Path('supabase/functions/fortune-interpret-v23-preview/index.ts')
index = INDEX.read_text()

import_anchor = 'import { ensureDayDepthGuides } from "./dayDepthRepairV23.ts";\n'
import_line = 'import { polishV23EditorialDepth } from "./editorialPolishV23.ts";\n'
if import_line not in index:
    if import_anchor not in index:
        raise SystemExit('V23 editorial import anchor missing')
    index = index.replace(import_anchor, import_anchor + import_line, 1)

old_version = 'const VERSION="supabase-ai-v23.1-structured-output-headroom";'
new_version = 'const VERSION="supabase-ai-v23.2-editorial-polish";'
if old_version in index:
    index = index.replace(old_version, new_version, 1)
elif new_version not in index:
    raise SystemExit('V23 runtime version anchor missing')

old_quality = '  const quality=inspectInterpretationQuality(data,payload);'
new_quality = '  data=polishV23EditorialDepth(data,payload);\n  const quality=inspectInterpretationQuality(data,payload);'
if new_quality not in index:
    if old_quality not in index:
        raise SystemExit('V23 quality anchor missing')
    index = index.replace(old_quality, new_quality, 1)

INDEX.write_text(index)
