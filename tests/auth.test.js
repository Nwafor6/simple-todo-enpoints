const request = require('supertest');
const createTestApp = require('./testApp');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./testSetup');
const User = require('../models/User');

const app = createTestApp();

describe('Authentication Endpoints', () => {
    beforeAll(async () => {
        await setupTestDB();
    });

    afterAll(async () => {
        await teardownTestDB();
    });

    beforeEach(async () => {
        await clearTestDB();
    });

    describe('POST /api/auth/register', () => {
        const validUser = {
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123'
        };

        test('should register a new user successfully', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send(validUser);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('User registered successfully');
            expect(response.body.data).toHaveProperty('user');
            expect(response.body.data).toHaveProperty('token');
            expect(response.body.data.user.email).toBe(validUser.email);
            expect(response.body.data.user.username).toBe(validUser.username);
            expect(response.body.data.user).not.toHaveProperty('password');
        });

        test('should fail with missing fields', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'test@example.com'
                    // missing username and password
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('required');
        });

        test('should fail with invalid email', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    ...validUser,
                    email: 'invalid-email'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('valid email');
        });

        test('should fail with short password', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    ...validUser,
                    password: '123'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('at least 6 characters');
        });

        test('should fail with duplicate email', async () => {
            // Create first user
            await request(app)
                .post('/api/auth/register')
                .send(validUser);

            // Try to create user with same email
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'different',
                    email: validUser.email,
                    password: 'password123'
                });

            expect(response.status).toBe(409);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('already exists');
        });

        test('should fail with duplicate username', async () => {
            // Create first user
            await request(app)
                .post('/api/auth/register')
                .send(validUser);

            // Try to create user with same username
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    username: validUser.username,
                    email: 'different@example.com',
                    password: 'password123'
                });

            expect(response.status).toBe(409);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('already exists');
        });
    });

    describe('POST /api/auth/login', () => {
        const testUser = {
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123'
        };

        beforeEach(async () => {
            // Register a test user before each login test
            await request(app)
                .post('/api/auth/register')
                .send(testUser);
        });

        test('should login with valid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Login successful');
            expect(response.body.data).toHaveProperty('user');
            expect(response.body.data).toHaveProperty('token');
            expect(response.body.data.user.email).toBe(testUser.email);
            expect(response.body.data.user).not.toHaveProperty('password');
        });

        test('should fail with missing credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email
                    // missing password
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('required');
        });

        test('should fail with non-existent email', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: testUser.password
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Invalid email or password');
        });

        test('should fail with wrong password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: 'wrongpassword'
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Invalid email or password');
        });
    });

    describe('GET /api/auth/profile', () => {
        const testUser = {
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123'
        };
        let authToken;

        beforeEach(async () => {
            // Register and login to get auth token
            const registerResponse = await request(app)
                .post('/api/auth/register')
                .send(testUser);

            authToken = registerResponse.body.data.token;
        });

        test('should get user profile with valid token', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('user');
            expect(response.body.data.user.email).toBe(testUser.email);
            expect(response.body.data.user.username).toBe(testUser.username);
            expect(response.body.data.user).not.toHaveProperty('password');
        });

        test('should fail without authorization header', async () => {
            const response = await request(app)
                .get('/api/auth/profile');

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('token');
        });

        test('should fail with invalid token', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', 'Bearer invalid-token');

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('token');
        });

        test('should fail with malformed authorization header', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', 'InvalidFormat');

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('token');
        });
    });
});