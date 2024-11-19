const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { connectDB } = require('./db');
const { authMiddleware } = require("./middleware/auth");
const cookieParser = require("cookie-parser");
const error = require('./middleware/error');
const { createEvent, getWeeklyEvents, auth2callback, getGoogleEvents, getUpcomingEvents, googleAuth } = require("./controllers/events");
const { logout, emailLogin, emailSignup } = require("./controllers/auth");
const { getUsers } = require("./controllers/user");

const app = express();
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
}))
app.use(express.json());
app.use(cookieParser());
connectDB();

app.get("/health", (req, res) => {
    res.send("Ok");
});

app.post("/createEvent", authMiddleware,createEvent);

app.post("/getWeeklyEvents", authMiddleware, getWeeklyEvents);

app.get("/oauth2callback", auth2callback);

app.post("/events", authMiddleware, getGoogleEvents);

app.post("/users", authMiddleware, getUsers);

app.post("/emailLogin", emailLogin)

app.post("/emailSignup", emailSignup)

app.get("/logout", authMiddleware, logout)

app.get("/googleAuth", googleAuth)

app.post("/getUpcomingEvents", authMiddleware, getUpcomingEvents);

app.use(error);
const PORT = process.env.PORT || 3012;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
