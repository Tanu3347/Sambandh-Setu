const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

let dbInstance = null;
let currentDbPath = null;

const generateId = () => crypto.randomBytes(12).toString("hex");

const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT DEFAULT '',
    first_name TEXT DEFAULT '',
    last_name TEXT DEFAULT '',
    password_hash TEXT,
    is_seeded INTEGER DEFAULT 0,
    onboarding_completed INTEGER DEFAULT 0,
    sharing_default TEXT DEFAULT 'keep_private',
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    age INTEGER NOT NULL,
    gender TEXT NOT NULL,
    height_cm INTEGER,
    avatar_url TEXT DEFAULT '',
    profile_status TEXT DEFAULT 'active',
    bio TEXT DEFAULT '',
    education TEXT DEFAULT '',
    profession TEXT DEFAULT '',
    location TEXT DEFAULT '',
    interests TEXT DEFAULT '[]',
    lifestyle TEXT DEFAULT '{}',
    family TEXT DEFAULT '{}',
    preferences TEXT DEFAULT '{}',
    builder_answers TEXT DEFAULT '{}',
    sections TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    participant_a TEXT NOT NULL,
    participant_b TEXT NOT NULL,
    pair_key TEXT NOT NULL UNIQUE,
    request_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    stage TEXT NOT NULL DEFAULT 'connect',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(participant_a) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(participant_b) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_connections_pair ON connections(pair_key);

CREATE TABLE IF NOT EXISTS connection_requests (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    pair_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(recipient_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_connection_requests_pair ON connection_requests(pair_key);
CREATE INDEX IF NOT EXISTS idx_connection_requests_recipient ON connection_requests(recipient_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_sender ON connection_requests(sender_id);

CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL UNIQUE,
    muted_by TEXT DEFAULT '[]',
    last_message_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(connection_id) REFERENCES connections(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chats_connection ON chats(connection_id);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    text TEXT NOT NULL,
    read_by TEXT DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    recipient_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    type TEXT NOT NULL,
    request_id TEXT,
    connection_id TEXT,
    read_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);

CREATE TABLE IF NOT EXISTS otps (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    code_hash TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    last_sent_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    locked_until TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);

CREATE TABLE IF NOT EXISTS reflection_questions (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    order_num INTEGER NOT NULL UNIQUE,
    category TEXT NOT NULL,
    prompt TEXT NOT NULL,
    type TEXT NOT NULL,
    options TEXT DEFAULT '[]',
    min_selections INTEGER,
    max_selections INTEGER,
    allow_other INTEGER DEFAULT 0,
    other_text_max_length INTEGER DEFAULT 100,
    min_rating INTEGER DEFAULT 1,
    max_rating INTEGER DEFAULT 5,
    max_length INTEGER DEFAULT 500,
    is_mock INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reflection_answers (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    value TEXT NOT NULL,
    other_text TEXT,
    sharing TEXT DEFAULT 'keep_private',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(connection_id) REFERENCES connections(id) ON DELETE CASCADE,
    FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(question_id) REFERENCES reflection_questions(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refl_ans ON reflection_answers(connection_id, author_id, question_id);

CREATE TABLE IF NOT EXISTS stage_contents (
    id TEXT PRIMARY KEY,
    stage TEXT NOT NULL UNIQUE,
    guidance TEXT NOT NULL DEFAULT '[]',
    for_you TEXT DEFAULT '[]',
    activities TEXT DEFAULT '[]',
    resources TEXT DEFAULT '[]',
    is_mock INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
`;

const initDb = (dbPath) => {
    if (dbInstance && currentDbPath === dbPath) {
        return dbInstance;
    }
    if (dbInstance) {
        try { dbInstance.close(); } catch {}
        dbInstance = null;
    }

    const resolvedPath = dbPath || process.env.SQLITE_DB_PATH || path.join(__dirname, "..", "sambandh_setu.db");
    currentDbPath = resolvedPath;

    if (resolvedPath !== ":memory:") {
        const dir = path.dirname(resolvedPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    dbInstance = new DatabaseSync(resolvedPath);
    dbInstance.exec("PRAGMA foreign_keys = ON;");
    if (resolvedPath !== ":memory:") {
        try {
            dbInstance.exec("PRAGMA journal_mode = WAL;");
        } catch {}
    }
    dbInstance.exec(SCHEMA_DDL);
    return dbInstance;
};

const getDb = () => {
    if (!dbInstance) {
        initDb();
    }
    return dbInstance;
};

const closeDb = () => {
    if (dbInstance) {
        try { dbInstance.close(); } catch {}
        dbInstance = null;
        currentDbPath = null;
    }
};

const isReady = () => dbInstance !== null;

const resetDb = () => {
    const db = getDb();
    const tables = [
        "reflection_answers",
        "stage_contents",
        "reflection_questions",
        "otps",
        "notifications",
        "messages",
        "chats",
        "connection_requests",
        "connections",
        "profiles",
        "users"
    ];
    db.exec("PRAGMA foreign_keys = OFF;");
    for (const table of tables) {
        db.exec(`DROP TABLE IF EXISTS ${table};`);
    }
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(SCHEMA_DDL);
};

module.exports = {
    initDb,
    getDb,
    closeDb,
    isReady,
    resetDb,
    generateId
};
