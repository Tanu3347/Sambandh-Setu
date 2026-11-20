const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const { getCurrentUser, getCurrentProfile, completeOnboarding } = require("../controllers/userController");
const { updateSharingDefault } = require("../controllers/reflectionController");
const {
    getMyPreferences,
    updateMyPreferences,
    updateMyProfile
} = require("../controllers/profileController");

const router = express.Router();

router.use(requireAuth);
router.get("/", getCurrentUser);
router.get("/profile", getCurrentProfile);
router.patch("/profile", updateMyProfile);
router.post("/onboarding/complete", completeOnboarding);
router.get("/preferences/:section", getMyPreferences);
router.patch("/preferences/:section", updateMyPreferences);
router.put("/sharing-default", updateSharingDefault);

module.exports = router;
