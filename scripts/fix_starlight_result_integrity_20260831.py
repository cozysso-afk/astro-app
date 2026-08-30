from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
app_path = ROOT / "web/src/AppNext.tsx"
api_path = ROOT / "api/main.py"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, got {count}")
    return text.replace(old, new, 1)


app = app_path.read_text()

app = replace_once(
    app,
    "  const [actionNotice, setActionNotice] = useState('')\n\n  useEffect(() => {",
    "  const [actionNotice, setActionNotice] = useState('')\n  const relationshipRevisionRef = useRef(0)\n  const restoringRelationshipRef = useRef(false)\n\n  useEffect(() => {",
    "relationship refs",
)

app = replace_once(
    app,
    "  useEffect(() => {\n    window.localStorage.setItem(AI_MODEL_STORAGE_KEY, aiModel)\n  }, [aiModel])\n\n  useEffect(() => {\n    const viewport = window.visualViewport",
    "  useEffect(() => {\n    window.localStorage.setItem(AI_MODEL_STORAGE_KEY, aiModel)\n  }, [aiModel])\n\n  useEffect(() => {\n    relationshipRevisionRef.current += 1\n    if (restoringRelationshipRef.current) {\n      restoringRelationshipRef.current = false\n      return\n    }\n    if (!relationshipResult && !relationshipRequestSnapshot && !relationshipAi && !reunionTiming) return\n    setRelationshipResult(null)\n    setRelationshipRequestSnapshot(null)\n    setRelationshipAi(null)\n    setRelationshipAiError('')\n    setRelationshipError('')\n    setReunionTiming(null)\n    setReunionTimingError('')\n    setRelationshipLoading(false)\n    setRelationshipAiLoading(false)\n    setReunionTimingLoading(false)\n  }, [selectedTool, relationshipMode, relationshipPurpose, marriageMode, relationshipDays, relationshipCalendarYear, queryDate, birthProfile, counterpart])\n\n  useEffect(() => {\n    const viewport = window.visualViewport",
    "relationship invalidation effect",
)

app = replace_once(
    app,
    "  const runReunionTiming = async (): Promise<ReunionTimingContext | null> => {\n    setReunionTimingLoading(true); setReunionTimingError('')",
    "  const runReunionTiming = async (): Promise<ReunionTimingContext | null> => {\n    const revision = relationshipRevisionRef.current\n    setReunionTimingLoading(true); setReunionTimingError('')",
    "reunion revision capture",
)

app = replace_once(
    app,
    "        const cached = buildReunionTimingContext(integratedResult)\n        setReunionTiming(cached)\n        return cached",
    "        const cached = buildReunionTimingContext(integratedResult)\n        if (revision !== relationshipRevisionRef.current) return null\n        setReunionTiming(cached)\n        return cached",
    "reunion cached stale guard",
)

app = replace_once(
    app,
    "      const context = buildReunionTimingContext(calculation)\n      setReunionTiming(context)\n      return context\n    } catch (error) {\n      const message = error instanceof Error ? error.message : '재회 시기 계산 중 오류가 발생했어.'\n      setReunionTimingError(message)\n      return null\n    } finally { setReunionTimingLoading(false) }",
    "      const context = buildReunionTimingContext(calculation)\n      if (revision !== relationshipRevisionRef.current) return null\n      setReunionTiming(context)\n      return context\n    } catch (error) {\n      if (revision !== relationshipRevisionRef.current) return null\n      const message = error instanceof Error ? error.message : '재회 시기 계산 중 오류가 발생했어.'\n      setReunionTimingError(message)\n      return null\n    } finally {\n      if (revision === relationshipRevisionRef.current) setReunionTimingLoading(false)\n    }",
    "reunion completion stale guard",
)

old_run_relationship = """  const runRelationship = async () => {
    setRelationshipError(''); setRelationshipResult(null); setRelationshipRequestSnapshot(null); setRelationshipAi(null); setRelationshipAiError(''); setReunionTiming(null); setReunionTimingError('')
    if (!birthProfile.birthDate || !birthProfile.birthTime) { setRelationshipError('먼저 내정보에서 본인 생년월일과 출생시간을 저장해줘.'); return }
    if (!counterpart.birthDate) { setRelationshipError('상대 생년월일은 반드시 필요해.'); return }
    if (counterpart.timeKnown && !counterpart.birthTime) { setRelationshipError('상대 출생시간을 모르면 “출생시간 모름”을 체크해줘.'); return }
    const body = {
      user: {
        name: birthProfile.name || '나', birth_date: birthProfile.birthDate, birth_time: birthProfile.birthTime, time_known: true,
        latitude: Number(birthProfile.latitude), longitude: Number(birthProfile.longitude), utc_offset_hours: Number(birthProfile.utcOffset || 9),
      },
      counterpart: {
        name: counterpart.name || '상대', birth_date: counterpart.birthDate, birth_time: counterpart.timeKnown ? counterpart.birthTime : null,
        time_known: counterpart.timeKnown, latitude: counterpart.timeKnown ? Number(counterpart.latitude) : null,
        longitude: counterpart.timeKnown ? Number(counterpart.longitude) : null, utc_offset_hours: Number(counterpart.utcOffset || 9),
      },
      start_date: relationshipStartDate,
      end_date: relationshipEndDate,
      relationship_status: selectedTool === 'marriage' ? (marriageMode === 'married' ? 'married' : 'dating') : (relationshipPurpose === 'reunion' ? 'single' : relationshipMode),
      analysis_mode: selectedTool === 'marriage' ? `marriage_${marriageMode}` : relationshipPurpose,
    }
    setRelationshipLoading(true)"""

new_run_relationship = """  const runRelationship = async () => {
    const revision = relationshipRevisionRef.current + 1
    relationshipRevisionRef.current = revision
    setRelationshipError(''); setRelationshipResult(null); setRelationshipRequestSnapshot(null); setRelationshipAi(null); setRelationshipAiError(''); setReunionTiming(null); setReunionTimingError('')
    if (!birthProfile.birthDate || !birthProfile.birthTime) { setRelationshipError('먼저 내정보에서 본인 생년월일과 출생시간을 저장해줘.'); return }
    const userLatitude = parseOptionalNumber(birthProfile.latitude)
    const userLongitude = parseOptionalNumber(birthProfile.longitude)
    if (userLatitude === null || userLongitude === null) { setRelationshipError('먼저 내정보에서 본인 출생지역까지 저장해줘. 정밀 관계 계산에는 위치 좌표가 필요해.'); return }
    if (!counterpart.birthDate) { setRelationshipError('상대 생년월일은 반드시 필요해.'); return }
    if (counterpart.timeKnown && !counterpart.birthTime) { setRelationshipError('상대 출생시간을 모르면 “출생시간 모름”을 체크해줘.'); return }
    const counterpartLatitude = counterpart.timeKnown ? parseOptionalNumber(counterpart.latitude) : null
    const counterpartLongitude = counterpart.timeKnown ? parseOptionalNumber(counterpart.longitude) : null
    if (counterpart.timeKnown && (counterpartLatitude === null || counterpartLongitude === null)) { setRelationshipError('상대 출생시간을 안다면 출생지역도 선택해줘. 모르면 “출생시간 모름”을 체크해줘.'); return }
    const body = {
      user: {
        name: birthProfile.name || '나', birth_date: birthProfile.birthDate, birth_time: birthProfile.birthTime, time_known: true,
        latitude: userLatitude, longitude: userLongitude, utc_offset_hours: Number(birthProfile.utcOffset || 9),
      },
      counterpart: {
        name: counterpart.name || '상대', birth_date: counterpart.birthDate, birth_time: counterpart.timeKnown ? counterpart.birthTime : null,
        time_known: counterpart.timeKnown, latitude: counterpartLatitude,
        longitude: counterpartLongitude, utc_offset_hours: Number(counterpart.utcOffset || 9),
      },
      start_date: relationshipStartDate,
      end_date: relationshipEndDate,
      relationship_status: selectedTool === 'marriage' ? (marriageMode === 'married' ? 'married' : 'dating') : (relationshipPurpose === 'reunion' ? 'single' : relationshipMode),
      analysis_mode: selectedTool === 'marriage' ? `marriage_${marriageMode}` : relationshipPurpose,
    }
    setRelationshipLoading(true)"""

app = replace_once(app, old_run_relationship, new_run_relationship, "relationship input validation")

app = replace_once(
    app,
    "      const typed = payload as RelationshipApiResponse\n      setRelationshipResult(typed)",
    "      const typed = payload as RelationshipApiResponse\n      if (revision !== relationshipRevisionRef.current) return\n      setRelationshipResult(typed)",
    "relationship response stale guard",
)

app = replace_once(
    app,
    "    } catch (error) {\n      setRelationshipError(error instanceof Error ? error.message : '관계 계산 중 오류가 발생했어.')\n    } finally { setRelationshipLoading(false) }",
    "    } catch (error) {\n      if (revision === relationshipRevisionRef.current) setRelationshipError(error instanceof Error ? error.message : '관계 계산 중 오류가 발생했어.')\n    } finally {\n      if (revision === relationshipRevisionRef.current) setRelationshipLoading(false)\n    }",
    "relationship request stale completion",
)

app = replace_once(
    app,
    "  const runRelationshipAi = async () => {\n    if (!relationshipResult) return\n    const analysisMode: RelationshipAnalysisMode = selectedTool === 'marriage' ? `marriage_${marriageMode}` : relationshipPurpose",
    "  const runRelationshipAi = async () => {\n    if (!relationshipResult) return\n    const revision = relationshipRevisionRef.current\n    const currentMode: RelationshipAnalysisMode = selectedTool === 'marriage' ? `marriage_${marriageMode}` : relationshipPurpose\n    const snapshotMode = String(relationshipRequestSnapshot?.analysis_mode ?? '')\n    const analysisMode = (snapshotMode || currentMode) as RelationshipAnalysisMode",
    "relationship AI snapshot mode",
)

app = replace_once(
    app,
    "      if (!payload?.ok || !payload.data) throw new Error(payload?.error || '관계 AI 해설 응답이 비어 있어.')\n      setRelationshipAi(annotatePayload(payload))\n    } catch (error) {\n      setRelationshipAiError(error instanceof Error ? error.message : '관계 AI 해설을 불러오지 못했어.')\n    } finally { setRelationshipAiLoading(false) }",
    "      if (!payload?.ok || !payload.data) throw new Error(payload?.error || '관계 AI 해설 응답이 비어 있어.')\n      if (revision !== relationshipRevisionRef.current) return\n      setRelationshipAi(annotatePayload(payload))\n    } catch (error) {\n      if (revision === relationshipRevisionRef.current) setRelationshipAiError(error instanceof Error ? error.message : '관계 AI 해설을 불러오지 못했어.')\n    } finally {\n      if (revision === relationshipRevisionRef.current) setRelationshipAiLoading(false)\n    }",
    "relationship AI stale completion",
)

app = replace_once(
    app,
    "    } else {\n      const request = item.request\n      const cp = (request.counterpart ?? {}) as Record<string, unknown>",
    "    } else {\n      restoringRelationshipRef.current = true\n      relationshipRevisionRef.current += 1\n      setRelationshipAi(null)\n      setRelationshipAiError('')\n      setRelationshipLoading(false)\n      setRelationshipAiLoading(false)\n      setReunionTimingLoading(false)\n      setReunionTimingError('')\n      const request = item.request\n      const cp = (request.counterpart ?? {}) as Record<string, unknown>",
    "archive relationship restore isolation",
)

app_path.write_text(app)

api = api_path.read_text()

api = replace_once(
    api,
    "    def engine_payload(self) -> dict:\n        return {\n            \"name\": self.name or \"\",\n            \"birth_date\": self.birth_date,\n            \"birth_time\": self.birth_time,\n            \"time_known\": bool(self.time_known and self.birth_time is not None),\n            \"latitude\": self.latitude,\n            \"longitude\": self.longitude,\n            \"utc_offset_hours\": self.utc_offset_hours,\n        }",
    "    def engine_payload(self) -> dict:\n        exact_time = bool(self.time_known and self.birth_time is not None)\n        return {\n            \"name\": self.name or \"\",\n            \"birth_date\": self.birth_date,\n            \"birth_time\": self.birth_time if exact_time else None,\n            \"time_known\": exact_time,\n            \"latitude\": self.latitude if exact_time else None,\n            \"longitude\": self.longitude if exact_time else None,\n            \"utc_offset_hours\": self.utc_offset_hours,\n        }",
    "relationship profile sanitization",
)

api = replace_once(
    api,
    "    if user_payload[\"birth_time\"] is None:\n        raise HTTPException(status_code=422, detail=\"user birth_time is required for the precision relationship engine\")\n\n    segments = _month_segments(request.start_date, request.end_date)",
    "    if not request.user.time_known or request.user.birth_time is None:\n        raise HTTPException(status_code=422, detail=\"user birth_time is required for the precision relationship engine\")\n    if request.user.latitude is None or request.user.longitude is None:\n        raise HTTPException(status_code=422, detail=\"user birth coordinates are required for the precision relationship engine\")\n    if request.counterpart.time_known:\n        if request.counterpart.birth_time is None:\n            raise HTTPException(status_code=422, detail=\"counterpart birth_time is required when time_known=true\")\n        if request.counterpart.latitude is None or request.counterpart.longitude is None:\n            raise HTTPException(status_code=422, detail=\"counterpart birth coordinates are required when time_known=true\")\n\n    segments = _month_segments(request.start_date, request.end_date)",
    "relationship API validation",
)

api_path.write_text(api)
print("PATCH_OK")
