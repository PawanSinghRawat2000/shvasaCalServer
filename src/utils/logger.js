const winston = require('winston');
const { combine, timestamp, json, errors, printf } = winston.format;
require('winston-daily-rotate-file');
const fs = require("fs");


const fileRotateTransport = new winston.transports.DailyRotateFile({
    filename: 'tmp/error.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '7d',
});

const getErrorLocation = (stack) => {
    if (!stack) return '';
    const lines = stack.split('\n');
    const match = lines[1]?.match(/\(([^)]+)\)/) || lines[1]?.match(/at (.+)/);
    return match ? match[1] : 'unknown location';
};

const logger = winston.createLogger({
    level: "info",
    format: combine(
        timestamp(),
        errors({ stack: true }),
        printf(({ timestamp, level, message, stack }) => {
            const location = stack ? getErrorLocation(stack) : 'unknown location';
            return `${timestamp} [${level.toUpperCase()}]: ${message} | Location: ${location}`;
        })),
    transports: [fileRotateTransport],
});

module.exports = logger;