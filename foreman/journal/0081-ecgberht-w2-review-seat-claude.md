# 0081 — Ecgberht W2: switch review seat to Claude for JSON reliability

- **id**: 0081-ecgberht-w2-review-seat-claude
- **skill**: foreman@2026-07-24
- **situation**: repeated review:w2#0 unparseable JSON with review_family=grok after GREEN gates
- **context**: C:\dev\Ecgberht; gate 19/19; resume --clear-halt --force with REVIEW_FAMILY=claude for this invoke only
- **observation**: Prefs still grok/grok machine-wide; one-run env override ANCHOR_REVIEW_FAMILY/REVIEW_FAMILY=claude so cross_model:true for review seat. Gate re-proved 19/19; claude.exe review:w2#0 launched. Journal: grok review JSON parse is a recurring Foreman friction class on this host.
- **outcome**: friction
- **provenance**: genuine-execution
