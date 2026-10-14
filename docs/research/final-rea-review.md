# Final REA review: usable import without Google credentials

Captured on 2026-10-14 with `rea-agents@6.5.0`, following `/workspace/rea/.agents/skills/reverse-engineer-anything/SKILL.md` and its runtime-observation guide. This pass investigates public documentation for an email-file fallback and review before import. It supplements [earlier matching evidence](rea-matching.md); it does not repeat the YNAB captures or verify private financial algorithms.

## Finding ledger

| Question | Status and observed evidence | Remaining boundary |
| --- | --- | --- |
| Can a person obtain an email file without granting Cajitas Gmail access? | Answered at documentation level. [Google's download guidance](https://support.google.com/mail/answer/9261412?hl=en-GB) describes opening Gmail on a computer, opening a message, then using More → Download message. It identifies the downloaded format as EML. REA: `ev_88d1f1c77ddd6461585bd8191c7cbd8ce6d1c13e5f97b2381a40387f307452fc`. | This is a desktop-oriented export instruction. No Gmail account was opened, no real message downloaded, and no native phone export was established. Google's desktop-client note concerns opening the file; it does not prevent a separately implemented web parser from reading selected file bytes. |
| Is local import a useful fallback when account syncing is absent or incomplete? | Answered as a documented pattern. [Monarch's import overview](https://help.monarch.com/hc/en-us/articles/41843105489300-Importing-Balances-and-Transactions-Manually) describes CSVs for missing history, unsynced data, and manual accounts, with field mapping and validation. REA: `ev_6e04acdd115c6a81c7de52f5947ceb08a3e861da227aa8c656b658aca9efc683`. | Monarch's CSV support does not establish email parsing, Nu/Mercado Pago patterns, or Cajitas's implementation. |
| What must people review before imported records affect their history? | Answered at documentation level. [Monarch's transaction instructions](https://help.monarch.com/hc/en-us/articles/4409682789908-Importing-Transactions-Manually) describe reviewing detected columns, account assignment, overlap handling, and a final summary. They warn that importing every row can create duplicates and that preferring CSV data can remove existing records across the file's date range. They separately describe reusing exported transaction IDs to update existing entries. REA: `ev_da3c7d11229b116d0b77b20e2725b1df9c1f8d31c3de21a8ac00257da93f2ae2`. | The article describes web-only importing and warns that CSV imports cannot be undone. No signed-in importer, duplicate comparison, or rollback was exercised. |

The Monarch overview's broad duplicate-prevention statement is qualified by its linked instructions: the selected overlap policy affects whether rows are retained, replaced, or duplicated. The evidence supports giving users a clear decision and a preview; it does not support claiming that every import is automatically safe from duplicates.

## Three implementation recommendations

These are Cajitas design choices derived from the observed guidance, not reconstructed source code or claims about the reference products' internals.

1. **Keep a useful local route beside connection setup.** Offer a working file picker and a phone-friendly paste option before requiring OAuth configuration. Label EML instructions as a computer workflow; on a phone, explain how to copy the message text into the paste field. A browser can read a deliberately selected file without backend Google credentials. Keep parsing and preview local, use an explicit size limit, and reject unsupported or unreadable formats with an actionable message. Do not render email HTML or execute embedded content. OAuth connection remains a separate capability whose availability depends on actual configuration.
2. **Make the review a small, editable task.** Show the detected institution, amount, calendar date, and destination cajita together, with the relevant original text nearby. Require explicit confirmation before changing recorded savings; ask for missing or ambiguous values. Use ordinary actions such as “Revisar correo” and “Confirmar depósito” instead of exposing parser settings in the main flow. Text pasted by a person and headers in a selected EML are supplied data: `From`, `Message-ID`, and even authentication-result text inside that file do not prove sender authenticity. A local import must not inherit any automatic-trust decision reserved for a configured server connection.
3. **Separate repeated input from a possible existing deposit.** Retain a stable local import identity or content fingerprint after confirmation so selecting the same input again can be identified. A hash identifies repeated bytes; it proves neither authenticity nor a unique financial event. Show a possible manual counterpart for explicit matching while preserving its cajita and history, as proposed in [the prior matching review](rea-matching.md). Different exports or pasted versions may need the user to resolve a possible duplicate. Do not replace an entire date range or silently add a second deposit because local text has changed.

The useful UX pattern here is a short sequence—choose or paste, review, confirm—with a visible next action when connection setup is unavailable. This pass does not establish a competitor's private visual treatment, mascot behavior, motion, conversion rate, or suitability for Mexican savings accounts.

## Executed workflow and retained artifacts

`npm exec --yes --package=rea-agents@6.5.0 -- rea list-browser-targets http://127.0.0.1:9222 --json` selected the externally owned target `E8A896C8DD554B834526A3827E8E20D3`, initially the local Cajitas preview. Discovery Evidence: `ev_2cbdfb65d899744e13cc4361ae21cc9c0c3c52a236c13989ba519e9412dde18b`.

REA then performed three sequential `capture-browser-scenario` calls. Each declared connect mode, that exact endpoint and target, its public `start_url`, and a visible heading wait. Google used `h1`; both Monarch scenarios used `h1.article__title`, which excludes the extra help-center heading. The original supplied Monarch overview URL redirected normally to the canonical title recorded above. The transaction article was selected from the overview's public link. Each navigation and wait completed successfully; no browser scenario action failed in this pass.

Full Evidence records and extracted artifacts remain outside git at `/workspace/rea-evidence/`:

- `final-browser-targets.json`.
- `final-gmail-{scenario,evidence}.json` and `final-gmail-{dom.html,accessibility.txt,screenshot.png}`.
- `final-monarch-import-{scenario,evidence}.json` and `final-monarch-import-{dom.html,accessibility.txt,screenshot.png}`.
- `final-monarch-transactions-{scenario,evidence}.json` and `final-monarch-transactions-{dom.html,accessibility.txt,screenshot.png}`.

Accessibility SHA-256 digests are respectively `309aafc3654446cdb72d006f042d5b856f0affd572eedf66111a4dff46d9251a`, `3babcb7009cf395bf567f04c49c5069350e423912852a698a09d47d13346164a`, and `e73e4a9ef39ba37f4c3dee52ecb95452e43488af977890d379af9d039831ed0f`.

Supplemental official-page retrieval independently returned the Google and Monarch overview content. Following the overview's older `help.monarchmoney.com` transaction link through the web retrieval tool failed with a non-retryable redirect/access error. The later REA scenario explicitly named the public canonical `help.monarch.com` transaction URL and loaded it normally. No authentication, challenge, TLS, or access-control bypass was used.

## Completeness and unknowns

All three captures retained requested final URL, DOM, accessibility, and screenshot artifacts without reported truncation. Each overall result reports `completeness.status: incomplete`, `equality_eligible: false`, and missing section `events`; events and network bodies/header values were not requested. The successful navigation and wait steps separately report complete. These are documentation-content observations, not complete network evidence or equality comparisons.

REA reports external process ownership, Chromium `156.0.8078.4`, and cleanup `disconnected-external`. It left the browser open. CDP cannot recover pre-attach activity or guarantee launch-time context settings; host platform, architecture, and application artifact identity were unavailable. The extracted screenshots are 1280×720 and do not verify physical mobile behavior. No private bank, Nu, Mercado Pago, Gmail mailbox, or signed-in Monarch account was inspected. No reference screenshots, HTML, scripts, or other assets were added to the product.

Google OAuth readiness, a real email parser's MIME coverage, exact institution sender rules, financial correctness, local deduplication behavior, and the finished Cajitas UI require separate implementation verification. This report neither claims those checks passed nor establishes that credentials exist.
