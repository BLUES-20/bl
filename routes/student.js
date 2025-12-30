// routes/student.js
const express = require('express');
const router = express.Router();

// Middleware to check if student is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.student) {
        return next();
    }
    req.flash('error', 'Please login to access this page');
    res.redirect('/auth/student-login');
};

// Apply authentication middleware to all student routes
router.use(isAuthenticated);

// Student Dashboard
router.get('/dashboard', (req, res) => {
    res.render('student/dashboard', { 
        title: 'Student Dashboard - Islamic School',
        page: 'student-dashboard',
        student: req.session.student
    });
});

// Check Result Page
router.get('/check-result', (req, res) => {
    res.render('student/check-result', { 
        title: 'Check Result - Islamic School',
        page: 'check-result',
        student: req.session.student
    });
});

// Announcements Page
router.get('/announcements', (req, res) => {
    res.render('student/announcements', { 
        title: 'Announcements - Islamic School',
        page: 'announcements',
        student: req.session.student
    });
});

// Profile Page
router.get('/profile', (req, res) => {
    res.render('student/profile', { 
        title: 'My Profile - Islamic School',
        page: 'profile',
        student: req.session.student
    });
});

module.exports = router;