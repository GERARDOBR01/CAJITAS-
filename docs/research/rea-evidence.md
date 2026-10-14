# REA public-page evidence

Captured 2026-10-14 using the cloned [morluto/rea](https://github.com/morluto/rea) repository at commit `0f55f247cdd2ae9bd7903d5e45962b19dfc233dc` for instructions and contract inspection, and the version-pinned `rea-agents@6.5.0` CLI for executed captures. No MCP/client configuration was changed. The workflow followed REA's `reverse-engineer-anything` skill and `references/runtime-observation.md` in the cloned repository.

## Executed workflow

1. `rea list-browser-targets http://127.0.0.1:9222 --json` identified the existing externally owned Chromium page, target `287C6FCEB080F20BFA17E3BE0ECA859C`. Discovery Evidence: `ev_0121b4e93ad1560b5cdc7937cb62daa76fec907cd063074b218ef5272bbf5fa2`.
2. `rea capture-browser-scenario /workspace/rea-evidence/<name>-scenario.json --json` ran sequentially for three public help articles. Each scenario explicitly selected connect mode, the loopback endpoint and target, a public `start_url`, and a bounded visible-article-heading wait. REA performed navigation and the declared wait; this was not merely a source search.
3. Final URL, DOM, accessibility snapshot, and screenshot were requested. Request bodies, response bodies, and header values were not requested. Full Evidence JSON and extracted screenshots/text remain outside the Cajitas repository under `/workspace/rea-evidence/`.

| Public target | Evidence ID | Observed outcome and product implication |
| --- | --- | --- |
| [Qapital Set & Forget](https://help.qapital.com/en/articles/10245402-set-forget-rule) | `ev_fa3369378338ee860865c9d8dbbf5c2d0a77cae1d11d96b53a0007dc4c58438e` | Initial navigation and `h1` wait completed. The captured article documents fixed-amount daily/weekly/monthly transfers. Adapt cadence as a plan and reminder, without automated journal entries or transfers. |
| [Monarch Save Up Goals](https://help.monarch.com/hc/en-us/articles/44373182867476-Using-Save-Up-Goals) | `ev_87422e6636e0ff859653814d9450f3e24350cad4c1b087e5992832765c1d1040` | Navigation and `h1.article__title` wait completed. Captured article content distinguishes targets, planned contributions, actual goal balances and projections, and documents reversible archiving. Adapt those distinctions and history preservation to manual records. |
| [Finch Creating and Completing Goals](https://help.finchcare.com/hc/en-us/articles/37779940291213-Creating-and-Completing-Goals) | `ev_abc1ba14a2d238b63160c2f010dd578b3f08fa03ae6459179e25f086c3224056` | Navigation and `h1` wait completed. Captured article content describes recurring goals and pet rewards for goal completion. Adapt a habit check-in that advances the original mascot while leaving recorded savings unchanged. |

Accessibility snapshot SHA-256 digests, respectively:

- Qapital: `939c9485831bae55cedfa03d60b50844366992a762d649746bdb34d2cb950ea5`.
- Monarch: `f004bf8b65642eba513129ebeebe9d05e454fb01b6bbd6f6eadabe319bf2a8d6`.
- Finch: `e574f888b387a4b030ea7b3caf99530e8b54a6f440e94762c350d087e9960415`.

The initial Monarch attempt, `ev_7f316caedada426ef7c0d369cc87b3d72e2f1d16bdae3b49587a6844bf4ea21f`, navigated successfully but its generic `h1` wait failed because two headings matched. That record is preserved as `monarch-initial-evidence.json`. The rerun changed the selector based on the observed article heading; it did not silently discard the failure.

## Coverage and limitations

All three final captures retained the requested snapshots with no reported truncated sections. Each reports overall `completeness.status: incomplete`, `equality_eligible: false`, and missing section `events`, because event families were not requested. These captures support public-page content observations, not an exhaustive network/execution analysis or equality comparison.

REA reported Chromium `156.0.8078.4`, external process ownership, and cleanup `disconnected-external`; the browser was left open for the parent workflow. CDP attachment cannot recover prior events or guarantee launch-time context options. Browser host platform and architecture were not observed, and target artifact identity was unavailable. Screenshots therefore do not establish physical iPhone/Android rendering or installation behavior. Public pages loaded with the parent's inherited proxy and TLS verification; no TLS bypass was introduced.

No private savings application was logged into or exercised. Documentation that rendered in Chromium describes those applications; it is not proof of their private financial operations. The [reference-patterns document](reference-patterns.md) separates these references from Cajitas's proposed original implementation. No third-party UI assets or screenshot bytes were added to the product or committed to this repository.
