# Releasing

This repo hosts the reusable release workflows consumed by every `elcoosp/*` repo.

## Patterns

| Package type | Reusable | Caller | Trusted Publisher filename |
|---|---|---|---|
| Rust crate | `.github/workflows/release-plz.yml` | `release-plz.yml` | `release-plz.yml` |
| npm package | `.github/workflows/release-please.yml` | `release.yml` | **`release.yml`** |

## Onboarding a new repo

**Rust crate:**
1. Copy `templates/release-plz-caller.yml` → `.github/workflows/release-plz.yml` verbatim.
2. Repo secret `RELEASE_PLZ_TOKEN` (PAT with `repo` scope, or org secret).
3. crates.io → `https://crates.io/crates/<crate>/settings/trusted-publishing` (GitHub Actions, `release-plz.yml`)

**npm package:**
1. Copy `.github/workflows/release.yml` from `takumi-motion`.
2. Repo secret `RELEASE_PLEASE_TOKEN`.
3. Add `release-please-config.json` and `.release-please-manifest.json`.
4. npm → `https://www.npmjs.com/package/<pkg>/access` (GitHub Actions, `release.yml`)

## Trusted Publisher
For reusable workflows, npm matches the **caller** workflow (e.g. `release.yml`).
