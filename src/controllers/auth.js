const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/userModel");

exports.emailLogin = async (req, res) => {
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
}

exports.emailSignup = async (req, res) => {
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
}

exports.logout = async (req, res) => {
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
}