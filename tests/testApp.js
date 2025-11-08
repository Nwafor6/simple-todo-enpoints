const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import routes
const authRoutes = require('../routes/auth');
const todoRoutes = require('../routes/todos');

// Create Express app for testing (without database connection)
const createTestApp = () => {
    const app = express();

    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Request logging for tests
    app.use((req, res, next) => {
        console.log(`Test: ${req.method} ${req.path}`);
        next();
    });

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/todos', todoRoutes);

    // Health check
    app.get('/', (req, res) => {
        res.json({
            success: true,
            message: 'Test API is running',
            timestamp: new Date().toISOString()
        });
    });

    // 404 handler
    app.use('*', (req, res) => {
        res.status(404).json({
            success: false,
            message: 'Route not found'
        });
    });

    // Error handler
    app.use((error, req, res, next) => {
        console.error('Test Error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    });

    return app;
};

module.exports = createTestApp;