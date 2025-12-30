// routes/staff.js
const express = require('express');
const router = express.Router();

// Middleware to check if staff is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.staff) {
        return next();
    }
    req.flash('error', 'Please login to access this page');
    res.redirect('/auth/staff-login');
};

// Apply authentication middleware to all staff routes
router.use(isAuthenticated);

// Staff Dashboard
router.get('/dashboard', (req, res) => {
    res.render('staff/dashboard', { 
        title: 'Staff Dashboard - Islamic School',
        page: 'staff-dashboard',
        staff: req.session.staff
    });
});

// Upload Document Page
router.get('/upload-document', (req, res) => {
    res.render('staff/upload-document', { 
        title: 'Upload Document - Islamic School',
        page: 'upload-document',
        staff: req.session.staff
    });
});

// Upload Result Page
router.get('/upload-result', (req, res) => {
    res.render('staff/upload-result', { 
        title: 'Upload Result - Islamic School',
        page: 'upload-result',
        staff: req.session.staff
    });
});

// Manage Students Page
router.get('/manage-students', (req, res) => {
    res.render('staff/manage-students', { 
        title: 'Manage Students - Islamic School',
        page: 'manage-students',
        staff: req.session.staff
    });
});

// Announcements Page
router.get('/announcements', (req, res) => {
    res.render('staff/announcements', { 
        title: 'Announcements - Islamic School',
        page: 'announcements',
        staff: req.session.staff
    });
});

module.exports = router;