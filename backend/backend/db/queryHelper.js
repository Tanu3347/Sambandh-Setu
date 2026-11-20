class QueryBuilder {
    constructor(executor) {
        this._executor = executor;
        this._populateCalls = [];
        this._sortObj = null;
        this._limitNum = null;
        this._selectFields = null;
    }

    populate(path, select) {
        this._populateCalls.push({ path, select });
        return this;
    }

    sort(sortObj) {
        this._sortObj = sortObj;
        return this;
    }

    limit(num) {
        this._limitNum = num;
        return this;
    }

    select(selectFields) {
        this._selectFields = selectFields;
        return this;
    }

    lean() {
        return this;
    }

    async exec() {
        return this._executor({
            populate: this._populateCalls,
            sort: this._sortObj,
            limit: this._limitNum,
            select: this._selectFields
        });
    }

    then(resolve, reject) {
        return this.exec().then(resolve, reject);
    }

    catch(reject) {
        return this.exec().catch(reject);
    }
}

const safeJsonParse = (val, fallback = null) => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === "object") return val;
    try {
        return JSON.parse(val);
    } catch {
        return fallback;
    }
};

const buildWhere = (query, colMapper = (c) => c) => {
    const clauses = [];
    const params = [];
    if (!query || typeof query !== "object" || Object.keys(query).length === 0) {
        return { sql: "", clauses, params };
    }

    if (query.$or && Array.isArray(query.$or)) {
        const orClauses = [];
        for (const subQuery of query.$or) {
            const sub = buildWhere(subQuery, colMapper);
            if (sub.clauses.length) {
                orClauses.push(`(${sub.clauses.join(" AND ")})`);
                params.push(...sub.params);
            }
        }
        if (orClauses.length) {
            clauses.push(`(${orClauses.join(" OR ")})`);
        }
    }

    for (const [rawKey, val] of Object.entries(query)) {
        if (rawKey === "$or") continue;

        // Special case for Connection participants query
        if (rawKey === "participants") {
            const pVal = typeof val === "object" && val ? (val.id || val._id || String(val)) : String(val);
            clauses.push("(participant_a = ? OR participant_b = ?)");
            params.push(pVal, pVal);
            continue;
        }

        const col = colMapper(rawKey);

        if (val === null || val === undefined) {
            clauses.push(`${col} IS NULL`);
        } else if (val instanceof RegExp) {
            const pattern = val.source.replace(/^(\^)?(.*?)(\$)?$/, "$2");
            clauses.push(`${col} LIKE ? COLLATE NOCASE`);
            params.push(`%${pattern}%`);
        } else if (typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
            if (val.$in && Array.isArray(val.$in)) {
                if (val.$in.length === 0) {
                    clauses.push("1=0");
                } else {
                    const placeholders = val.$in.map(() => "?").join(", ");
                    clauses.push(`${col} IN (${placeholders})`);
                    params.push(...val.$in.map(v => typeof v === "object" && v ? (v.id || v._id || String(v)) : String(v)));
                }
            } else if (val.$nin && Array.isArray(val.$nin)) {
                if (val.$nin.length === 0) {
                    clauses.push("1=1");
                } else {
                    const placeholders = val.$nin.map(() => "?").join(", ");
                    clauses.push(`${col} NOT IN (${placeholders})`);
                    params.push(...val.$nin.map(v => typeof v === "object" && v ? (v.id || v._id || String(v)) : String(v)));
                }
            } else if (val.$ne !== undefined) {
                if (val.$ne === null) {
                    clauses.push(`${col} IS NOT NULL`);
                } else {
                    const neVal = typeof val.$ne === "object" && val.$ne ? (val.$ne.id || val.$ne._id || String(val.$ne)) : String(val.$ne);
                    clauses.push(`${col} != ?`);
                    params.push(neVal);
                }
            } else if (val.$gt !== undefined) {
                clauses.push(`${col} > ?`);
                params.push(val.$gt instanceof Date ? val.$gt.toISOString() : String(val.$gt));
            } else if (val.$gte !== undefined) {
                clauses.push(`${col} >= ?`);
                params.push(val.$gte instanceof Date ? val.$gte.toISOString() : String(val.$gte));
            } else if (val.$lt !== undefined) {
                clauses.push(`${col} < ?`);
                params.push(val.$lt instanceof Date ? val.$lt.toISOString() : String(val.$lt));
            } else if (val.$lte !== undefined) {
                clauses.push(`${col} <= ?`);
                params.push(val.$lte instanceof Date ? val.$lte.toISOString() : String(val.$lte));
            } else if (val.id || val._id) {
                clauses.push(`${col} = ?`);
                params.push(String(val.id || val._id));
            } else {
                clauses.push(`${col} = ?`);
                params.push(String(val));
            }
        } else {
            const v = val instanceof Date ? val.toISOString() : (typeof val === "boolean" ? (val ? 1 : 0) : String(val));
            clauses.push(`${col} = ?`);
            params.push(v);
        }
    }

    return {
        sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
        clauses,
        params
    };
};

module.exports = {
    QueryBuilder,
    safeJsonParse,
    buildWhere
};
