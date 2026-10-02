// Loaded last in a disposable host. RPC exposes inventory only, never execution.
import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const { Plugin, Rpc, Model } = await import(process.env.NATIVE_SDK_PATH!);
const root = process.env.NATIVE_RUN_ROOT!;
const audit = (stage: string, data: unknown) => appendFileSync(join(root, "events.jsonl"), JSON.stringify({ at: new Date().toISOString(), stage, data }) + "\n");

export default Plugin.define({
  id: "native-acceptance-observer-v1",
  async setup(ctx: any) {
    const registrations: any[] = [];
    registrations.push(await ctx.provider.transform((editor: any) => {
      editor.add({ info: { id: "native-fixture", name: "Native scripted fixture (no inference)", activation: "enabled", package: "@opencode/ai/providers/openai-compatible", settings: { name: "native-fixture", baseURL: process.env.NATIVE_FIXTURE_URL, apiKey: "unused-local-fixture" } }, models: [Model.Info.default("native-fixture", "scripted")] });
    }));
    registrations.push(await ctx.tool.transform((editor: any) => {
      editor.add({ name: "native_schema_probe", description: "Harness-only closed-schema boundary probe.", input: { type: "object", properties: { known: { type: "string" } }, required: ["known"], additionalProperties: false }, options: { codemode: false }, async execute(input: unknown) { return { content: JSON.stringify(input) }; } });
      for (const outcome of ["allow", "deny", "ask"] as const) editor.add({
        name: `native_probe_${outcome}`, description: "Native acceptance harness permission sentinel; fixture capability only.",
        input: { type: "object", properties: {}, additionalProperties: false },
        options: { codemode: false, permission: `native-probe-${outcome}` },
        async execute(input: unknown, context: any) {
          audit("CALLBACK_ENTERED", { tool: `native_probe_${outcome}`, callID: context.id, sessionID: context.sessionID, input });
          writeFileSync(join(root, `probe-${outcome}.txt`), outcome, { flag: "wx" });
          const result = { content: JSON.stringify({ probe: outcome }) };
          audit("CALLBACK_RETURNED", { tool: `native_probe_${outcome}`, callID: context.id, sessionID: context.sessionID, result });
          return result;
        },
      });
      for (const tool of editor.list()) {
        if (!/^(lens_|relate|radar_|authority_|evidence_|verify_|proof_|memory_|context_compiler_|native_schema_probe$|write$|shell$)/.test(tool.id)) continue;
        editor.update(tool.id, (entry: any) => {
          const execute = entry.execute;
          entry.execute = async (input: unknown, context: any) => {
            const identity = { tool: tool.id, callID: context.id, sessionID: context.sessionID, messageID: context.messageID };
            audit("CALLBACK_ENTERED", { ...identity, input });
            try { const result = await execute(input, context); audit("CALLBACK_RETURNED", { ...identity, result }); return result; }
            catch (error) { audit("CALLBACK_THROW", { ...identity, error: String(error) }); throw error; }
          };
        });
      }
    }));
    for (const hook of ["execute.before", "execute.after"] as const) registrations.push(await ctx.tool.hook(hook, (data: unknown) => audit(`TOOL_${hook}`, data)));
    registrations.push(await ctx.permission.hook("evaluate", (data: unknown) => audit("PERMISSION_DECISION_OBSERVED", data)));
    for (const hook of ["prompt", "context", "model.request", "retry"] as const) registrations.push(await ctx.session.hook(hook, (data: unknown) => audit(`SESSION_${hook}`, data)));
    registrations.push(await ctx.session.hook("title", (data: any) => { data.result = "Native acceptance fixture"; }));
    const definition = Rpc.define({ id: "native-acceptance-v1", methods: { inventory: { input: { type: "object", additionalProperties: false }, output: { type: "object", additionalProperties: true } } }, events: {} });
    registrations.push(await ctx.rpc.register(definition, { async inventory() { const tools = await ctx.tool.list(); return JSON.parse(JSON.stringify({ version: ctx.app.version, tools: tools.map((t: any) => ({ id: t.id, input: t.input, options: t.options ?? null })) })); } }));
    audit("OBSERVER_LOADED", { version: ctx.app.version, location: ctx.location });
    return async () => { for (const registration of registrations.reverse()) await registration.dispose(); };
  },
});
