import ts from "typescript";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// Exercise the source on Node builds that do not include native TS stripping.
export function loadTypeScript(url) {
  const { outputText } = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    createRequire(url),
    module,
    module.exports,
  );
  return module.exports;
}
