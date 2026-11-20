const { getDb, generateId } = require("../db");
const { QueryBuilder, safeJsonParse, buildWhere } = require("../db/queryHelper");
const User = require("./User");

class Message {
    constructor(data = {}) {
        this.id = String(data.id || data._id || generateId());
        this._id = this.id;
        this.chat = data.chat || data.chat_id || null;
        this.sender = data.sender || data.sender_id || null;
        this.text = String(data.text || "").trim();
        this.readBy = Array.isArray(data.readBy) ? data.readBy : safeJsonParse(data.read_by || data.readBy, []);
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    }

    async save() {
        const db = getDb();
        this.updatedAt = new Date();
        const chatId = typeof this.chat === "object" && this.chat ? (this.chat.id || this.chat._id) : this.chat;
        const senderId = typeof this.sender === "object" && this.sender ? (this.sender.id || this.sender._id) : this.sender;
        const existing = db.prepare("SELECT id FROM messages WHERE id = ?").get(this.id);
        if (existing) {
            db.prepare(`
                UPDATE messages SET
                    chat_id = ?, sender_id = ?, text = ?, read_by = ?, updated_at = ?
                WHERE id = ?
            `).run(
                String(chatId),
                String(senderId),
                this.text,
                JSON.stringify(this.readBy || []),
                this.updatedAt.toISOString(),
                this.id
            );
        } else {
            db.prepare(`
                INSERT INTO messages (
                    id, chat_id, sender_id, text, read_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                this.id,
                String(chatId),
                String(senderId),
                this.text,
                JSON.stringify(this.readBy || []),
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
            chat: this.chat,
            sender: this.sender,
            text: this.text,
            readBy: this.readBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    toJSON() {
        return this.toObject();
    }

    static _fromRow(row) {
        if (!row) return null;
        return new Message({
            id: row.id,
            chat_id: row.chat_id,
            chat: row.chat_id,
            sender_id: row.sender_id,
            sender: row.sender_id,
            text: row.text,
            read_by: row.read_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        });
    }

    static async _populate(msg, popConfig) {
        if (!msg || !popConfig || !popConfig.length) return msg;
        for (const pop of popConfig) {
            if (pop.path === "sender") {
                const sId = typeof msg.sender === "object" && msg.sender ? (msg.sender.id || msg.sender._id) : msg.sender;
                if (sId) msg.sender = (await User.findById(sId)) || msg.sender;
            }
        }
        return msg;
    }

    static _col(field) {
        const map = {
            id: "id", _id: "id", chat: "chat_id", chatId: "chat_id",
            sender: "sender_id", senderId: "sender_id", text: "text",
            createdAt: "created_at", updatedAt: "updated_at"
        };
        return map[field] || field;
    }

    static _buildWhere(query) {
        return buildWhere(query, Message._col);
    }

    static find(query = {}) {
        return new QueryBuilder(async ({ populate, sort, limit }) => {
            const db = getDb();
            const { sql, params } = Message._buildWhere(query);
            let querySql = `SELECT * FROM messages ${sql}`;
            if (sort) {
                const sortClauses = Object.entries(sort).map(([k, dir]) => `${Message._col(k)} ${dir === -1 ? "DESC" : "ASC"}`);
                if (sortClauses.length) querySql += ` ORDER BY ${sortClauses.join(", ")}`;
            } else {
                querySql += ` ORDER BY created_at ASC`;
            }
            if (limit) querySql += ` LIMIT ${Number(limit)}`;
            const rows = db.prepare(querySql).all(...params);
            const msgs = rows.map(r => Message._fromRow(r));
            for (const m of msgs) {
                await Message._populate(m, populate);
            }
            return msgs;
        });
    }

    static findOne(query = {}) {
        return new QueryBuilder(async ({ populate }) => {
            const db = getDb();
            const { sql, params } = Message._buildWhere(query);
            const row = db.prepare(`SELECT * FROM messages ${sql} LIMIT 1`).get(...params);
            const msg = Message._fromRow(row);
            return Message._populate(msg, populate);
        });
    }

    static findById(id) {
        return new QueryBuilder(async ({ populate }) => {
            if (!id) return null;
            const db = getDb();
            const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(String(id));
            const msg = Message._fromRow(row);
            return Message._populate(msg, populate);
        });
    }

    static async create(data) {
        const msg = new Message(data);
        await msg.save();
        return msg;
    }

    static async updateMany(query = {}, update = {}) {
        const db = getDb();
        const chatId = query.chat ? (query.chat.id || query.chat._id || String(query.chat)) : null;
        if (!chatId) return { modifiedCount: 0 };

        const rows = db.prepare("SELECT * FROM messages WHERE chat_id = ?").all(chatId);
        let modified = 0;
        for (const row of rows) {
            const msg = Message._fromRow(row);
            let changed = false;
            if (update.$addToSet && update.$addToSet.readBy) {
                const uId = String(update.$addToSet.readBy);
                if (!msg.readBy.includes(uId)) {
                    msg.readBy.push(uId);
                    changed = true;
                }
            }
            if (changed) {
                await msg.save();
                modified++;
            }
        }
        return { modifiedCount: modified };
    }

    static async aggregate(pipeline = []) {
        const db = getDb();
        const matchStage = pipeline.find(p => p.$match);
        const groupStage = pipeline.find(p => p.$group);

        if (matchStage && groupStage) {
            const match = matchStage.$match;
            const chatIds = match.chat && match.chat.$in ? match.chat.$in.map(String) : [];
            const excludeSender = match.sender && match.sender.$ne ? String(match.sender.$ne) : null;
            const excludeReadBy = match.readBy && match.readBy.$ne ? String(match.readBy.$ne) : null;

            if (chatIds.length === 0) return [];

            const placeholders = chatIds.map(() => "?").join(", ");
            let sql = `SELECT * FROM messages WHERE chat_id IN (${placeholders})`;
            const params = [...chatIds];
            if (excludeSender) {
                sql += " AND sender_id != ?";
                params.push(excludeSender);
            }

            const rows = db.prepare(sql).all(...params);
            const counts = {};
            for (const row of rows) {
                const readBy = safeJsonParse(row.read_by, []);
                if (excludeReadBy && readBy.includes(excludeReadBy)) {
                    continue;
                }
                counts[row.chat_id] = (counts[row.chat_id] || 0) + 1;
            }
            return Object.entries(counts).map(([chatId, count]) => ({
                _id: chatId,
                count
            }));
        }
        return [];
    }

    static async deleteOne(query = {}) {
        const db = getDb();
        const msg = await Message.findOne(query);
        if (!msg) return { deletedCount: 0 };
        const result = db.prepare("DELETE FROM messages WHERE id = ?").run(msg.id);
        return { deletedCount: result.changes };
    }

    static async deleteMany(query = {}) {
        const db = getDb();
        if (!query || Object.keys(query).length === 0) {
            const result = db.prepare("DELETE FROM messages").run();
            return { deletedCount: result.changes };
        }
        const { sql, params } = Message._buildWhere(query);
        const result = db.prepare(`DELETE FROM messages ${sql}`).run(...params);
        return { deletedCount: result.changes };
    }

    static async countDocuments(query = {}) {
        const db = getDb();
        const { sql, params } = Message._buildWhere(query);
        const row = db.prepare(`SELECT COUNT(*) as count FROM messages ${sql}`).get(...params);
        return row ? row.count : 0;
    }

    static async exists(query = {}) {
        const msg = await Message.findOne(query);
        return msg ? { _id: msg._id } : null;
    }
}

module.exports = Message;
