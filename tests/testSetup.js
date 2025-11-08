const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Setup test database
const setupTestDB = async () => {
    try {
        // Create an in-memory MongoDB instance
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();

        // Connect to the in-memory database
        await mongoose.connect(mongoUri);

        console.log('✅ Test database connected');
    } catch (error) {
        console.error('❌ Test database setup failed:', error);
        throw error;
    }
};

// Cleanup test database
const teardownTestDB = async () => {
    try {
        // Clear all collections
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            const collection = collections[key];
            await collection.deleteMany({});
        }

        // Close connections
        await mongoose.connection.close();
        if (mongoServer) {
            await mongoServer.stop();
        }

        console.log('✅ Test database cleaned up');
    } catch (error) {
        console.error('❌ Test database cleanup failed:', error);
        throw error;
    }
};

// Clear collections between tests
const clearTestDB = async () => {
    try {
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            const collection = collections[key];
            await collection.deleteMany({});
        }
    } catch (error) {
        console.error('❌ Test database clear failed:', error);
        throw error;
    }
};

module.exports = {
    setupTestDB,
    teardownTestDB,
    clearTestDB
};