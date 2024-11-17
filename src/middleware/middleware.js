const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

module.exports.authMiddleware = async (req, res, next) => {
    console.log(req.cookies);
    const token = req.cookies.shvasaCal_token;
    console.log(token);
    if (!token) {
        return res.status(401).json({ message: "User not logged in" });
    }

    try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET_KEY);

        const user = await User.find({ _id: decodedToken.id});
        if (user[0]) {
            req.user = user[0];
            next();
        } else {
            return res.status(401).json({ message: "User not logged in" });
        }
    } catch (err) {
        return res.status(401).json({ message: "User not logged in" });
    }
};
