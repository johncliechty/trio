---
id: 0049
skill: researchPrime
---

**situation:** John asked for a vetted report on Bildco (Abu Dhabi), carrying four supplied premises: UAE-government owned, backed by "a brother of MBZ, Khaled", run by Shamsa Al Fahim with father Sulaiman on the board, building a new city "between Dubai and Abu Dhabi" called "El something".

**context:** ENGINE mode (import spike go, 26 trio symbols). Single-context, ISOLATION approximated (session rule bars sub-agent fan-out). Tier `high` (declared high + hard-to-reverse + major). plan-gate APPROVE recorded, planHash 66600a00…3cb10472.

**observation:** Three of four premises did not survive primary sourcing. The decisive find came from ARABIC-language sources only — the English corpus never named the 80% strategic partner (Abu Dhabi Integrated Investment Holding, 36m sqm land in-kind, AED 2.131bn, 6 Dec 2025). Two English-language searches on the same question returned "not disclosed in these sources". Lesson: for Gulf corporate structure, query in Arabic before concluding a fact is unpublished. Second: the ADX apigateway PDF endpoint 403s to WebFetch, but bildco.ae's investor-relations page renders the same filings' contents — the company site was the usable primary path. Third: the engine's finding schema is strict — `traces_to_north_star` must be the STRING "yes" and severity must be BLOCKER/MAJOR uppercase; booleans + lowercase silently demoted every finding and round 1 reported a false zero-AXIS skip. That failure mode looks exactly like a clean run.

**outcome:** worked — converged DRY at round 4 (dryStreak 3/3, unresolvedHigh 0, conformance OK); honesty guard correctly fired on round 1 flagging the single-family blind spot as un-mitigable.

**provenance:** genuine-execution
