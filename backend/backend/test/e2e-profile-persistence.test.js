const assert = require("node:assert/strict");
const http = require("node:http");
const { after, before, test } = require("node:test");
const { initDb, closeDb } = require("../db");
let capturedOtp = null;
const mailer = require("../services/mailer");
mailer.sendOtpEmail = async (to, code) => {
    capturedOtp = code;
};

const { app } = require("../server");
const User = require("../models/User");
const Profile = require("../models/Profile");

let server;
let baseUrl;

const request = (path, { method = "GET", body, headers = {} } = {}) =>
    new Promise((resolve, reject) => {
        const payload = body === undefined ? undefined : JSON.stringify(body);
        const req = http.request(
            `${baseUrl}${path}`,
            {
                method,
                headers: {
                    ...(payload ? { "content-type": "application/json" } : {}),
                    ...headers
                }
            },
            (res) => {
                let responseBody = "";
                res.setEncoding("utf8");
                res.on("data", (chunk) => {
                    responseBody += chunk;
                });
                res.on("end", () => {
                    resolve({
                        status: res.statusCode,
                        body: responseBody ? JSON.parse(responseBody) : null
                    });
                });
            }
        );
        req.on("error", reject);
        if (payload) {
            req.write(payload);
        }
        req.end();
    });

before(async () => {
    process.env.JWT_SECRET = "test-secret-that-is-at-least-thirty-two-chars-long";
    initDb(":memory:");

    server = app.listen(0);
    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
    closeDb();
});

test("E2E Profile Persistence: onboarding, name saving, backend as sole source of truth", async () => {
    const email = "adarsh.fullstack.test@example.com";
    const password = "Password12345!";

    // 1. Request OTP
    const otpReq = await request("/auth/otp/request", {
        method: "POST",
        body: { email }
    });
    assert.equal(otpReq.status, 200);
    assert.ok(capturedOtp, "OTP should be captured by mailer mock");

    // 2. Signup with OTP, password, and fullName
    const signupRes = await request("/auth/otp/verify", {
        method: "POST",
        body: {
            email,
            code: capturedOtp,
            password,
            fullName: "Adarsh Sharma"
        }
    });

    assert.equal(signupRes.status, 200);
    const token = signupRes.body.data.token;
    assert.ok(token);
    assert.equal(signupRes.body.data.user.displayName, "Adarsh Sharma");
    assert.equal(signupRes.body.data.user.firstName, "Adarsh");
    assert.equal(signupRes.body.data.user.lastName, "Sharma");

    // 3. Check /me endpoint returns persisted name
    const meRes = await request("/me", {
        headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.data.user.displayName, "Adarsh Sharma");
    assert.equal(meRes.body.data.user.firstName, "Adarsh");
    assert.equal(meRes.body.data.user.lastName, "Sharma");

    // 4. Update profile with custom details via /me/profile
    const updateRes = await request("/me/profile", {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}` },
        body: {
            age: 28,
            gender: "Man",
            bio: "Building scalable distributed systems",
            education: "M.Tech Computer Science",
            profession: "Principal Architect",
            interests: ["Systems Architecture", "Distributed Consensus"]
        }
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.data.profile.age, 28);
    assert.equal(updateRes.body.data.profile.bio, "Building scalable distributed systems");
    assert.equal(updateRes.body.data.profile.profession, "Principal Architect");

    // 5. Verify /me/profile GET returns updated profile from SQLite
    const getProfileRes = await request("/me/profile", {
        headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(getProfileRes.status, 200);
    assert.equal(getProfileRes.body.data.profile.age, 28);
    assert.equal(getProfileRes.body.data.profile.profession, "Principal Architect");
    assert.deepEqual(getProfileRes.body.data.profile.interests, ["Systems Architecture", "Distributed Consensus"]);

    // 6. Complete onboarding via /me/onboarding/complete
    const onboardingRes = await request("/me/onboarding/complete", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: {
            age: 28,
            gender: "Man",
            bio: "Building scalable distributed systems",
            education: "M.Tech Computer Science",
            profession: "Principal Architect",
            interests: ["Systems Architecture", "Distributed Consensus"]
        }
    });
    assert.equal(onboardingRes.status, 200);
    assert.equal(onboardingRes.body.data.user.onboardingCompleted, true);

    // 7. Verify /me now reflects onboardingCompleted = true
    const meAfterOnboarding = await request("/me", {
        headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(meAfterOnboarding.status, 200);
    assert.equal(meAfterOnboarding.body.data.user.onboardingCompleted, true);
});
