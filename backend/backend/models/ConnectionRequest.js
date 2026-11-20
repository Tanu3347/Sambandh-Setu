const { getDb, generateId } = require("../db");
const { QueryBuilder, buildWhere } = require("../db/queryHelper");
const User = require("./User");

class ConnectionRequest {
    constructor(data = {}) {
        this.id = String(data.id || data._id || generateId());
        this._id = this.id;
        this.sender = data.sender || data.sender_id || null;
        this.recipient = data.recipient || data.recipient_id || null;
        this.pairKey = data.pairKey || data.pair_key || "";
        this.status = data.status || "pending";
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    }

    async save() {
        const db = getDb();
        this.updatedAt = new Date();
        const sId = typeof this.sender === "object" && this.sender ? (this.sender.id || this.sender._id) : this.sender;
        const rId = typeof this.recipient === "object" && this.recipient ? (this.recipient.id || this.recipient._id) : this.recipient;
        const existing = db.prepare("SELECT id FROM connection_requests WHERE id = ?").get(this.id);
        if (existing) {
            db.prepare(`
                UPDATE connection_requests SET
                    sender_id = ?, recipient_id = ?, pair_key = ?, status = ?, updated_at = ?
                WHERE id = ?
            `).run(
                String(sId),
                String(rId),
                this.pairKey,
                this.status,
                this.updatedAt.toISOString(),
                this.id
            );
        } else {
            db.prepare(`
                INSERT INTO connection_requests (
                    id, sender_id, recipient_id, pair_key, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                this.id,
                String(sId),
                String(rId),
                this.pairKey,
                this.status,
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
            sender: this.sender,
            recipient: this.recipient,
            pairKey: this.pairKey,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    toJSON() {
        return this.toObject();
    }

    static _fromRow(row) {
        if (!row) return null;
        return new ConnectionRequest({
            id: row.id,
            sender: row.sender_id,
            recipient: row.recipient_id,
            pairKey: row.pair_key,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        });
    }

    static async _populate(reqDoc, popConfig) {
        if (!reqDoc || !popConfig || !popConfig.length) return reqDoc;
        for (const pop of popConfig) {
            if (pop.path === "sender") {
                const sId = typeof reqDoc.sender === "object" && reqDoc.sender ? (reqDoc.sender.id || reqDoc.sender._id) : reqDoc.sender;
                if (sId) reqDoc.sender = (await User.findById(sId)) || reqDoc.sender;
            } else if (pop.path === "recipient") {
                const rId = typeof reqDoc.recipient === "object" && reqDoc.recipient ? (reqDoc.recipient.id || reqDoc.recipient._id) : reqDoc.recipient;
                if (rId) reqDoc.recipient = (await User.findById(rId)) || reqDoc.recipient;
            }
        }
        return reqDoc;
    }

    static _col(field) {
        const map = {
            id: "id", _id: "id", sender: "sender_id", senderId: "sender_id",
            recipient: "recipient_id", recipientId: "recipient_id",
            pairKey: "pair_key", status: "status", createdAt: "created_at", updatedAt: "updated_at"
        };
        return map[field] || field;
    }

    static _buildWhere(query) {
        return buildWhere(query, ConnectionRequest._col);
    }

    static findOne(query = {}) {
        return new QueryBuilder(async ({ populate }) => {
            const db = getDb();
            const { sql, params } = ConnectionRequest._buildWhere(query);
            const row = db.prepare(`SELECT * FROM connection_requests ${sql} LIMIT 1`).get(...params);
            const reqDoc = ConnectionRequest._fromRow(row);
            return ConnectionRequest._populate(reqDoc, populate);
        });
    }

    static findById(id) {
        return new QueryBuilder(async ({ populate }) => {
            if (!id) return null;
            const db = getDb();
            const row = db.prepare("SELECT * FROM connection_requests WHERE id = ?").get(String(id));
            const reqDoc = ConnectionRequest._fromRow(row);
            return ConnectionRequest._populate(reqDoc, populate);
        });
    }

    static find(query = {}) {
        return new QueryBuilder(async ({ populate, sort, limit }) => {
            const db = getDb();
            const { sql, params } = ConnectionRequest._buildWhere(query);
            let querySql = `SELECT * FROM connection_requests ${sql}`;
            if (sort) {
                const sortClauses = Object.entries(sort).map(([k, dir]) => `${ConnectionRequest._col(k)} ${dir === -1 ? "DESC" : "ASC"}`);
                if (sortClauses.length) querySql += ` ORDER BY ${sortClauses.join(", ")}`;
            }
            if (limit) querySql += ` LIMIT ${Number(limit)}`;
            const rows = db.prepare(querySql).all(...params);
            const reqDocs = rows.map(r => ConnectionRequest._fromRow(r));
            for (const doc of reqDocs) {
                await ConnectionRequest._populate(doc, populate);
            }
            return reqDocs;
        });
    }

    static async create(data) {
        const reqDoc = new ConnectionRequest(data);
        await reqDoc.save();
        return reqDoc;
    }

    static findOneAndUpdate(query = {}, update = {}, options = {}) {
        return new QueryBuilder(async ({ populate }) => {
            const reqDoc = await ConnectionRequest.findOne(query);
            if (!reqDoc) return null;
            const setFields = update.$set ? { ...update.$set } : { ...update };
            delete setFields.$set;
            if (setFields.status !== undefined) reqDoc.status = setFields.status;
            await reqDoc.save();
            return ConnectionRequest._populate(reqDoc, populate);
        });
    }

    static async updateOne(query = {}, update = {}, options = {}) {
        return ConnectionRequest.findOneAndUpdate(query, update, options);
    }

    static async deleteOne(query = {}) {
        const db = getDb();
        const reqDoc = await ConnectionRequest.findOne(query);
        if (!reqDoc) return { deletedCount: 0 };
        const result = db.prepare("DELETE FROM connection_requests WHERE id = ?").run(reqDoc.id);
        return { deletedCount: result.changes };
    }

    static async deleteMany(query = {}) {
        const db = getDb();
        if (!query || Object.keys(query).length === 0) {
            const result = db.prepare("DELETE FROM connection_requests").run();
            return { deletedCount: result.changes };
        }
        const { sql, params } = ConnectionRequest._buildWhere(query);
        const result = db.prepare(`DELETE FROM connection_requests ${sql}`).run(...params);
        return { deletedCount: result.changes };
    }

    static async countDocuments(query = {}) {
        const db = getDb();
        const { sql, params } = ConnectionRequest._buildWhere(query);
        const row = db.prepare(`SELECT COUNT(*) as count FROM connection_requests ${sql}`).get(...params);
        return row ? row.count : 0;
    }

    static async exists(query = {}) {
        const reqDoc = await ConnectionRequest.findOne(query);
        return reqDoc ? { _id: reqDoc._id } : null;
    }
}

module.exports = ConnectionRequest;
