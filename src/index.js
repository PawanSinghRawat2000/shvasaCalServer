const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { connectDB } = require('./db');
const Event = require("./models/eventModel");
const { google } = require("googleapis");
const bcrypt = require("bcrypt");
const User = require("./models/userModel");
const jwt = require("jsonwebtoken");
const { authMiddleware } = require("./middleware/middleware");
const cookieParser = require("cookie-parser");

const app = express();
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
}))
app.use(express.json());
app.use(cookieParser());
connectDB();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

app.get("/health", (req, res) => {
    res.send("Ok");
});

app.post("/createEvent", authMiddleware, async (req, res) => {
    const postData = req.body;
    postData.createdBy = req.user._id;

    try {
        const event = new Event(postData);
        const savedEvent = await event.save();
        console.log("Event saved successfully:", savedEvent);
        if (postData.sync) {
            if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
                return res.status(400).json({ message: "User is not authenticated." });
            }

            try {
                const googleEvent = {
                    summary: postData.title,
                    location: postData.location || '',
                    description: postData.description || '',
                    start: {
                        dateTime: new Date(postData.startTime).toISOString(),
                        timeZone: 'UTC',
                    },
                    end: {
                        dateTime: new Date(postData.endTime).toISOString(),
                        timeZone: 'UTC',
                    },
                    attendees: postData.attendees || [],
                    reminders: {
                        useDefault: false,
                        overrides: [
                            { method: 'popup', minutes: 10 },
                        ],
                    },
                };
                const calendar = google.calendar({ version: "v3", auth: oauth2Client });
                const calendarResponse = await calendar.events.insert({
                    calendarId: 'primary',
                    resource: googleEvent,
                });
            } catch (error) {
                console.error("Error syncing to Google Calendar:", error.message);
                return res.status(500).json({
                    message: "Error syncing to Google Calendar.",
                    error: error.message,
                });
            }
        }

        res.status(201).json({
            message: "Event created successfully",
            event: savedEvent,
        });
    } catch (error) {
        console.error("Error saving event:", error.message);
        res.status(500).json({
            message: "Error saving event",
            error: error.message,
        });
    }
});

app.post("/getWeeklyEvents", authMiddleware, async (req, res) => {
    const { startDate, endDate,userId } = req.body;
    const user = userId ?userId:req.user._id;
    try {
        const events = await Event.find({
            createdBy: user,
            $or: [
                { startTime: { $gte: startDate, $lte: endDate } },
                { endTime: { $gte: startDate, $lte: endDate } }
            ]
        });
        res.status(200).json({
            message: "Events fetched successfully",
            event: events,
        });
    } catch (error) {
        console.error("Error fetching event:", error.message);
        res.status(500).json({
            message: "Error saving event",
            error: error.message,
        });
    }
});

app.post("/oauth2callback", async (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).send("Authorization code is missing.");
    }
    try {
        // Exchange authorization code for access and refresh tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        return res.status(200).json({ message: "Sign In successful" });
    } catch (error) {
        console.error("Error exchanging code for tokens:", error);
        res.status(500).send("Error during authentication.");
    }
});

app.post("/events", authMiddleware, async (req, res) => {
    const { startDate, endDate } = req.body;
    try {
        if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
            return res.status(401).json({ message: "Please sign in" });
        }
        const calendar = google.calendar({ version: "v3", auth: oauth2Client });
        const response = await calendar.events.list({
            calendarId: "primary",
            timeMin: new Date(startDate).toISOString(),
            timeMax: new Date(endDate).toISOString(),
            singleEvents: true,
            orderBy: "startTime",
        });

        const events = response.data.items;
        res.status(200).json(events);
    } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).send("Error fetching events.");
    }
});

app.post("/users", authMiddleware, async (req, res) => {
    const { userSearch } = req.body;
    try {
        const users = await User.find({ email: { $regex: userSearch, $options: "i" } },{password:0});
        const data = users.filter((user)=> !user._id.equals(req.user._id));
        return res.status(200).json({ message: "success", data });
    } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).send("Error fetching events.");
    }
});

app.post("/emailLogin", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required.",
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res
                .status(404)
                .json({ message: "User not found" });
        }

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res
                .status(401)
                .json({ message: "Invalid credentials." });
        }

        const token = jwt.sign(
            {
                id: user._id,
            },
            process.env.JWT_SECRET_KEY,
            {
                expiresIn: 10 * 24 * 60 * 60,
            }
        );
        res.cookie("shvasaCal_token", token, {
            maxAge: 1000 * 60 * 60 * 24 * 10,
            httpOnly: false,
            secure: false,
            sameSite: "lax",
        });
        return res.status(200).json({ user: user, message: "Logged in" });
    } catch (err) {
        return res
            .status(500)
            .json({ status: 500, message: "Internal Server Error" });
    }
})

app.post("/emailSignup", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required.",
            });
        }

        //check user exists
        let user = await User.findOne({ email });
        if (user) {
            return res
                .status(401)
                .json({ message: "User Already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ email, password: hashedPassword });
        newUser.save();
        const token = jwt.sign(
            {
                id: newUser._id,
            },
            process.env.JWT_SECRET_KEY,
            {
                expiresIn: 10 * 24 * 60 * 60,
            }
        );
        res.cookie("shvasaCal_token", token, {
            maxAge: 1000 * 60 * 60 * 24 * 10,
            withCredentials: true,
            httpOnly: false,
            secure: false,
            sameSite: "lax",
        });
        return res.status(201).json({
            user: newUser,
            message: "User created successfully",
        });
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            message:
                "Internal Server Error",
        });
    }
})

app.get("/logout", authMiddleware, async (req, res) => {
    try {
        res.clearCookie("shvasaCal_token", {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
        });

        return res.status(200).json({
            message: "Logged out successfully",
        });
    } catch (err) {
        console.error("Error during logout:", err.message);
        return res.status(500).json({
            message: "Internal Server Error",
        });
    }
})

const PORT = process.env.PORT || 3012;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
