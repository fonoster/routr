#!/usr/bin/env node
/* Writes HTML redirect stubs for the old Docusaurus docs (routr.io/docs/...) that now live on
   docs.routr.io. Used by .github/workflows/gh-pages.yaml after the docs build, and only once
   docs.routr.io answers; see docs-site/REDIRECTS.md.

   Usage: node .scripts/docs-redirect-stubs.js <out dir> [new host]

   For every entry in docs-redirects.json it writes both
     <out>/docs/2.11.5/<old>/index.html   (the last Docusaurus "current" version)
     <out>/docs/<old>/index.html          (the unversioned form some links use)
   plus <out>/docs/index.html and <out>/docs/2.11.5/index.html. The frozen 2.0.0 and 1.x.x trees
   are never touched. */
const fs = require("fs");
const path = require("path");

const out = process.argv[2];
const host = (process.argv[3] || "https://docs.routr.io").replace(/\/$/, "");
if (!out) {
  console.error("usage: docs-redirect-stubs.js <out dir> [new host]");
  process.exit(1);
}

const map = JSON.parse(fs.readFileSync(path.join(__dirname, "docs-redirects.json"), "utf8"));
const CURRENT = "2.11.5";

const stub = (target) => `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Routr docs moved</title>
<link rel="canonical" href="${target}">
<meta http-equiv="refresh" content="0; url=${target}">
<meta name="robots" content="noindex">
<p>The Routr docs moved to <a href="${target}">${target.replace(/^https?:\/\//, "")}</a>.</p>
</html>
`;

const write = (rel, target) => {
  const dir = path.join(out, "docs", rel);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), stub(target));
};

let count = 0;
for (const [oldPath, newPath] of Object.entries(map)) {
  const target = `${host}${newPath}`;
  write(path.join(CURRENT, oldPath), target);
  write(oldPath, target);
  count += 2;
}
write("", `${host}/introduction`);
write(CURRENT, `${host}/introduction`);
console.log(`wrote ${count + 2} redirect stubs under ${path.join(out, "docs")} -> ${host}`);
