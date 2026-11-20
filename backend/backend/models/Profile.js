const { getDb, generateId } = require("../db");
const { QueryBuilder, safeJsonParse, buildWhere } = require("../db/queryHelper");
const User = require("./User");

class Profile {
    constructor(data = {}) {
        this.id = String(data.id || data._id || generateId());
        this._id = this.id;
        this.user = data.user || data.user_id || null;
        this.age = Number(data.age) || 26;
        this.gender = String(data.gender || "Not specified").trim();
        this.heightCm = data.heightCm ? Number(data.heightCm) : (data.height_cm ? Number(data.height_cm) : null);
        this.avatarUrl = data.avatarUrl || data.avatar_url || "";
        this.profileStatus = data.profileStatus || data.profile_status || "active";
        this.bio = data.bio || "";
        this.education = data.education || "";
        this.profession = data.profession || "";
        this.location = data.location || "";
        this.interests = Array.isArray(data.interests) ? data.interests : safeJsonParse(data.interests, []);
        this.lifestyle = (data.lifestyle && typeof data.lifestyle === "object") ? data.lifestyle : safeJsonParse(data.lifestyle, {});
        this.family = (data.family && typeof data.family === "object") ? data.family : safeJsonParse(data.family, {});
        this.preferences = (data.preferences && typeof data.preferences === "object") ? data.preferences : safeJsonParse(data.preferences, {});
        this.builderAnswers = (data.builderAnswers && typeof data.builderAnswers === "object") ? data.builderAnswers : (data.builder_answers ? safeJsonParse(data.builder_answers, {}) : {});
        this.sections = (data.sections && typeof data.sections === "object") ? data.sections : safeJsonParse(data.sections, {});
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    }

    markModified(field) {
        return this;
    }

    async save() {
        const db = getDb();
        this.updatedAt = new Date();
        const userId = typeof this.user === "object" && this.user ? (this.user.id || this.user._id) : this.user;
        const existing = db.prepare("SELECT id FROM profiles WHERE id = ?").get(this.id);
        if (existing) {
            db.prepare(`
                UPDATE profiles SET
                    user_id = ?, age = ?, gender = ?, height_cm = ?, avatar_url = ?,
                    profile_status = ?, bio = ?, education = ?, profession = ?, location = ?,
                    interests = ?, lifestyle = ?, family = ?, preferences = ?,
                    builder_answers = ?, sections = ?, updated_at = ?
                WHERE id = ?
            `).run(
                String(userId),
                this.age,
                this.gender,
                this.heightCm,
                this.avatarUrl,
                this.profileStatus,
                this.bio,
                this.education,
                this.profession,
                this.location,
                JSON.stringify(this.interests || []),
                JSON.stringify(this.lifestyle || {}),
                JSON.stringify(this.family || {}),
                JSON.stringify(this.preferences || {}),
                JSON.stringify(this.builderAnswers || {}),
                JSON.stringify(this.sections || {}),
                this.updatedAt.toISOString(),
                this.id
            );
        } else {
            db.prepare(`
                INSERT INTO profiles (
                    id, user_id, age, gender, height_cm, avatar_url,
                    profile_status, bio, education, profession, location,
                    interests, lifestyle, family, preferences,
                    builder_answers, sections, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                this.id,
                String(userId),
                this.age,
                this.gender,
                this.heightCm,
                this.avatarUrl,
                this.profileStatus,
                this.bio,
                this.education,
                this.profession,
                this.location,
                JSON.stringify(this.interests || []),
                JSON.stringify(this.lifestyle || {}),
                JSON.stringify(this.family || {}),
                JSON.stringify(this.preferences || {}),
                JSON.stringify(this.builderAnswers || {}),
                JSON.stringify(this.sections || {}),
                this.createdAt.toISOString(),
                this.updatedAt.toISOString()
            );
        }
        return this;
    }

    toObject() {
        return {
            ...this,
            interests: Array.isArray(this.interests) ? [...this.interests] : [],
            lifestyle: { ...(this.lifestyle || {}) },
            family: { ...(this.family || {}) },
            preferences: { ...(this.preferences || {}) },
            builderAnswers: { ...(this.builderAnswers || {}) },
            sections: { ...(this.sections || {}) }
        };
    }

    toJSON() {
        return this.toObject();
    }

    static _fromRow(row) {
        if (!row) return null;
        return new Profile({
            id: row.id,
            user_id: row.user_id,
            user: row.user_id,
            age: row.age,
            gender: row.gender,
            height_cm: row.height_cm,
            avatar_url: row.avatar_url,
            profile_status: row.profile_status,
            bio: row.bio,
            education: row.education,
            profession: row.profession,
            location: row.location,
            interests: row.interests,
            lifestyle: row.lifestyle,
            family: row.family,
            preferences: row.preferences,
            builder_answers: row.builder_answers,
            sections: row.sections,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        });
    }

    static async _populateUser(profile, popConfig) {
        if (!profile) return null;
        if (!popConfig || !popConfig.length) return profile;
        for (const pop of popConfig) {
            if (pop.path === "user") {
                const userId = typeof profile.user === "object" && profile.user ? (profile.user.id || profile.user._id) : profile.user;
                if (userId) {
                    const u = await User.findById(userId);
                    if (u) profile.user = u;
                }
            }
        }
        return profile;
    }

    static _col(field) {
        const map = {
            id: "id", _id: "id", user: "user_id", userId: "user_id",
            age: "age", gender: "gender", heightCm: "height_cm",
            avatarUrl: "avatar_url", profileStatus: "profile_status",
            bio: "bio", education: "education", profession: "profession",
            location: "location", createdAt: "created_at", updatedAt: "updated_at"
        };
        return map[field] || field;
    }

    static _buildWhere(query) {
        return buildWhere(query, Profile._col);
    }

    static findOne(query = {}) {
        return new QueryBuilder(async ({ populate }) => {
            const db = getDb();
            const { sql, params } = Profile._buildWhere(query);
            const row = db.prepare(`SELECT * FROM profiles ${sql} LIMIT 1`).get(...params);
            const profile = Profile._fromRow(row);
            return Profile._populateUser(profile, populate);
        });
    }

    static findById(id) {
        return new QueryBuilder(async ({ populate }) => {
            if (!id) return null;
            const db = getDb();
            const row = db.prepare("SELECT * FROM profiles WHERE id = ?").get(String(id));
            const profile = Profile._fromRow(row);
            return Profile._populateUser(profile, populate);
        });
    }

    static find(query = {}) {
        return new QueryBuilder(async ({ populate, sort, limit }) => {
            const db = getDb();
            const { sql, params } = Profile._buildWhere(query);
            let querySql = `SELECT * FROM profiles ${sql}`;
            if (sort) {
                const sortClauses = Object.entries(sort).map(([k, dir]) => `${Profile._col(k)} ${dir === -1 ? "DESC" : "ASC"}`);
                if (sortClauses.length) querySql += ` ORDER BY ${sortClauses.join(", ")}`;
            }
            if (limit) querySql += ` LIMIT ${Number(limit)}`;
            const rows = db.prepare(querySql).all(...params);
            const profiles = rows.map(r => Profile._fromRow(r));
            for (const p of profiles) {
                await Profile._populateUser(p, populate);
            }
            return profiles;
        });
    }

    static async create(data) {
        const profile = new Profile(data);
        await profile.save();
        return profile;
    }

    static findOneAndUpdate(query = {}, update = {}, options = {}) {
        return new QueryBuilder(async ({ populate }) => {
            let profile = await Profile.findOne(query);
            if (!profile && options.upsert) {
                const userVal = query.user || (update.$set && update.$set.user) || update.user;
                profile = new Profile({ ...query, user: userVal });
            }
            if (!profile) return null;

            const setFields = update.$set ? { ...update.$set } : { ...update };
            delete setFields.$set;

            for (const [k, v] of Object.entries(setFields)) {
                if (k === "user") profile.user = v;
                else if (k === "age") profile.age = Number(v);
                else if (k === "gender") profile.gender = String(v).trim();
                else if (k === "heightCm") profile.heightCm = Number(v);
                else if (k === "avatarUrl") profile.avatarUrl = String(v);
                else if (k === "profileStatus") profile.profileStatus = String(v);
                else if (k === "bio") profile.bio = String(v);
                else if (k === "education") profile.education = String(v);
                else if (k === "profession") profile.profession = String(v);
                else if (k === "location") profile.location = String(v);
                else if (k === "interests") profile.interests = Array.isArray(v) ? v : [];
                else if (k === "lifestyle") profile.lifestyle = { ...(profile.lifestyle || {}), ...(v || {}) };
                else if (k === "family") profile.family = { ...(profile.family || {}), ...(v || {}) };
                else if (k === "preferences") profile.preferences = { ...(profile.preferences || {}), ...(v || {}) };
                else if (k === "builderAnswers") profile.builderAnswers = { ...(profile.builderAnswers || {}), ...(v || {}) };
                else if (k === "sections") profile.sections = { ...(profile.sections || {}), ...(v || {}) };
            }

            await profile.save();
            return Profile._populateUser(profile, populate);
        });
    }

    static async updateOne(query = {}, update = {}, options = {}) {
        return Profile.findOneAndUpdate(query, update, options);
    }

    static async replaceOne(query = {}, doc = {}) {
        let profile = await Profile.findOne(query);
        if (!profile) return { matchedCount: 0, modifiedCount: 0 };
        const id = profile.id;
        const newProfile = new Profile({ ...doc, id, _id: id });
        await newProfile.save();
        return { matchedCount: 1, modifiedCount: 1 };
    }

    static async deleteOne(query = {}) {
        const db = getDb();
        const profile = await Profile.findOne(query);
        if (!profile) return { deletedCount: 0 };
        const result = db.prepare("DELETE FROM profiles WHERE id = ?").run(profile.id);
        return { deletedCount: result.changes };
    }

    static async deleteMany(query = {}) {
        const db = getDb();
        if (!query || Object.keys(query).length === 0) {
            const result = db.prepare("DELETE FROM profiles").run();
            return { deletedCount: result.changes };
        }
        const { sql, params } = Profile._buildWhere(query);
        const result = db.prepare(`DELETE FROM profiles ${sql}`).run(...params);
        return { deletedCount: result.changes };
    }

    static async countDocuments(query = {}) {
        const db = getDb();
        const { sql, params } = Profile._buildWhere(query);
        const row = db.prepare(`SELECT COUNT(*) as count FROM profiles ${sql}`).get(...params);
        return row ? row.count : 0;
    }

    static async exists(query = {}) {
        const profile = await Profile.findOne(query);
        return profile ? { _id: profile._id } : null;
    }
}

module.exports = Profile;
