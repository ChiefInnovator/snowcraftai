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

## Optional (changes HEAD)

```bash
git fetch origin cursor/combined-parity-1518
# only after the worktree already matches that tree, or on a throwaway clone
```
