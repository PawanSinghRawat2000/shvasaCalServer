const mongoose = require('mongoose');

exports.connectDB = async () => {
    try {
        const conn = await mongoose.connect(`mongodb://localhost:27017/Shvasa`);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}