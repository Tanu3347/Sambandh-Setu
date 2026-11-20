const serializeUser = (user) => {
    if (!user) {
        return null;
    }
    const value = typeof user.toObject === "function" ? user.toObject() : user;
    const displayName = value.displayName || [value.firstName, value.lastName].filter(Boolean).join(" ") || value.username || "";
    return {
        id: String(value._id || value.id),
        username: value.username,
        firstName: value.firstName || "",
        lastName: value.lastName || "",
        displayName,
        name: displayName,
        onboardingCompleted: Boolean(value.onboardingCompleted)
    };
};

const serializeProfile = (profile, user = profile?.user) => {
    if (!profile) {
        return null;
    }
    const value = typeof profile.toObject === "function" ? profile.toObject() : profile;
    const serializedUser = serializeUser(user);
    const displayName = serializedUser?.displayName || "";
    return {
        id: String(value._id || value.id),
        user: serializedUser,
        name: displayName,
        displayName,
        age: value.age,
        gender: value.gender,
        heightCm: value.heightCm,
        height: value.heightCm ? `${value.heightCm} cm` : "",
        avatarUrl: value.avatarUrl || "",
        profileStatus: value.profileStatus,
        bio: value.bio || "",
        education: value.education || "",
        profession: value.profession || "",
        location: value.location || "",
        interests: value.interests || [],
        lifestyle: value.lifestyle || {},
        family: value.family || {},
        preferences: value.preferences || {},
        builderAnswers: value.builderAnswers || {},
        sections: value.sections || {},
        createdAt: value.createdAt,
        updatedAt: value.updatedAt
    };
};

const serializeNotification = (notification) => ({
    id: String(notification._id || notification.id),
    type: notification.type,
    actor: serializeUser(notification.actor),
    requestId: notification.request ? String(notification.request._id || notification.request) : undefined,
    connectionId: notification.connection
        ? String(notification.connection._id || notification.connection)
        : undefined,
    createdAt: notification.createdAt,
    readAt: notification.readAt || null
});

module.exports = { serializeUser, serializeProfile, serializeNotification };
