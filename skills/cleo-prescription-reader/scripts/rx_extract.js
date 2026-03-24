#!/usr/bin/env node
/**
 * rx_extract.js — Pass 1: Extract prescription label fields using GPT-4o
 *
 * Usage:
 *   node rx_extract.js <image-path-or-base64> [--site-id <id>]
 *
 * Reads a prescription label image via OpenAI GPT-4o vision and returns
 * structured JSON with all visible fields.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY not set");
  process.exit(1);
}

const EXTRACTION_PROMPT = `You are a prescription label reader. Extract all visible fields from this prescription label image.

Return ONLY valid JSON with this structure. Include ALL fields — if a field is not visible or cannot be determined, set its value to null and add a corresponding entry in the "unresolved" object explaining why:

{
  "patient": {
    "first_name": "patient first name",
    "middle_name": "patient middle name or initial",
    "last_name": "patient last name"
  },
  "ndc": "XXXXX-XXXX-XX",
  "drug_name": "drug name and strength (do not include quantity here)",
  "directions": "exact directions as printed",
  "quantity": "quantity dispensed (look for # or Qty)",
  "days_supply": "days supply (look for DS or Days Supply)",
  "refills": "refills remaining",
  "prescriber": {
    "name": "doctor name and credentials",
    "npi": "prescriber NPI number",
    "dea": "DEA number"
  },
  "pharmacy": {
    "name": "pharmacy name",
    "address": "pharmacy address",
    "phone": "pharmacy phone number",
    "npi": "pharmacy NPI number"
  },
  "rx_number": "prescription number",
  "date_written": "date prescribed (labeled DW or Date Written)",
  "date_filled": "date dispensed by pharmacy (labeled Date, Date Filled, or Fill Date — ALWAYS look for this separately from date_written)",
  "expiration": "expiration date",
  "manufacturer": "manufacturer name",
  "pill_description": "color, shape, imprint",
  "warnings": ["any warning labels visible"],
  "unresolved": {
    "<field_name>": "reason not captured (e.g., obscured, redacted, not printed on label, illegible)"
  }
}

Rules:
- NDC must be formatted as 5-4-2 with dashes (XXXXX-XXXX-XX)
- NPI is a 10-digit number
- DEA is a 9-character alphanumeric code (2 letters + 7 digits)
- CRITICAL: Most labels have TWO dates. date_written is when the doctor wrote the Rx (labeled "DW"). date_filled is when the pharmacy dispensed it (labeled "Date" or "Date Filled"). Look for BOTH. They are almost always different dates. If you only find one date, assign it to date_filled.
- Patient name is typically at the top of the label. If the patient name area is obscured, redacted, or covered, omit the patient field entirely. Do NOT use the prescriber name as the patient name.
- Preserve exact wording of directions/sig as printed
- If a field is partially obscured, include what you can read and append "(partial)"
- ALWAYS include every field in the JSON. Use null for fields that cannot be determined, and document the reason in the "unresolved" object
- Common unresolved reasons: "redacted", "obscured", "not printed on label", "illegible", "covered by tape"
- If multiple labels are visible, return an array of objects
- Return ONLY the JSON, no markdown or explanation`;

function imageToBase64(input) {
  // If it's already base64, return as-is
  if (input.length > 260 && !fs.existsSync(input)) {
    return input;
  }
  // Read from file
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

function callOpenAI(base64Image, mimeType) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "gpt-4o",
      temperature: 0.0,
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    });

    const options = {
      hostname: "api.openai.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
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
          const content = json.choices[0].message.content;
          // Strip markdown fencing if present
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
  if (args.length < 1) {
    console.error("Usage: node rx_extract.js <image-path-or-base64> [--site-id <id>]");
    process.exit(1);
  }

  const imageInput = args[0];
  const siteIdx = args.indexOf("--site-id");
  const siteId = siteIdx !== -1 && args[siteIdx + 1] ? args[siteIdx + 1] : "default";

  const base64Image = imageToBase64(imageInput);
  const mimeType = detectMimeType(imageInput);

  try {
    const extraction = await callOpenAI(base64Image, mimeType);
    const result = {
      site_id: siteId,
      timestamp: new Date().toISOString(),
      model: "gpt-4o",
      temperature: 0.0,
      pass: 1,
      extraction,
    };
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`Extraction failed: ${err.message}`);
    process.exit(1);
  }
}

main();
