import fs from "node:fs";
const t = fs.readFileSync("public/real/pronun.html", "utf8");
console.log("size:", t.length);
const m = [...t.matchAll(/Bài\s*\d+:\s*Luyện\s*âm\s*\/[^/]+\//g)];
console.log("total Bài cards:", m.length);
console.log("first 3:", m.slice(0, 3).map((x) => x[0]));
console.log("last 5:", m.slice(-5).map((x) => x[0]));
// Check whether the file is served at /alphafeature/pronun (no lesson)
console.log("\n--- Where is this used?");
console.log("server.js path match: /alphafeature/pronun/lessonN/sectionM");
