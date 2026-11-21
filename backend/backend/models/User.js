const bcrypt = require("bcryptjs");
const { getDb, generateId } = require("../db");
const { QueryBuilder, buildWhere } = require("../db/queryHelper");

class User {
    constructor(data = {}) {
        this.id = String(data.id || data._id || generateId());
        this._id = this.id;
        this.username = String(data.username || "").trim().toLowerCase();
        this.email = String(data.email || "").trim().toLowerCase();
        this.displayName = data.displayName || data.display_name || "";
        this.firstName = data.firstName || data.first_name || "";
        this.lastName = data.lastName || data.last_name || "";
        this.passwordHash = data.passwordHash || data.password_hash || "";
        this.isSeeded = data.isSeeded !== undefined ? Boolean(data.isSeeded) : (data.is_seeded !== undefined ? Boolean(data.is_seeded) : false);
        this.onboardingCompleted = data.onboardingCompleted !== undefined ? Boolean(data.onboardingCompleted) : (data.onboarding_completed !== undefined ? Boolean(data.onboarding_completed) : false);
        this.sharingDefault = data.sharingDefault || data.sharing_default || "keep_private";
        this.isActive = data.isActive !== undefined ? Boolean(data.isActive) : (data.is_active !== undefined ? Boolean(data.is_active) : true);
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    }

    async setPassword(plainPassword) {
        const salt = await bcrypt.genSalt(10);
        this.passwordHash = await bcrypt.hash(plainPassword, salt);
    }

    async comparePassword(candidatePassword) {
        if (!this.passwordHash) return false;
        return bcrypt.compare(candidatePassword, this.passwordHash);
    }

    async save() {
        const db = getDb();
        this.updatedAt = new Date();
        let existing = null;
        if (this.id) {
            existing = await db.prepare("SELECT id FROM users WHERE id = ?").get(this.id);
        }
        if (!existing && this.username) {
            existing = await db.prepare("SELECT id FROM users WHERE username = ?").get(this.username);
            if (existing) {
                this.id = existing.id;
                this._id = existing.id;
            }
        }
        if (!existing && this.email) {
            existing = await db.prepare("SELECT id FROM users WHERE email = ?").get(this.email);
            if (existing) {
                this.id = existing.id;
                this._id = existing.id;
            }
        }
        if (existing) {
            await db.prepare(`
                UPDATE users SET
                    username = ?, email = ?, display_name = ?, first_name = ?, last_name = ?,
                    password_hash = ?, is_seeded = ?, onboarding_completed = ?,
                    sharing_default = ?, is_active = ?, updated_at = ?
                WHERE id = ?
            `).run(
                this.username,
                this.email,
                this.displayName,
                this.firstName,
                this.lastName,
                this.passwordHash,
                this.isSeeded ? 1 : 0,
                this.onboardingCompleted ? 1 : 0,
                this.sharingDefault,
                this.isActive ? 1 : 0,
                this.updatedAt.toISOString(),
                this.id
            );
        } else {
            await db.prepare(`
                INSERT INTO users (
                    id, username, email, display_name, first_name, last_name,
                    password_hash, is_seeded, onboarding_completed,
                    sharing_default, is_active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                this.id,
                this.username,
                this.email,
                this.displayName,
                this.firstName,
                this.lastName,
                this.passwordHash,
                this.isSeeded ? 1 : 0,
                this.onboardingCompleted ? 1 : 0,
                this.sharingDefault,
                this.isActive ? 1 : 0,
                this.createdAt.toISOString(),
                this.updatedAt.toISOString()
            );
        }
        return this;
    }

    toObject(options = {}) {
        const obj = {
            id: this.id,
            _id: this.id,
            username: this.username,
            displayName: this.displayName || [this.firstName, this.lastName].filter(Boolean).join(" ") || this.username,
            firstName: this.firstName,
            lastName: this.lastName,
            onboardingCompleted: this.onboardingCompleted,
            sharingDefault: this.sharingDefault,
            isActive: this.isActive,
            isSeeded: this.isSeeded,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
        if (options.includePrivate) {
            obj.email = this.email;
            obj.passwordHash = this.passwordHash;
        }
        return obj;
    }

    toJSON() {
        return this.toObject();
    }

    static _fromRow(row) {
        if (!row) return null;
        return new User({
            id: row.id,
            username: row.username,
            email: row.email,
            display_name: row.display_name,
            first_name: row.first_name,
            last_name: row.last_name,
            password_hash: row.password_hash,
            is_seeded: Boolean(row.is_seeded),
            onboarding_completed: Boolean(row.onboarding_completed),
            sharing_default: row.sharing_default,
            is_active: Boolean(row.is_active),
            createdAt: row.created_at,
            updatedAt: row.updated_at
        });
    }

    static _col(field) {
        const map = {
            id: "id", _id: "id", username: "username", email: "email",
            displayName: "display_name", firstName: "first_name", lastName: "last_name",
            passwordHash: "password_hash", isSeeded: "is_seeded",
            onboardingCompleted: "onboarding_completed", sharingDefault: "sharing_default",
            isActive: "is_active", createdAt: "created_at", updatedAt: "updated_at"
        };
        return map[field] || field;
    }

    static _buildWhere(query) {
        return buildWhere(query, User._col);
    }

    static findOne(query = {}) {
        return new QueryBuilder(async ({ select }) => {
            const db = getDb();
            const { sql, params } = User._buildWhere(query);
            const row = await db.prepare(`SELECT * FROM users ${sql} LIMIT 1`).get(...params);
            return User._fromRow(row);
        });
    }

    static findById(id) {
        return new QueryBuilder(async ({ select }) => {
            if (!id) return null;
            const db = getDb();
            const row = await db.prepare("SELECT * FROM users WHERE id = ?").get(String(id));
            return User._fromRow(row);
        });
    }

    static find(query = {}) {
        return new QueryBuilder(async ({ sort, limit }) => {
            const db = getDb();
            const { sql, params } = User._buildWhere(query);
            let querySql = `SELECT * FROM users ${sql}`;
            if (sort) {
                const sortClauses = Object.entries(sort).map(([k, dir]) => `${User._col(k)} ${dir === -1 ? "DESC" : "ASC"}`);
                if (sortClauses.length) querySql += ` ORDER BY ${sortClauses.join(", ")}`;
            }
            if (limit) querySql += ` LIMIT ${Number(limit)}`;
            const rows = await db.prepare(querySql).all(...params);
            return rows.map(r => User._fromRow(r));
        });
    }

    static async create(data) {
        const user = new User(data);
        await user.save();
        return user;
    }

    static findByIdAndUpdate(id, update, options = {}) {
        return new QueryBuilder(async ({ select }) => {
            const user = await User.findById(id);
            if (!user) return null;
            const setFields = update.$set ? { ...update.$set } : { ...update };
            delete setFields.$set;
            if (setFields.displayName !== undefined) user.displayName = setFields.displayName;
            if (setFields.firstName !== undefined) user.firstName = setFields.firstName;
            if (setFields.lastName !== undefined) user.lastName = setFields.lastName;
            if (setFields.username !== undefined) user.username = setFields.username;
            if (setFields.onboardingCompleted !== undefined) user.onboardingCompleted = Boolean(setFields.onboardingCompleted);
            if (setFields.isActive !== undefined) user.isActive = Boolean(setFields.isActive);
            if (setFields.sharingDefault !== undefined) user.sharingDefault = setFields.sharingDefault;
            await user.save();
            return user;
        });
    }

    static async updateOne(query = {}, update = {}, options = {}) {
        const user = await User.findOne(query);
        if (!user) return { matchedCount: 0, modifiedCount: 0 };
        const setFields = update.$set ? { ...update.$set } : { ...update };
        delete setFields.$set;
        for (const [k, v] of Object.entries(setFields)) {
            user[k] = v;
        }
        await user.save();
        return { matchedCount: 1, modifiedCount: 1 };
    }

    static async deleteOne(query = {}) {
        const db = getDb();
        const user = await User.findOne(query);
        if (!user) return { deletedCount: 0 };
        const result = await db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
        return { deletedCount: result.changes };
    }

    static async deleteMany(query = {}) {
        const db = getDb();
        if (!query || Object.keys(query).length === 0) {
            const result = await db.prepare("DELETE FROM users").run();
            return { deletedCount: result.changes };
        }
        const { sql, params } = User._buildWhere(query);
        const result = await db.prepare(`DELETE FROM users ${sql}`).run(...params);
        return { deletedCount: result.changes };
    }

    static async countDocuments(query = {}) {
        const db = getDb();
        const { sql, params } = User._buildWhere(query);
        const row = await db.prepare(`SELECT COUNT(*) as count FROM users ${sql}`).get(...params);
        return row ? Number(row.count) : 0;
    }

    static async exists(query = {}) {
        const user = await User.findOne(query);
        return user ? { _id: user._id } : null;
    }
}

module.exports = User;
