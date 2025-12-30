// server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const db = require('./config/db');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-here',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true if using HTTPS
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Flash messages
app.use(flash());

// Global variables for flash messages
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success');
    res.locals.error_msg = req.flash('error');
    res.locals.error = req.flash('error');
    res.locals.user = req.session.user || null;
    res.locals.staff = req.session.staff || null;
    res.locals.student = req.session.student || null;
    res.locals.page = ""; // ✅ Global page variable
    next();
});

// Set EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const staffRoutes = require('./routes/staff');
const studentRoutes = require('./routes/student');

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/staff', staffRoutes);
app.use('/student', studentRoutes);

// 404 Error Handler
app.use((req, res) => {
    res.status(404).render('public/404', { 
        title: '404 - Page Not Found',
        page: '404'
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('public/error', { 
        title: 'Error',
        error: err.message,
        page: 'error'
    });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📚 Islamic School Management System`);
});