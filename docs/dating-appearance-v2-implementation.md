# Dating Appearance Archetype V2 — implementation review

Status: IMPLEMENTED FOR REVIEW. No merge or deployment. Real-device visual QA not approved.

Base/main verified and fetched: `dcabee92dc770d19dc7e0b3ee61d71a343d05200`

Branch: `feat/dating-appearance-v2`

This branch starts directly from current main. The separate PR #118 home design and single/couple changes remain pending and are not silently included in this focused change. Both PRs touch the dating panel integration and must be reconciled before merging together.

## Actual data path

The existing `/v1/love/new-relationship` endpoint already returns `result.static_structure`. The new panel loads this only on the user's “출생차트로 느낌 보기” action, using the saved calculation request profile, not unsaved form inputs. The request uses one selected-period day because the natal structure is invariant; the endpoint's timing output is not consumed or added to Fortune scores. Period scene cues use the existing selected-period Fortune result separately.

This is an existing deterministic calculation API call, not Gemini. No internal interpretation endpoint is invoked. There is an abort timeout, unmount cancellation, double-request guard and generic public error. Unsupported or missing natal evidence produces an honest limited state, never the old two-template fallback.

The local API contract and engine tests pass. A live production OpenAPI GET could not be completed from this environment (network URLError); production route availability and real-device click/copy behavior still need verification. Nothing was deployed to make this route available.

## Architecture

1. `datingNatalTransport.ts`: whitelist the single-person request; validate the existing response scope; select period mood only.
2. `datingArchetypeV2.ts`: extract precision-safe natal signatures, deduplicate physical factors, vote independently for each trait, assemble age impression and provenance.
3. `datingTraitRules.ts`: explicit product-authored symbolic visual styling choices. A score here is a local composition vote, never an astrology activation score or empirical probability.
4. `DatingArchetypePanel.tsx`: compact overview, face/body/style rows, animal metaphor, attraction points, celebrity reference, evidence disclosure and portrait controls.
5. Image copy reads the final structured traits, never a Venus/Mars whole-face template. Celebrity references are held separately and never passed to the builder.

## What actually contributes

| Existing source | Role | Relative weight | Traits/context |
|---|---|---:|---|
| Whole Sign 5H sign | Primary dating structure | 3 | Sign symbolism votes across independent traits |
| 5H ruler and its returned sign/house | Primary attraction context | 3 | Ruler identity, sign styling, small house context modifier |
| Natal Venus sign | Attraction | 2.5 | Sign style plus a modest harmony/style modifier |
| Whole Sign 7H sign | Partner context | 1.25 | Secondary relational visual context |
| 7H ruler and its returned sign/house | Partner context | 1.25 | Secondary ruler/sign styling |
| DSC | Partner axis | No extra vote when 7H already present | Corroborating provenance; one partner-axis source |
| Natal Moon sign | Softness/expression modifier | 1 | Exact birth time only |
| Selected-period Mercury/Venus/Mars support | Scene only | No anatomy vote | Animated conversation / relaxed scene / active scene |

When one physical planet serves multiple roles (e.g. Venus and both house rulers), its strongest role weight is used once; roles remain visible in provenance. Five and seven house contexts remain distinct. Stable rule ordering breaks ties. Repeated independent support is required for face shape, eyelid styling, height, body, proportions, jaw and nose shape. Weak data omit those fields.

The existing route does NOT expose a complete independent natal Mars/Mercury/Jupiter/Saturn position set or natal aspects. Those bodies participate only when returned as actual house rulers. No natal aspects, additional placements or anatomical facts were inferred. Quadrant metadata is not treated as extra independent support. This is an intentionally bounded use of the available contract.

## Symbolic crosswalk

| Symbol family | Example styling contributions |
|---|---|
| Mercury / Gemini / Virgo | Youthful impression, light frame, long eyes, animated mouth |
| Saturn / Capricorn | Mature impression, lean structure, restrained mouth, defined jaw |
| Jupiter / Sagittarius | Larger silhouette, long proportions, relaxed fit, open smile |
| Venus / Taurus / Libra | Balanced features, soft smile, polished style |
| Mars / Aries | Athletic build, defined contours, active posture |
| Moon / Cancer | Softer cheeks, curved eyes, warmer expression |
| Uranus / Aquarius | Distinctive styling and light/tapered visual impression |
| Neptune / Pisces | Dreamy gaze, softer lines and fabric |
| Pluto / Scorpio | Focused gaze and defined visual intensity |
| Sun / Leo | Open expression and physical presence |

These are editorial entertainment mappings; no claim of scientific validation or physical prediction is made. Eyelid creases are explicitly a visual style. Confidence means repetition of symbolic support, not empirical accuracy.

## Age and identity

- No fixed “30s” default. A symbolic relative-age category is rendered against the actual current age computed from saved birth date and an explicit as-of date.
- Bands remain adult-only and use a range. Unknown/invalid birth date omits the age range. No biological age is predicted.
- Ethnicity/nationality never enters natal derivation. Korean, East Asian and unrestricted rendering are user controls; Korean is the Korean-language product default.
- Gender remains visibly adjustable. Existing profile-based product default is preserved because no stored relationship-preference field exists in the current screen. User selection takes precedence for copy and celebrity references; no orientation claim is made.
- Celebrity names are editorial mood examples for gaze, smile and style only. Both KR/EN image prompts omit all names.
- Height is relative only; no cm measurement is generated.

## Dating versus spouse

Dating prioritizes 5H and attraction context. The personal-marriage model and endpoint are unchanged; no spouse output is reused. No comparison is displayed without both independently available models. A repeated symbol never asserts the next date is a future spouse.

## QA and verification

See [five complete generated examples](dating-appearance-v2-qa.md). Each includes age, height, body, face, eyes, nose, mouth, style, animal type, actual input evidence and final Korean image prompt. Regenerate with:

```sh
node scripts/generate-dating-archetype-v2-qa.mjs
```

Validation:

- All JavaScript tests: 280 passed.
- Dedicated V2 suite: 16 passed (included above).
- Python personal-love engine/API and birth-time reliability: 38 passed.
- TypeScript: passed.
- Vite production build: passed.
- `git diff --check`: passed.
- No browser runtime available; no generated-image or visual-realism approval claimed.
- Backend/DB/auth/cache/score logic: unchanged.
- Edge/Render deployments: none.
- Gemini paid calls: 0.

The prior obsolete two-template tests were ported to V2, retaining gender, precision, name exclusion and measurement restrictions. New tests additionally cover deterministic output, five-profile diversity (at least five trait differences between each pair), 5H/7H roles, duplicate physical factors, relative age, rendering identity separation, unknown-evidence failure, period/core separation and endpoint request safety.
