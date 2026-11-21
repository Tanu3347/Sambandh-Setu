
const ApiError = require("../utils/ApiError");

const unavailable = () => new ApiError(
    503,
    "GUIDE_UNAVAILABLE",
    "Setu Guide is temporarily unavailable. Please try again later."
);

const getRetryDelay = (value) => {
    if (!value) return null;

    const seconds = Number(value);

    if (Number.isFinite(seconds) && seconds >= 0) {
        return seconds * 1000;
    }

    const date = Date.parse(value);

    if (Number.isNaN(date)) return null;

    return Math.max(0, date - Date.now());
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const chat = async (payload = {}) => {
    const baseUrl = process.env.GUIDE_SERVICE_URL;

    if (!baseUrl) {
        console.info("Setu Guide bridge", {
            status: "not_configured",
            durationMs: 0
        });
        throw unavailable();
    }

    const url = `${baseUrl.replace(/\/+$/, "")}/v1/guide/chat`;

    for (let attempt = 0; attempt < 2; attempt++) {
        const startTime = Date.now();

        try {
            let fetchUrl = url;
            let response;
            try {
                response = await fetch(fetchUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(45000)
                });
            } catch (initialErr) {
                if (fetchUrl.includes("localhost")) {
                    fetchUrl = fetchUrl.replace("localhost", "127.0.0.1");
                    response = await fetch(fetchUrl, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(payload),
                        signal: AbortSignal.timeout(45000)
                    });
                } else {
                    throw initialErr;
                }
            }

            if (response.status === 429 && attempt === 0) {
                const retryDelay = getRetryDelay(
                    response.headers.get("Retry-After")
                );

                console.info("Setu Guide bridge", {
                    status: 429,
                    durationMs: Date.now() - startTime
                });

                if (retryDelay === null) {
                    throw unavailable();
                }

                await wait(retryDelay);
                continue;
            }

            if (!response.ok) {
                console.info("Setu Guide bridge", {
                    status: response.status,
                    durationMs: Date.now() - startTime
                });

                throw unavailable();
            }

            let data;

            try {
                data = await response.json();
            } catch {
                console.info("Setu Guide bridge", {
                    status: "invalid_json",
                    durationMs: Date.now() - startTime
                });

                throw unavailable();
            }

            if (!data || typeof data !== "object" || Array.isArray(data)) {
                console.info("Setu Guide bridge", {
                    status: "invalid_response",
                    durationMs: Date.now() - startTime
                });

                throw unavailable();
            }

            console.info("Setu Guide bridge", {
                status: response.status,
                durationMs: Date.now() - startTime
            });

            return data;
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }

            const isTimeout =
                error.name === "TimeoutError" ||
                error.name === "AbortError";

            console.info("Setu Guide bridge", {
                status: isTimeout ? "timeout" : "unavailable",
                durationMs: Date.now() - startTime
            });

            throw unavailable();
        }
    }

    throw unavailable();
};

module.exports = { chat };
