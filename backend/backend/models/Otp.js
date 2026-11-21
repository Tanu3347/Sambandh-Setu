const { getDb, generateId } = require("../db");
const { QueryBuilder, buildWhere } = require("../db/queryHelper");

class Otp {
    constructor(data = {}) {
        this.id = String(data.id || data._id || generateId());
        this._id = this.id;
        this.email = String(data.email || "").trim().toLowerCase();
        this.codeHash = data.codeHash || data.code_hash || "";
        this.attempts = Number(data.attempts) || 0;
        this.lastSentAt = data.lastSentAt || data.last_sent_at ? new Date(data.lastSentAt || data.last_sent_at) : new Date();
        this.expiresAt = data.expiresAt || data.expires_at ? new Date(data.expiresAt || data.expires_at) : new Date(Date.now() + 10 * 60 * 1000);
        this.lockedUntil = data.lockedUntil || data.locked_until ? new Date(data.lockedUntil || data.locked_until) : null;
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    }

    async save() {
        const db = getDb();
        this.updatedAt = new Date();
        const existing = await db.prepare("SELECT id FROM otps WHERE id = ? OR email = ?").get(this.id, this.email);
        if (existing) {
            this.id = existing.id;
            this._id = this.id;
            await db.prepare(`
                UPDATE otps SET
                    email = ?, code_hash = ?, attempts = ?, last_sent_at = ?,
                    expires_at = ?, locked_until = ?, updated_at = ?
                WHERE id = ?
            `).run(
                this.email,
                this.codeHash,
                this.attempts,
                (this.lastSentAt && !isNaN(this.lastSentAt.getTime())) ? this.lastSentAt.toISOString() : new Date().toISOString(),
                (this.expiresAt && !isNaN(this.expiresAt.getTime())) ? this.expiresAt.toISOString() : new Date().toISOString(),
                (this.lockedUntil && !isNaN(this.lockedUntil.getTime())) ? this.lockedUntil.toISOString() : null,
                this.updatedAt.toISOString(),
                this.id
            );
        } else {
            await db.prepare(`
                INSERT INTO otps (
                    id, email, code_hash, attempts, last_sent_at,
                    expires_at, locked_until, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                this.id,
                this.email,
                this.codeHash,
                this.attempts,
                (this.lastSentAt && !isNaN(this.lastSentAt.getTime())) ? this.lastSentAt.toISOString() : new Date().toISOString(),
                (this.expiresAt && !isNaN(this.expiresAt.getTime())) ? this.expiresAt.toISOString() : new Date().toISOString(),
                (this.lockedUntil && !isNaN(this.lockedUntil.getTime())) ? this.lockedUntil.toISOString() : null,
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
            email: this.email,
            codeHash: this.codeHash,
            attempts: this.attempts,
            lastSentAt: this.lastSentAt,
            expiresAt: this.expiresAt,
            lockedUntil: this.lockedUntil,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    toJSON() {
        return this.toObject();
    }

    static _fromRow(row) {
        if (!row) return null;
        return new Otp({
            id: row.id,
            email: row.email,
            code_hash: row.code_hash,
            attempts: row.attempts,
            last_sent_at: row.last_sent_at,
            expires_at: row.expires_at,
            locked_until: row.locked_until,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        });
    }

    static _col(field) {
        const map = {
            id: "id", _id: "id", email: "email",
            codeHash: "code_hash", attempts: "attempts",
            lastSentAt: "last_sent_at", expiresAt: "expires_at",
            lockedUntil: "locked_until", createdAt: "created_at", updatedAt: "updated_at"
        };
        return map[field] || field;
    }

    static _buildWhere(query) {
        return buildWhere(query, Otp._col);
    }

    static findOne(query = {}) {
        return new QueryBuilder(async () => {
            const db = getDb();
            const { sql, params } = Otp._buildWhere(query);
            const row = await db.prepare(`SELECT * FROM otps ${sql} LIMIT 1`).get(...params);
            return Otp._fromRow(row);
        });
    }

    static findById(id) {
        return new QueryBuilder(async () => {
            if (!id) return null;
            const db = getDb();
            const row = await db.prepare("SELECT * FROM otps WHERE id = ?").get(String(id));
            return Otp._fromRow(row);
        });
    }

    static async create(data) {
        const otp = new Otp(data);
        await otp.save();
        return otp;
    }

    static async findOneAndUpdate(query = {}, update = {}, options = {}) {
        let otp = await Otp.findOne(query);
        if (!otp && options.upsert) {
            otp = new Otp(query);
        }
        if (!otp) return null;

        let setFields = {};
        if (Array.isArray(update)) {
            for (const stage of update) {
                if (stage.$set) Object.assign(setFields, stage.$set);
            }
        } else if (update.$set) {
            setFields = { ...update.$set };
        } else {
            setFields = { ...update };
        }

        if (setFields.attempts !== undefined) {
            if (typeof setFields.attempts === "object" && setFields.attempts.$add) {
                otp.attempts += 1;
            } else {
                otp.attempts = Number(setFields.attempts);
            }
        }
        if (otp.attempts >= 5) {
            otp.lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
        } else if (setFields.lockedUntil instanceof Date) {
            otp.lockedUntil = setFields.lockedUntil;
        } else if (typeof setFields.lockedUntil === "string") {
            otp.lockedUntil = new Date(setFields.lockedUntil);
        } else if (setFields.lockedUntil === null) {
            otp.lockedUntil = null;
        }

        await otp.save();
        return otp;
    }

    static async deleteOne(query = {}) {
        const db = getDb();
        const otp = await Otp.findOne(query);
        if (!otp) return { deletedCount: 0 };
        const result = await db.prepare("DELETE FROM otps WHERE id = ?").run(otp.id);
        return { deletedCount: result.changes };
    }

    static async deleteMany(query = {}) {
        const db = getDb();
        if (!query || Object.keys(query).length === 0) {
            const result = await db.prepare("DELETE FROM otps").run();
            return { deletedCount: result.changes };
        }
        const { sql, params } = Otp._buildWhere(query);
        const result = await db.prepare(`DELETE FROM otps ${sql}`).run(...params);
        return { deletedCount: result.changes };
    }

    static async countDocuments(query = {}) {
        const db = getDb();
        const { sql, params } = Otp._buildWhere(query);
        const row = await db.prepare(`SELECT COUNT(*) as count FROM otps ${sql}`).get(...params);
        return row ? Number(row.count) : 0;
    }

    static async exists(query = {}) {
        const otp = await Otp.findOne(query);
        return otp ? { _id: otp._id } : null;
    }
}

module.exports = Otp;
