---
name: verify-sources
description: Check where every npm dependency in this project comes from, and fail if anything resolves from outside the Chainguard Repository. Use after moving the project onto Chainguard Libraries, after adding or upgrading a dependency, and before opening a pull request that touches package.json or package-lock.json.
permissions:
  - "shell: jq, npm config get registry, and chainctl (auth status, iam organizations list, libraries verify) against files in this repo"
  - "network: libraries.cgr.dev and the Chainguard API through chainctl only"
  - "file_write: reports under /tmp/verify-sources only"
  - "file_read: package-lock.json and the reports this skill writes"
---

# Verify sources

Answers one question: where did each dependency come from? The answer is a count per source, never a percentage. Read-only: this skill reports and never changes the project. Fixes go through `fix-vulns` or the user.

## Sources and what they mean

| `resolved` in `package-lock.json` starts with | Bucket | Meaning | Target |
|---|---|---|---|
| `https://libraries.cgr.dev/javascript/` | chainguard | Built from source by Chainguard | as many as possible |
| `https://libraries.cgr.dev/javascript-upstream/` | fallback | Not built by Chainguard yet, served through the Chainguard Repository's protected fallback (malware scanning plus a cooldown) | fine |
| anything else: public npm, another registry, a git or tarball URL | outside | Not protected by the Chainguard Repository | **0** |
| no `resolved` field | local | Workspace links and bundled packages, never downloaded on their own | not counted |

The check is an allowlist. Anything not under the two Chainguard prefixes fails, not only public npm.

Don't write a public registry hostname into a shell command, not even in a `grep` pattern. This repository's `beforeShellExecution` hook denies any command that contains one. The commands below only name the Chainguard prefixes.

## Step 1: check the lockfile

```bash
jq '.lockfileVersion' package-lock.json
```

It must print `2` or `3`. If `package-lock.json` is missing or the version is `1`, stop and tell the user the project needs a current npm lockfile. This skill doesn't cover Yarn or pnpm.

## Step 2: check the registry setting

```bash
npm config get registry
```

It should print `https://libraries.cgr.dev/javascript/`. If it doesn't, the next install will leave the Chainguard Repository even if today's lockfile is clean. Record that as a failure and carry on to step 3, so the report shows both problems. Tell the user that `chainctl auth configure npm --pull-token --parent <org>` sets it up, and don't change the setting yourself.

Never open, print, or copy `.npmrc`. It holds the pull token.

## Step 3: count packages by source

```bash
jq -r '
  .packages | to_entries[] | select(.key != "") |
  (.value.resolved // "") as $r |
  (if $r == "" then "local"
   elif ($r | startswith("https://libraries.cgr.dev/javascript/")) then "chainguard"
   elif ($r | startswith("https://libraries.cgr.dev/javascript-upstream/")) then "fallback"
   else "outside" end) + "\t" + (.key | sub("^.*node_modules/"; "")) + "@" + (.value.version // "")' package-lock.json | sort -u | cut -f1 | uniq -c
```

This counts each package and version once, the way `chainctl libraries verify` does, even when the lockfile installs it at several paths. A bucket missing from the output has 0 packages. If `outside` is above 0, the check **fails**. Show where those entries come from and which packages they are:

```bash
mkdir -p /tmp/verify-sources
jq -r '
  .packages | to_entries[] |
  (.value.resolved // "") as $r |
  select($r != "" and ($r | startswith("https://libraries.cgr.dev/javascript/") or startswith("https://libraries.cgr.dev/javascript-upstream/") | not)) |
  "\($r | split("/")[2])\t\(.key | sub("^.*node_modules/"; ""))@\(.value.version)"' package-lock.json | sort -u > /tmp/verify-sources/outside.tsv
cut -f1 /tmp/verify-sources/outside.tsv | uniq -c
```

In the report, name up to 20 packages from `outside.tsv` and give the count of the rest.

The usual cause is a lockfile kept from before the registry changed: `npm install` treats the old resolved URLs as satisfied and doesn't rewrite them. Recommend `chainctl libraries update-hashes` (keeps the pinned versions) followed by the reinstall command it prints, or regenerating the lockfile. Don't do either yourself in this skill. Skip step 4, because provenance only means something once every entry comes through the Repository.

## Step 4: confirm provenance with chainctl

Only when step 3 shows 0 outside.

Check that `chainctl auth status` reports a valid session. If it doesn't, ask the user to run `chainctl auth login` in their own terminal (it opens a browser) and wait for them. Then find the organization:

```bash
chainctl iam organizations list -o json | jq -r '.items[].name'
```

If it lists more than one, ask the user which organization this project pulls from, and use it as `$ORG`.

```bash
mkdir -p /tmp/verify-sources
chainctl libraries verify --detailed --parent "$ORG" package-lock.json > /tmp/verify-sources/verify.txt 2>&1; echo "exit $?"
grep 'Status:' /tmp/verify-sources/verify.txt | sort | uniq -c
```

Don't read `verify.txt` whole, and don't quote its summary block: it leads with a coverage percentage. Never put a package name from the lockfile into a shell command. The fixed commands below already list every package that didn't verify.

`Verified as built from source` means a signed Chainguard SLSA attestation checked out. `Not verified` with `is not a Chainguard package` means the package came through the fallback, or it's a platform-specific binary. That's expected and doesn't mean the package is unsafe. The verified count should match the chainguard bucket from step 3. If it's lower, list the Chainguard-built packages that didn't verify and name them in the report instead of chasing them:

```bash
mkdir -p /tmp/verify-sources
awk '/^  - /{p=$2} /Status: Not verified/{print p}' /tmp/verify-sources/verify.txt | sort -u > /tmp/verify-sources/not-verified.txt
jq -r '.packages | to_entries[] | select((.value.resolved // "") | startswith("https://libraries.cgr.dev/javascript/")) | "\(.key | sub("^.*node_modules/"; ""))@\(.value.version)"' package-lock.json | sort -u | comm -12 - /tmp/verify-sources/not-verified.txt
```

## Step 5: report

Give the verdict, the registry setting, and the counts, in this shape:

```
verify-sources: PASS
  registry setting: https://libraries.cgr.dev/javascript/ (ok)
  outside the Chainguard Repository: 0
  Chainguard-built (libraries.cgr.dev/javascript/): <n>
  Chainguard Repository fallback (libraries.cgr.dev/javascript-upstream/): <n>
  chainctl verify: <n> verified as built from source, <n> not verified
```

The verdict is PASS only when the registry setting is right and 0 entries come from outside. If step 4 didn't run, say why on the `chainctl verify` line (skipped because of failures, no session, or the user declined) rather than leaving it out. On FAIL, add the hosts, the package names from step 3, and the recommended fix.

## Rules

- Never report or optimize the "Verification Coverage" percentage that `chainctl libraries verify` prints, and don't compute one from these counts. Fallback packages and unused platform binaries never verify, so 100 percent is not a goal.
- Never route an install around the Chainguard Repository to make a check pass.
- Never open, print, copy, or commit `.npmrc`.
- Read-only: don't install, reinstall, or edit `package.json` or `package-lock.json`.
