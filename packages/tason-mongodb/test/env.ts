import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 集成测试连接信息加载：
 * 进程环境变量 > .env.local > .env（占位值）。
 * 不引入 dotenv 依赖，只解析 KEY=VALUE 行（支持 # 注释与成对引号）。
 */

const PACKAGE_ROOT = join(__dirname, "..");

export interface MongoTestConfig {
  uri: string;
  dbName: string;
  /** uri 已配置且不是占位值 */
  isConfigured: boolean;
}

function parseDotEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const result: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function getMongoTestConfig(): MongoTestConfig {
  const fileEnv = {
    ...parseDotEnv(join(PACKAGE_ROOT, ".env")),
    ...parseDotEnv(join(PACKAGE_ROOT, ".env.local")),
  };
  const uri = process.env.MONGODB_URI || fileEnv.MONGODB_URI || "";
  const dbName =
    process.env.MONGODB_DB_NAME || fileEnv.MONGODB_DB_NAME ||
    "tason_integration_test";

  const looksLikeUri =
    uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://");
  return {
    uri,
    dbName,
    isConfigured: looksLikeUri && !/placeholder/i.test(uri),
  };
}
