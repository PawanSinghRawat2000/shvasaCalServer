const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { connectDB } = require('./db');
const cookieParser = require("cookie-parser");
const error = require('./middleware/error');
const router = require('./routes')

const app = express();
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
}))
app.use(express.json());
app.use(cookieParser());
connectDB();

app.use("/", router);
app.use(error);
const PORT = process.env.PORT || 3012;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
