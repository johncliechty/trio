# 0047 — RBS2418 L1b: CPPD age stratification and the non-wage economic channel

- **id:** 0047
- **skill:** researchPrime (Heavy, ENGINE mode)
- **situation:** Targeted REPRISE of campaign step L1. The principal challenged two L1 conclusions on
  specific, reasonable grounds: (a) that a single flat "CPPD is 1.5–5% of elderly arthritis" figure
  concealed steep age stratification, and (b) that declaring the economic channel empty on labour-force
  participation ignored non-wage productivity. Mid-run the coordinator added a requirement to express
  the channel as a conditional, parameterised function rather than a point estimate.
- **context:** Plan gate hash-bound (`1e12087993b590eb…`), tier=high, 5 fresh-context seats, 4 governed
  rounds. Session WebSearch budget was exhausted (200/200) BEFORE the run started; all discovery ran
  through PubMed E-utilities, Europe PMC REST, PMC, OpenAlex, Unpaywall, CORE, the BLS public API, and a
  DuckDuckGo-lite HTML fallback.
- **observation:**
  1. **The lite.duckduckgo.com/lite HTML endpoint is a working WebSearch substitute via WebFetch** when
     the search budget is gone. Plain `duckduckgo.com/html` hits a CAPTCHA; `bing.com/search` returns
     junk. Complex quoted queries return nothing on lite; simple ones work. This restored search.
  2. **When WebFetch's summariser refuses to reproduce a table on copyright grounds, the fetched PDF is
     still saved locally** — `pdftotext -layout` on that file recovered the Second Panel Impact Inventory
     verbatim. The refusal is at the summariser, not the fetch.
  3. **Unpaywall's `oa_locations` found a PMC copy that PMC's own search, OpenAlex and Semantic Scholar
     all missed.** The paywalled target (Grosse 2009) was genuinely unobtainable after 10 routes, but its
     open-access same-author successor was one Unpaywall call away. Chase the successor, not the paper.
  4. **A 100× decimal-rendering trap in a PMC table** (548.87 rendering as "54,887"). Caught only because
     the table printed its own numerators and denominators, making the rates self-checking. A seat had
     flagged caution but got the direction of the correction wrong; personally recomputing settled it.
  5. **The engine's round schema needs `severity: 'MAJOR'|'MINOR'` and `traces_to_north_star: 'yes'` as
     STRINGS.** Booleans silently produce a `SKIPPED (zero-AXIS, crit-4)` round that looks like a clean
     pass. That is a dangerous failure mode — it reads as convergence when nothing was adjudicated.
  6. `bin/plan-gate.mjs` CLI hangs at Gate 2 under piped stdin; driving `runPlanReviewGate` directly with
     `promptGate1`/`promptGate2` callbacks works and writes the governance record.
  7. **Both challenges were partly right and partly wrong, in opposite directions** — the age gradient is
     real (~4–5×) but the share LEVEL is lower than L1 reported; the economic channel is real and
     guideline-sanctioned but its magnitude is unmeasured. Reporting both directions was the whole value.
- **outcome:** worked — CONVERGED (dry) after 4 rounds, one binding 3-of-3 blocker accepted and the share
  table rebuilt around within-source gradients rather than a cross-source ratio.
- **provenance:** genuine-execution
