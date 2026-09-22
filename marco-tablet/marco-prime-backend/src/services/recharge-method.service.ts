import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const rechargeMethodSchema = z.enum(["card", "cash"]);
export type RechargeMethod = z.infer<typeof rechargeMethodSchema>;

const storedSchema = z.record(z.string(), rechargeMethodSchema);
let pendingWrite: Promise<void> = Promise.resolve();

function filePath() {
  return path.join(process.env.MARCO_DATA_DIR || "./data", "recharge-methods.json");
}

export async function readRechargeMethods(): Promise<Record<string, RechargeMethod>> {
  try {
    return storedSchema.parse(JSON.parse(await readFile(filePath(), "utf8")));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return {};
    throw error;
  }
}

export function recordRechargeMethod(orderId: number, method: RechargeMethod): Promise<void> {
  const write = pendingWrite.catch(() => {}).then(async () => {
    const target = filePath();
    const methods = await readRechargeMethods();
    methods[String(orderId)] = method;
    const temporary = `${target}.${process.pid}.tmp`;
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(temporary, `${JSON.stringify(methods, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, target);
  });
  pendingWrite = write;
  return write;
}
