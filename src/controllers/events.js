const { google } = require("googleapis");
const Event = require("../models/eventModel");
const User = require("../models/userModel");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

exports.createEvent = async (req, res, next) => {
    const postData = req.body;
    postData.createdBy = req.user._id;

    try {
        const event = new Event(postData);
        const savedEvent = await event.save();
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
        next(error);
    }
}

exports.getWeeklyEvents = async (req, res, next) => {
    const { startDate, endDate, userId } = req.body;
    const user = userId ? userId : req.user._id;
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
        next(error)
    }
}

exports.auth2callback = async (req, res, next) => {
    const { code, state } = req.query;
    if (!code) {
        return res.status(400).send("Authorization code is missing.");
    }
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        const { userId } = JSON.parse(state);
        await User.updateOne(
            { _id: userId },
            { $set: { tokens } },
        );
        res.cookie("google_sync_token", "1", {
            maxAge: 1000 * 60 * 60 * 24 * 10,
            withCredentials: true,
            httpOnly: false,
            secure: true,
            sameSite: "none",
        });
        res.redirect(`${process.env.CLIENT_URL}/calendar`);
    } catch (error) {
        console.error("Error exchanging code for tokens:", error);
        next(error);
    }
}

exports.getGoogleEvents = async (req, res, next) => {
    const { startDate, endDate } = req.body;
    try {
        if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
            const user = await User.findOne({ _id: req.user._id });
            if (user.tokens?.access_token && user.tokens.expiry_date > new Date()) {
                oauth2Client.setCredentials(user.tokens);
            } else return res.status(401).json({ message: "Please sign in with google to sync" });
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
        next(error);
    }
}

exports.getUpcomingEvents = async (req, res, next) => {
    const { page = 1, filter = null } = req.body;
    try {
        const pageSize = 10;
        const skip = (page - 1) * pageSize;
        const query = {
            createdBy: req.user._id,
            startTime: { $gt: new Date() },
        };
        if (filter) {
            query.tag = filter;
        }
        const events = await Event.find(query).skip(skip).limit(pageSize);

        const totalEvents = await Event.countDocuments(query);

        const totalPages = Math.ceil(totalEvents / pageSize);

        res.status(200).json({
            events,
            totalPages,
            totalEvents,
        });
    } catch (error) {
        console.error("Error fetching events:", error);
        next(error);
    }
}

exports.googleAuth = async (req, res, next) => {
    try {
        const user = await User.findOne({ _id: req.user._id });
        if (user.tokens?.access_token && user.tokens.expiry_date > new Date()) {
            oauth2Client.setCredentials(user.tokens);
        } else if (user.tokens?.refresh_token) {
            await refreshAccessToken(user._id, user.tokens.refresh_token);
        } else {
            const authUrl = oauth2Client.generateAuthUrl({
                access_type: "offline",
                scope: [
                    "https://www.googleapis.com/auth/calendar.readonly",
                    "https://www.googleapis.com/auth/calendar.events",
                ],
                prompt: "consent",
                state: JSON.stringify({ userId: user._id }),
            });

            return res.redirect(authUrl);
        }
        res.cookie("google_sync_token", "1", {
            maxAge: 1000 * 60 * 60 * 24 * 10,
            withCredentials: true,
            httpOnly: false,
            secure: true,
            sameSite: "none",
        });
        res.redirect(`${process.env.CLIENT_URL}/calendar`);
    } catch (error) {
        console.error("Error during Google authentication:", error.message);
        next(error);
    }
}

const refreshAccessToken = async (userId, refreshToken) => {
    try {
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const { credentials } = await oauth2Client.refreshAccessToken();
        await User.updateOne(
            { _id: userId },
            { $set: { "tokens.access_token": credentials.access_token, "tokens.expiry_date": credentials.expiry_date } }
        );

        return credentials.access_token;
    } catch (error) {
        console.error("Error refreshing access token:", error.message);
        throw new Error("Could not refresh access token");
    }
}