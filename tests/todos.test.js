const request = require('supertest');
const createTestApp = require('./testApp');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./testSetup');
const User = require('../models/User');
const Todo = require('../models/Todo');

const app = createTestApp();

describe('Todo Endpoints', () => {
    let authToken;
    let userId;
    const testUser = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
    };

    beforeAll(async () => {
        await setupTestDB();
    });

    afterAll(async () => {
        await teardownTestDB();
    });

    beforeEach(async () => {
        await clearTestDB();

        // Register and login to get auth token for each test
        const registerResponse = await request(app)
            .post('/api/auth/register')
            .send(testUser);

        authToken = registerResponse.body.data.token;
        userId = registerResponse.body.data.user._id;
    });

    describe('POST /api/todos', () => {
        const validTodo = {
            title: 'Test Todo',
            description: 'This is a test todo',
            priority: 'high'
        };

        test('should create a new todo successfully', async () => {
            const response = await request(app)
                .post('/api/todos')
                .set('Authorization', `Bearer ${authToken}`)
                .send(validTodo);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Todo created successfully');
            expect(response.body.data).toHaveProperty('todo');
            expect(response.body.data.todo.title).toBe(validTodo.title);
            expect(response.body.data.todo.description).toBe(validTodo.description);
            expect(response.body.data.todo.priority).toBe(validTodo.priority);
            expect(response.body.data.todo.completed).toBe(false);
            expect(response.body.data.todo.userId._id).toBe(userId);
        });

        test('should create todo with minimal data', async () => {
            const minimalTodo = {
                title: 'Simple Todo'
            };

            const response = await request(app)
                .post('/api/todos')
                .set('Authorization', `Bearer ${authToken}`)
                .send(minimalTodo);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.todo.title).toBe(minimalTodo.title);
            expect(response.body.data.todo.priority).toBe('medium'); // default
            expect(response.body.data.todo.completed).toBe(false);
        });

        test('should fail without authentication', async () => {
            const response = await request(app)
                .post('/api/todos')
                .send(validTodo);

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('token');
        });

        test('should fail without title', async () => {
            const response = await request(app)
                .post('/api/todos')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    description: 'No title provided'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('required');
        });

        test('should fail with invalid priority', async () => {
            const response = await request(app)
                .post('/api/todos')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    ...validTodo,
                    priority: 'invalid'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/todos', () => {
        beforeEach(async () => {
            // Create some test todos
            await Todo.create([
                {
                    title: 'Todo 1',
                    description: 'First todo',
                    userId,
                    completed: false,
                    priority: 'high'
                },
                {
                    title: 'Todo 2',
                    description: 'Second todo',
                    userId,
                    completed: true,
                    priority: 'low'
                },
                {
                    title: 'Todo 3',
                    description: 'Third todo',
                    userId,
                    completed: false,
                    priority: 'medium'
                }
            ]);
        });

        test('should get all todos for authenticated user', async () => {
            const response = await request(app)
                .get('/api/todos')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('todos');
            expect(response.body.data.todos).toHaveLength(3);
            expect(response.body.data).toHaveProperty('pagination');

            // Verify all todos belong to the authenticated user
            response.body.data.todos.forEach(todo => {
                expect(todo.userId).toBe(userId);
            });
        });

        test('should filter todos by completion status', async () => {
            const response = await request(app)
                .get('/api/todos?completed=true')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.todos).toHaveLength(1);
            expect(response.body.data.todos[0].completed).toBe(true);
        });

        test('should filter todos by priority', async () => {
            const response = await request(app)
                .get('/api/todos?priority=high')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.todos).toHaveLength(1);
            expect(response.body.data.todos[0].priority).toBe('high');
        });

        test('should paginate todos', async () => {
            const response = await request(app)
                .get('/api/todos?page=1&limit=2')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.todos).toHaveLength(2);
            expect(response.body.data.pagination.page).toBe(1);
            expect(response.body.data.pagination.limit).toBe(2);
            expect(response.body.data.pagination.total).toBe(3);
        });

        test('should fail without authentication', async () => {
            const response = await request(app)
                .get('/api/todos');

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('token');
        });
    });

    describe('GET /api/todos/:id', () => {
        let todoId;

        beforeEach(async () => {
            const todo = await Todo.create({
                title: 'Test Todo',
                description: 'Test description',
                userId,
                priority: 'medium'
            });
            todoId = todo._id.toString();
        });

        test('should get a specific todo', async () => {
            const response = await request(app)
                .get(`/api/todos/${todoId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('todo');
            expect(response.body.data.todo._id).toBe(todoId);
            expect(response.body.data.todo.title).toBe('Test Todo');
        });

        test('should fail with invalid todo ID', async () => {
            const response = await request(app)
                .get('/api/todos/invalid-id')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Invalid');
        });

        test('should fail with non-existent todo ID', async () => {
            const nonExistentId = '507f1f77bcf86cd799439011';
            const response = await request(app)
                .get(`/api/todos/${nonExistentId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Todo not found');
        });

        test('should fail without authentication', async () => {
            const response = await request(app)
                .get(`/api/todos/${todoId}`);

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('token');
        });
    });

    describe('PUT /api/todos/:id', () => {
        let todoId;

        beforeEach(async () => {
            const todo = await Todo.create({
                title: 'Original Todo',
                description: 'Original description',
                userId,
                priority: 'low',
                completed: false
            });
            todoId = todo._id.toString();
        });

        test('should update todo successfully', async () => {
            const updateData = {
                title: 'Updated Todo',
                description: 'Updated description',
                priority: 'high'
            };

            const response = await request(app)
                .put(`/api/todos/${todoId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Todo updated successfully');
            expect(response.body.data.todo.title).toBe(updateData.title);
            expect(response.body.data.todo.description).toBe(updateData.description);
            expect(response.body.data.todo.priority).toBe(updateData.priority);
        });

        test('should update partial fields', async () => {
            const updateData = {
                completed: true
            };

            const response = await request(app)
                .put(`/api/todos/${todoId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.todo.completed).toBe(true);
            expect(response.body.data.todo.title).toBe('Original Todo'); // unchanged
        });

        test('should fail with invalid todo ID', async () => {
            const response = await request(app)
                .put('/api/todos/invalid-id')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Updated' });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Invalid');
        });

        test('should fail with non-existent todo ID', async () => {
            const nonExistentId = '507f1f77bcf86cd799439011';
            const response = await request(app)
                .put(`/api/todos/${nonExistentId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Todo not found');
        });

        test('should fail without authentication', async () => {
            const response = await request(app)
                .put(`/api/todos/${todoId}`)
                .send({ title: 'Updated' });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('token');
        });
    });

    describe('DELETE /api/todos/:id', () => {
        let todoId;

        beforeEach(async () => {
            const todo = await Todo.create({
                title: 'Todo to Delete',
                description: 'This will be deleted',
                userId,
                priority: 'medium'
            });
            todoId = todo._id.toString();
        });

        test('should delete todo successfully', async () => {
            const response = await request(app)
                .delete(`/api/todos/${todoId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Todo deleted successfully');

            // Verify todo is actually deleted
            const deletedTodo = await Todo.findById(todoId);
            expect(deletedTodo).toBeNull();
        });

        test('should fail with invalid todo ID', async () => {
            const response = await request(app)
                .delete('/api/todos/invalid-id')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Invalid');
        });

        test('should fail with non-existent todo ID', async () => {
            const nonExistentId = '507f1f77bcf86cd799439011';
            const response = await request(app)
                .delete(`/api/todos/${nonExistentId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Todo not found');
        });

        test('should fail without authentication', async () => {
            const response = await request(app)
                .delete(`/api/todos/${todoId}`);

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('token');
        });
    });

    describe('PATCH /api/todos/:id/complete', () => {
        let todoId;

        beforeEach(async () => {
            const todo = await Todo.create({
                title: 'Todo to Complete',
                description: 'This will be marked as complete',
                userId,
                priority: 'medium',
                completed: false
            });
            todoId = todo._id.toString();
        });

        test('should mark todo as complete', async () => {
            const response = await request(app)
                .patch(`/api/todos/${todoId}/complete`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Todo marked as complete');
            expect(response.body.data.todo.completed).toBe(true);
        });

        test('should handle already completed todo', async () => {
            // First, mark it as complete
            await request(app)
                .patch(`/api/todos/${todoId}/complete`)
                .set('Authorization', `Bearer ${authToken}`);

            // Try to complete again
            const response = await request(app)
                .patch(`/api/todos/${todoId}/complete`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.todo.completed).toBe(true);
        });

        test('should fail with invalid todo ID', async () => {
            const response = await request(app)
                .patch('/api/todos/invalid-id/complete')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Invalid');
        });

        test('should fail with non-existent todo ID', async () => {
            const nonExistentId = '507f1f77bcf86cd799439011';
            const response = await request(app)
                .patch(`/api/todos/${nonExistentId}/complete`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Todo not found');
        });

        test('should fail without authentication', async () => {
            const response = await request(app)
                .patch(`/api/todos/${todoId}/complete`);

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('token');
        });
    });
});