const { getDb, generateId } = require("../db");
const { QueryBuilder, buildWhere } = require("../db/queryHelper");
const User = require("./User");

const JOURNEY_STAGES = [
    "connect",
    "understand",
    "reflect",
    "discuss",
    "agree",
    "family",
    "reflect_again",
    "decision",
    "complete"
];

class Connection {
    constructor(data = {}) {
        this.id = String(data.id || data._id || generateId());
        this._id = this.id;
        const p = data.participants || [];
        this.participantA = String(data.participantA || data.participant_a || (p[0] && (p[0].id || p[0]._id || p[0])) || "");
        this.participantB = String(data.participantB || data.participant_b || (p[1] && (p[1].id || p[1]._id || p[1])) || "");
        this.participants = [this.participantA, this.participantB];
        this.pairKey = data.pairKey || data.pair_key || [this.participantA, this.participantB].sort().join(":");
        this.request = data.request || data.request_id || null;
        this.status = data.status || "active";
        this.stage = data.stage || "connect";
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    }

    async save() {
        const db = getDb();
        this.updatedAt = new Date();
        const requestId = typeof this.request === "object" && this.request ? (this.request.id || this.request._id) : this.request;
        let existing = null;
        if (this.id) {
            existing = await db.prepare("SELECT id FROM connections WHERE id = ?").get(this.id);
        }
        if (!existing && this.pairKey) {
            existing = await db.prepare("SELECT id FROM connections WHERE pair_key = ?").get(this.pairKey);
            if (existing) {
                this.id = existing.id;
                this._id = existing.id;
            }
        }
        if (existing) {
            await db.prepare(`
                UPDATE connections SET
                    participant_a = ?, participant_b = ?, pair_key = ?,
                    request_id = ?, status = ?, stage = ?, updated_at = ?
                WHERE id = ?
            `).run(
                this.participantA,
                this.participantB,
                this.pairKey,
                requestId ? String(requestId) : null,
                this.status,
                this.stage,
                this.updatedAt.toISOString(),
                this.id
            );
        } else {
            await db.prepare(`
                INSERT INTO connections (
                    id, participant_a, participant_b, pair_key,
                    request_id, status, stage, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                this.id,
                this.participantA,
                this.participantB,
                this.pairKey,
                requestId ? String(requestId) : null,
                this.status,
                this.stage,
                this.createdAt.toISOString(),
                this.updatedAt.toISOString()
            );
        }
        return this;
    }

    toObject() {
        return {
            id: this.id,
            _id: this.id,
            participants: this.participants,
            pairKey: this.pairKey,
            request: this.request,
            status: this.status,
            stage: this.stage,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    toJSON() {
        return this.toObject();
    }

    static _fromRow(row) {
        if (!row) return null;
        return new Connection({
            id: row.id,
            participant_a: row.participant_a,
            participant_b: row.participant_b,
            pair_key: row.pair_key,
            request_id: row.request_id,
            status: row.status,
            stage: row.stage,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        });
    }

    static async _populate(conn, popConfig) {
        if (!conn || !popConfig || !popConfig.length) return conn;
        for (const pop of popConfig) {
            if (pop.path === "participants") {
                const [uA, uB] = await Promise.all([
                    User.findById(conn.participantA),
                    User.findById(conn.participantB)
                ]);
                conn.participants = [uA || conn.participantA, uB || conn.participantB];
            }
        }
        return conn;
    }

    static _col(field) {
        const map = {
            id: "id", _id: "id", pairKey: "pair_key", request: "request_id", requestId: "request_id",
            status: "status", stage: "stage", createdAt: "created_at", updatedAt: "updated_at"
        };
        return map[field] || field;
    }

    static _buildWhere(query) {
        return buildWhere(query, Connection._col);
    }

    static findOne(query = {}) {
        return new QueryBuilder(async ({ populate }) => {
            const db = getDb();
            const { sql, params } = Connection._buildWhere(query);
            const row = await db.prepare(`SELECT * FROM connections ${sql} LIMIT 1`).get(...params);
            const conn = Connection._fromRow(row);
            return Connection._populate(conn, populate);
        });
    }

    static findById(id) {
        return new QueryBuilder(async ({ populate }) => {
            if (!id) return null;
            const db = getDb();
            const row = await db.prepare("SELECT * FROM connections WHERE id = ?").get(String(id));
            const conn = Connection._fromRow(row);
            return Connection._populate(conn, populate);
        });
    }

    static find(query = {}) {
        return new QueryBuilder(async ({ populate, sort, limit }) => {
            const db = getDb();
            const { sql, params } = Connection._buildWhere(query);
            let querySql = `SELECT * FROM connections ${sql}`;
            if (sort) {
                const sortClauses = Object.entries(sort).map(([k, dir]) => `${Connection._col(k)} ${dir === -1 ? "DESC" : "ASC"}`);
                if (sortClauses.length) querySql += ` ORDER BY ${sortClauses.join(", ")}`;
            }
            if (limit) querySql += ` LIMIT ${Number(limit)}`;
            const rows = await db.prepare(querySql).all(...params);
            const conns = rows.map(r => Connection._fromRow(r));
            for (const c of conns) {
                await Connection._populate(c, populate);
            }
            return conns;
        });
    }

    static async create(data) {
        const conn = new Connection(data);
        await conn.save();
        return conn;
    }

    static findOneAndUpdate(query = {}, update = {}, options = {}) {
        return new QueryBuilder(async ({ populate }) => {
            const conn = await Connection.findOne(query);
            if (!conn) return null;
            const setFields = update.$set ? { ...update.$set } : { ...update };
            delete setFields.$set;
            if (setFields.stage !== undefined) conn.stage = setFields.stage;
            if (setFields.status !== undefined) conn.status = setFields.status;
            await conn.save();
            return Connection._populate(conn, populate);
        });
    }

    static async updateOne(query = {}, update = {}, options = {}) {
        return Connection.findOneAndUpdate(query, update, options);
    }

    static async deleteOne(query = {}) {
        const db = getDb();
        const conn = await Connection.findOne(query);
        if (!conn) return { deletedCount: 0 };
        const result = await db.prepare("DELETE FROM connections WHERE id = ?").run(conn.id);
        return { deletedCount: result.changes };
    }

    static async deleteMany(query = {}) {
        const db = getDb();
        if (!query || Object.keys(query).length === 0) {
            const result = await db.prepare("DELETE FROM connections").run();
            return { deletedCount: result.changes };
        }
        const { sql, params } = Connection._buildWhere(query);
        const result = await db.prepare(`DELETE FROM connections ${sql}`).run(...params);
        return { deletedCount: result.changes };
    }

    static async countDocuments(query = {}) {
        const db = getDb();
        const { sql, params } = Connection._buildWhere(query);
        const row = await db.prepare(`SELECT COUNT(*) as count FROM connections ${sql}`).get(...params);
        return row ? Number(row.count) : 0;
    }

    static async exists(query = {}) {
        const conn = await Connection.findOne(query);
        return conn ? { _id: conn._id } : null;
    }
}

Connection.JOURNEY_STAGES = JOURNEY_STAGES;
module.exports = Connection;
