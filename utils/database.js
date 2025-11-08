const mongoose = require('mongoose');

class MongoDatabase {
    static async connect() {
        try {
            const mongoUrl = process.env.MONGO_DB_URL;
            if (!mongoUrl) {
                throw new Error('MONGO_DB_URL is not defined in environment variables');
            }

            await mongoose.connect(mongoUrl);
            console.log('✅ MongoDB connected successfully');

            // Handle connection events
            mongoose.connection.on('error', (err) => {
                console.error('❌ MongoDB connection error:', err);
            });

            mongoose.connection.on('disconnected', () => {
                console.log('⚠️  MongoDB disconnected');
            });

        } catch (error) {
            console.error('❌ MongoDB connection failed:', error);
            process.exit(1);
        }
    }

    static async disconnect() {
        try {
            await mongoose.connection.close();
            console.log('✅ MongoDB disconnected successfully');
        } catch (error) {
            console.error('❌ Error disconnecting from MongoDB:', error);
        }
    }
}

module.exports = MongoDatabase;