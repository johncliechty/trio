---
id: 0002-cloud-collab-claude-rw
skill: researchPrime (Heavy)
provenance: genuine-execution
---

- **situation:** John asked for a Heavy analysis of secure cloud collab (Box/Dropbox/Google/alt) where multiple humans collaborate AND Claude (Cowork/Code/connector) can read, MODIFY, and write docs back; >=3 options w/ pros·cons; no GitHub; not prohibitively costly.
- **context:** ENGINE probe GO (node v26, all trio modules crossed). Single-context host → isolation approximated. Cross-model via agy-dispatch (Gemini), readonly, no-shell steer. 6 web sweeps for ground-truth.
- **observation:** Engine import probe worked first try. agy-dispatch FIRST run failed usefully: Gemini misresolved CWD, tried to write a locate script, and (correctly, under the steer) refused to run a shell — returned no critique. Re-dispatch with the ABSOLUTE file path baked into the prompt → 14s, clean 2.5KB refutation. Lesson: never rely on the Gemini reviewer's CWD; always hand it an absolute path to the artifact.
- **outcome:** worked. Cross-model round materially improved the result — elevated M365/OneDrive to top pick (.docx-on-disk vs .gdoc-shortcut insight), corrected a wrong Google local-sync mitigation, forced modify-in-place vs save-new distinction, added Dropbox 3-seat-min + conflict-storm caveats. Adjudicated one Gemini overreach (Dropbox connector "can't write") against official pages and kept the corrected claim.
- **friction:** foreground `sleep` is blocked by the harness (must use background + notification); user reminded me of the 10-min status-table standing rule mid-run — honored thereafter.
