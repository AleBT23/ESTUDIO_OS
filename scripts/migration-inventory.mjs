import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
export async function localMigrations(directory) {
  const names = (await readdir(directory))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  return Promise.all(
    names.map(async (name) => {
      const body = await readFile(path.join(directory, name), "utf8");
      return {
        name,
        body,
        sha256: createHash("sha256").update(body).digest("hex"),
      };
    }),
  );
}

export function migrationPlan(local, applied) {
  const registered = new Map(applied.map((row) => [row.name, row.sha256]));
  const names = new Set(local.map((row) => row.name));
  const unknown = applied
    .filter((row) => !names.has(row.name))
    .map((row) => row.name);
  const changed = [],
    pending = [],
    verified = [],
    outOfOrder = [];
  for (const { name, sha256 } of local) {
    if (!registered.has(name)) pending.push(name);
    else {
      if (pending.length) outOfOrder.push(name);
      if (registered.get(name) !== sha256) changed.push(name);
      else verified.push(name);
    }
  }
  return {
    compatible: !unknown.length && !changed.length && !outOfOrder.length,
    verified,
    pending,
    unknown,
    changed,
    outOfOrder,
  };
}
