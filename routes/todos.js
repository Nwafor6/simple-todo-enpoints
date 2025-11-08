const express = require('express');
const mongoose = require('mongoose');
const Todo = require('../models/Todo');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Apply authentication to all todo routes
router.use(authenticateToken);

// Get all todos for the current user
router.get('/', async (req, res) => {
    try {
        const { completed, priority, sortBy = 'createdAt', order = 'desc', page = 1, limit = 20 } = req.query;

        // Build filter
        const filter = { userId: req.user.id };
        if (completed !== undefined) {
            filter.completed = completed === 'true';
        }
        if (priority) {
            filter.priority = priority;
        }

        // Build sort object
        const sortOrder = order === 'asc' ? 1 : -1;
        const sort = { [sortBy]: sortOrder };

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const todos = await Todo.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('userId', 'username email');

        const totalTodos = await Todo.countDocuments(filter);
        const totalPages = Math.ceil(totalTodos / parseInt(limit));

        res.json({
            success: true,
            data: {
                todos,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalTodos,
                    hasNext: parseInt(page) < totalPages,
                    hasPrev: parseInt(page) > 1
                }
            }
        });
    } catch (error) {
        console.error('Get todos error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get a specific todo by ID
router.get('/:id', async (req, res) => {
    try {
        const todo = await Todo.findById(req.params.id).populate('userId', 'username email');

        if (!todo) {
            return res.status(404).json({
                success: false,
                message: 'Todo not found'
            });
        }

        // Check if todo belongs to current user
        if (todo.userId._id.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. This todo does not belong to you.'
            });
        }

        res.json({
            success: true,
            data: { todo }
        });
    } catch (error) {
        console.error('Get todo error:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid todo ID format'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Create a new todo
router.post('/', async (req, res) => {
    try {
        const { title, description, priority, dueDate } = req.body;

        // Validation
        if (!title || title.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Title is required'
            });
        }

        // Create todo
        const newTodo = new Todo({
            title: title.trim(),
            description: description ? description.trim() : '',
            priority: priority || 'medium',
            dueDate: dueDate ? new Date(dueDate) : null,
            userId: req.user.id
        });

        await newTodo.save();
        await newTodo.populate('userId', 'username email');

        res.status(201).json({
            success: true,
            message: 'Todo created successfully',
            data: { todo: newTodo }
        });

    } catch (error) {
        console.error('Create todo error:', error);

        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', ')
            });
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Update a todo
router.put('/:id', async (req, res) => {
    try {
        const { title, description, completed, priority, dueDate } = req.body;

        // Find the todo
        const todo = await Todo.findById(req.params.id);

        if (!todo) {
            return res.status(404).json({
                success: false,
                message: 'Todo not found'
            });
        }

        // Check ownership
        if (todo.userId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. This todo does not belong to you.'
            });
        }

        // Update fields
        if (title !== undefined) todo.title = title.trim();
        if (description !== undefined) todo.description = description.trim();
        if (completed !== undefined) todo.completed = completed;
        if (priority !== undefined) todo.priority = priority;
        if (dueDate !== undefined) todo.dueDate = dueDate ? new Date(dueDate) : null;

        await todo.save();
        await todo.populate('userId', 'username email');

        res.json({
            success: true,
            message: 'Todo updated successfully',
            data: { todo }
        });

    } catch (error) {
        console.error('Update todo error:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid todo ID format'
            });
        }

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', ')
            });
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Mark todo as complete/incomplete
router.patch('/:id/toggle', async (req, res) => {
    try {
        const todo = await Todo.findById(req.params.id);

        if (!todo) {
            return res.status(404).json({
                success: false,
                message: 'Todo not found'
            });
        }

        // Check ownership
        if (todo.userId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. This todo does not belong to you.'
            });
        }

        // Toggle completion status
        todo.completed = !todo.completed;
        await todo.save();
        await todo.populate('userId', 'username email');

        res.json({
            success: true,
            message: `Todo marked as ${todo.completed ? 'complete' : 'incomplete'}`,
            data: { todo }
        });

    } catch (error) {
        console.error('Toggle todo error:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid todo ID format'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Delete a todo
router.delete('/:id', async (req, res) => {
    try {
        const todo = await Todo.findById(req.params.id);

        if (!todo) {
            return res.status(404).json({
                success: false,
                message: 'Todo not found'
            });
        }

        // Check ownership
        if (todo.userId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. This todo does not belong to you.'
            });
        }

        await Todo.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Todo deleted successfully'
        });

    } catch (error) {
        console.error('Delete todo error:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid todo ID format'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get todo statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const userId = req.user.id;

        const stats = await Todo.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    completed: { $sum: { $cond: ['$completed', 1, 0] } },
                    pending: { $sum: { $cond: ['$completed', 0, 1] } },
                    highPriority: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } },
                    mediumPriority: { $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] } },
                    lowPriority: { $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] } }
                }
            }
        ]);

        const result = stats[0] || {
            total: 0,
            completed: 0,
            pending: 0,
            highPriority: 0,
            mediumPriority: 0,
            lowPriority: 0
        };

        res.json({
            success: true,
            data: { stats: result }
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;