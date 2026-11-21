
const {
    requireObjectId,
    requireString
} = require("../utils/validation");

const ApiError = require("../utils/ApiError");

const {
    getConnectionForUser,
    getMatchId
} = require("../services/connectionAccessService");

const Connection = require("../models/Connection");
const Profile = require("../models/Profile");
const guideService = require("../services/guideService");

const chatWithGuide = async (req, res) => {
    let connection = null;
    let matchId = "general";
    let stage = "connect";

    const rawConnectionId = req.body?.connectionId;
    if (rawConnectionId) {
        const connectionId = requireObjectId(
            rawConnectionId,
            "connectionId"
        );
        connection = await getConnectionForUser(
            connectionId,
            req.user._id
        );
        stage = connection.stage || "connect";
        matchId = String(getMatchId(connection, req.user._id));
    } else {
        // Fall back to finding an active connection for this user
        connection = await Connection.findOne({
            $or: [
                { participant_a: String(req.user._id) },
                { participant_b: String(req.user._id) }
            ],
            status: "active"
        });
        if (connection) {
            stage = connection.stage || "connect";
            try {
                matchId = String(getMatchId(connection, req.user._id));
            } catch {
                matchId = "general";
            }
        }
    }

    const message = requireString(
        req.body?.message,
        "message",
        { maxLength: 500, optional: true }
    );

    const allowedIntents = [
        "conversation_ideas",
        "help_me_understand",
        "next_steps",
        "privacy_safety"
    ];

    const intent = req.body?.intent;

    if (intent !== undefined && !allowedIntents.includes(intent)) {
        throw ApiError.badRequest("Invalid Guide intent");
    }

    if (!intent && !message) {
        throw ApiError.badRequest(
            "Provide either an intent or a non-empty message"
        );
    }

    // Prepare consented profile context for AI enhancement
    let context = undefined;
    try {
        const viewerProfile = await Profile.findOne({ user: req.user._id });
        let matchProfile = null;
        if (connection && matchId && matchId !== "general") {
            matchProfile = await Profile.findOne({ user: matchId });
        }
        if (viewerProfile || matchProfile) {
            context = {
                viewer: viewerProfile ? {
                    interests: viewerProfile.interests || [],
                    lifestyle: viewerProfile.lifestyle || {},
                    location: viewerProfile.location || ""
                } : {},
                match: matchProfile ? {
                    interests: matchProfile.interests || [],
                    lifestyle: matchProfile.lifestyle || {},
                    location: matchProfile.location || ""
                } : {}
            };
        }
    } catch {
        // context is optional
    }

    const result = await guideService.chat({
        user_id: String(req.user._id),
        match_id: matchId,
        stage: stage,
        ...(intent ? { intent } : {}),
        ...(message ? { message } : {}),
        ...(context ? { context } : {})
    });

    res.json({ data: result });
};

module.exports = { chatWithGuide };
