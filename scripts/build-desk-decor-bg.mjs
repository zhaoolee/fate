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
const sourceDir = path.resolve(root, args.get("source") || "desk-decor-bg-origin");
const outputDir = path.resolve(root, args.get("out") || "desk-decor-bg");
const maxHeight = Number(args.get("height") || 1200);
const jpegQuality = Number(args.get("quality") || 82);
const supportedImagePattern = /\.(png|jpe?g|webp|avif)$/i;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function imageHeight(filePath) {
  const output = execFileSync("sips", ["-g", "pixelHeight", filePath], { encoding: "utf8" });
  const match = output.match(/pixelHeight:\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

if (!Number.isFinite(maxHeight) || maxHeight < 1) {
  fail("--height must be a positive number.");
}

if (!Number.isFinite(jpegQuality) || jpegQuality < 1 || jpegQuality > 100) {
  fail("--quality must be a number from 1 to 100.");
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
  const outputPath = path.join(outputDir, `${path.basename(fileName, path.extname(fileName))}.jpg`);
  const height = imageHeight(sourcePath);
  const sipsArgs = [];

  if (height > maxHeight) {
    sipsArgs.push("--resampleHeight", String(maxHeight));
  }

  sipsArgs.push("-s", "format", "jpeg", "-s", "formatOptions", String(jpegQuality), sourcePath, "--out", outputPath);
  execFileSync("sips", sipsArgs, { stdio: "ignore" });
  console.log(`${path.relative(root, outputPath)} <= ${path.relative(root, sourcePath)}`);
}

console.log(`Generated ${sourceFiles.length} desk decor background image(s) at max ${maxHeight}px height, JPEG quality ${jpegQuality}.`);
