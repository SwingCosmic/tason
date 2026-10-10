import { describe, expect, test } from "@jest/globals";
import fs from "fs";
import path from "path";
import ts from "typescript";
import TASON, { formatTASON, parseSyntax } from "@/index";
import { formatTASON as formatFromSyntax, parseSyntax as parseFromSyntax } from "@/syntax";

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const SYNTAX_ENTRY = path.join(PACKAGE_ROOT, "src/syntax/index.ts");

const ALLOWED_PACKAGES = new Set(["antlr4", "tslib"]);
const ALLOWED_ROOTS = [
  path.join(PACKAGE_ROOT, "src/syntax"),
  path.join(PACKAGE_ROOT, "src/grammar"),
];

describe("语法层公开入口", () => {
  test("根入口挂载 parseSyntax 与 format", () => {
    expect(TASON.parseSyntax).toBe(parseSyntax);
    expect(TASON.format).toBe(formatTASON);

    const parsed = TASON.parseSyntax(`{a:1}`);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.ast?.type).toBe("ObjectExpression");

    expect(TASON.format(`{a:1}`).text).toBe(`{ a: 1 }\n`);
    const bad = TASON.format(`{,}`);
    expect(bad.diagnostics.length).toBeGreaterThan(0);
    expect(bad.text).toBe(`{,}`);
  });

  test("tason/syntax 与根入口行为一致", () => {
    const src = `{a:1,b:[2]}`;
    expect(formatFromSyntax(src)).toEqual(formatTASON(src));
    expect(parseFromSyntax(src).diagnostics).toEqual(parseSyntax(src).diagnostics);
    expect(parseFromSyntax(src).ast).toEqual(parseSyntax(src).ast);
  });

  test("package.json 只公开主入口、syntax 与 package.json", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8"));
    expect(Object.keys(pkg.exports).sort()).toEqual([".", "./package.json", "./syntax"]);
    expect(pkg.exports["./syntax"].import).toBe("./lib/syntax/index.js");
  });

  test("syntax 子入口的模块图不进入值级依赖", () => {
    const packages = new Set<string>();
    const files = new Set<string>();

    const visit = (file: string) => {
      const resolved = path.resolve(file);
      if (files.has(resolved)) return;
      files.add(resolved);
      if (!insideAllowedRoot(resolved)) {
        throw new Error(`syntax 入口触及模块边界之外的文件：${path.relative(PACKAGE_ROOT, resolved)}`);
      }
      for (const spec of moduleSpecifiers(resolved)) {
        if (spec.startsWith(".")) {
          visit(resolveRelative(resolved, spec));
          continue;
        }
        packages.add(packageName(spec));
      }
    };

    visit(SYNTAX_ENTRY);

    const unexpected = [...packages].filter((name) => !ALLOWED_PACKAGES.has(name));
    expect(unexpected).toEqual([]);
  });
});

function insideAllowedRoot(file: string): boolean {
  return ALLOWED_ROOTS.some((root) => {
    const rel = path.relative(root, file);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  });
}

function packageName(spec: string): string {
  if (spec.startsWith("@")) {
    const [scope, name] = spec.split("/");
    return `${scope}/${name}`;
  }
  return spec.split("/")[0];
}

function moduleSpecifiers(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const specs: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specs.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specs.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specs;
}

function resolveRelative(fromFile: string, spec: string): string {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    path.join(base, "index.ts"),
  ];
  // 生成物用 "./TASONParser.js" 指向同目录的 .ts 源文件
  if (base.endsWith(".js")) {
    const stem = base.slice(0, -3);
    candidates.unshift(`${stem}.ts`, `${stem}.tsx`);
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`无法解析 ${spec}（来自 ${path.relative(PACKAGE_ROOT, fromFile)}）`);
}
