const { getDb, generateId } = require("../db");
const { QueryBuilder, safeJsonParse, buildWhere } = require("../db/queryHelper");

class StageContent {
    constructor(data = {}) {
        this.id = String(data.id || data._id || generateId());
        this._id = this.id;
        this.stage = String(data.stage || "").trim();
        this.guidance = Array.isArray(data.guidance) ? data.guidance : safeJsonParse(data.guidance, []);
        this.forYou = Array.isArray(data.forYou) ? data.forYou : safeJsonParse(data.for_you || data.forYou, []);
        this.activities = Array.isArray(data.activities) ? data.activities : safeJsonParse(data.activities, []);
        this.resources = Array.isArray(data.resources) ? data.resources : safeJsonParse(data.resources, []);
        this.isMock = data.isMock !== undefined ? Boolean(data.isMock) : (data.is_mock !== undefined ? Boolean(data.is_mock) : true);
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    }

    async save() {
        const db = getDb();
        this.updatedAt = new Date();
        const existing = db.prepare("SELECT id FROM stage_contents WHERE id = ? OR stage = ?").get(this.id, this.stage);
        if (existing) {
            this.id = existing.id;
            this._id = this.id;
            db.prepare(`
                UPDATE stage_contents SET
                    stage = ?, guidance = ?, for_you = ?, activities = ?,
                    resources = ?, is_mock = ?, updated_at = ?
                WHERE id = ?
            `).run(
                this.stage,
                JSON.stringify(this.guidance || []),
                JSON.stringify(this.forYou || []),
                JSON.stringify(this.activities || []),
                JSON.stringify(this.resources || []),
                this.isMock ? 1 : 0,
                this.updatedAt.toISOString(),
                this.id
            );
        } else {
            db.prepare(`
                INSERT INTO stage_contents (
                    id, stage, guidance, for_you, activities,
                    resources, is_mock, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                this.id,
                this.stage,
                JSON.stringify(this.guidance || []),
                JSON.stringify(this.forYou || []),
                JSON.stringify(this.activities || []),
                JSON.stringify(this.resources || []),
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
            stage: this.stage,
            guidance: this.guidance,
            forYou: this.forYou,
            activities: this.activities,
            resources: this.resources,
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
        return new StageContent({
            id: row.id,
            stage: row.stage,
            guidance: row.guidance,
            for_you: row.for_you,
            activities: row.activities,
            resources: row.resources,
            is_mock: Boolean(row.is_mock),
            createdAt: row.created_at,
            updatedAt: row.updated_at
        });
    }

    static _col(field) {
        const map = {
            id: "id", _id: "id", stage: "stage", isMock: "is_mock", is_mock: "is_mock",
            createdAt: "created_at", updatedAt: "updated_at"
        };
        return map[field] || field;
    }

    static _buildWhere(query) {
        return buildWhere(query, StageContent._col);
    }

    static findOne(query = {}) {
        return new QueryBuilder(async () => {
            const db = getDb();
            const { sql, params } = StageContent._buildWhere(query);
            const row = db.prepare(`SELECT * FROM stage_contents ${sql} LIMIT 1`).get(...params);
            return StageContent._fromRow(row);
        });
    }

    static findById(id) {
        return StageContent.findOne({ id });
    }

    static find(query = {}) {
        return new QueryBuilder(async () => {
            const db = getDb();
            const { sql, params } = StageContent._buildWhere(query);
            const rows = db.prepare(`SELECT * FROM stage_contents ${sql}`).all(...params);
            return rows.map(r => StageContent._fromRow(r));
        });
    }

    static async insertMany(docs = []) {
        const results = [];
        for (const doc of docs) {
            const item = new StageContent(doc);
            await item.save();
            results.push(item);
        }
        return results;
    }

    static async bulkWrite(ops = []) {
        for (const op of ops) {
            if (op.updateOne) {
                const { filter, update } = op.updateOne;
                const content = update.$set || update;
                const stage = filter.stage || content.stage;
                const item = new StageContent({ ...content, stage });
                await item.save();
            }
        }
    }

    static async create(data) {
        const sc = new StageContent(data);
        await sc.save();
        return sc;
    }

    static async deleteOne(query = {}) {
        const db = getDb();
        const sc = await StageContent.findOne(query);
        if (!sc) return { deletedCount: 0 };
        const result = db.prepare("DELETE FROM stage_contents WHERE id = ?").run(sc.id);
        return { deletedCount: result.changes };
    }

    static async deleteMany(query = {}) {
        const db = getDb();
        if (!query || Object.keys(query).length === 0) {
            const result = db.prepare("DELETE FROM stage_contents").run();
            return { deletedCount: result.changes };
        }
        const { sql, params } = StageContent._buildWhere(query);
        const result = db.prepare(`DELETE FROM stage_contents ${sql}`).run(...params);
        return { deletedCount: result.changes };
    }

    static async countDocuments(query = {}) {
        const db = getDb();
        const { sql, params } = StageContent._buildWhere(query);
        const row = db.prepare(`SELECT COUNT(*) as count FROM stage_contents ${sql}`).get(...params);
        return row ? row.count : 0;
    }

    static async exists(query = {}) {
        const sc = await StageContent.findOne(query);
        return sc ? { _id: sc._id } : null;
    }
}

module.exports = StageContent;
