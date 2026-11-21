const { getDb, generateId } = require("../db");
const { QueryBuilder, safeJsonParse, buildWhere } = require("../db/queryHelper");

class Chat {
    constructor(data = {}) {
        this.id = String(data.id || data._id || generateId());
        this._id = this.id;
        this.connection = data.connection || data.connection_id || null;
        this.mutedBy = Array.isArray(data.mutedBy) ? data.mutedBy : safeJsonParse(data.muted_by || data.mutedBy, []);
        this.lastMessageAt = data.lastMessageAt || data.last_message_at ? new Date(data.lastMessageAt || data.last_message_at) : null;
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    }

    async save() {
        const db = getDb();
        this.updatedAt = new Date();
        const connId = typeof this.connection === "object" && this.connection ? (this.connection.id || this.connection._id) : this.connection;
        const existing = await db.prepare("SELECT id FROM chats WHERE id = ?").get(this.id);
        if (existing) {
            await db.prepare(`
                UPDATE chats SET
                    connection_id = ?, muted_by = ?, last_message_at = ?, updated_at = ?
                WHERE id = ?
            `).run(
                String(connId),
                JSON.stringify(this.mutedBy || []),
                this.lastMessageAt ? this.lastMessageAt.toISOString() : null,
                this.updatedAt.toISOString(),
                this.id
            );
        } else {
            await db.prepare(`
                INSERT INTO chats (
                    id, connection_id, muted_by, last_message_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                this.id,
                String(connId),
                JSON.stringify(this.mutedBy || []),
                this.lastMessageAt ? this.lastMessageAt.toISOString() : null,
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
            connection: this.connection,
            mutedBy: this.mutedBy,
            lastMessageAt: this.lastMessageAt,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    toJSON() {
        return this.toObject();
    }

    static _fromRow(row) {
        if (!row) return null;
        return new Chat({
            id: row.id,
            connection_id: row.connection_id,
            connection: row.connection_id,
            muted_by: row.muted_by,
            last_message_at: row.last_message_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        });
    }

    static _col(field) {
        const map = {
            id: "id", _id: "id", connection: "connection_id", connectionId: "connection_id",
            createdAt: "created_at", updatedAt: "updated_at"
        };
        return map[field] || field;
    }

    static _buildWhere(query) {
        return buildWhere(query, Chat._col);
    }

    static findOne(query = {}) {
        return new QueryBuilder(async () => {
            const db = getDb();
            const { sql, params } = Chat._buildWhere(query);
            const row = await db.prepare(`SELECT * FROM chats ${sql} LIMIT 1`).get(...params);
            return Chat._fromRow(row);
        });
    }

    static findById(id) {
        return new QueryBuilder(async () => {
            if (!id) return null;
            const db = getDb();
            const row = await db.prepare("SELECT * FROM chats WHERE id = ?").get(String(id));
            return Chat._fromRow(row);
        });
    }

    static find(query = {}) {
        return new QueryBuilder(async ({ sort, limit }) => {
            const db = getDb();
            const { sql, params } = Chat._buildWhere(query);
            let querySql = `SELECT * FROM chats ${sql}`;
            if (sort) {
                const sortClauses = Object.entries(sort).map(([k, dir]) => `${Chat._col(k)} ${dir === -1 ? "DESC" : "ASC"}`);
                if (sortClauses.length) querySql += ` ORDER BY ${sortClauses.join(", ")}`;
            }
            if (limit) querySql += ` LIMIT ${Number(limit)}`;
            const rows = await db.prepare(querySql).all(...params);
            return rows.map(r => Chat._fromRow(r));
        });
    }

    static async create(data) {
        const chat = new Chat(data);
        await chat.save();
        return chat;
    }

    static findOneAndUpdate(query = {}, update = {}, options = {}) {
        return new QueryBuilder(async ({ populate }) => {
            let chat = await Chat.findOne(query);
            if (!chat && options.upsert) {
                const connId = query.connection || (update.$setOnInsert && update.$setOnInsert.connection) || (update.$set && update.$set.connection);
                chat = new Chat({ connection: connId });
            }
            if (!chat) return null;
            const setFields = update.$set ? { ...update.$set } : { ...update };
            delete setFields.$set;
            if (setFields.lastMessageAt !== undefined) chat.lastMessageAt = setFields.lastMessageAt ? new Date(setFields.lastMessageAt) : null;
            if (setFields.mutedBy !== undefined) chat.mutedBy = setFields.mutedBy;

            if (update.$addToSet && update.$addToSet.mutedBy) {
                const uid = String(update.$addToSet.mutedBy);
                if (!chat.mutedBy.map(String).includes(uid)) {
                    chat.mutedBy.push(uid);
                }
            }
            if (update.$pull && update.$pull.mutedBy) {
                const uid = String(update.$pull.mutedBy);
                chat.mutedBy = chat.mutedBy.filter(u => String(u) !== uid);
            }

            await chat.save();
            return chat;
        });
    }

    static async updateOne(query = {}, update = {}, options = {}) {
        return Chat.findOneAndUpdate(query, update, options);
    }

    static async deleteOne(query = {}) {
        const db = getDb();
        const chat = await Chat.findOne(query);
        if (!chat) return { deletedCount: 0 };
        const result = await db.prepare("DELETE FROM chats WHERE id = ?").run(chat.id);
        return { deletedCount: result.changes };
    }

    static async deleteMany(query = {}) {
        const db = getDb();
        if (!query || Object.keys(query).length === 0) {
            const result = await db.prepare("DELETE FROM chats").run();
            return { deletedCount: result.changes };
        }
        const { sql, params } = Chat._buildWhere(query);
        const result = await db.prepare(`DELETE FROM chats ${sql}`).run(...params);
        return { deletedCount: result.changes };
    }

    static async countDocuments(query = {}) {
        const db = getDb();
        const { sql, params } = Chat._buildWhere(query);
        const row = await db.prepare(`SELECT COUNT(*) as count FROM chats ${sql}`).get(...params);
        return row ? Number(row.count) : 0;
    }

    static async exists(query = {}) {
        const chat = await Chat.findOne(query);
        return chat ? { _id: chat._id } : null;
    }
}

module.exports = Chat;
