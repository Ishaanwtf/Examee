import "server-only";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { type Database, DEMO_USERS } from "@/lib/domain";

const filePath = path.join(process.cwd(), ".data", "examee.json");

// Records from the retired prototype seed. This lets existing local installs
// self-clean while retaining papers uploaded by a real user.
const RETIRED_SEED_IDS = new Set([
  ...Array.from({ length: 6 }, (_, i) => `MAT301-SEM3-2026-${String(i + 1).padStart(4, "0")}`),
  ...Array.from({ length: 6 }, (_, i) => `PHY101-SEM1-2026-${String(i + 101).padStart(4, "0")}`),
  ...Array.from({ length: 6 }, (_, i) => `CSE503-SEM5-2026-${String(i + 201).padStart(4, "0")}`)
]);

function emptyDatabase(): Database {
  return { users: DEMO_USERS, sheets: [] };
}

export async function getDatabase(): Promise<Database> {
  try {
    const data = JSON.parse(await readFile(filePath, "utf8")) as Database;
    const sheets = data.sheets.filter((sheet) => !RETIRED_SEED_IDS.has(sheet.id));
    if (sheets.length !== data.sheets.length) {
      const cleaned = { ...data, sheets };
      await saveDatabase(cleaned);
      return cleaned;
    }
    return data;
  } catch {
    const data = emptyDatabase();
    await saveDatabase(data);
    return data;
  }
}

export async function saveDatabase(data: Database) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}
