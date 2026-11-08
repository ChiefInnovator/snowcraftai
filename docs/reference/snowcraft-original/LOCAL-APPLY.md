# Applying this tree onto Rich’s checkout

Goal: `/Users/rich/.openclaw/projects/snowcraftai/docs/reference/snowcraft-original/`
contains these archives, not merely a copy under uploads or `/tmp`.

The combined branch is `cursor/combined-parity-1518`. It is based on
`feature/repo-restructure` at `ff39e410` and already includes the local
four-file edits that were on that checkout, original audio, BITD/VWSC work,
and this docs folder.

**Do not merge to `develop` or `main`.**

## Preferred: checkout / merge the combined branch

From `/Users/rich/.openclaw/projects/snowcraftai`, currently on
`feature/repo-restructure` with possible uncommitted edits:

```bash
git fetch origin cursor/combined-parity-1518
# stash only if you have *newer* local edits that are not in the branch
git stash push -u -m "pre-combined" || true
git merge --ff-only origin/cursor/combined-parity-1518
# or: git checkout cursor/combined-parity-1518
```

After that, confirm:

```bash
ls docs/reference/snowcraft-original/archives
sha256sum -c docs/reference/snowcraft-original/SHA256MANIFEST.txt
```

## Binary patch from `ff39e410`

A binary-capable patch (`git diff --binary ff39e410`) is produced as a cloud
artifact for this run (not committed inside the repo, which would nest a copy
of the zips inside the zips’ own patch).

On a clean tree whose `HEAD` is `ff39e410`:

```bash
git apply --binary --index snowcraft-combined-from-ff39e410.patch
```

`git apply` needs Git’s binary literal format (`diff --git` plus
`GIT binary patch` / literal). A plain unified diff will reject the zips.

If the working tree still has the original uncommitted SEO / revive /
`winctl.py` edits, reset or stash them first — they are already in the patch.
