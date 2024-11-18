// Middleware
const error = (err, req, res, next) => {
    console.error("Error fetching events:", err.stack);
    res.status(500).json({
        message: "Internal server error",
        error: err.stack
    });
};

module.exports = error;
