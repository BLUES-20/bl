// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const router = express.Router();
const db = require('../config/db'); // Make sure this exports a 'pg' client connection

// =================== Nodemailer Setup ===================
let transporter = null;
let emailEnabled = false;

// Only set up email if credentials are provided
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000
    });

    transporter.verify((error, success) => {
        if (error) {
            console.error('Email setup error:', error.message);
            console.log('⚠️  Email service unavailable. Server will continue without email functionality.');
        } else {
            emailEnabled = true;
            console.log('✅ Gmail transporter ready');
        }
    });
} else {
    console.log('⚠️  Email credentials not configured. Email features disabled.');
}

// Helper function to send email safely
async function sendEmail(mailOptions) {
    if (!emailEnabled || !transporter) {
        console.log('📧 Email skipped (not configured):', mailOptions.subject);
        return false;
    }
    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (err) {
        console.error('Email sending error:', err.message);
        return false;
    }
}

// =================== STUDENT LOGIN ===================
router.get('/student-login', (req, res) => {
    res.render('auth/student-login', {
        title: 'Student Login - Islamic School',
        page: 'student-login'
    });
});

router.post('/student-login', async (req, res) => {
    const { admission_number, password } = req.body;

    if (!admission_number || !password) {
        req.flash('error', 'Please enter admission number and password');
        return res.redirect('/auth/student-login');
    }

    try {
        const query = `
            SELECT u.password, s.id, s.user_id, s.admission_number, s.first_name, s.last_name, s.email, s.class
            FROM users u
            JOIN students s ON u.id = s.user_id
            WHERE s.admission_number = $1 AND u.role = 'student'
        `;
        const { rows } = await db.query(query, [admission_number]);

        if (!rows || rows.length === 0) {
            req.flash('error', 'Invalid admission number or password');
            return res.redirect('/auth/student-login');
        }

        const student = rows[0];
        
        // Check password (handle plain text for seed data, hashed for others)
        let match = false;
        if (student.password === password) {
            match = true;
        } else {
            match = await bcrypt.compare(password, student.password);
        }

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

    } catch (err) {
        console.error('Student login error:', err);
        req.flash('error', 'Login failed. Please try again.');
        res.redirect('/auth/student-login');
    }
});

// =================== STAFF LOGIN ===================
router.get('/staff-login', (req, res) => {
    res.render('auth/staff-login', {
        title: 'Staff Login - Islamic School',
        page: 'staff-login'
    });
});

router.post('/staff-login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash('error', 'Please enter email and password');
        return res.redirect('/auth/staff-login');
    }

    try {
        const query = `
            SELECT u.id as user_id, u.password, u.role, u.email, s.id as staff_id, s.first_name, s.last_name, s.position
            FROM users u
            LEFT JOIN staff s ON u.id = s.user_id
            WHERE u.email = $1 AND u.role IN ('staff', 'admin')
        `;
        const { rows } = await db.query(query, [email]);

        if (!rows || rows.length === 0) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/auth/staff-login');
        }

        const user = rows[0];
        
        // Check password (handle plain text for seed admin, hashed for others)
        let match = false;
        if (user.password === password) {
            match = true;
        } else {
            match = await bcrypt.compare(password, user.password);
        }

        if (!match) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/auth/staff-login');
        }

        req.session.staff = {
            id: user.staff_id || user.user_id,
            user_id: user.user_id,
            name: user.first_name ? (user.first_name + ' ' + user.last_name) : 'Administrator',
            email: user.email,
            position: user.position || 'Admin'
        };

        req.flash('success', `Welcome back, ${req.session.staff.name}!`);
        res.redirect('/staff/dashboard');

    } catch (err) {
        console.error('Staff login error:', err);
        req.flash('error', 'Login failed. Please try again.');
        res.redirect('/auth/staff-login');
    }
});

// =================== STUDENT REGISTRATION ===================
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
        date_of_birth, 
        gender, 
        class_name, 
        parent_name, 
        parent_phone, 
        address, 
        password, 
        confirm_password 
    } = req.body;

    // Validation
    if (!full_name || !email || !password || !confirm_password) {
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
        // Check if email already exists
        const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            req.flash('error', 'Email already registered');
            return res.redirect('/auth/student-register');
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate admission number
        const year = new Date().getFullYear();
        const countResult = await db.query('SELECT COUNT(*) FROM students');
        const count = parseInt(countResult.rows[0].count) + 1;
        const admission_number = `STU${year}${count.toString().padStart(3, '0')}`;

        // Split full name into first and last name
        const nameParts = full_name.trim().split(' ');
        const first_name = nameParts[0];
        const last_name = nameParts.slice(1).join(' ') || nameParts[0];

        // Create user first
        const userResult = await db.query(
            'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
            [email, email, hashedPassword, 'student']
        );
        const user_id = userResult.rows[0].id;

        // Create student record
        await db.query(
            `INSERT INTO students (user_id, admission_number, first_name, last_name, email, date_of_birth, gender, class, parent_name, parent_phone, address) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [user_id, admission_number, first_name, last_name, email, date_of_birth || null, gender || null, class_name || null, parent_name || null, parent_phone || null, address || null]
        );

        req.flash('success', `Registration successful! Your admission number is: ${admission_number}. Please save it for login.`);
        res.redirect('/auth/student-login');

    } catch (err) {
        console.error('Registration error:', err);
        req.flash('error', 'Registration failed. Please try again.');
        res.redirect('/auth/student-register');
    }
});

// =================== FORGOT PASSWORD ===================
router.get('/forgot-password', (req, res) => {
    res.render('auth/forgot-password', {
        title: 'Forgot Password - Islamic School',
        page: 'forgot-password'
    });
});

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            req.flash('error', 'No account with that email exists.');
            return res.redirect('/auth/forgot-password');
        }

        // Generate token
        const token = crypto.randomBytes(20).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour from now

        await db.query(
            'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE email = $3',
            [token, expires, email]
        );

        // Use APP_URL from .env for mobile compatibility
        const appUrl = process.env.APP_URL || `http://${req.headers.host}`;
        const resetLink = `${appUrl}/auth/reset-password/${token}`;

        const mailOptions = {
            to: email,
            from: process.env.EMAIL_USER,
            subject: 'Password Reset Request - Islamic School',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #1a5f3f; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                        <h2 style="margin: 0;">Islamic School Management System</h2>
                        <p style="margin: 5px 0 0 0;">Password Reset Request</p>
                    </div>
                    <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 5px 5px;">
                        <p>Hello,</p>
                        
                        <p>You have requested to reset your password. Click the button below to create a new password.</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetLink}" style="background-color: #1a5f3f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                Reset Password
                            </a>
                        </div>
                        
                        <p>Or copy and paste this link into your browser:</p>
                        <p style="word-break: break-all; background-color: #f0f0f0; padding: 10px; border-radius: 3px;">
                            <a href="${resetLink}" style="color: #1a5f3f;">${resetLink}</a>
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                        
                        <p><strong>⏰ Important:</strong> This link will expire in <strong>1 hour</strong>.</p>
                        
                        <p>If you did not request this password reset, please ignore this email and your password will remain unchanged.</p>
                        
                        <p style="color: #666; font-size: 12px; margin-top: 20px;">
                            This email was sent from Islamic School Management System.<br>
                            Do not reply to this email.
                        </p>
                    </div>
                    <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 5px 5px;">
                        <p style="margin: 0;">© 2025 Islamic School Management System. All rights reserved.</p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Password reset email sent to ${email}`);
        req.flash('success', 'An e-mail has been sent to ' + email + ' with a password reset link. The link will expire in 1 hour.');
        res.redirect('/auth/forgot-password');

    } catch (err) {
        console.error('Forgot password error:', err);
        req.flash('error', 'Error sending email. Please try again.');
        res.redirect('/auth/forgot-password');
    }
});

router.get('/reset-password/:token', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > $2',
            [req.params.token, new Date()]
        );

        if (result.rows.length === 0) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/auth/forgot-password');
        }

        res.render('auth/reset-password', {
            title: 'Reset Password',
            page: 'reset-password',
            token: req.params.token
        });
    } catch (err) {
        console.error('Reset token check error:', err);
        res.redirect('/auth/forgot-password');
    }
});

router.post('/reset-password/:token', async (req, res) => {
    try {
        const { password, confirm_password } = req.body;
        if (password !== confirm_password) {
            req.flash('error', 'Passwords do not match.');
            return res.redirect('back');
        }

        const result = await db.query(
            'SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > $2',
            [req.params.token, new Date()]
        );

        if (result.rows.length === 0) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/auth/forgot-password');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            'UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
            [hashedPassword, result.rows[0].id]
        );

        req.flash('success', 'Success! Your password has been changed.');
        res.redirect('/auth/student-login');

    } catch (err) {
        console.error('Reset password error:', err);
        req.flash('error', 'Error resetting password.');
        res.redirect('back');
    }
});

// =================== LOGOUT ===================
router.get('/logout', (req, res) => {
    const isStaff = !!req.session.staff;
    req.session.destroy(err => {
        if (err) console.error('Logout error:', err);
        // Cannot use flash after session is destroyed, so we redirect with query param
        res.redirect(isStaff ? '/auth/staff-login?logout=1' : '/auth/student-login?logout=1');
    });
});

module.exports = router;
