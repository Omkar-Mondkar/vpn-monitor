const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

// Configure daily rotate file transport
// This will write to a "logs" folder in the project root
// Files will be named like logs/vpn-monitor-2023-10-25.log
const fileRotateTransport = new winston.transports.DailyRotateFile({
  filename: path.join(__dirname, '../logs/vpn-monitor-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d',   // Keep logs for 14 days before deleting old ones
  maxSize: '20m',    // Maximum size of a single file
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  )
});

// Configure console transport (terminal output)
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(
      (info) => `${info.timestamp} ${info.level}: ${info.message}`
    )
  )
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    fileRotateTransport,
    consoleTransport
  ],
  // Also catch unhandled exceptions and promise rejections
  exceptionHandlers: [
    new winston.transports.DailyRotateFile({
      filename: path.join(__dirname, '../logs/exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d'
    })
  ],
  rejectionHandlers: [
    new winston.transports.DailyRotateFile({
      filename: path.join(__dirname, '../logs/rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d'
    })
  ]
});

module.exports = logger;
