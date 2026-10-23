# 0126 — NYU Stern Viva Open-Source Codebase, Licensing & Author Inquiry Audit

- **Date:** 2026-10-19
- **Project:** `C:\dev\MBA Teaching AI\Smeal AI Teaching Grant`
- **Stakes:** Medium (verifying open-source availability, Zenodo `10.5281/zenodo.21522314` licensing, and ACM Digital Library publication status of NYU Stern Viva before contacting Prof. Panos Ipeirotis and Konstantinos Rizakos)
- **Outcome:** Kept work produced (`NYU-Viva-Open-Source-and-License-ResearchPrime-Report.md`) and repaired after cross-family (`claude-fable-5-1`) review caught two primary-source attribution errors before the author inquiry email was sent.

## What Worked
- Querying the Zenodo API (`https://zenodo.org/api/records/21522314`) with a standard HTTP `User-Agent` header resolved the earlier Cloudflare 403 block and retrieved `oral_ai_exams_data_zenodo.zip` (2.38 MB), confirming that the 6 Python scripts (`scripts/*.py`) carry an explicit **Apache-2.0** license (`README.md` lines 97–101: *"Data: CC BY 4.0. Code (scripts): Apache-2.0."*), while the two standalone February 24, 2026 GitHub Gists (`download_convai_transcripts.py` and `council_grade.py`) lack license headers.
- Cross-family review (`claude-fable-5-1`) caught two critical factual points that the single-family (`gemini`) worker missed:
  1. Crossref metadata for DOI `10.1145/3831714` shows the *Communications of the ACM* article was published online on **October 13, 2026** (`dl.acm.org/doi/full/10.1145/3831714`), six days before the run—so the report and email must not tell the authors that their CACM article is "not yet live online" or "slated for November 2026"; because `dl.acm.org` returns HTTP 403 to automated fetches, whether the sanitized orchestration snapshot is attached to the ACM DL *Supplemental Material* tab is `UNVERIFIED` pending browser inspection or author reply.
  2. `github.com/rizakos` is an unrelated dormant 2015 account, whereas GitHub user search identifies `github.com/KonstantinosRizakosNice` (`name: "Konstantinos Rizakos"`, New York City, created May 2026, 0 public repos), matching his NiCE affiliation in `paper_arxiv.tex` lines 99–103.

## Friction / Lessons
- **Crossref DOI check for ACM/IEEE publications behind Cloudflare 403:** When `dl.acm.org` blocks automated HTTP fetches with 403, workers should query `https://api.crossref.org/works/<doi>` to verify exact online publication dates rather than relying on preprint header notes, and grade supplemental-tab attachments behind HTTP 403 as `UNVERIFIED` rather than `OBSERVED` absent.
- **GitHub handle disambiguation:** Never assume a surname handle (`@rizakos`) belongs to a paper co-author when the GitHub API returns `name: null` and 10-year dormancy; always run `https://api.github.com/search/users?q=<Full+Name>` to locate the author's verified account (`@KonstantinosRizakosNice`).
