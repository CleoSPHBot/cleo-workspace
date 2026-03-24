#!/usr/bin/env node
/**
 * rx_read.js — Orchestrator: Two-pass prescription label reader
 *
 * Usage:
 *   node rx_read.js <image-path> [--site-id <id>] [--no-ndc] [--output-dir <dir>]
 *
 * Flow:
 *   1. Upload image to S3 (sph-cleo-rx/<site-id>/)
 *   2. Pass 1: GPT-4o extracts label fields
 *   3. Pass 2: Claude Sonnet 4 verifies extraction with confidence scores
 *   4. Optional: NDC lookup via FDB
 *   5. Store combined results as JSON
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SCRIPT_DIR = __dirname;
const S3_BUCKET = "sph-cleo-rx";
const DEFAULT_OUTPUT_DIR = path.join(SCRIPT_DIR, "..", "data", "rx-results");

function parseArgs(args) {
  const opts = {
    imagePath: null,
    siteId: "default",
    runNdc: true,
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--site-id" && args[i + 1]) {
      opts.siteId = args[++i];
    } else if (args[i] === "--no-ndc") {
      opts.runNdc = false;
    } else if (args[i] === "--output-dir" && args[i + 1]) {
      opts.outputDir = args[++i];
    } else if (!args[i].startsWith("--")) {
      opts.imagePath = args[i];
    }
  }

  return opts;
}

function uploadToS3(imagePath, siteId) {
  const ext = path.extname(imagePath) || ".jpg";
  const hash = crypto.randomBytes(8).toString("hex");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const s3Key = `${siteId}/${timestamp}-${hash}${ext}`;
  const s3Uri = `s3://${S3_BUCKET}/${s3Key}`;

  try {
    execSync(`aws s3 cp "${imagePath}" "${s3Uri}" --region us-west-2`, {
      stdio: "pipe",
    });
    console.error(`✓ Image uploaded to ${s3Uri}`);
    return { s3_uri: s3Uri, s3_key: s3Key };
  } catch (e) {
    console.error(`⚠ S3 upload failed: ${e.message}`);
    return { s3_uri: null, s3_key: null, error: e.message };
  }
}

function runExtraction(imagePath, siteId) {
  const cmd = `node "${path.join(SCRIPT_DIR, "rx_extract.js")}" "${imagePath}" --site-id "${siteId}"`;
  const output = execSync(cmd, {
    encoding: "utf-8",
    env: { ...process.env },
    timeout: 60000,
  });
  return JSON.parse(output);
}

function runVerification(imagePath, extractionFile) {
  const cmd = `node "${path.join(SCRIPT_DIR, "rx_verify.js")}" "${imagePath}" "${extractionFile}"`;
  const output = execSync(cmd, {
    encoding: "utf-8",
    env: { ...process.env },
    timeout: 60000,
  });
  return JSON.parse(output);
}

function runNdcLookup(ndc) {
  if (!ndc) return null;
  const ndcClean = ndc.replace(/-/g, "");
  const lookupScript = path.join(
    SCRIPT_DIR,
    "..",
    "..",
    "cleo-ndc-lookup",
    "scripts",
    "ndc_lookup.js"
  );

  if (!fs.existsSync(lookupScript)) {
    console.error("⚠ NDC lookup script not found, skipping");
    return null;
  }

  try {
    const output = execSync(
      `node "${lookupScript}" "${ndcClean}" --img-dir /tmp`,
      { encoding: "utf-8", timeout: 30000 }
    );
    return JSON.parse(output);
  } catch (e) {
    console.error(`⚠ NDC lookup failed: ${e.message}`);
    return null;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.imagePath) {
    console.error(
      "Usage: node rx_read.js <image-path> [--site-id <id>] [--no-ndc] [--output-dir <dir>]"
    );
    process.exit(1);
  }

  if (!fs.existsSync(opts.imagePath)) {
    console.error(`Error: Image not found: ${opts.imagePath}`);
    process.exit(1);
  }

  // Ensure output directory exists
  fs.mkdirSync(opts.outputDir, { recursive: true });

  const imageId = `rx-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  console.error(`\n🏥 Cleo Prescription Reader — ${imageId}`);
  console.error(`   Site: ${opts.siteId}\n`);

  // Step 1: Upload to S3
  console.error("📤 Uploading image to S3...");
  const s3Info = uploadToS3(opts.imagePath, opts.siteId);

  // Step 2: Pass 1 — GPT-4o extraction
  console.error("🔍 Pass 1: Extracting label fields (GPT-4o)...");
  const extractionResult = runExtraction(opts.imagePath, opts.siteId);

  // Save extraction to temp file for Pass 2
  const tempFile = path.join(opts.outputDir, `${imageId}-pass1.json`);
  fs.writeFileSync(tempFile, JSON.stringify(extractionResult, null, 2));

  // Step 3: Pass 2 — Claude Sonnet verification
  console.error("✅ Pass 2: Verifying extraction (Claude Sonnet 4)...");
  const verificationResult = runVerification(opts.imagePath, tempFile);

  // Clean up temp file
  fs.unlinkSync(tempFile);

  // Step 4: NDC lookup
  let ndcResult = null;
  const ndc = extractionResult.extraction?.ndc;
  if (opts.runNdc && ndc) {
    console.error(`💊 Looking up NDC: ${ndc}...`);
    ndcResult = runNdcLookup(ndc);
  } else if (!ndc) {
    console.error("⚠ No NDC found in extraction, skipping lookup");
  }

  // Step 5: Assemble and store final result
  const finalResult = {
    id: imageId,
    site_id: opts.siteId,
    timestamp: new Date().toISOString(),
    image: {
      local_path: path.resolve(opts.imagePath),
      ...s3Info,
    },
    pass1_extraction: extractionResult,
    pass2_verification: verificationResult,
    ndc_lookup: ndcResult,
    human_correction: null, // Slot for feedback loop
  };

  // Save result
  const resultFile = path.join(opts.outputDir, `${imageId}.json`);
  fs.writeFileSync(resultFile, JSON.stringify(finalResult, null, 2));
  console.error(`\n💾 Result saved: ${resultFile}`);

  // Output to stdout for piping
  console.log(JSON.stringify(finalResult, null, 2));
}

main();
