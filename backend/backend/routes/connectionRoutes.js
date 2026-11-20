const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const { listActiveConnections, getConnection } = require("../controllers/connectionController");
const {
    getJourneyForConnection,
    getStageContent,
    completeStage
} = require("../controllers/journeyController");
const {
    getReflectionQuestions,
    saveReflectionAnswer,
    getReflectionProgress
} = require("../controllers/reflectionController");

const Connection = require("../models/Connection");
const ApiError = require("../utils/ApiError");

const router = express.Router();

router.use(requireAuth);
router.get("/:connectionId/journey", getJourneyForConnection);
router.get("/:connectionId/stages/:stage", getStageContent);
router.post("/:connectionId/stages/:stage/complete", completeStage);
router.get("/:connectionId/reflect/questions", getReflectionQuestions);
router.put("/:connectionId/reflect/answers/:questionId", saveReflectionAnswer);
router.get("/:connectionId/reflect/progress", getReflectionProgress);
router.get("/", listActiveConnections);
router.put("/:connectionId/pause", async (req, res, next) => {
    try {
        const connection = await Connection.findOneAndUpdate(
            { _id: req.params.connectionId, participants: req.user._id },
            { $set: { status: "paused" } },
            { returnDocument: "after" }
        );
        if (!connection) {
            throw ApiError.notFound("Connection not found");
        }
        res.json({ data: { status: "paused" } });
    } catch (err) {
        next(err);
    }
});
router.put("/:connectionId/resume", async (req, res, next) => {
    try {
        const connection = await Connection.findOneAndUpdate(
            { _id: req.params.connectionId, participants: req.user._id },
            { $set: { status: "active" } },
            { returnDocument: "after" }
        );
        if (!connection) {
            throw ApiError.notFound("Connection not found");
        }
        res.json({ data: { status: "active" } });
    } catch (err) {
        next(err);
    }
});
router.get("/:connectionId", getConnection);

module.exports = router;
