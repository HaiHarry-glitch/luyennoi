import { readFileSync, writeFileSync } from "node:fs";
import { argv } from "node:process";

const target = argv[2];
const apply = argv.includes("--apply");
if (!target) {
  console.error("usage: node tests/fix-mojibake.mjs <file> [--apply]");
  process.exit(2);
}

const cp1252 = {
  0x20AC: 0x80, 0x0081: 0x81, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84,
  0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89,
  0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x008D: 0x8D, 0x017D: 0x8E,
  0x008F: 0x8F, 0x0090: 0x90, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
  0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98,
  0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x009D: 0x9D,
  0x017E: 0x9E, 0x0178: 0x9F
};
const GHOST_BYTES = [0x81, 0x8D, 0x8F, 0x90, 0x9D];

function expectedContinuations(lead) {
  if ((lead & 0xE0) === 0xC0) return 1;
  if ((lead & 0xF0) === 0xE0) return 2;
  if ((lead & 0xF8) === 0xF0) return 3;
  return 0;
}

function repairBytes(bytes) {
  let i = 0;
  const out = [];
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) { out.push(b); i++; continue; }
    const need = expectedContinuations(b);
    if (need === 0) return null;
    const seq = [b];
    let j = i + 1;
    while (seq.length < 1 + need) {
      if (j < bytes.length && (bytes[j] & 0xC0) === 0x80) {
        seq.push(bytes[j]);
        j++;
      } else {
        if (seq.length === 1 && need >= 2) {
          seq.push(0x90);
        } else if (seq.length === 2 && need === 2) {
          seq.push(0x8D);
        } else if (seq.length === 1 && need === 1 && b === 0xC4) {
          seq.push(0x90);
        } else {
          return null;
        }
      }
    }
    out.push(...seq);
    i = j;
  }
  return out;
}

function decodeRun(text) {
  if (!text) return text;
  const bytes = [];
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c <= 0xff) bytes.push(c);
    else if (cp1252[c] !== undefined) bytes.push(cp1252[c]);
    else return text;
  }
  const tryDecode = (arr) => {
    try {
      const out = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(arr));
      return out.includes("\uFFFD") ? null : out;
    } catch { return null; }
  };
  const direct = tryDecode(bytes);
  if (direct) return direct;
  if (bytes.length < 2) return text;
  const lead = bytes[0];
  const isLead = (lead & 0xE0) === 0xC0 || (lead & 0xF0) === 0xE0 || (lead & 0xF8) === 0xF0;
  if (!isLead) return text;
  const repaired = repairBytes(bytes);
  if (repaired) {
    const out = tryDecode(repaired);
    if (out) return out;
  }
  return text;
}

const RUN_RE = /[\u0081\u008d\u008f\u0090\u009d\u00a0-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013\u2014\u2018\u2019\u201a\u201c\u201d\u201e\u2020\u2021\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]+/g;

const src = readFileSync(target, "utf8");
const out = src.replace(RUN_RE, (m) => decodeRun(m));

if (out === src) {
  console.log(`OK: no mojibake detected in ${target}`);
  process.exit(0);
}

const a = src.split(/\n/);
const b = out.split(/\n/);
let changes = 0;
for (let i = 0; i < a.length; i++) {
  if (a[i] !== b[i]) {
    changes++;
    console.log(`L${i + 1}: ${a[i]}`);
    console.log(`  => ${b[i]}`);
  }
}
console.log(`Total changed lines: ${changes}`);

if (apply) {
  writeFileSync(target, out, "utf8");
  console.log(`Wrote fixed content to ${target}`);
}
