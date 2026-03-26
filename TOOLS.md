# TOOLS.md - Cleo's Local Notes

## Q Business (QB / QSph)

- **App ID:** `1b2dcad6-c48e-4f28-ba6e-b10e4a8e476f`
- **Index ID:** `90f472c9-4b5c-4e7e-9739-a96caaa191d7`
- **Region:** us-west-2
- **Data sources:** FHIR-R4-CQL-Docs, hedis-my2025, hedis-my2026, FDBDocumentation, Surescripts, NCQA-HEDIS-Core, LongCOVID-Research, ncqa-simplifier
- **S3 bucket:** `sph-amazon-q`
- **Auto-sync:** daily at 6 AM UTC (10 PM PST)
- When someone says "QB", "QSph", "check the docs", or "search the knowledge base" → use the cleo-qbusiness skill

## MongoDB (FDB)

- **URI:** Set in `FDB_MONGO_URI` env var (Atlas dev-fdb-01 cluster)
- **Database:** FDB pharmaceutical data — NDCs, MEDIDs, drug interactions, etc.
- Used by all cleo-* clinical skills

## Cleo Rx Service

- **Host:** 172.16.128.101 / cleo-rx.sph-dev.net
- **Port:** 15160
- Purpose: FDB-powered prescription/drug lookup API

## AWS

- **Region:** us-west-2
- **Credentials:** ~/.aws/credentials (default profile)

## Python Environment

- Location: `~/.Py3Env` (if set up — check before using)
- For Python package installs, use venv — don't `--break-system-packages`

## Agent Family

| Agent | Animal | Emoji | Role |
|-------|--------|-------|------|
| Edgar | Lobster | 🦞 | General assistant / infra |
| Ada | Butterfly | 🦋 | Infrastructure monitoring |
| Hugo | Fox | 🦊 | Apple development |
| Cleo | Owl | 🦉 | Clinical data + AI integrations |
| Hedy | Octopus | 🐙 | TBD |

## Sending Images on Teams

- Use `MEDIA:./filename.jpg` on its own line in your **direct reply text**
- Do NOT use the `message` tool with `filePath` or cards for images — it doesn't render
- The MEDIA tag must be in your normal reply, not inside a tool call
- Image file must be in your workspace directory (~/.openclaw/workspace/)
- Example: `MEDIA:./00071015523.jpg`
- Confirmed working 2026-03-26
