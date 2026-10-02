# Native OpenCode acceptance v1

This harness tests the real OpenCode 2.0.22 agent loop, Code Mode admission,
schema decoding, provider callbacks, permissions where evaluated, tool hooks,
session results and named disposable store effects. It belongs to Runtime's
cross-provider conformance responsibility; it contains no provider domain logic.

The loopback Chat Completions endpoint emits caller-declared tool proposals.
It performs **zero model inference**. The runtime uses its shipped
`@opencode/ai/providers/openai-compatible` driver. Most unpinned plugin tools
are called by native `execute` with `tools["exact_registered_id"](input)`.
The inventory RPC is read-only. There is no callback-dispatch RPC.

Prerequisites: Python 3.10+, Bun for repository tests, installed provider
dependencies, and an existing exact `@opencode/cli@2.0.22` binary. No global
configuration or credentials are used. The output directory must be new;
its final directory name is the stable run ID. Source and evidence paths may
be supplied explicitly; the smoke inputs reference canonical compiler fixtures.

```powershell
python conformance/native-opencode-v1/smoke_cases.py --projects C:/Projects --out C:/Temp/native-cases.json
python conformance/native-opencode-v1/run.py --binary C:/path/to/opencode.exe --projects C:/Projects --out C:/Temp/native-run-001 --cases C:/Temp/native-cases.json
python conformance/native-opencode-v1/receipts.py C:/Temp/native-run-001
python -m unittest discover -s conformance/native-opencode-v1 -p test_receipts.py
bun test
```

`identity.json` records PID, command, exact version, executable/config hashes,
isolated child environment and provider HEADs. `raw/`, `api-exchanges.jsonl`,
`fixture-requests.jsonl`, `fixture-responses.jsonl`, `events.jsonl`, `server.log`,
named `stores/`, `sessions.json` and `results.json` retain independent evidence.
Only the host's temporary server password is redacted. `manifest.json` hashes
the initial retained run files; later derived receipts must be hashed separately.
Every server is terminated in a `finally` block. VFS auto-commit/push is disabled.

The passive observer wraps a callback only to log its actual entry/return and
delegates the unchanged decoded arguments/context/result. It neither admits a
tool nor grants permission. `TOOL_execute.before` alone is **not admission**;
it also fires for rejected calls. A permission `ask` hook, its actual pending
request/reply, and an explicit session `permission.rejected` error are distinct
observations. An explicit deny may occur without a permission-hook event.

`receipts.py` checks callback output against the session, requested result
values, and named store/file effects. Registration, callback execution,
permission, hooks and effects remain separate stage fields. Missing observations
stay UNKNOWN. A narrow native-operation PASS can retain UNKNOWN permission
because the provider never requested permission; it does not satisfy a full
release gate. Rejection tests can pass while admission correctly reads FAIL.

No inference about real model tool choice, trust-conditioned context influence,
Writer integration, fresh installation, restart persistence, general interception
or release readiness is permitted. Fixture token/cost zeros are synthetic.

Wave 1 retained a native runtime discrepancy: `additionalProperties:false`
unknown fields are removed during native decoding rather than rejected. The
Authority metadata-rejection check deliberately remains FAIL. A closed-schema
harness-only probe reproduces that behavior independently. Do not change its
expectation to make the matrix green. Actual `ask`/`deny` write probes validate
permissions; a custom tool's permission option may only control availability.
