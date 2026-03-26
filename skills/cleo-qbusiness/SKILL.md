---
name: cleo-qbusiness
description: "Search Spectator Health's knowledge base via AWS Q Business (QB/QSph). Triggered by questions about HEDIS measures, FHIR R4 specs, CQL logic, FDB documentation, Surescripts specs, NCQA guidelines, or Long COVID research. Also triggered by 'search QB', 'ask QSph', 'check the docs', 'what do the HEDIS specs say', or any request to look something up in the indexed documentation."
metadata:
  openclaw:
    emoji: "📚"
    requires:
      bins: ["aws"]
---

# Q Business Knowledge Search (QB / QSph)

Search Spectator Health's indexed documentation via AWS Q Business.

## When to Use

✅ **USE this skill when:**
- Questions about HEDIS measures, specifications, or guidelines
- FHIR R4 resource definitions, CQL measure logic
- FDB (First Databank) documentation questions
- Surescripts implementation specs
- NCQA quality measure details
- Long COVID clinical research
- User says "QB", "QSph", "check the docs", "search the knowledge base"
- Any question that could be answered by clinical/technical documentation

❌ **DON'T use this skill when:**
- Drug lookups by NDC/MEDID/name → use FDB skills instead
- Live patient data queries → use aegis_server endpoints
- General knowledge questions not specific to indexed docs

## Configuration

- **App ID:** `1b2dcad6-c48e-4f28-ba6e-b10e4a8e476f`
- **Region:** `us-west-2`
- **Indexed Sources:** FHIR-R4-CQL-Docs, hedis-my2025, hedis-my2026, FDBDocumentation, Surescripts, NCQA-HEDIS-Core, LongCOVID-Research, ncqa-simplifier

## Usage

Run the search script:

```bash
bash ~/.openclaw/workspace/skills/cleo-qbusiness/scripts/qb-search.sh "your question here"
```

The script calls `aws qbusiness chat-sync` and returns:
- The AI-generated answer from Q Business
- Source citations with S3 URLs and relevant snippets

## Interpreting Results

- **systemMessage**: The generated answer text
- **sourceAttributions**: Array of cited sources with:
  - `title`: Source document name
  - `url`: S3 path to the source document
  - `snippetExcerpt.text`: Relevant excerpt from the source
  - `citationNumber`: Reference number matching citations in the answer

## Tips

- Be specific in queries — "CBP measure exclusions for MY2026" works better than "tell me about blood pressure"
- The index includes both MY2025 and MY2026 HEDIS specs — specify the measurement year when it matters
- CQL logic is indexed — you can ask about specific measure logic implementation
- If results seem stale, the index auto-syncs daily at 6 AM UTC
