const User = require("../models/userModel");

exports.getUsers = async (req, res,next) => {
    const { userSearch } = req.body;
    try {
        const users = await User.find({ email: { $regex: userSearch, $options: "i" } }, { password: 0 });
        const data = users.filter((user) => !user._id.equals(req.user._id));
        return res.status(200).json({ message: "success", data });
    } catch (error) {
        next(error);
    }
}