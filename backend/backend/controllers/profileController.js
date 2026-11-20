const Profile = require("../models/Profile");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const { serializeProfile } = require("../utils/serializers");

const PROFILE_FIELDS = new Set([
    "name",
    "displayName",
    "age",
    "dob",
    "gender",
    "heightCm",
    "height",
    "avatarUrl",
    "profileStatus",
    "bio",
    "education",
    "profession",
    "location",
    "interests",
    "lifestyle",
    "family",
    "preferences",
    "builderAnswers",
    "sections"
]);
const PREFERENCE_SECTIONS = new Set([
    "basic",
    "lifestyle",
    "family",
    "valuesOutlook",
    "additional"
]);

const isPlainObject = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const validateText = (value, field, maxLength, { allowEmpty = true } = {}) => {
    if (
        typeof value !== "string" ||
        value.length > maxLength ||
        (!allowEmpty && !value.trim())
    ) {
        throw ApiError.badRequest(`${field} must be a string of at most ${maxLength} characters`, [
            { field }
        ]);
    }
    return value.trim();
};

const validateStringList = (value, field, { maxItems = 30, maxLength = 80 } = {}) => {
    if (!Array.isArray(value) || value.length > maxItems) {
        throw ApiError.badRequest(`${field} must be an array of at most ${maxItems} items`, [
            { field }
        ]);
    }
    return value.map((item, index) => validateText(item, `${field}.${index}`, maxLength, {
        allowEmpty: false
    }));
};

const validateNestedProfile = (value, field, allowedFields) => {
    if (!isPlainObject(value)) {
        throw ApiError.badRequest(`${field} must be an object`, [{ field }]);
    }
    for (const key of Object.keys(value)) {
        if (allowedFields && allowedFields.size > 0 && !allowedFields.has(key)) {
            throw ApiError.badRequest(`Unsupported ${field} field: ${key}`, [{ field: `${field}.${key}` }]);
        }
    }

    const result = {};
    for (const [key, item] of Object.entries(value)) {
        const path = `${field}.${key}`;
        if (key === "interests" || Array.isArray(item)) {
            result[key] = validateStringList(item, path);
        } else if (typeof item === "string") {
            result[key] = validateText(item, path, 500);
        } else if (typeof item === "number" || typeof item === "boolean") {
            result[key] = item;
        } else if (isPlainObject(item)) {
            result[key] = item;
        }
    }
    return result;
};

const validateProfilePatch = (body) => {
    if (!isPlainObject(body) || Object.keys(body).length === 0) {
        throw ApiError.badRequest("A non-empty profile update object is required");
    }

    const result = {};
    for (const [field, value] of Object.entries(body)) {
        if (!PROFILE_FIELDS.has(field)) {
            throw ApiError.badRequest(`Unsupported profile field: ${field}`, [{ field }]);
        }
        switch (field) {
            case "name":
            case "displayName":
                result[field] = validateText(value, field, 120, { allowEmpty: false });
                break;
            case "dob":
                result[field] = validateText(value, field, 20);
                break;
            case "height":
                if (typeof value === "number") {
                    result[field] = value;
                } else if (typeof value === "string") {
                    result[field] = validateText(value, field, 30);
                } else {
                    throw ApiError.badRequest("height must be a string or number", [{ field }]);
                }
                break;
            case "age":
                if (!Number.isInteger(value) || value < 18 || value > 100) {
                    throw ApiError.badRequest("age must be an integer between 18 and 100", [{ field }]);
                }
                result[field] = value;
                break;
            case "heightCm":
                if (typeof value !== "number" || !Number.isFinite(value) || value < 100 || value > 250) {
                    throw ApiError.badRequest("heightCm must be a number between 100 and 250", [{ field }]);
                }
                result[field] = value;
                break;
            case "gender":
                result[field] = validateText(value, field, 40, { allowEmpty: false });
                break;
            case "avatarUrl":
                result[field] = validateText(value, field, 500);
                break;
            case "profileStatus":
                if (!["active", "paused"].includes(value)) {
                    throw ApiError.badRequest("profileStatus must be active or paused", [{ field }]);
                }
                result[field] = value;
                break;
            case "bio":
                result[field] = validateText(value, field, 500);
                break;
            case "education":
            case "profession":
            case "location":
                result[field] = validateText(value, field, 120);
                break;
            case "interests":
                result[field] = validateStringList(value, field);
                break;
            case "lifestyle":
                result[field] = validateNestedProfile(value, field, new Set([
                    "routine", "interests", "description", "livingPref", "careerGrowth",
                    "hobbies", "food", "travel", "music", "movies", "fitness", "values"
                ]));
                break;
            case "family":
                result[field] = validateNestedProfile(value, field, new Set([
                    "background", "involvement", "father", "mother", "familyType",
                    "siblings", "familyValues", "religion", "caste", "known", "comfortable", "meeting"
                ]));
                break;
            case "preferences":
            case "builderAnswers":
            case "sections":
                if (!isPlainObject(value)) {
                    throw ApiError.badRequest(`${field} must be an object`, [{ field }]);
                }
                result[field] = value;
                break;
            default:
                throw ApiError.badRequest(`Unsupported profile field: ${field}`, [{ field }]);
        }
    }
    return result;
};

const validatePreferenceObject = (value, field, depth = 0) => {
    if (!isPlainObject(value) || depth > 4) {
        throw ApiError.badRequest(`${field} must be a JSON object no more than four levels deep`, [
            { field }
        ]);
    }
    const result = {};
    for (const [key, item] of Object.entries(value)) {
        if (
            !key ||
            key.length > 80 ||
            key.startsWith("$") ||
            key.includes(".") ||
            ["__proto__", "prototype", "constructor"].includes(key)
        ) {
            throw ApiError.badRequest(`${field} contains an unsupported field name`, [
                { field: `${field}.${key}` }
            ]);
        }
        const path = `${field}.${key}`;
        if (typeof item === "string") {
            result[key] = validateText(item, path, 500);
        } else if (typeof item === "number" && Number.isFinite(item)) {
            result[key] = item;
        } else if (typeof item === "boolean" || item === null) {
            result[key] = item;
        } else if (Array.isArray(item)) {
            if (item.length > 50) {
                throw ApiError.badRequest(`${path} may contain at most 50 items`, [{ field: path }]);
            }
            result[key] = item.map((entry, index) => {
                const entryPath = `${path}.${index}`;
                if (typeof entry === "string") {
                    return validateText(entry, entryPath, 500);
                }
                if (typeof entry === "number" && Number.isFinite(entry)) {
                    return entry;
                }
                if (typeof entry === "boolean" || entry === null) {
                    return entry;
                }
                if (isPlainObject(entry)) {
                    return validatePreferenceObject(entry, entryPath, depth + 1);
                }
                throw ApiError.badRequest(`${entryPath} has an unsupported value`, [{ field: entryPath }]);
            });
        } else if (isPlainObject(item)) {
            result[key] = validatePreferenceObject(item, path, depth + 1);
        } else {
            throw ApiError.badRequest(`${path} has an unsupported value`, [{ field: path }]);
        }
    }
    return result;
};

const mergePreferenceObjects = (current, update) => {
    const merged = { ...current };
    for (const [key, value] of Object.entries(update)) {
        merged[key] =
            isPlainObject(value) && isPlainObject(current[key])
                ? mergePreferenceObjects(current[key], value)
                : value;
    }
    return merged;
};

const getMyPreferences = async (req, res) => {
    const { section } = req.params;
    if (!PREFERENCE_SECTIONS.has(section)) {
        throw ApiError.badRequest("Unsupported preference section", [{ field: "section" }]);
    }
    const profile = await Profile.findOne({ user: req.user._id }).select(`preferences.${section}`);
    if (!profile) {
        throw ApiError.notFound("Profile not found");
    }
    res.json({ data: { section, preferences: profile.preferences?.[section] || {} } });
};

const updateMyProfile = async (req, res) => {
    const updates = validateProfilePatch(req.body);
    let userUpdated = false;
    const userUpdates = {};

    const newName = updates.displayName || updates.name;
    if (newName) {
        const trimmedName = newName.trim();
        const parts = trimmedName.split(/\s+/);
        userUpdates.displayName = trimmedName;
        userUpdates.firstName = parts[0] || trimmedName;
        userUpdates.lastName = parts.slice(1).join(" ") || "";
        userUpdates.onboardingCompleted = true;
        userUpdated = true;
        delete updates.name;
        delete updates.displayName;
    }

    if (userUpdated) {
        await User.findByIdAndUpdate(req.user._id, { $set: userUpdates });
    }

    if (updates.height && !updates.heightCm) {
        const parsed = parseInt(String(updates.height), 10);
        if (parsed >= 100 && parsed <= 250) {
            updates.heightCm = parsed;
        }
        delete updates.height;
    } else if (updates.height) {
        delete updates.height;
    }

    if (updates.dob) {
        if (!updates.age) {
            const m = String(updates.dob).match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
            if (m) {
                const y = Number(m[3]);
                const calcAge = new Date().getFullYear() - y;
                if (calcAge >= 18 && calcAge <= 100) {
                    updates.age = calcAge;
                }
            }
        }
        delete updates.dob;
    }

    let profile;
    if (Object.keys(updates).length > 0) {
        profile = await Profile.findOneAndUpdate(
            { user: req.user._id },
            { $set: updates },
            { returnDocument: "after", runValidators: true }
        ).populate("user", "username displayName firstName lastName onboardingCompleted");
    } else {
        profile = await Profile.findOne({ user: req.user._id })
            .populate("user", "username displayName firstName lastName onboardingCompleted");
    }

    if (!profile) {
        throw ApiError.notFound("Profile not found");
    }
    res.json({ data: { profile: serializeProfile(profile) } });
};

const updateMyPreferences = async (req, res) => {
    const { section } = req.params;
    if (!PREFERENCE_SECTIONS.has(section)) {
        throw ApiError.badRequest("Unsupported preference section", [{ field: "section" }]);
    }
    const updates = validatePreferenceObject(req.body, section);
    if (Object.keys(updates).length === 0) {
        throw ApiError.badRequest("A non-empty preferences update object is required");
    }

    const profile = await Profile.findOne({ user: req.user._id });
    if (!profile) {
        throw ApiError.notFound("Profile not found");
    }
    profile.preferences[section] = mergePreferenceObjects(
        isPlainObject(profile.preferences?.[section]) ? profile.preferences[section] : {},
        updates
    );
    profile.markModified(`preferences.${section}`);
    await profile.save();
    res.json({ data: { section, preferences: profile.preferences[section] } });
};

module.exports = {
    getMyPreferences,
    updateMyPreferences,
    updateMyProfile,
    validatePreferenceObject,
    validateProfilePatch
};
