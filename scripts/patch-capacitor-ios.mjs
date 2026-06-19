import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const configPath = resolve("ios/App/App/capacitor.config.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const classList = new Set(config.packageClassList || []);

classList.add("LoofCloudPlugin");
config.packageClassList = [...classList];

await writeFile(configPath, `${JSON.stringify(config, null, "\t")}\n`);
