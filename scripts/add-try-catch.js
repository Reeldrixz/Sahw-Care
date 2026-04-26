const fs   = require("fs");
const path = require("path");

const skip = new Set([
  "users\\route.ts", "users\\[id]\\route.ts",
  "items\\route.ts", "items\\[id]\\route.ts",
  "stats\\route.ts",
]);

const adminDir = path.join(__dirname, "..", "src", "app", "api", "admin");

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else if (entry.name === "route.ts") results.push(full);
  }
  return results;
}

const files = walk(adminDir).filter((f) => {
  const rel = f.slice(adminDir.length + 1);
  return !skip.has(rel);
});

let changed = 0;

for (const file of files) {
  let src = fs.readFileSync(file, "utf8");

  if (src.includes("try {")) {
    console.log("SKIP (already has try-catch):", path.relative(adminDir, file));
    continue;
  }

  const lines = src.split("\n");
  const out   = [];
  let inFn        = false;
  let depth       = 0;
  let tryInserted = false;

  for (let i = 0; i < lines.length; i++) {
    const line    = lines[i];
    const trimmed = line.trim();

    const opens  = (line.match(/{/g)  || []).length;
    const closes = (line.match(/}/g) || []).length;

    if (!inFn && trimmed.startsWith("export async function")) {
      inFn = true;
      depth = opens - closes;
      tryInserted = false;
      out.push(line);
      continue;
    }

    if (inFn) {
      depth += opens - closes;

      // After an auth guard line that returns 403, insert try {
      if (
        !tryInserted &&
        trimmed.startsWith("if") &&
        trimmed.includes("403")
      ) {
        out.push(line);
        out.push("");
        out.push("  try {");
        tryInserted = true;
        continue;
      }

      // When the function closes, finish the try-catch
      if (depth === 0) {
        if (tryInserted) {
          out.push('  } catch {');
          out.push('    return NextResponse.json({ error: "Internal server error" }, { status: 500 });');
          out.push('  }');
        }
        out.push(line);
        inFn        = false;
        tryInserted = false;
        continue;
      }

      out.push(line);
    } else {
      out.push(line);
    }
  }

  const newSrc = out.join("\n");
  if (newSrc !== src) {
    fs.writeFileSync(file, newSrc, "utf8");
    console.log("PATCHED:", path.relative(adminDir, file));
    changed++;
  } else {
    console.log("NO-CHANGE:", path.relative(adminDir, file));
  }
}

console.log("\nDone. Patched", changed, "files.");
