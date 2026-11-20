const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Profile = require("../models/Profile");
const ApiError = require("../utils/ApiError");
const { requireString } = require("../utils/validation");
const { requestOtp, verifyOtp } = require("../services/otpService");

const OTP_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => {
    const email = requireString(value, "email", { maxLength: 254 }).toLowerCase();

    if (!OTP_EMAIL_REGEX.test(email)) {
        throw ApiError.badRequest("Please provide a valid email address");
    }

    return email;
};

const createToken = (user) => {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new ApiError(
            500,
            "SERVER_CONFIGURATION_ERROR",
            "Authentication is not configured"
        );
    }

    return jwt.sign({}, process.env.JWT_SECRET, {
        subject: String(user._id),
        expiresIn: "7d",
        algorithm: "HS256",
        issuer: "sambandh-setu",
        audience: "sambandh-setu-api"
    });
};

const requestEmailOtp = async (req, res) => {
    const email = normalizeEmail(req.body?.email);

    const code = await requestOtp(email);

    // Same response whether the email belongs to an existing user or not.
    res.status(200).json({
        message: "If the email can receive a code, an OTP will be sent.",
        expiresInSeconds: 600,
        resendAfterSeconds: 30,
        ...(process.env.NODE_ENV === "development" ? { code } : {})
    });
};

const verifyEmailOtp = async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = requireString(req.body?.code, "code", { maxLength: 6 });
    const password = req.body?.password;

    if (!/^\d{6}$/.test(code)) {
        throw ApiError.badRequest("OTP must contain exactly 6 digits");
    }

    const result = await verifyOtp(email, code);

    if (!result.valid) {
        if (result.reason === "OTP_LOCKED") {
            res.set("Retry-After", "600");

            throw new ApiError(
                429,
                "OTP_LOCKED",
                "Too many incorrect attempts. Request a new OTP after the lock period.",
                [{ retryAfterSeconds: 600 }]
            );
        }

        throw new ApiError(
            400,
            "INVALID_OTP",
            "The OTP is invalid or has expired"
        );
    }

    let user = await User.findOne({ email }).select("+email +passwordHash");

    let isNewUser = false;

    if (!user) {
        isNewUser = true;

        // Temporary username until the user chooses one during onboarding.
        const username = `user_${crypto.randomBytes(8).toString("hex")}`;

        user = new User({
            email,
            username,
            firstName: "",
            lastName: "",
            onboardingCompleted: false,
            isSeeded: false
        });

        if (password && typeof password === "string" && password.length >= 8) {
            await user.setPassword(password);
        }

        await user.save();

        await Profile.create({
            user: user._id,
            age: 26,
            gender: "Not specified",
            profileStatus: "active"
        });
    } else if (password && typeof password === "string" && password.length >= 8) {
        await user.setPassword(password);
        await user.save();
    }

    if (!user.isActive) {
        throw ApiError.forbidden("This account is inactive");
    }

    const token = createToken(user);
    const profile = await Profile.findOne({ user: user._id });

    const payload = {
        token,
        isNewUser,
        user: {
            id: String(user._id),
            name: user.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username,
            avatar: profile?.avatarUrl || undefined,
            onboardingCompleted: Boolean(user.onboardingCompleted)
        }
    };

    res.status(200).json({
        data: payload,
        ...payload
    });
};

const loginWithPassword = async (req, res) => {
    const rawId = req.body?.identifier || req.body?.email || req.body?.username;
    const identifier = requireString(rawId, "identifier", { maxLength: 254 }).trim();
    const password = requireString(req.body?.password, "password", { maxLength: 128 });

    const user = await User.findOne({
        $or: [
            { email: identifier.toLowerCase() },
            { username: identifier.toLowerCase() }
        ]
    }).select("+passwordHash +email +isSeeded");

    if (!user || !user.isActive) {
        throw ApiError.unauthorized("Incorrect email or password");
    }

    if (!user.passwordHash) {
        throw ApiError.badRequest("No password set for this account. Please log in with OTP or reset your password.");
    }

    const matches = await user.comparePassword(password);
    if (!matches) {
        throw ApiError.unauthorized("Incorrect email or password");
    }

    const token = createToken(user);
    const profile = await Profile.findOne({ user: user._id });

    const payload = {
        token,
        user: {
            id: String(user._id),
            name: user.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username,
            avatar: profile?.avatarUrl || undefined,
            onboardingCompleted: Boolean(user.onboardingCompleted)
        }
    };

    res.status(200).json({
        data: payload,
        ...payload
    });
};

const forgotPassword = async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = await requestOtp(email);

    res.status(200).json({
        message: "If the email can receive a code, an OTP will be sent.",
        expiresInSeconds: 600,
        resendAfterSeconds: 30,
        ...(process.env.NODE_ENV === "development" ? { code } : {})
    });
};

const resetPassword = async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = requireString(req.body?.code, "code", { maxLength: 6 });
    const newPassword = requireString(req.body?.newPassword || req.body?.password, "newPassword", { maxLength: 128 });

    if (newPassword.length < 8) {
        throw ApiError.badRequest("Password must contain at least 8 characters");
    }

    const result = await verifyOtp(email, code);
    if (!result.valid) {
        throw ApiError.badRequest("Invalid or expired reset code");
    }

    const user = await User.findOne({ email }).select("+passwordHash +email");
    if (!user) {
        throw ApiError.notFound("User not found");
    }

    await user.setPassword(newPassword);
    await user.save();

    const token = createToken(user);
    const profile = await Profile.findOne({ user: user._id });

    const payload = {
        token,
        message: "Password reset successfully",
        user: {
            id: String(user._id),
            name: user.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username,
            avatar: profile?.avatarUrl || undefined,
            onboardingCompleted: Boolean(user.onboardingCompleted)
        }
    };

    res.status(200).json({
        data: payload,
        ...payload
    });
};

const changePassword = async (req, res) => {
    const currentPassword = requireString(req.body?.currentPassword, "currentPassword", { maxLength: 128 });
    const newPassword = requireString(req.body?.newPassword, "newPassword", { maxLength: 128 });

    if (newPassword.length < 8) {
        throw ApiError.badRequest("New password must contain at least 8 characters");
    }

    const user = await User.findById(req.user._id).select("+passwordHash");
    if (!user) {
        throw ApiError.notFound("User not found");
    }

    if (user.passwordHash) {
        const matches = await user.comparePassword(currentPassword);
        if (!matches) {
            throw ApiError.badRequest("Current password is incorrect");
        }
    }

    await user.setPassword(newPassword);
    await user.save();

    res.status(200).json({
        data: { message: "Password updated successfully" },
        message: "Password updated successfully"
    });
};

// Existing development login — preserved.
const createDevelopmentSession = async (req, res) => {
    if (process.env.NODE_ENV !== "development") {
        throw ApiError.forbidden(
            "Development login is only available when NODE_ENV=development"
        );
    }

    const username = req.body?.username === undefined
        ? "aanya"
        : requireString(req.body.username, "username", {
            maxLength: 50
        }).toLowerCase();

    const user = await User.findOne({
        username,
        isSeeded: true
    }).select("+isSeeded");

    if (!user || !user.isActive) {
        throw ApiError.notFound("Seeded user not found");
    }

    const token = createToken(user);

    res.json({
        data: {
            token,
            user: require("../utils/serializers").serializeUser(user)
        }
    });
};

module.exports = {
    requestEmailOtp,
    verifyEmailOtp,
    loginWithPassword,
    forgotPassword,
    resetPassword,
    changePassword,
    createDevelopmentSession
};
