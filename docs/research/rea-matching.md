# REA evidence: manual and imported transaction matching

Captured 2026-10-14 with `rea-agents@6.5.0`, following the REA browser runtime workflow. This investigation is limited to two official YNAB help articles. It observed public documentation, not transactions in a signed-in YNAB account.

## Sources and observed guidance

| Source | REA Evidence ID | Captured guidance |
| --- | --- | --- |
| [How Do I Find Matched Transactions?](https://support.ynab.com/en_us/how-do-i-find-matched-transactions-By_NjCAYGx) | `ev_4cde08e0fe636d7e0dfb9442f6c7a6fd3fc24551b46dfe4f445d249758bc73fd` | The article says a manually entered transaction can be matched when it later imports. A Matched filter exposes the result. The initially displayed iOS instructions use Spending → search → Matched; the article limits the mobile filter to matches on or after July 20, 2026. Other platform tabs were not exercised. |
| [File-Based Import](https://support.ynab.com/en_us/file-based-import-a-guide-Bkj4Sszyo) | `ev_28a32e1455285825bf6edfdf7b9b7709c87524e03f81784e8d7fc9b6163dae77` | The duplicate/skipped section says manual/imported matching requires exactly equal amounts and dates within ten days. Separately, repeated imports skip transactions with exactly the same date and amount. The article describes verifying the destination account and CSV field mapping, reviewing skipped transactions, and saving only transactions confirmed in the preview. |

The file-import article distinguishes matching a manual entry from suppressing a repeated imported entry. This distinction is useful for Cajitas: an import's prior identity and a possible counterpart in the manual journal answer different questions. Equal amounts alone cannot establish that two records are the same purchase.

## Cajitas design recommendation

Use a conservative suggestion based on the same integer-cent amount, local calendar date, and provider, with an explicit confirmation for each proposed manual/import pair. Confirmation should retain the existing journal entry and its assigned cajita while recording the import identity, so the user does not count the same movement twice. If multiple manual entries qualify, require selection instead of silently choosing one. Keep unmatched imported rows reviewable and show which entry was matched.

These are Cajitas design choices. The captured YNAB documentation describes a broader ten-day date window; it does not establish a provider equality rule, integer-cent storage, ambiguity resolution, preservation of Cajitas categories, or the implementation of an explicit pair-confirmation control. Its account verification and import preview provide documented review patterns, not proof of those proposed details.

## Executed workflow and retained evidence

`list-browser-targets http://127.0.0.1:9222 --format json` identified the externally owned local Cajitas page, target `522D0A85EFA1F14EBE9FE42FAD691DD8`; discovery Evidence was `ev_10fa1fe8f8fba0d85eebc888dbf602d2a85d1a2be0adc928012478a86138f81a`. REA then performed declared navigation to each source URL and a visible wait for `article h2.article-title`. Final URL, DOM, accessibility and screenshot captures were requested. Both final navigation and wait steps completed.

Full records and extracted snapshots remain outside the app under `/workspace/rea-evidence/`:

- `ynab-matching-title-scenario.json` and `ynab-matching-title-evidence.json`.
- `ynab-file-import-title-scenario.json` and `ynab-file-import-title-evidence.json`.
- `ynab-{matching,file-import}-{dom.html,accessibility.txt,screenshot.png}`.

Initial `h1` waits timed out because the rendered article titles are `h2`. A subsequent broad `article h2` selector failed strict matching because multiple headings matched. Those unsuccessful records remain as `*-evidence.json` and `*-ready-evidence.json`; the final selector was narrowed using the observed DOM. A zero CLI exit status alone did not establish successful scenario actions.

## Boundaries and unresolved questions

The two guidance questions—how users discover matched entries and what matching/import-suppression conditions the help articles describe—are answered at documentation level. Actual YNAB algorithm execution, signed-in UI behavior, ambiguous matches, matching reversal and financial correctness remain unobserved. No private account, bank site, Nu or Mercado Pago interface was accessed.

Each final record reports `completeness.status: incomplete`, `equality_eligible: false`, missing section `events`, and no truncated sections. Event families, request/response bodies and header values were not requested. These records support source-content observations, not a network or execution comparison. REA reports external process ownership and `cleanup: disconnected-external`; it left the browser open. Artifact identity, host platform and architecture were unavailable, and CDP attachment cannot guarantee launch-time context options. Captured PNGs are 1280×720, so they do not verify a 390×844 device viewport or physical mobile behavior. No third-party assets were added to the product.
