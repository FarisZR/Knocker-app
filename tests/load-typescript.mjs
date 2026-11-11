import ts from "typescript";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

// Exercise the source on Node builds that do not include native TS stripping.
export function loadTypeScript(url, stubs = {}) {
  const { outputText } = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} };
  const require = createRequire(url);
  const resolve = (name) => {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    if (name.startsWith(".")) {
      const local = new URL(name.endsWith(".ts") ? name : `${name}.ts`, url);
      if (existsSync(local)) return loadTypeScript(local, stubs);
    }
    return require(name);
  };
  new Function("require", "module", "exports", outputText)(
    resolve,
    module,
    module.exports,
  );
  return module.exports;
}
