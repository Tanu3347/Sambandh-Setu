const express = require("express");
const requireAuth = require("../middleware/requireAuth");

const {
    requestEmailOtp,
    verifyEmailOtp,
    loginWithPassword,
    forgotPassword,
    resetPassword,
    changePassword,
    createDevelopmentSession
} = require("../controllers/authController");

const {
    otpIpRateLimiter,
    otpEmailRateLimiter
} = require("../middleware/rateLimit");

const router = express.Router();

router.post("/otp/request", otpIpRateLimiter, otpEmailRateLimiter, requestEmailOtp);
router.post("/otp/verify", otpIpRateLimiter, otpEmailRateLimiter, verifyEmailOtp);
router.post("/login", loginWithPassword);
router.post("/forgot-password", otpIpRateLimiter, otpEmailRateLimiter, forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/change-password", requireAuth, changePassword);
router.post("/dev-login", createDevelopmentSession);

module.exports = router;
