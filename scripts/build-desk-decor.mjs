import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map(
  process.argv
    .slice(2)
    .filter(arg => arg.startsWith("--"))
    .map(arg => {
      const [key, value = ""] = arg.slice(2).split("=");
      return [key, value];
    })
);
const sourceDir = path.resolve(root, args.get("source") || "desk-decor-origin");
const outputDir = path.resolve(root, args.get("out") || "desk-decor");
const maxSize = Number(args.get("size") || 422);
const supportedImagePattern = /\.(png|jpe?g|webp|avif)$/i;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!Number.isFinite(maxSize) || maxSize < 1) {
  fail("--size must be a positive number.");
}

if (!existsSync(sourceDir)) {
  fail(`Source directory does not exist: ${path.relative(root, sourceDir)}`);
}

const sipsCheck = spawnSync("sips", ["--version"], { encoding: "utf8" });
if (sipsCheck.error || sipsCheck.status !== 0) {
  fail("This script requires macOS `sips`. Run it on macOS, or add another image backend.");
}

mkdirSync(outputDir, { recursive: true });

const sourceFiles = readdirSync(sourceDir)
  .filter(fileName => supportedImagePattern.test(fileName))
  .sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));

if (!sourceFiles.length) {
  fail(`No source images found in ${path.relative(root, sourceDir)}.`);
}

for (const fileName of readdirSync(outputDir)) {
  const outputPath = path.join(outputDir, fileName);
  if (supportedImagePattern.test(fileName) && statSync(outputPath).isFile()) {
    unlinkSync(outputPath);
  }
}

for (const fileName of sourceFiles) {
  const sourcePath = path.join(sourceDir, fileName);
  const outputPath = path.join(outputDir, fileName);
  execFileSync("sips", ["--resampleHeightWidthMax", String(maxSize), sourcePath, "--out", outputPath], {
    stdio: "ignore"
  });
  console.log(`${path.relative(root, outputPath)} <= ${path.relative(root, sourcePath)}`);
}

console.log(`Generated ${sourceFiles.length} desk decor image(s) at max ${maxSize}px.`);
