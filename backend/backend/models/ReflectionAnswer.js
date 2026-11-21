const { getDb, generateId } = require("../db");
const { QueryBuilder, safeJsonParse, buildWhere } = require("../db/queryHelper");
const ReflectionQuestion = require("./ReflectionQuestion");
const User = require("./User");

class ReflectionAnswer {
    constructor(data = {}) {
        this.id = String(data.id || data._id || generateId());
        this._id = this.id;
        this.connection = data.connection || data.connection_id || null;
        this.author = data.author || data.author_id || null;
        this.question = data.question || data.question_id || null;
        this.value = data.value !== undefined ? (typeof data.value === "object" ? data.value : safeJsonParse(data.value, data.value)) : "";
        this.otherText = data.otherText || data.other_text || null;
        this.sharing = data.sharing || "keep_private";
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    }

    async save() {
        const db = getDb();
        this.updatedAt = new Date();
        const connId = typeof this.connection === "object" && this.connection ? (this.connection.id || this.connection._id) : this.connection;
        const authId = typeof this.author === "object" && this.author ? (this.author.id || this.author._id) : this.author;
        const qId = typeof this.question === "object" && this.question ? (this.question.id || this.question._id) : this.question;

        const existing = await db.prepare("SELECT id FROM reflection_answers WHERE connection_id = ? AND author_id = ? AND question_id = ?").get(
            String(connId), String(authId), String(qId)
        );

        if (existing) {
            this.id = existing.id;
            this._id = this.id;
            await db.prepare(`
                UPDATE reflection_answers SET
                    value = ?, other_text = ?, sharing = ?, updated_at = ?
                WHERE id = ?
            `).run(
                typeof this.value === "object" ? JSON.stringify(this.value) : String(this.value),
                this.otherText,
                this.sharing,
                this.updatedAt.toISOString(),
                this.id
            );
        } else {
            await db.prepare(`
                INSERT INTO reflection_answers (
                    id, connection_id, author_id, question_id,
                    value, other_text, sharing, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                this.id,
                String(connId),
                String(authId),
                String(qId),
                typeof this.value === "object" ? JSON.stringify(this.value) : String(this.value),
                this.otherText,
                this.sharing,
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
            author: this.author,
            question: this.question,
            value: this.value,
            otherText: this.otherText,
            sharing: this.sharing,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    toJSON() {
        return this.toObject();
    }

    static _fromRow(row) {
        if (!row) return null;
        return new ReflectionAnswer({
            id: row.id,
            connection_id: row.connection_id,
            connection: row.connection_id,
            author_id: row.author_id,
            author: row.author_id,
            question_id: row.question_id,
            question: row.question_id,
            value: row.value,
            other_text: row.other_text,
            sharing: row.sharing,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        });
    }

    static async _populate(ans, popConfig) {
        if (!ans || !popConfig || !popConfig.length) return ans;
        for (const pop of popConfig) {
            if (pop.path === "question") {
                const qId = typeof ans.question === "object" && ans.question ? (ans.question.id || ans.question._id) : ans.question;
                if (qId) {
                    const q = await ReflectionQuestion.findById(qId);
                    if (q) ans.question = q;
                }
            } else if (pop.path === "author") {
                const aId = typeof ans.author === "object" && ans.author ? (ans.author.id || ans.author._id) : ans.author;
                if (aId) {
                    const u = await User.findById(aId);
                    if (u) ans.author = u;
                }
            }
        }
        return ans;
    }

    static _col(field) {
        const map = {
            id: "id", _id: "id", connection: "connection_id", connectionId: "connection_id",
            author: "author_id", authorId: "author_id", question: "question_id", questionId: "question_id",
            value: "value", otherText: "other_text", sharing: "sharing",
            createdAt: "created_at", updatedAt: "updated_at"
        };
        return map[field] || field;
    }

    static _buildWhere(query) {
        return buildWhere(query, ReflectionAnswer._col);
    }

    static find(query = {}) {
        return new QueryBuilder(async ({ populate, sort, limit }) => {
            const db = getDb();
            const { sql, params } = ReflectionAnswer._buildWhere(query);
            let querySql = `SELECT * FROM reflection_answers ${sql}`;
            if (sort) {
                const sortClauses = Object.entries(sort).map(([k, dir]) => `${ReflectionAnswer._col(k)} ${dir === -1 ? "DESC" : "ASC"}`);
                if (sortClauses.length) querySql += ` ORDER BY ${sortClauses.join(", ")}`;
            } else {
                querySql += " ORDER BY created_at ASC";
            }
            if (limit) querySql += ` LIMIT ${Number(limit)}`;
            const rows = await db.prepare(querySql).all(...params);
            const answers = rows.map(r => ReflectionAnswer._fromRow(r));
            for (const a of answers) {
                await ReflectionAnswer._populate(a, populate);
            }
            return answers;
        });
    }

    static findOne(query = {}) {
        return new QueryBuilder(async ({ populate }) => {
            const db = getDb();
            const { sql, params } = ReflectionAnswer._buildWhere(query);
            const row = await db.prepare(`SELECT * FROM reflection_answers ${sql} LIMIT 1`).get(...params);
            const ans = ReflectionAnswer._fromRow(row);
            return ReflectionAnswer._populate(ans, populate);
        });
    }

    static findById(id) {
        return new QueryBuilder(async ({ populate }) => {
            if (!id) return null;
            const db = getDb();
            const row = await db.prepare("SELECT * FROM reflection_answers WHERE id = ?").get(String(id));
            const ans = ReflectionAnswer._fromRow(row);
            return ReflectionAnswer._populate(ans, populate);
        });
    }

    static async create(data) {
        const a = new ReflectionAnswer(data);
        await a.save();
        return a;
    }

    static findOneAndUpdate(query = {}, update = {}, options = {}) {
        return new QueryBuilder(async ({ populate }) => {
            let ans = await ReflectionAnswer.findOne(query);
            if (!ans && options.upsert) {
                const connId = query.connection || (update.$setOnInsert && update.$setOnInsert.connection);
                const authId = query.author || (update.$setOnInsert && update.$setOnInsert.author);
                const qId = query.question || (update.$setOnInsert && update.$setOnInsert.question);
                ans = new ReflectionAnswer({ ...query, connection: connId, author: authId, question: qId });
            }
            if (!ans) return null;

            const setFields = update.$set ? { ...update.$set } : { ...update };
            delete setFields.$set;

            if (setFields.value !== undefined) ans.value = setFields.value;
            if (setFields.otherText !== undefined) ans.otherText = setFields.otherText;
            if (setFields.sharing !== undefined) ans.sharing = setFields.sharing;
            await ans.save();
            return ReflectionAnswer._populate(ans, populate);
        });
    }

    static async updateOne(query = {}, update = {}, options = {}) {
        return ReflectionAnswer.findOneAndUpdate(query, update, options);
    }

    static async deleteOne(query = {}) {
        const db = getDb();
        const ans = await ReflectionAnswer.findOne(query);
        if (!ans) return { deletedCount: 0 };
        const result = await db.prepare("DELETE FROM reflection_answers WHERE id = ?").run(ans.id);
        return { deletedCount: result.changes };
    }

    static async deleteMany(query = {}) {
        const db = getDb();
        if (!query || Object.keys(query).length === 0) {
            const result = await db.prepare("DELETE FROM reflection_answers").run();
            return { deletedCount: result.changes };
        }
        const { sql, params } = ReflectionAnswer._buildWhere(query);
        const result = await db.prepare(`DELETE FROM reflection_answers ${sql}`).run(...params);
        return { deletedCount: result.changes };
    }

    static async countDocuments(query = {}) {
        const db = getDb();
        const { sql, params } = ReflectionAnswer._buildWhere(query);
        const row = await db.prepare(`SELECT COUNT(*) as count FROM reflection_answers ${sql}`).get(...params);
        return row ? Number(row.count) : 0;
    }

    static async exists(query = {}) {
        const ans = await ReflectionAnswer.findOne(query);
        return ans ? { _id: ans._id } : null;
    }
}

module.exports = ReflectionAnswer;
