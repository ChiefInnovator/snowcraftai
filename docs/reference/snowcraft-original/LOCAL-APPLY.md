# Applying onto the dirty `ff39e410` checkout

Local tree this patch is built for:

- Branch: `feature/repo-restructure`
- `HEAD`: `ff39e41023f9c6d3682f23917532fb5dd759e7c2`
- Uncommitted: the four files in `snowcraft-local-edits.patch`
  (`docs/SPECIFICATIONS.md`, `src/index.html`, `src/js/game.js`,
  `tools/reference/winctl.py`)

**Do not** `git reset`, `git stash`, `git checkout --`, or merge to
`develop` / `main`. The patch’s “before” side **is** that dirty preimage.
A clean-`ff39e410` patch will collide with those four files.

Final tree: `cursor/combined-parity-1518` (see the artifact for the exact
commit SHA). After a successful apply, `/Users/rich/.openclaw/projects/snowcraftai/docs/reference/snowcraft-original/` exists on disk. `HEAD` can stay at `ff39e410`.

## Exact commands

From `/Users/rich/.openclaw/projects/snowcraftai`:

```bash
git rev-parse HEAD
# must print ff39e41023f9c6d3682f23917532fb5dd759e7c2

git status --short
# must include the four local-edit files; do not revert them

git apply --check --binary /path/to/snowcraft-dirty-ff39e410-plus-local-edits-to-combined.patch
git apply --binary /path/to/snowcraft-dirty-ff39e410-plus-local-edits-to-combined.patch

sha256sum -c docs/reference/snowcraft-original/SHA256MANIFEST.txt
ls docs/reference/snowcraft-original/archives
```

Optional: `--whitespace=nowarn` if Git only complains about trailing
whitespace in recovered Director dumps.

If `--check` fails, stop. Do not `--reject`, stash, or reset.

## Incremental patch after that apply (from `8cee4f1`)

Once the dirty-preimage patch has been applied, the worktree matches combined
`8cee4f14959a25765dfa0842949ddbfb126c8f06`. **Do not** reset or re-apply the
ff39e410 patch. The next graphics/scaler update is an incremental binary patch
whose before-side **is** that `8cee4f1` tree:

```bash
# worktree must already be the applied combined tree (8cee4f1 contents)
git apply --check --binary /path/to/snowcraft-incremental-8cee4f1-graphics-scaler.patch
git apply --binary /path/to/snowcraft-incremental-8cee4f1-graphics-scaler.patch
```

That patch keeps the existing 600×320–1800×960 display scaler (Fit to window,
1×–3×). It does not stash, reset, or merge to `develop` / `main`.

## Incremental patch after the graphics/scaler apply (from `8b73a06`)

Once the graphics/scaler increment has been applied, the worktree matches
combined `8b73a06ecf8526542f1827b194941f6befa35231`. **Do not** reset or
re-apply earlier patches. The next 32-bit UI increment is a binary patch whose
before-side **is** that `8b73a06` tree:

```bash
# worktree must already be the applied combined tree (8b73a06 contents)
git apply --check --binary /path/to/snowcraft-incremental-8b73a06-bitd32-ui.patch
git apply --binary /path/to/snowcraft-incremental-8b73a06-bitd32-ui.patch
```

That patch recovers Happy Holidays, digits 5–9, and Congratulations from D4
planar PackBits BITDs. It keeps the 600×320–1800×960 display scaler. It does
not stash, reset, or merge to `develop` / `main`.

## Incremental patch after the 32-bit UI apply (from `8936227`)

Once the 32-bit UI increment has been applied, the worktree matches combined
`8936227b47bb91f7353704824c3b69df9f558300`. **Do not** reset or re-apply
earlier patches. The next digit-slot / Play Again increment is a binary patch
whose before-side **is** that `8936227` tree:

```bash
# worktree must already be the applied combined tree (8936227 contents)
git apply --check --binary /path/to/snowcraft-incremental-8936227-digit-slot-playagain.patch
git apply --binary /path/to/snowcraft-incremental-8936227-digit-slot-playagain.patch
```

That patch slot-aligns digits 5–9 with the 8-bit 2–4 VWSC loc and wires the
original Play Again BITD (member 77). It keeps the 600×320–1800×960 display
scaler. It does not stash, reset, or merge to `develop` / `main`.

## Incremental patch after digit-slot apply (from `733caa4`)

Once the digit-slot increment has been applied, the worktree matches combined
`733caa477a57f8f44b07ba8cd6d99dfea6834bda`. **Do not** reset or re-apply
earlier patches. The Copilot mute / docs increment is a binary patch whose
before-side **is** that `733caa4` tree:

```bash
# worktree must already be the applied combined tree (733caa4 contents)
git apply --check --binary /path/to/snowcraft-incremental-733caa4-copilot-mute-docs.patch
git apply --binary /path/to/snowcraft-incremental-733caa4-copilot-mute-docs.patch
```

That patch resumes BGM on unmute, gates title-start intro/music through mute,
and corrects DXR extraction steps in the original-archive docs. Scaler
unchanged. If the worktree is still `8936227`, apply the digit-slot patch
first, then this one — or apply
`snowcraft-incremental-8936227-digit-slot-and-mute.patch` instead of both.

## Incremental patch after mute/docs apply (from `9447385`)

Once the mute/docs increment has been applied, the worktree matches combined
`9447385a812c6a5f98a2f088a0aea88fb09a2d86`. **Do not** reset or re-apply
earlier patches. The level-end hit guard is a binary patch whose before-side
**is** that `9447385` tree:

```bash
# worktree must already be the applied combined tree (9447385 contents)
git apply --check --binary /path/to/snowcraft-incremental-9447385-level-end-hits.patch
git apply --binary /path/to/snowcraft-incremental-9447385-level-end-hits.patch
```

That patch ignores in-flight hits after a level has ended so a loss cannot
be overwritten by a later win. Scaler unchanged. If the worktree is still
`8936227`, prefer the combined patch named
`snowcraft-incremental-8936227-to-combined.patch` instead of stacking every
increment.

## Optional (changes HEAD)

```bash
git fetch origin cursor/combined-parity-1518
# only after the worktree already matches that tree, or on a throwaway clone
```
