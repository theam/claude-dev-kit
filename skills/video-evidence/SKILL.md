---
name: video-evidence
description: Record a short before/after MP4 of a story's changed user flow from the repo's own e2e spec and prepare it for the PR. Optional evidence, never a gate. Use from the story workflow when the plan offers it, or when asked for a video of a flow.
---

# Video Evidence

A reviewer or product owner should see the changed flow without booting the app. This skill records it from the repo's own e2e spec, converts it to MP4, checks it, and gets it into the PR.

It is **evidence, never a gate**: a skipped or failed recording never blocks the PR, and the PR always says why there is no video. Framework discovery, spec conventions, and the user-facing judgment come from `e2e-generate` — don't restate them here.

## 1. Detection (at plan time)

Offer the step only when all of these hold:

1. **User-facing change** — the plan's test plan includes `e2e-generate` work for this story. Refactors, tests, CI, and docs never get the offer.
2. **Browser e2e framework present** — detected the way `e2e-generate` does. Never install one for this.
3. **Native video** — v1 supports **Playwright** and **Cypress**. Puppeteer, TestCafe, Selenium, and WebdriverIO are "not offered yet".
4. **Unattended flow** — the spec runs on the suite's own auth (fixtures, stored state, test users). A flow behind interactive login or emailed codes is not offered.
5. **Local or test target** — the e2e `baseURL` is the e2e gate's own server, localhost, or a dedicated test environment with seeded data. Never production or a shared environment with real data.

Also probe ffmpeg (`ffmpeg -hide_banner -encoders | grep libx264`) and the repo's visibility (`gh repo view --json visibility`, `glab repo view`). A missing ffmpeg does not stop the offer (see §4).

Read `evidence.video` in `.claude/dev-kit.json`: `ask` (default, and the value when absent) · `always` · `never`. `always` still respects detection.

Put exactly one **Evidence** line in the plan:

- `Evidence: Video offered — before/after of <flow> (evidence.video: ask; ffmpeg: available|missing; repo: private|public)`
- `Evidence: Video will be recorded — before/after of <flow> (evidence.video: always; ffmpeg: available|missing; repo: private|public)`
- `Evidence: Video not recorded (evidence.video: never)`
- `Evidence: Video not offered (<reason>)` — e.g. `no user-facing change`, `no browser e2e framework`, `Selenium has no built-in recording yet`, `flow needs interactive login`, `target is not a local/test environment`

## 2. The gate question

Ask only when the Evidence line says **offered** and `evidence.video` is `ask`, together with plan approval — never as a separate pause:

- Yes, this time
- No, this time
- Yes, always (saved to `.claude/dev-kit.json` for the whole team)
- No, never (saved to `.claude/dev-kit.json` for the whole team)

On an always/never answer, set `evidence.video` to `always`/`never` in the working tree, preserving the rest of the file — never commit it at the gate. `create-pr` commits it as its own `chore:` commit in the story PR and names it in "Notes for reviewers": it is a team decision.

**ffmpeg missing and the video will be recorded** (a yes answer, or `always` in an interactive run) — ask one follow-up at the same gate:

- Install it now: show the platform command (`brew install ffmpeg` · `sudo apt-get install ffmpeg` · `winget install ffmpeg`) and run it only with the person's go-ahead.
- Download a portable copy for this run only: `npm install --no-save --no-audit --no-fund --prefix <temp dir outside the repo> ffmpeg-static@5.3.0` (the default pin — an exact version, never `latest`). It runs the package's install script, which downloads a prebuilt third-party ffmpeg binary: say so and get explicit consent first. Verify `libx264` is in its encoders, use it only from that temp dir, never add it to the repo's manifests, and delete the temp dir after the run.
- Continue with WebM (see §4).

**Public repo and the video will be recorded** — at the same gate, ask for the go-ahead to upload a world-readable clip. Without it (or when the step later runs as a subagent that can't ask), treat the upload as non-interactive (§5).

**Non-interactive** (`--auto-approve`, pre-approved runs): no question and no download. `always` records, `never` doesn't, `ask` doesn't — and the PR says so.

## 3. Record

- **Target check first** — confirm detection condition 5 against the resolved `baseURL` before recording; if it fails, don't record.
- **Nothing lands in the repo.** Write recordings to a temp directory outside the repo (`mktemp -d`; no spaces or commas in the path). A temporary config or spec copy that must sit inside the repo (so relative imports resolve, and next to the original so it matches the framework's spec pattern) goes in `.git/info/exclude` and is deleted afterwards. **Never edit the committed tests** or their config, and never commit video files to the PR branch.
- **Before** — at the start of Implement, on the untouched tree: for a bug, the repro spec written first, failing; for a changed flow, the existing spec. If that wasn't possible, use a temporary `git worktree` of the base branch running the same spec (needs a dependency install; watch for dev-server port collisions), and remove it afterwards.
- **After** — once the gates and self-review pass, from the already-green spec, reusing the server the e2e gate started.
- **Playwright** — a temporary config that extends the repo's: `use: { video: 'on', launchOptions: { slowMo: 300–600 }, viewport }`, `outputDir` in the temp directory. Run only the chosen test, once: `-g '<escaped name>' --project=<one> --retries=0 --workers=1`. Other bindings: pytest-playwright `--video on --slowmo 500 --output <temp dir>`; .NET/Java set `RecordVideoDir` on the context in the temporary copy.
- **Cypress** — `npx cypress run --spec <temp copy> --config video=true,videosFolder=<temp dir>`. Cypress has no slowMo: pace the temporary copy, never the committed spec.
- **Readable without audio** — in the temporary copy, inject a caption overlay into the page for each step.
- **Cold start** — warm the route first, outside the recorded context.
- **Budget** — 10 minutes for the whole step (the kit's default; there is no setting for it yet). On timeout, stop and report it.
- **Failure** — report it; never retry in a loop.

## 4. Convert

- **MP4 through ffmpeg**, trimming leading blank frames (find the first real frame after the warm-up, or use `blackdetect`/`freezedetect`):
  ```bash
  ffmpeg -y -ss <start> -i <in> -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an <out>.mp4
  ```
  Cypress already records MP4 — ffmpeg only trims it.
- **Short** — 5 to 30 s per clip, under the host's upload limit (GitHub: about 10 MB on free plans). Too large → raise `-crf` or scale down.
- **Never a GIF.** It is heavier, loses color, and can't be paused or seeked.
- **No ffmpeg** (none installed and no consent to download) → hand off the WebM the framework recorded, untrimmed, and confirm the host accepts `.webm`.

## 5. Check key frames before hand-off

Extract about one frame per second into the temp directory (`ffmpeg -i <clip> -vf fps=1 <tmp>/frame-%03d.png`), plus the frame at each caption and the last frame before each navigation, and look at them.

- Tokens, keys, real emails or names, or real customer data visible → **do not hand the clip off**; delete the clip and its frames now, report it, and use the `withheld` line.
- **Public repo** (e.g. `gh repo view --json visibility`, `glab repo view`): an attached video is world-readable. Upload only with the go-ahead given at the plan gate (§2). Without it, never upload; use `Video: recorded, pending attachment (public repo — needs a human check)`.

## 6. Hand-off (after `create-pr` returns the PR URL)

| `prHost` | Hand-off |
|---|---|
| `gitlab` | Upload each clip: `curl --header "PRIVATE-TOKEN: $GITLAB_TOKEN" --form "file=@<clip>" "<gitlab>/api/v4/projects/<id>/uploads"` — reference the variable, never print, echo, or log its value, and never put it in a URL. Post the returned `markdown` as an MR note under "Before"/"After". Inline playback on self-managed instances: verify. |
| `github` | Prepared hand-off (the API cannot attach a video that plays inline). |
| `bitbucket`, `azure`, other | Prepared hand-off; the host may only link the file rather than play it. |

**Prepared hand-off:**

1. Reveal the files: `open -R <clip>` (macOS) · `xdg-open <dir>` (Linux) · `explorer /select,<clip>` (Windows).
2. Give a paste-ready comment with a **Before** and an **After** heading.
3. Give the exact instruction: "Open the PR, start a new comment, paste the text, drag each file under its heading, wait for the upload to finish, then post."

**Never claim an attachment that wasn't made.** The line stays "pending attachment" until a `github.com/user-attachments/assets/` link (or the host's equivalent) is actually seen in the PR. Once it is — or the GitLab upload succeeded — update the `Video:` line in the PR body to `attached`. Clean up the temp directory and any worktree afterwards; keep the final clips until the person confirms the hand-off.

## PR evidence line

Hand `create-pr` exactly one `Video:` line:

- `Video: attached (before/after)` — set on the PR body only after the attachment is really there (§6)
- `Video: recorded, pending attachment` (add `(public repo — needs a human check)` when §5 applies)
- `Video: WebM (ffmpeg not available), pending attachment`
- `Video: not offered (<reason>)`
- `Video: declined`
- `Video: not recorded (non-interactive run; evidence.video is "ask")`
- `Video: not recorded (evidence.video is "never")`
- `Video: failed (<reason>)`
- `Video: withheld (key frames showed <kind of data>)`
