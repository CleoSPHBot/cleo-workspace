#!/usr/bin/env node
/**
 * rx_verify.js — Pass 2: Verify extraction using Claude Sonnet 4
 *
 * Usage:
 *   node rx_verify.js <image-path-or-base64> <extraction-json-file>
 *
 * Re-reads the prescription label image via Anthropic Claude Sonnet 4 and
 * scores each extracted field for accuracy.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY not set");
  process.exit(1);
}

const VERIFICATION_PROMPT = `You are a prescription label verification system. You will be shown a prescription label image and a proposed extraction of its contents.

Your job: re-read the image independently, then score each extracted field for accuracy.

Here is the proposed extraction:
{{EXTRACTION}}

For each field in the extraction, return a JSON object with this structure:

{
  "verification": {
    "<field_name>": {
      "value_extracted": "<what was extracted>",
      "value_observed": "<what you see on the label>",
      "score": <0-100>,
      "match": <true|false>,
      "flag": "<null or description of discrepancy>"
    }
  },
  "overall_score": <0-100>,
  "missing_fields": ["<fields visible on label but not in extraction>"],
  "notes": "<any general observations about image quality or readability>"
}

Rules:
- Score 100 = exact match, 0 = completely wrong
- Score 50-99 = partial match (e.g., minor formatting difference, partially correct)
- If a field is correct but could be more complete, score 80-90
- Flag anything where your reading differs from the extraction
- Check NDC format (should be 5-4-2 with dashes)
- Note any fields visible on the label that were missed in the extraction
- Return ONLY the JSON, no markdown or explanation`;

function imageToBase64(input) {
  if (input.length > 260 && !fs.existsSync(input)) {
    return input;
  }
  const filePath = path.resolve(input);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(filePath).toString("base64");
}

function detectMimeType(input) {
  if (!fs.existsSync(input)) return "image/jpeg";
  const ext = path.extname(input).toLowerCase();
  const types = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  return types[ext] || "image/jpeg";
}

function callAnthropic(base64Image, mimeType, extractionJson) {
  return new Promise((resolve, reject) => {
    const prompt = VERIFICATION_PROMPT.replace(
      "{{EXTRACTION}}",
      JSON.stringify(extractionJson, null, 2)
    );

    const body = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: base64Image,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message));
            return;
          }
          const content = json.content[0].text;
          const cleaned = content
            .replace(/^```json\s*/i, "")
            .replace(/```\s*$/, "")
            .trim();
          resolve(JSON.parse(cleaned));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}\n${data}`));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: node rx_verify.js <image-path-or-base64> <extraction-json-file>");
    process.exit(1);
  }

  const imageInput = args[0];
  const extractionFile = args[1];

  const base64Image = imageToBase64(imageInput);
  const mimeType = detectMimeType(imageInput);

  let extractionData;
  try {
    const raw = fs.readFileSync(path.resolve(extractionFile), "utf-8");
    const parsed = JSON.parse(raw);
    extractionData = parsed.extraction || parsed;
  } catch (e) {
    console.error(`Error reading extraction file: ${e.message}`);
    process.exit(1);
  }

  try {
    const verification = await callAnthropic(base64Image, mimeType, extractionData);
    const result = {
      timestamp: new Date().toISOString(),
      model: "claude-sonnet-4-20250514",
      temperature: 0.3,
      pass: 2,
      verification,
    };
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`Verification failed: ${err.message}`);
    process.exit(1);
  }
}

main();
