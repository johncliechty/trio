- `id`: 0099-green-gates-cannot-see-that-no-human-can-reach-the-feature
- `skill`: foreman@steward-v3-heavy
- `situation`: a build passes every gate and the user cannot perform the capability the build was for
- `context`: Ecgberht steward, 2026-08-04. Three separate user-facing dead ends found in
  ONE day, all in a build that closed 22/22 waves with 1193 tests and zero failures.
  John's words: *"I hate having to try it and it breaks... why didn't you find that one?"*
- `observation`:

  **All three defects share one shape, and the gate is structurally blind to it: the TEST
  ENTERED THROUGH A DIFFERENT DOOR THAN THE HUMAN.**

  1. `registerRoot` — the only verb that mints a project into the portfolio index. Proven
     by tests that `import { registerRoot }` and call it. No CLI, no bridge, no host path
     existed. The High Seat could therefore never show anything, on any host, ever.
  2. `proposeScaffolding` — the capability behind success criterion 1 ("a spoken
     description produces a PROPOSED multi-stage scaffolding"). Proven by **T-HOST-0**,
     the host-independence ACCEPTANCE test, which imports the function and calls it
     directly. The dialogue act table has ELEVEN acts and none of them is "scaffold this
     project"; the bridge accepts `--speak/--recall/--stand-up-confirm/--not-now` and has
     no scaffold command at all. So the acceptance test for the criterion PROVED THE
     ENGINE WORKS WHILE PROVING NOTHING ABOUT WHETHER A HUMAN CAN REACH IT.
  3. The CLI junction guard — tests invoked `bin/*.mjs` by its real path; the registered
     skill path is a junction, and through a junction both CLIs exited 0 in silence.

  **The acceptance test bypassed the surface it was accepting.** That is the whole
  lesson. A test that imports the function under test can only ever answer "does this
  function work". Reachability — is there a route from the thing the user touches to this
  function — is a DIFFERENT question, and nothing in the gate asked it. Worse, T-HOST-0
  is named for host-independence, so calling the engine directly *looks* principled: it
  is proving the engine needs no host. It just happens to also be the only evidence
  anyone had that the feature existed.

  **Why "more tests" is the wrong fix.** There were 1193 of them. The missing test is not
  another unit; it is ONE test per user-facing criterion that STARTS WHERE THE USER
  STARTS — argv into the bridge, an HTTP request to the endpoint, the CLI as a spawned
  process — and asserts the user-visible answer. Everything below that is already covered.

  **The cheap detector, in hindsight:** for every success criterion phrased as "a user
  can X", grep whether any non-test file outside the module reaches the implementing
  symbol. All three defects would have shown up as "referenced only by tests and the
  barrel" — a five-minute check that no wave ran.
- `outcome`: failed — the build was GREEN and the product was unusable in three places;
  found by the user, not the gate
- `provenance`: genuine-execution

## Lesson (one line)

**A wave that claims a USER capability is not proven by a test that imports the function
— it is proven by a test that enters through the outermost surface the human touches, and
until that test exists the criterion is unproven no matter how green the suite is.**
