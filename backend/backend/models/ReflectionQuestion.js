const { getDb, generateId } = require("../db");
const { QueryBuilder, safeJsonParse, buildWhere } = require("../db/queryHelper");

class ReflectionQuestion {
    constructor(data = {}) {
        this.id = String(data.id || data._id || generateId());
        this._id = this.id;
        this.key = String(data.key || "");
        this.order = Number(data.order !== undefined ? data.order : data.order_num) || 1;
        this.category = String(data.category || "");
        this.prompt = String(data.prompt || "");
        this.type = String(data.type || "single_select");
        this.options = Array.isArray(data.options) ? data.options : safeJsonParse(data.options, []);
        this.minSelections = data.minSelections !== undefined ? Number(data.minSelections) : null;
        this.maxSelections = data.maxSelections !== undefined ? Number(data.maxSelections) : null;
        this.allowOther = Boolean(data.allowOther || data.allow_other);
        this.otherTextMaxLength = Number(data.otherTextMaxLength || data.other_text_max_length) || 100;
        this.minRating = Number(data.minRating || data.min_rating) || 1;
        this.maxRating = Number(data.maxRating || data.max_rating) || 5;
        this.maxLength = Number(data.maxLength || data.max_length) || 500;
        this.isMock = data.isMock !== undefined ? Boolean(data.isMock) : (data.is_mock !== undefined ? Boolean(data.is_mock) : true);
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    }

    async save() {
        const db = getDb();
        this.updatedAt = new Date();
        const existing = db.prepare("SELECT id FROM reflection_questions WHERE id = ? OR key = ?").get(this.id, this.key);
        if (existing) {
            this.id = existing.id;
            this._id = this.id;
            db.prepare(`
                UPDATE reflection_questions SET
                    key = ?, order_num = ?, category = ?, prompt = ?, type = ?,
                    options = ?, min_selections = ?, max_selections = ?, allow_other = ?,
                    other_text_max_length = ?, min_rating = ?, max_rating = ?,
                    max_length = ?, is_mock = ?, updated_at = ?
                WHERE id = ?
            `).run(
                this.key,
                this.order,
                this.category,
                this.prompt,
                this.type,
                JSON.stringify(this.options || []),
                this.minSelections,
                this.maxSelections,
                this.allowOther ? 1 : 0,
                this.otherTextMaxLength,
                this.minRating,
                this.maxRating,
                this.maxLength,
                this.isMock ? 1 : 0,
                this.updatedAt.toISOString(),
                this.id
            );
        } else {
            db.prepare(`
                INSERT INTO reflection_questions (
                    id, key, order_num, category, prompt, type,
                    options, min_selections, max_selections, allow_other,
                    other_text_max_length, min_rating, max_rating, max_length,
                    is_mock, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                this.id,
                this.key,
                this.order,
                this.category,
                this.prompt,
                this.type,
                JSON.stringify(this.options || []),
                this.minSelections,
                this.maxSelections,
                this.allowOther ? 1 : 0,
                this.otherTextMaxLength,
                this.minRating,
                this.maxRating,
                this.maxLength,
                this.isMock ? 1 : 0,
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
            key: this.key,
            order: this.order,
            category: this.category,
            prompt: this.prompt,
            type: this.type,
            options: this.options,
            minSelections: this.minSelections,
            maxSelections: this.maxSelections,
            allowOther: this.allowOther,
            otherTextMaxLength: this.otherTextMaxLength,
            minRating: this.minRating,
            maxRating: this.maxRating,
            maxLength: this.maxLength,
            isMock: this.isMock,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    toJSON() {
        return this.toObject();
    }

    static _fromRow(row) {
        if (!row) return null;
        return new ReflectionQuestion({
            id: row.id,
            key: row.key,
            order: row.order_num,
            category: row.category,
            prompt: row.prompt,
            type: row.type,
            options: row.options,
            minSelections: row.min_selections,
            maxSelections: row.max_selections,
            allowOther: Boolean(row.allow_other),
            otherTextMaxLength: row.other_text_max_length,
            minRating: row.min_rating,
            maxRating: row.max_rating,
            maxLength: row.max_length,
            isMock: Boolean(row.is_mock),
            createdAt: row.created_at,
            updatedAt: row.updated_at
        });
    }

    static _col(field) {
        const map = {
            id: "id", _id: "id", key: "key", order: "order_num", orderNum: "order_num",
            category: "category", prompt: "prompt", type: "type",
            isMock: "is_mock", is_mock: "is_mock",
            createdAt: "created_at", updatedAt: "updated_at"
        };
        return map[field] || field;
    }

    static _buildWhere(query) {
        return buildWhere(query, ReflectionQuestion._col);
    }

    static find(query = {}) {
        return new QueryBuilder(async ({ sort }) => {
            const db = getDb();
            const { sql, params } = ReflectionQuestion._buildWhere(query);
            let querySql = `SELECT * FROM reflection_questions ${sql}`;
            if (sort && (sort.order !== undefined || sort.order_num !== undefined)) {
                const dir = (sort.order || sort.order_num) === -1 ? "DESC" : "ASC";
                querySql += ` ORDER BY order_num ${dir}`;
            } else {
                querySql += " ORDER BY order_num ASC";
            }
            const rows = db.prepare(querySql).all(...params);
            return rows.map(r => ReflectionQuestion._fromRow(r));
        });
    }

    static findOne(query = {}) {
        return new QueryBuilder(async () => {
            const db = getDb();
            const { sql, params } = ReflectionQuestion._buildWhere(query);
            const row = db.prepare(`SELECT * FROM reflection_questions ${sql} LIMIT 1`).get(...params);
            return ReflectionQuestion._fromRow(row);
        });
    }

    static findById(id) {
        return ReflectionQuestion.findOne({ id });
    }

    static async insertMany(docs = []) {
        const results = [];
        for (const doc of docs) {
            const item = new ReflectionQuestion(doc);
            await item.save();
            results.push(item);
        }
        return results;
    }

    static async bulkWrite(ops = []) {
        for (const op of ops) {
            if (op.updateOne) {
                const { filter, update } = op.updateOne;
                const question = update.$set || update;
                const key = filter.key || question.key;
                const item = new ReflectionQuestion({ ...question, key });
                await item.save();
            }
        }
    }

    static async create(data) {
        const q = new ReflectionQuestion(data);
        await q.save();
        return q;
    }

    static async deleteOne(query = {}) {
        const db = getDb();
        const q = await ReflectionQuestion.findOne(query);
        if (!q) return { deletedCount: 0 };
        const result = db.prepare("DELETE FROM reflection_questions WHERE id = ?").run(q.id);
        return { deletedCount: result.changes };
    }

    static async deleteMany(query = {}) {
        const db = getDb();
        if (!query || Object.keys(query).length === 0) {
            const result = db.prepare("DELETE FROM reflection_questions").run();
            return { deletedCount: result.changes };
        }
        const { sql, params } = ReflectionQuestion._buildWhere(query);
        const result = db.prepare(`DELETE FROM reflection_questions ${sql}`).run(...params);
        return { deletedCount: result.changes };
    }

    static async countDocuments(query = {}) {
        const db = getDb();
        const { sql, params } = ReflectionQuestion._buildWhere(query);
        const row = db.prepare(`SELECT COUNT(*) as count FROM reflection_questions ${sql}`).get(...params);
        return row ? row.count : 0;
    }

    static async exists(query = {}) {
        const q = await ReflectionQuestion.findOne(query);
        return q ? { _id: q._id } : null;
    }
}

module.exports = ReflectionQuestion;
