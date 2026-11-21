const path = require("path");
const { initDb, closeDb, isReady, isPostgresUrl } = require("../db");

let isSeeding = false;

const connectDB = async () => {
    try {
        const neonUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL;

        if (isPostgresUrl(neonUrl)) {
            console.log("[DB] Connecting to Neon DB / PostgreSQL...");
            const db = initDb(neonUrl);
            if (db.initPromise) {
                await db.initPromise;
            }
            console.log("[DB] Neon DB connected & schema initialized successfully!");
        } else {
            const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, "..", "sambandh_setu.db");
            initDb(dbPath);
            console.log(`[DB] SQLite database connected successfully (${dbPath})`);
        }

        // Auto-seed if database has no users (e.g. fresh ephemeral container on Render or new Neon DB)
        // Guarded with isSeeding to prevent any recursive loop when seedUsers runs
        if (process.env.NODE_ENV !== "test" && !isSeeding) {
            isSeeding = true;
            try {
                const User = require("../models/User");
                const count = await User.countDocuments();
                if (count === 0) {
                    console.log("[DB] No users found in database, running initial seed...");
                    const { seedUsers } = require("../seed/seedUsers");
                    await seedUsers();
                    console.log("[DB] Initial seed completed successfully.");
                }
            } catch (seedErr) {
                console.warn("[DB] Initial auto-seed skipped or failed:", seedErr.message);
            } finally {
                isSeeding = false;
            }
        }
    } catch (error) {
        console.error(
            "Database connection failed: name=%s code=%s",
            error.name || "Error",
            error.code || "none"
        );
        throw error;
    }
};

module.exports = connectDB;
