const express = require("express");
const router = express.Router();

const { createEvent, getWeeklyEvents, auth2callback, getGoogleEvents, getUpcomingEvents, googleAuth } = require("./controllers/events");
const { logout, emailLogin, emailSignup } = require("./controllers/auth");
const { getUsers } = require("./controllers/user");
const { authMiddleware } = require("./middleware/auth");

router.get("/health", (req, res) => {
    res.send("Ok");
});

router.post("/createEvent", authMiddleware, createEvent);

router.post("/getWeeklyEvents", authMiddleware, getWeeklyEvents);

router.get("/oauth2callback", auth2callback);

router.post("/events", authMiddleware, getGoogleEvents);

router.post("/users", authMiddleware, getUsers);

router.post("/emailLogin", emailLogin)

router.post("/emailSignup", emailSignup)

router.get("/logout", authMiddleware, logout)

router.get("/googleAuth", authMiddleware, googleAuth)

router.post("/getUpcomingEvents", authMiddleware, getUpcomingEvents);

module.exports = router;
