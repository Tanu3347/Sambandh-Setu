const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const { ensureAiService, stopAiService } = require("./services/aiServiceSupervisor");
const { closeDb, isReady } = require("./db");
const { corsOptions } = require("./config/cors");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const profileRoutes = require("./routes/profileRoutes");
const discoverRoutes = require("./routes/discoverRoutes");
const requestRoutes = require("./routes/requestRoutes");
const connectionRoutes = require("./routes/connectionRoutes");
const homeRoutes = require("./routes/homeRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const chatRoutes = require("./routes/chatRoutes");
const guideRoutes = require("./routes/guideRoutes");
const { notFoundHandler, errorHandler } = require("./middleware/errorMiddleware");
const {
    globalLimiter,
    authIpLimiter,
    authEmailLimiter,
    applyTrustProxy
} = require("./middleware/rateLimit");
const { initSentry, captureException } = require("./config/sentry");
const ApiError = require("./utils/ApiError");

dotenv.config();
initSentry();

const app = express();
app.set("trust proxy", 1);

applyTrustProxy(app);

// Request logger for visibility on backend terminal
if (process.env.NODE_ENV !== "test") {
    app.use((req, res, next) => {
        const start = Date.now();
        res.on("finish", () => {
            console.log(`[HTTP] ${req.method} ${req.path} -> ${res.statusCode} (${Date.now() - start}ms)`);
        });
        next();
    });
}

// Security headers run first. The API is consumed cross-origin by the web app,
// so CORP is set to cross-origin while the rest of Helmet's defaults stay on.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors(corsOptions));
app.use(express.json({ limit: "100kb" }));
app.use(globalLimiter);

app.get("/", (req, res) => {
    res.json({ message: "Sambandh Setu Backend is running!" });
});

app.get("/health/live", (req, res) => {
    res.json({ data: { status: "ok" } });
});

const readinessHandler = (req, res) => {
    if (!isReady()) {
        return res.status(503).json({
            error: {
                code: "NOT_READY",
                message: "Database connection is not ready",
                details: []
            }
        });
    }
    return res.json({ data: { status: "ready" } });
};

// `/health` is the single path the hosting platform probes (D2-21). It is an
// alias of `/health/ready` so the check fails when Database is unavailable.
app.get("/health", readinessHandler);
app.get("/health/ready", readinessHandler);

app.use("/auth", authIpLimiter, authEmailLimiter, authRoutes);
app.use("/me", userRoutes);
app.use("/users", userRoutes);
app.use("/profiles", profileRoutes);
app.use("/profile", profileRoutes);
app.use("/discover", discoverRoutes);
app.use("/requests", requestRoutes);
app.use("/connections", connectionRoutes);
app.use("/home", homeRoutes);
app.use("/notifications", notificationRoutes);
app.use("/chats", chatRoutes);
app.use("/guide", guideRoutes);

app.use(notFoundHandler);

// Optional Sentry capture (no-op unless SENTRY_DSN is set). Only 5xx errors
// are sent; request bodies, headers and query strings are never attached.
app.use((error, req, res, next) => {
    captureException(error, req);
    next(error);
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        const configError = new Error("JWT_SECRET must be configured with at least 32 characters");
        configError.code = "CONFIG_INVALID_JWT_SECRET";
        throw configError;
    }

    await connectDB();
    await ensureAiService();

    let server;
    try {
        server = await new Promise((resolve, reject) => {
            const listener = app.listen(PORT);
            listener.once("listening", () => resolve(listener));
            listener.once("error", reject);
        });
    } catch (error) {
        try {
            closeDb();
        } catch (disconnectError) {
            console.error(
                "Database disconnect after startup failure failed: name=%s",
                disconnectError.name || "Error"
            );
        }
        throw error;
    }
    console.log(`Server running on port ${PORT}`);
    return server;
};

if (require.main === module) {
    startServer()
        .then((server) => {
            let shuttingDown = false;
            const shutdown = async (signal) => {
                if (shuttingDown) {
                    return;
                }
                shuttingDown = true;
                console.log(`${signal} received; shutting down`);
                stopAiService();
                server.close(async (error) => {
                    if (error) {
                        console.error("HTTP server shutdown failed: name=%s", error.name || "Error");
                        process.exitCode = 1;
                    }
                    try {
                        closeDb();
                    } catch (disconnectError) {
                        console.error("Database shutdown failed: name=%s", disconnectError.name || "Error");
                        process.exitCode = 1;
                    }
                });
            };
            process.on("SIGINT", () => shutdown("SIGINT"));
            process.on("SIGTERM", () => shutdown("SIGTERM"));
        })
        .catch((error) => {
            if (error.code === "CONFIG_INVALID_JWT_SECRET") {
                console.error("Server startup failed: JWT_SECRET missing or shorter than 32 characters");
            } else {
                console.error(
                    "Server startup failed: name=%s code=%s",
                    error.name || "Error",
                    error.code || "none"
                );
            }
            process.exitCode = 1;
        });
}

module.exports = { app, startServer };
