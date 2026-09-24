# Reunion AI v12.9 grounding false-negative fix

Production evidence after v12.8 showed Gemini generation completed twice but the result was still rejected as `REL_RESULT_INVALID`.

Root cause: `repairReunionGroundingV2()` accepted grounded core sections with structural minima, but `grounded()` immediately imposed much larger prose-length style targets (summary 260, why 420, timing 220, rebuild 240, repeat risk 140). A safe, evidence-linked answer could therefore be repaired successfully and then rejected solely for being shorter than the editorial target.

v12.9 keeps evidence-reference, unsupported-claim, structure, and timing gates intact, while aligning the final reunion grounding check with the repair layer's structural minima. Editorial length remains a prompt quality target rather than a safety failure condition.

Safe stage-only diagnostics were added for shape, reunion repair, grounding, and parse/validation exceptions. Raw prompts and generated prose are not logged.
