import "dotenv/config";
import { initDb, pool } from "../src/db.js";
try { await initDb(); console.log("PostgreSQL schema and sample data are ready."); } catch (error) { console.error(error.message); process.exitCode = 1; } finally { await pool.end(); }
