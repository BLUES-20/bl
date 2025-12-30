// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const router = express.Router();
const db = require('../config/db');

// Setup Nodemailer transporter

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Optional: verify connection
transporter.verify((error, success) => {
    if (error) {
        console.error('Email setup error:', error);
    } else {
        console.log('Gmail transporter ready');
    }
});


/* ================= STUDENT REGISTRATION ================= */
router.get('/student-register', (req, res) => {
    res.render('auth/student-register', {
        title: 'Student Registration - Islamic School',
        page: 'student-register'
    });
});

router.post('/student-register', async (req, res) => {
    const {
        full_name,
        email,
        password,
        confirm_password,
        class_name,
        date_of_birth,
        gender,
        parent_name,
        parent_phone,
        address
    } = req.body;

    // Validation
    if (!full_name || !email || !password) {
        req.flash('error', 'Please fill in all required fields');
        return res.redirect('/auth/student-register');
    }

    if (password !== confirm_password) {
        req.flash('error', 'Passwords do not match');
        return res.redirect('/auth/student-register');
    }

    if (password.length < 6) {
        req.flash('error', 'Password must be at least 6 characters');
        return res.redirect('/auth/student-register');
    }

    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate unique admission number
        const admission_number = `STU${new Date().getFullYear()}${String(Date.now()).slice(-6)}`;

        // Insert into users table
        db.query(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
            [email, email, hashedPassword, 'student'],
            (err, userResult) => {
                if (err) {
                    console.error('User creation error:', err);
                    req.flash('error', 'Email already exists or registration failed');
                    return res.redirect('/auth/student-register');
                }

                const userId = userResult.insertId;

                // Insert into students table
                db.query(
                    `INSERT INTO students 
                    (user_id, admission_number, first_name, last_name, email, class, date_of_birth, gender, parent_name, parent_phone, address)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        userId,
                        admission_number,
                        full_name.split(' ')[0] || full_name,
                        full_name.split(' ').slice(1).join(' ') || '',
                        email,
                        class_name || 'Not Assigned',
                        date_of_birth || null,
                        gender || 'other',
                        parent_name || '',
                        parent_phone || '',
                        address || ''
                    ],
                    (err) => {
                        if (err) {
                            console.error('Student record error:', err);
                            req.flash('error', 'Registration failed. Please try again');
                            return res.redirect('/auth/student-register');
                        }

                        // Send email with admission number
                        const mailOptions = {
                            from: '"Islamic School" <noreply@islamicschool.com>',
                            to: email,
                            subject: 'Welcome to Islamic School - Your Admission Details',
                            html: `
                                <h2>Welcome to Islamic School!</h2>
                                <p>Dear ${full_name},</p>
                                <p>Your registration has been successful.</p>
                                <p><strong>Your Admission Number: ${admission_number}</strong></p>
                                <p>Please use this admission number along with your password to login to your student portal.</p>
                                <p>Best regards,<br>Islamic School Administration</p>
                            `
                        };

                        transporter.sendMail(mailOptions, (error, info) => {
                            if (error) {
                                console.error('Email send error:', error);
                            } else {
                                console.log('Email sent:', info.messageId);
                                console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
                            }
                        });

                        req.flash('success', `Registration successful! Your admission number is: ${admission_number}. Please check your email for confirmation.`);
                        res.redirect('/auth/student-login');
                    }
                );
            }
        );
    } catch (error) {
        console.error('Registration error:', error);
        req.flash('error', 'An error occurred during registration');
        res.redirect('/auth/student-register');
    }
});

/* ================= STUDENT LOGIN ================= */
router.get('/student-login', (req, res) => {
    res.render('auth/student-login', {
        title: 'Student Login - Islamic School',
        page: 'student-login'
    });
});

router.post('/student-login', (req, res) => {
    const { admission_number, password } = req.body;

    if (!admission_number || !password) {
        req.flash('error', 'Please enter admission number and password');
        return res.redirect('/auth/student-login');
    }

    db.query(
        `SELECT u.password, s.id, s.user_id, s.admission_number, s.first_name, s.last_name, s.email, s.class
         FROM users u
         JOIN students s ON u.id = s.user_id
         WHERE s.admission_number = ? AND u.role = 'student'`,
        [admission_number],
        async (err, results) => {
            if (err) {
                console.error('Database error during student login:', err);
                req.flash('error', 'Login failed. Please try again');
                return res.redirect('/auth/student-login');
            }

            if (!results || results.length === 0) {
                req.flash('error', 'Invalid admission number or password');
                return res.redirect('/auth/student-login');
            }

            const student = results[0];

            try {
                const match = await bcrypt.compare(password, student.password);

                if (!match) {
                    req.flash('error', 'Invalid admission number or password');
                    return res.redirect('/auth/student-login');
                }

                req.session.student = {
                    id: student.id,
                    user_id: student.user_id,
                    name: student.first_name + ' ' + student.last_name,
                    admission_number: student.admission_number,
                    email: student.email,
                    class: student.class
                };

                req.flash('success', `Welcome back, ${student.first_name}!`);
                res.redirect('/student/dashboard');
            } catch (error) {
                console.error('Password comparison error:', error);
                req.flash('error', 'Login failed. Please try again');
                res.redirect('/auth/student-login');
            }
        }
    );
});

/* ================= STAFF LOGIN ================= */
router.get('/staff-login', (req, res) => {
    res.render('auth/staff-login', {
        title: 'Staff Login - Islamic School',
        page: 'staff-login'
    });
});

router.post('/staff-login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash('error', 'Please enter email and password');
        return res.redirect('/auth/staff-login');
    }

    db.query(
        `SELECT u.password, s.id, s.user_id, s.first_name, s.last_name, s.email, s.position
         FROM users u
         JOIN staff s ON u.id = s.user_id
         WHERE u.email = ? AND u.role = 'staff'`,
        [email],
        async (err, results) => {
            if (err) {
                console.error('Database error during staff login:', err);
                req.flash('error', 'Login failed. Please try again');
                return res.redirect('/auth/staff-login');
            }

            if (!results || results.length === 0) {
                req.flash('error', 'Invalid email or password');
                return res.redirect('/auth/staff-login');
            }

            const staff = results[0];

            try {
                const match = await bcrypt.compare(password, staff.password);

                if (!match) {
                    req.flash('error', 'Invalid email or password');
                    return res.redirect('/auth/staff-login');
                }

                req.session.staff = {
                    id: staff.id,
                    user_id: staff.user_id,
                    name: staff.first_name + ' ' + staff.last_name,
                    email: staff.email,
                    position: staff.position
                };

                req.flash('success', `Welcome back, ${staff.first_name}!`);
                res.redirect('/staff/dashboard');
            } catch (error) {
                console.error('Password comparison error:', error);
                req.flash('error', 'Login failed. Please try again');
                res.redirect('/auth/staff-login');
            }
        }
    );
});

/* ================= LOGOUT ================= */
router.get('/logout', (req, res) => {
    const isStaff = req.session.staff ? true : false;

    req.flash('success', 'Logged out successfully');

    req.session.destroy((err) => {
        if (err) console.error('Logout error:', err);

        if (isStaff) {
            res.redirect('/auth/staff-login');
        } else {
            res.redirect('/auth/student-login');
        }
    });
});

module.exports = router;
