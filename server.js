const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import database connection
const MongoDatabase = require('./utils/database');

// Import routes
const authRoutes = require('./routes/auth');
const todoRoutes = require('./routes/todos');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// app.use(cors({
//     origin: process.env.NODE_ENV === 'production'
//         ? ["*"] // Add your production domain here
//         : ["*"], // Development origins
//     credentials: true
// }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Serve static files (for documentation)
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Simple Todo API is running!',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            auth: '/api/auth',
            todos: '/api/todos',
            documentation: '/docs'
        }
    });
});

// API Documentation route
app.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/todos', todoRoutes);

// 404 handler for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        requestedPath: req.originalUrl,
        availableEndpoints: {
            auth: '/api/auth',
            todos: '/api/todos'
        }
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);

    // Handle JSON parsing errors
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            message: 'Invalid JSON format in request body'
        });
    }

    // Handle other errors
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Start server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await MongoDatabase.connect();

        app.listen(PORT, () => {
            console.log(`
🚀 Simple Todo API Server is running!
📍 Port: ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
💾 Database: MongoDB Connected
📚 Health Check: http://localhost:${PORT}
📖 API Base: http://localhost:${PORT}/api
🔑 Auth Endpoints: http://localhost:${PORT}/api/auth
📝 Todo Endpoints: http://localhost:${PORT}/api/todos
📚 API Documentation: http://localhost:${PORT}/docs
⏰ Started at: ${new Date().toISOString()}
`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    await MongoDatabase.disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received. Shutting down gracefully...');
    await MongoDatabase.disconnect();
    process.exit(0);
});

module.exports = app;