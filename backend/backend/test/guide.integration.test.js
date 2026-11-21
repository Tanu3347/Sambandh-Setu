const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.JWT_SECRET = "test-secret-at-least-32-characters-long-2026";
process.env.SQLITE_DB_PATH = path.join(__dirname, "test_guide_integration.db");
process.env.GUIDE_SERVICE_URL = "http://127.0.0.1:8000";

const { initDb, closeDb, getDb } = require("../db");
const User = require("../models/User");
const Profile = require("../models/Profile");
const Connection = require("../models/Connection");
const { startServer } = require("../server");

let server;
let baseUrl;
let userToken;
let connectionId;

before(async () => {
    initDb(process.env.SQLITE_DB_PATH);
    server = await startServer();
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Seed test users
    const userA = new User({
        username: "guide_tester_a",
        email: "guide_tester_a@example.com",
        displayName: "Aanya Guide",
        firstName: "Aanya",
        lastName: "Guide",
        onboardingCompleted: true
    });
    await userA.setPassword("TestPassword123!");
    await userA.save();

    const userB = new User({
        username: "guide_tester_b",
        email: "guide_tester_b@example.com",
        displayName: "Rohan Guide",
        firstName: "Rohan",
        lastName: "Guide",
        onboardingCompleted: true
    });
    await userB.setPassword("TestPassword123!");
    await userB.save();

    // Create profile
    const profileA = new Profile({
        user: userA.id,
        interests: ["hiking", "reading", "cooking"],
        location: "Mumbai",
        lifestyle: { diet: "Vegetarian", sleepHabits: "Early bird" }
    });
    await profileA.save();

    // Create active connection
    const conn = new Connection({
        participantA: userA.id,
        participantB: userB.id,
        status: "active",
        stage: "connect"
    });
    await conn.save();
    connectionId = conn.id;

    // Log in userA
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "guide_tester_a@example.com", password: "TestPassword123!" })
    });
    const loginData = await loginRes.json();
    userToken = loginData.data?.token || loginData.token;
});

after(async () => {
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
    closeDb();
    const fs = require("fs");
    for (const ext of ["", "-wal", "-shm"]) {
        try { fs.unlinkSync(`${process.env.SQLITE_DB_PATH}${ext}`); } catch {}
    }
});

test("POST /guide/chat fails 401 when unauthenticated", async () => {
    const res = await fetch(`${baseUrl}/guide/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "conversation_ideas" })
    });
    assert.equal(res.status, 401);
});

test("POST /guide/chat fails 400 when neither intent nor message is provided", async () => {
    const res = await fetch(`${baseUrl}/guide/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${userToken}`
        },
        body: JSON.stringify({ connectionId })
    });
    assert.equal(res.status, 400);
});

test("POST /guide/chat fails 400 on invalid intent", async () => {
    const res = await fetch(`${baseUrl}/guide/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${userToken}`
        },
        body: JSON.stringify({ intent: "nonexistent_intent" })
    });
    assert.equal(res.status, 400);
});

test("POST /guide/chat returns AI guidance with explicit connectionId and intent", async () => {
    const res = await fetch(`${baseUrl}/guide/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${userToken}`
        },
        body: JSON.stringify({
            connectionId,
            intent: "conversation_ideas"
        })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data);
    assert.equal(body.data.intent, "conversation_ideas");
    assert.ok(typeof body.data.reply === "string");
    assert.ok(Array.isArray(body.data.questions));
    assert.ok(Array.isArray(body.data.chips));
    assert.equal(body.data.safety.status, "pass");
});

test("POST /guide/chat returns AI guidance when connectionId is omitted (auto-detected active connection)", async () => {
    const res = await fetch(`${baseUrl}/guide/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${userToken}`
        },
        body: JSON.stringify({
            intent: "next_steps"
        })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data);
    assert.equal(body.data.intent, "next_steps");
    assert.ok(typeof body.data.reply === "string");
    assert.ok(body.data.reply.length > 0);
});

test("POST /guide/chat returns AI guidance for free-text message", async () => {
    const res = await fetch(`${baseUrl}/guide/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${userToken}`
        },
        body: JSON.stringify({
            message: "privacy and safety advice"
        })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data);
    assert.equal(body.data.intent, "privacy_safety");
    assert.ok(typeof body.data.reply === "string");
});
