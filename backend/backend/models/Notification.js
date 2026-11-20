const { getDb, generateId } = require("../db");
const { QueryBuilder, buildWhere } = require("../db/queryHelper");
const User = require("./User");

class Notification {
    constructor(data = {}) {
        this.id = String(data.id || data._id || generateId());
        this._id = this.id;
        this.recipient = data.recipient || data.recipient_id || null;
        this.actor = data.actor || data.actor_id || null;
        this.type = String(data.type || "");
        this.request = data.request || data.request_id || null;
        this.connection = data.connection || data.connection_id || null;
        this.readAt = data.readAt || data.read_at ? new Date(data.readAt || data.read_at) : null;
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    }

    async save() {
        const db = getDb();
        this.updatedAt = new Date();
        const rId = typeof this.recipient === "object" && this.recipient ? (this.recipient.id || this.recipient._id) : this.recipient;
        const aId = typeof this.actor === "object" && this.actor ? (this.actor.id || this.actor._id) : this.actor;
        const reqId = typeof this.request === "object" && this.request ? (this.request.id || this.request._id) : this.request;
        const connId = typeof this.connection === "object" && this.connection ? (this.connection.id || this.connection._id) : this.connection;

        const existing = db.prepare("SELECT id FROM notifications WHERE id = ?").get(this.id);
        if (existing) {
            db.prepare(`
                UPDATE notifications SET
                    recipient_id = ?, actor_id = ?, type = ?, request_id = ?,
                    connection_id = ?, read_at = ?, updated_at = ?
                WHERE id = ?
            `).run(
                String(rId),
                String(aId),
                this.type,
                reqId ? String(reqId) : null,
                connId ? String(connId) : null,
                this.readAt ? this.readAt.toISOString() : null,
                this.updatedAt.toISOString(),
                this.id
            );
        } else {
            db.prepare(`
                INSERT INTO notifications (
                    id, recipient_id, actor_id, type, request_id,
                    connection_id, read_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                this.id,
                String(rId),
                String(aId),
                this.type,
                reqId ? String(reqId) : null,
                connId ? String(connId) : null,
                this.readAt ? this.readAt.toISOString() : null,
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
            recipient: this.recipient,
            actor: this.actor,
            type: this.type,
            request: this.request,
            connection: this.connection,
            readAt: this.readAt,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    toJSON() {
        return this.toObject();
    }

    static _fromRow(row) {
        if (!row) return null;
        return new Notification({
            id: row.id,
            recipient_id: row.recipient_id,
            recipient: row.recipient_id,
            actor_id: row.actor_id,
            actor: row.actor_id,
            type: row.type,
            request_id: row.request_id,
            request: row.request_id,
            connection_id: row.connection_id,
            connection: row.connection_id,
            read_at: row.read_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        });
    }

    static async _populate(notif, popConfig) {
        if (!notif || !popConfig || !popConfig.length) return notif;
        for (const pop of popConfig) {
            if (pop.path === "actor") {
                const aId = typeof notif.actor === "object" && notif.actor ? (notif.actor.id || notif.actor._id) : notif.actor;
                if (aId) notif.actor = (await User.findById(aId)) || notif.actor;
            }
        }
        return notif;
    }

    static _col(field) {
        const map = {
            id: "id", _id: "id", recipient: "recipient_id", recipientId: "recipient_id",
            actor: "actor_id", actorId: "actor_id", type: "type",
            request: "request_id", connection: "connection_id",
            readAt: "read_at", createdAt: "created_at", updatedAt: "updated_at"
        };
        return map[field] || field;
    }

    static _buildWhere(query) {
        return buildWhere(query, Notification._col);
    }

    static find(query = {}) {
        return new QueryBuilder(async ({ populate, sort, limit }) => {
            const db = getDb();
            const { sql, params } = Notification._buildWhere(query);
            let querySql = `SELECT * FROM notifications ${sql}`;
            if (sort) {
                const sortClauses = Object.entries(sort).map(([k, dir]) => `${Notification._col(k)} ${dir === -1 ? "DESC" : "ASC"}`);
                if (sortClauses.length) querySql += ` ORDER BY ${sortClauses.join(", ")}`;
            } else {
                querySql += ` ORDER BY created_at DESC`;
            }
            if (limit) querySql += ` LIMIT ${Number(limit)}`;
            const rows = db.prepare(querySql).all(...params);
            const notifs = rows.map(r => Notification._fromRow(r));
            for (const n of notifs) {
                await Notification._populate(n, populate);
            }
            return notifs;
        });
    }

    static findOne(query = {}) {
        return new QueryBuilder(async ({ populate }) => {
            const db = getDb();
            const { sql, params } = Notification._buildWhere(query);
            const row = db.prepare(`SELECT * FROM notifications ${sql} LIMIT 1`).get(...params);
            const notif = Notification._fromRow(row);
            return Notification._populate(notif, populate);
        });
    }

    static findById(id) {
        return new QueryBuilder(async ({ populate }) => {
            if (!id) return null;
            const db = getDb();
            const row = db.prepare("SELECT * FROM notifications WHERE id = ?").get(String(id));
            const notif = Notification._fromRow(row);
            return Notification._populate(notif, populate);
        });
    }

    static findByIdAndUpdate(id, update = {}, options = {}) {
        return new QueryBuilder(async ({ populate }) => {
            const notif = await Notification.findById(id);
            if (!notif) return null;
            const setFields = update.$set ? { ...update.$set } : { ...update };
            delete setFields.$set;
            if (setFields.readAt !== undefined) notif.readAt = setFields.readAt ? new Date(setFields.readAt) : null;
            await notif.save();
            return Notification._populate(notif, populate);
        });
    }

    static async updateMany(query = {}, update = {}) {
        const db = getDb();
        const { sql, params } = Notification._buildWhere(query);
        const rows = db.prepare(`SELECT * FROM notifications ${sql}`).all(...params);
        let count = 0;
        const setFields = update.$set ? { ...update.$set } : { ...update };
        for (const row of rows) {
            const n = Notification._fromRow(row);
            if (setFields.readAt !== undefined) n.readAt = setFields.readAt ? new Date(setFields.readAt) : null;
            await n.save();
            count++;
        }
        return { modifiedCount: count };
    }

    static async create(data) {
        const notif = new Notification(data);
        await notif.save();
        return notif;
    }

    static async deleteOne(query = {}) {
        const db = getDb();
        const notif = await Notification.findOne(query);
        if (!notif) return { deletedCount: 0 };
        const result = db.prepare("DELETE FROM notifications WHERE id = ?").run(notif.id);
        return { deletedCount: result.changes };
    }

    static async deleteMany(query = {}) {
        const db = getDb();
        if (!query || Object.keys(query).length === 0) {
            const result = db.prepare("DELETE FROM notifications").run();
            return { deletedCount: result.changes };
        }
        const { sql, params } = Notification._buildWhere(query);
        const result = db.prepare(`DELETE FROM notifications ${sql}`).run(...params);
        return { deletedCount: result.changes };
    }

    static async countDocuments(query = {}) {
        const db = getDb();
        const { sql, params } = Notification._buildWhere(query);
        const row = db.prepare(`SELECT COUNT(*) as count FROM notifications ${sql}`).get(...params);
        return row ? row.count : 0;
    }

    static async exists(query = {}) {
        const notif = await Notification.findOne(query);
        return notif ? { _id: notif._id } : null;
    }
}

module.exports = Notification;
