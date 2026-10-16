# Public source and private operational data

The repository contains application code and synthetic test data. It must not contain production exports, member identities, avatar URLs, private financial corrections or credentials.

## Existing deployment

Do not rerun historical SQL migrations. They were already applied to the deployed database. Public migration bootstrap IDs and seed content have been replaced with demo values; they are not a production restore backup. Schema baseline automation is not provided.

Historical PK boards are read from `pk_leaderboard_snapshots` using the period and match type. No board is recalculated or seeded during deployment. The private database remains authoritative. A missing snapshot produces an error rather than showing a fabricated ranking. Closed periods remain protected by application validation and database triggers.

Before deploying the archive refactor, verify both legacy snapshots exist and their non-avatar ranking fields match the previous deployment. Store original migrations and recovery exports in private operator storage outside public Git. Their absence from this repository does not delete production rows.

## Local development

Copy each `.env.example` to `.env` and configure your own Supabase and PayOS test credentials. Never copy production data into fixtures. `backend/tests/fixtures/pk-history-demo.json` is generated synthetic evidence for regression tests only.

## Publishing checklist

Scan the complete reachable Git history and tracked files with Gitleaks. Review commit messages, author metadata, PRs, Actions logs/artifacts, releases, screenshots and attachments separately. Treat asset redistribution rights as a separate review; source visibility does not establish a license for third-party images.

History rewritten for privacy must replace every published branch/tag that retains the original data. Collaborators should clone again rather than merge old history. Keep operational backups private. Do not change repository visibility until repository and GitHub-hosted surfaces have been reviewed.
