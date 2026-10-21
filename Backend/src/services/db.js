import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

let _pool = null;

function getPool() {
  if (!_pool) {
    _pool = new Pool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST || "localhost",
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT || "5432"),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      statement_timeout: 30000,
      allowExitOnIdle: true,
    });

    _pool.on("error", (err) => {
      console.error("Unexpected error on idle PG client:", err);
    });
  }
  return _pool;
}

export const pool = {
  query: (...args) => getPool().query(...args),
  connect: () => getPool().connect(),
  end: () => getPool().end(),
};


