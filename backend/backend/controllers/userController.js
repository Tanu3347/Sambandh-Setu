const User = require("../models/User");
const Profile = require("../models/Profile");
const ApiError = require("../utils/ApiError");
const { requireObjectId } = require("../utils/validation");
const { serializeUser, serializeProfile } = require("../utils/serializers");

const getCurrentUser = async (req, res) => {
    res.json({ data: { user: serializeUser(req.user) } });
};

const getCurrentProfile = async (req, res) => {
    const profile = await Profile.findOne({ user: req.user._id }).populate(
        "user",
        "username displayName firstName lastName onboardingCompleted"
    );
    if (!profile) {
        throw ApiError.notFound("Profile not found");
    }
    res.json({ data: { profile: serializeProfile(profile) } });
};

const getProfile = async (req, res) => {
    const rawId = req.params.userId;
    const userId = rawId === "me" ? req.user._id : requireObjectId(rawId, "userId");
    const user = await User.findOne({ _id: userId, isActive: true }).select(
        "_id username displayName firstName lastName onboardingCompleted"
    );
    if (!user) {
        throw ApiError.notFound("User not found");
    }
    const profile = await Profile.findOne({ user: userId });
    if (!profile) {
        throw ApiError.notFound("Profile not found");
    }
    res.json({ data: { profile: serializeProfile(profile, user) } });
};

const completeOnboarding = async (req, res) => {
    const user = await User.findByIdAndUpdate(req.user._id, { $set: { onboardingCompleted: true } });
    res.json({ data: { user: serializeUser(user) } });
};

module.exports = { getCurrentUser, getCurrentProfile, getProfile, completeOnboarding };
