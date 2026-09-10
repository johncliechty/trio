- id: 0131
- skill: foreman
- situation: Build orchestration latency and misleading progress
- context: John requested future-improvement journaling during the 2026-09-10 Steward/Anchor review. No Foreman engine was launched; historical records and this session launcher failures were inspected.
- observation: Steward 0082 records about 46h total, 21.5h dead and 19.5h in two overnight stalls; active fixes caught real lock/DOM defects. It also records repeated full gates over an unchanged prior-wave tree after an executor failed. Steward 0100 records six launches before useful build work in a new seat configuration. Foreman 0129 already records the spaced-path ConPTY failure; this session independently repeated that wrapper class before Grok review, with zero model calls on those launches. The overly short review turn cap is our session harness error, not a Foreman defect.
- outcome: OPEN future Foundry improvement: separate build/check time from orientation, queue and recovery; verify actual project/seat/tool capability at launch; supervise owned executor terminal state across host refresh; avoid reproving unchanged work as a new wave; reuse prior gates only when artifact/environment scope matches, never skip necessary verification. Use direct bounded slices for refinement where they fit, with the same meaningful review and live proof.
- provenance: genuine-execution of user-requested retrospective review; not a new engine run or current defect certification.

Independent plan-review follow-up: Grok (actual grok-4.6-build) recommends no Foreman launch for the first refinement loop, a disposable first write target, named durability/concurrency gates and no dependency on the later status soak. Direct coding still needs independent review and real visible proof; no claim that reduced ceremony alone makes it correct or faster.

Acceptance for a future cycle: Use a spaced project path, dead executor with unchanged tree, provider limit, interrupted coordinator and changed gate input; require correct root, journaled configured failover, honest stopped state, no false new-wave success, supported resume and actual delivery. Compare time to first usable product and post-feedback rework, not raw gate count.

Evidence: C:/dev/Ecgberht/journal/0082-steward-chamber-wallclock-accounting.md; C:/dev/Ecgberht/journal/0100-gate5-three-days-lessons-learned.md; C:/dev/trio/foreman/journal/0129-chekhov-main-launch-space-quoting.md; C:\dev\Skill Foundry\planning\steward-refinement-2026-09-10\SESSION.md
