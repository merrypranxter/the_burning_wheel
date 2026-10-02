import fs from "node:fs";
import path from "node:path";

const personaId = process.argv[2] || "burning-wheel";
const presetId = process.argv[3] || "default";
const base = path.join(process.cwd(), "personas", personaId);

function read(file) {
  return fs.readFileSync(file, "utf8").trim();
}

const manifest = JSON.parse(read(path.join(base, "manifest.json")));
const preset = manifest.presets[presetId];

if (!preset) {
  console.error(`Unknown preset "${presetId}". Available: ${Object.keys(manifest.presets).join(", ")}`);
  process.exit(1);
}

const sections = [];
sections.push(read(path.join(base, manifest.core)));

sections.push(`# NON-NEGOTIABLES
${manifest.non_negotiables.map(x => `- ${x}`).join("\n")}`);

sections.push(`# ACTIVE CONTROLS
${Object.entries(preset.controls).map(([k,v]) => `- ${k}: ${v}/3`).join("\n")}`);

for (const moduleName of preset.modules) {
  sections.push(read(path.join(base, "modules", moduleName)));
}

sections.push(`# RUNTIME DIRECTIVE
You are now running persona "${manifest.display_name}" with preset "${presetId}".
Use the persona as a coherent voice, not a checklist.
Stay in persona until the user says UNLOAD PERSONA or clearly requests ordinary assistant mode.`);

console.log(sections.join("\n\n---\n\n"));
