const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

let aiProcess = null;

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
    const aiDir = path.resolve(__dirname, "../../../setu_ai");
    console.log(`[AI Service] Starting Setu AI FastAPI server from ${aiDir}...`);
    aiProcess = spawn("python", ["-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"], {
        cwd: aiDir,
        shell: false,
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

    aiProcess.on("error", (err) => {
        console.warn("[AI Service] Failed to spawn Setu AI process:", err.message);
    });

    const cleanup = () => {
        if (aiProcess) {
            try {
                aiProcess.kill();
            } catch {}
            aiProcess = null;
        }
    };

    process.once("exit", cleanup);
    process.once("SIGINT", cleanup);
    process.once("SIGTERM", cleanup);

    return aiProcess;
}

async function ensureAiService() {
    if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "production") {
        return;
    }

    const guideUrl = process.env.GUIDE_SERVICE_URL || "";
    if (guideUrl && !guideUrl.includes("localhost") && !guideUrl.includes("127.0.0.1")) {
        // Remote AI service configured (e.g. Render), skip local process spawning
        return;
    }

    const aiDir = path.resolve(__dirname, "../../../setu_ai");
    if (!fs.existsSync(aiDir)) {
        return;
    }

    const alreadyRunning = await isAiRunning();
    if (alreadyRunning) {
        console.log("[AI Service] Setu AI is already running on http://localhost:8000");
        return;
    }

    spawnAiProcess();

    // Wait up to 5 seconds for Setu AI to be ready
    for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (await isAiRunning()) {
            console.log("[AI Service] Setu AI is ready on http://localhost:8000");
            return;
        }
    }

    console.warn("[AI Service] Setu AI service spawn attempted, still warming up...");
}

function stopAiService() {
    if (aiProcess) {
        try {
            aiProcess.kill();
            console.log("[AI Service] Stopped Setu AI server.");
        } catch {}
        aiProcess = null;
    }
}

module.exports = { isAiRunning, ensureAiService, stopAiService };
