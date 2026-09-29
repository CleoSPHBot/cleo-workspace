# OpenClaw: new models never appear despite successful `models refresh`

**Discovered:** 2026-09-29 (David + Cleo)
**Environment:** OpenClaw 2026.9.6 (eb377ac)

---

## Symptom

- `openclaw models refresh` reports success — `unchanged (44 providers, 1038 models; generated ...)` — but no new models ever show up
- `openclaw models list` shows only the handful of models hand-written in config (15 in our case)
- Newer models (`claude-sonnet-5`, `claude-opus-5`) never appear
- Control UI model picker / `openclaw setup` shows **"No models available"**

## Root cause

Config had:

```json
"models": { "mode": "replace", ... }
```

Per the `models.mode` schema:

> `"merge"` keeps built-ins and overlays your custom providers, while **`"replace"` uses only your configured providers.**

So OpenClaw was discarding its entire built-in catalog (44 providers / 1,038 models) and serving **only** the models explicitly listed under `models.providers.*`. The refresh genuinely downloaded a fresh catalog every time — then `replace` mode threw it away before anything consumed it. Success message, zero visible effect.

## Fix

Set a single field:

```
models.mode:  "replace"  ->  "merge"
```

Config file: `~/.openclaw/openclaw.json`. Applied via `config.set` on path `models.mode`.

- `reloadKind: hot` — **no gateway restart required**
- Change only that one field; leave `models.providers` untouched

## Why merge is safe (non-destructive)

Per the schema, in `merge` mode:
- matching provider IDs **preserve** non-empty agent `models.json` baseUrl values
- `apiKey` values are **preserved** unless the provider is SecretRef-managed (those refresh from current source markers)
- matching models take the **higher** of explicit vs implicit `contextWindow` / `maxTokens`

Verified after our change: `models.providers.anthropic` kept its `baseUrl`, `auth`, `apiKey`, and all 5 original model entries.

## Result

| | Before | After |
|---|---|---|
| Total models | 15 | **27** |
| Sonnet 5 | no | yes — `claude-sonnet-5` (alias `sonnet`) |
| Opus 5 | no | yes — `claude-opus-5` (alias `opus`) |

Also surfaced: `claude-opus-5-5`, `claude-fable-5`, `claude-fable-5-1`, `claude-mythos-5`,
image-capable `claude-haiku-4-5`, `gpt-6-sol`, `gpt-6-luna`, `gpt-5.4-mini`, `gpt-5.4-nano`, `chat-latest`.

Bonus: several models previously listed as text-only now correctly show **text+image**, since merge
took the richer built-in definitions.

## Diagnostic commands

```bash
# check the culprit first
openclaw gateway config.get --path models.mode

# what's actually usable
openclaw models list --all

# full resolved state: default, aliases, fallbacks, auth, route issues
openclaw models status --json
```

## Red herrings — don't waste time here

Cleo chased all three before finding it:

| Suspected | Reality |
|---|---|
| Auth profiles / `Auth` column | Auth was fine. Misread the `Local` vs `Auth` columns — `Auth` was `yes` all along |
| Re-running `models auth paste-api-key` | Unnecessary; keys already worked |
| Bundled `@anthropic-ai/sdk` 0.125 vs npm 0.129 | Irrelevant; SDK is pinned to OpenClaw and not the gating factor |

**The tell:** *"refresh reports success but nothing changes"* points at how the catalog is
**consumed**, not at credentials or versions. Check `models.mode` first.

Note on syntax drift in 2026.9.6: `models auth paste-api-key` now requires flags, not a
positional arg — `--provider anthropic` (optionally `--profile-id anthropic:default`).

## Separate issue (distinct from models.mode)

After the upgrade, a new system agent dir appeared at `~/.openclaw/agents/openclaw/agent/` —
no `models.json`, empty sqlite, and not a configured agent (`openclaw agents list` shows only
`main`). `openclaw setup` and the `openclaw` control tool run on **that** agent, so both fail
independently of the catalog fix. Control tool error:

> *OpenClaw could not reach working inference. Run `openclaw onboard` on the machine running OpenClaw to reconnect.*

Remedy is `openclaw onboard` (needs a TTY). Unrelated to `models.mode` — keep the two separate
when debugging.

Also: `openclaw setup --json` reports `apiKeys.anthropic: false` purely from
`Boolean(env.ANTHROPIC_API_KEY?.trim())` (source: `dist/overview-*.mjs`). It never reads config
or the auth store, so it reads `false` while every Anthropic model works. **Cosmetic — ignore it.**

Related: `openclaw setup` is the onboarding wizard, not a model manager. It hangs without a TTY
and isn't needed on a live gateway. Use `openclaw models list` or Control UI -> Models instead.
