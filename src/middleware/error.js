// Middleware
const error = (err, req, res, next) => {
    res.status(500).json({
        message: "Internal server error",
        error: err.stack
    });
};

module.exports = error;
