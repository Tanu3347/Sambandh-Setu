const path = require("path");
const { initDb, closeDb, isReady } = require("../db");

const connectDB = async () => {
    try {
        const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, "..", "sambandh_setu.db");
        initDb(dbPath);
        console.log(`SQLite database connected successfully (${dbPath})`);

        // Auto-seed if database has no users (e.g. fresh ephemeral container on Render)
        if (process.env.NODE_ENV !== "test") {
            const User = require("../models/User");
            const count = await User.countDocuments();
            if (count === 0) {
                console.log("[DB] No users found in database, running initial seed...");
                try {
                    const { seedUsers } = require("../seed/seedUsers");
                    await seedUsers();
                } catch (seedErr) {
                    console.warn("[DB] Initial auto-seed skipped or failed:", seedErr.message);
                }
            }
        }
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
