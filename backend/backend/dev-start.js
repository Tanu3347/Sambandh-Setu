const path = require("path");
const crypto = require("crypto");
const http = require("http");
const { spawn } = require("child_process");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

const { closeDb } = require("./db");
const { seedUsers, fictionalUsers } = require("./seed/seedUsers");

function isAiRunning() {
    return new Promise((resolve) => {
        const req = http.get("http://127.0.0.1:8000/health", (res) => {
            resolve(res.statusCode === 200);
        });
        req.on("error", () => resolve(false));
        req.setTimeout(1000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

function spawnAiProcess() {
    const aiDir = path.resolve(__dirname, "../../setu_ai");
    console.log(`[AI Service] Spawning Setu AI FastAPI server from ${aiDir}...`);
    const aiProcess = spawn("python", ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"], {
        cwd: aiDir,
        shell: true,
        stdio: ["ignore", "pipe", "pipe"]
    });

    aiProcess.stdout.on("data", (d) => {
        const line = d.toString().trim();
        if (line) console.log(`[Setu AI] ${line}`);
    });
    aiProcess.stderr.on("data", (d) => {
        const line = d.toString().trim();
        if (line) console.log(`[Setu AI] ${line}`);
    });

    return aiProcess;
}

async function devStart() {
    console.log("-----------------------------------------");
    console.log("Starting Sambandh Setu Local Backend (SQLite)...");
    console.log("-----------------------------------------");

    process.env.SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, "sambandh_setu.db");
    console.log(`[Database] SQLite instance ready at ${process.env.SQLITE_DB_PATH}`);

    // Check / Start Setu AI service
    let aiProcess = null;
    const aiRunning = await isAiRunning();
    if (aiRunning) {
        console.log("[AI Service] Setu AI is already running on http://localhost:8000");
    } else {
        aiProcess = spawnAiProcess();
        for (let i = 0; i < 6; i++) {
            await new Promise((r) => setTimeout(r, 500));
            if (await isAiRunning()) {
                console.log("[AI Service] Setu AI is ready on http://localhost:8000");
                break;
            }
        }
    }

    // Start Express Server
    const { startServer } = require("./server");
    const server = await startServer();

    // Check if we need to seed
    const User = require("./models/User");
    const Profile = require("./models/Profile");
    const Connection = require("./models/Connection");
    const ConnectionRequest = require("./models/ConnectionRequest");
    const Chat = require("./models/Chat");
    const Message = require("./models/Message");
    const seedB2 = require("./seed/seedB2");

    console.log("[Seed] Syncing all fictional users and profiles...");
    for (const fixture of fictionalUsers) {
        let user = await User.findOne({ username: fixture.username });
        const fullName = [fixture.firstName, fixture.lastName].filter(Boolean).join(" ");
        if (!user) {
            user = new User({
                username: fixture.username,
                email: `${fixture.username}@example.test`,
                displayName: fullName,
                firstName: fixture.firstName,
                lastName: fixture.lastName,
                onboardingCompleted: true,
                isSeeded: true
            });
            await user.setPassword("Password123!");
        } else {
            user.displayName = fullName;
            user.firstName = fixture.firstName;
            user.lastName = fixture.lastName;
            user.onboardingCompleted = true;
            user.isSeeded = true;
            await user.setPassword("Password123!");
        }
        await user.save();

        const { username, firstName, lastName, ...profile } = fixture;
        await Profile.findOneAndUpdate(
            { user: user._id },
            { $set: { user: user._id, ...profile } },
            { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true }
        );
    }
    await seedB2();

    // Ensure Aanya and Rohan have an active Connection and Chat
    const aanya = await User.findOne({ username: "aanya" });
    const rohan = await User.findOne({ username: "rohan" });
    const karthik = await User.findOne({ username: "karthik" });

    if (aanya && rohan) {
        const pairKey = [String(aanya._id), String(rohan._id)].sort().join(":");
        let connReq = await ConnectionRequest.findOne({ pairKey });
        if (!connReq) {
            connReq = await ConnectionRequest.create({
                sender: aanya._id,
                recipient: rohan._id,
                pairKey,
                status: "accepted"
            });
        }

        let connection = await Connection.findOne({ pairKey });
        if (!connection) {
            connection = await Connection.create({
                participants: [aanya._id, rohan._id],
                pairKey,
                request: connReq._id,
                status: "active",
                stage: "understand"
            });
            console.log("[Seed] Created active Connection between Aanya and Rohan at stage 'understand'!");
        }

        let chat = await Chat.findOne({ connection: connection._id });
        if (!chat) {
            chat = await Chat.create({
                connection: connection._id,
                participants: [aanya._id, rohan._id],
                lastMessageAt: new Date()
            });
            await Message.create({
                chat: chat._id,
                sender: rohan._id,
                text: "Hi Aanya! Nice to connect with you. How is your week going?",
                readBy: [rohan._id]
            });
            console.log("[Seed] Created active Chat thread with initial message!");
        }
    }

    // Ensure a pending received request exists for Aanya from Karthik
    if (aanya && karthik) {
        const karthikPairKey = [String(karthik._id), String(aanya._id)].sort().join(":");
        const karthikReq = await ConnectionRequest.findOne({ pairKey: karthikPairKey });
        if (!karthikReq) {
            await ConnectionRequest.create({
                sender: karthik._id,
                recipient: aanya._id,
                pairKey: karthikPairKey,
                status: "pending"
            });
            console.log("[Seed] Created pending interest request from Karthik to Aanya!");
        }
    }

    console.log("=========================================");
    console.log(`Sambandh Setu Backend running at: http://localhost:${process.env.PORT || 5000}`);
    console.log(`Health check: http://localhost:${process.env.PORT || 5000}/health`);
    console.log("=========================================");

    const shutdown = async (signal) => {
        console.log(`Received ${signal}, shutting down gracefully...`);
        if (aiProcess) {
            try {
                aiProcess.kill();
                console.log("[AI Service] Stopped Setu AI server.");
            } catch {}
        }
        server.close(async () => {
            try {
                closeDb();
                console.log("Backend and SQLite database stopped successfully.");
                process.exit(0);
            } catch (err) {
                console.error("Shutdown error:", err);
                process.exit(1);
            }
        });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
}

devStart().catch((err) => {
    console.error("Failed to start local dev backend:", err);
    process.exit(1);
});
