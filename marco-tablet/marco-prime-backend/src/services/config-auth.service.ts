import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const storedSchema = z.object({
  version: z.literal(1),
  passwordHash: z.string(),
  salt: z.string(),
  adminCardNumber: z.number().int().positive(),
  updatedAt: z.string(),
});
type Stored = z.infer<typeof storedSchema>;

const MAX_FAILURES = 5;
const LOCK_DURATION_MS = 30_000;
let failures = 0;
let lockedUntil = 0;

function filePath() {
  return path.join(
    process.env.MARCO_DATA_DIR || "./data",
    "config-auth.json",
  );
}

function deriveKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

async function readStored(): Promise<Stored | null> {
  let raw: string;
  try {
    raw = await readFile(filePath(), "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
  const parsed = storedSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

async function writeStored(stored: Stored) {
  const target = filePath();
  const temporary = `${target}.${process.pid}.tmp`;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(stored, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporary, target);
}

export const configAuthService = {
  async status() {
    const stored = await readStored();
    return {
      configured: stored !== null,
      updatedAt: stored?.updatedAt ?? null,
    };
  },

  async setPassword(adminCardNumber: number, password: string) {
    const salt = randomBytes(16).toString("hex");
    const passwordHash = (await deriveKey(password, salt)).toString("hex");
    await writeStored({
      version: 1,
      passwordHash,
      salt,
      adminCardNumber,
      updatedAt: new Date().toISOString(),
    });
    failures = 0;
    lockedUntil = 0;
  },

  async removePassword() {
    try {
      await unlink(filePath());
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }
    failures = 0;
    lockedUntil = 0;
  },

  async verifyPassword(password: string) {
    if (Date.now() < lockedUntil) {
      return { status: "locked" as const };
    }
    const stored = await readStored();
    if (!stored) {
      return { status: "not-configured" as const };
    }

    const expected = Buffer.from(stored.passwordHash, "hex");
    const actual = await deriveKey(password, stored.salt);
    const valid =
      expected.length === actual.length && timingSafeEqual(expected, actual);
    if (!valid) {
      failures += 1;
      if (failures >= MAX_FAILURES) {
        lockedUntil = Date.now() + LOCK_DURATION_MS;
        failures = 0;
      }
      return { status: "invalid" as const };
    }

    failures = 0;
    lockedUntil = 0;
    return { status: "ok" as const, adminCardNumber: stored.adminCardNumber };
  },
};
