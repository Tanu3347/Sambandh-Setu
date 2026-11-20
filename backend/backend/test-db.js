const path = require("path");
const { initDb, getDb, closeDb } = require("./db");

async function testConnection() {
    try {
        const dbPath = path.join(__dirname, "sambandh_setu.db");
        initDb(dbPath);
        const db = getDb();
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        console.log("SQLite tables:", tables.map(t => t.name));
        console.log("SQLite connection successful!");
    } catch (error) {
        console.error("Connection failed:", error);
    } finally {
        closeDb();
    }
}

testConnection();
