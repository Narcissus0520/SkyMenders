import { resolve } from "node:path";

import {
  createContentFreezeLock,
  verifyContentFreezeLock,
  writeContentFreezeLock,
} from "./content-freeze.js";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const lockPath = resolve(repositoryRoot, "config/release/content-freeze.json");
const rulesVersion = "0.6.0";
const write = process.argv.includes("--write");

if (write) {
  const lock = createContentFreezeLock(repositoryRoot, rulesVersion);
  writeContentFreezeLock(lockPath, lock);
  console.log(
    `content freeze lock written: ${lock.contentVersion}/${lock.rulesVersion}, ${lock.catalogs.length} catalogs`,
  );
} else {
  const errors = verifyContentFreezeLock(repositoryRoot, lockPath, rulesVersion);
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log("content freeze: passed");
  }
}
