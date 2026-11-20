const path = require("path");
const { initDb, closeDb, isReady } = require("../db");

const connectDB = async () => {
    try {
        const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, "..", "sambandh_setu.db");
        initDb(dbPath);
        console.log(`SQLite database connected successfully (${dbPath})`);
    } catch (error) {
        console.error(
            "SQLite database connection failed: name=%s code=%s",
            error.name || "Error",
            error.code || "none"
        );
        throw error;
    }
};

module.exports = connectDB;
