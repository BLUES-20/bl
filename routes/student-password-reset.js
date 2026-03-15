// Add student-specific forgot password routes to student.js
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const emailService = require('../services/email');

// Add to existing router.use(isAuthenticated); BEFORE these routes
router.get('/forgot-password', (req, res) => {
    res.render('auth/student-forgot-password', {
        title: 'Forgot Password - Student Portal',
        page: 'student-forgot-password'
    });
});

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const result = await db.query('SELECT * FROM users u JOIN students s ON u.id = s.user_id WHERE u.email = $1 AND u.role = \'student\'', [email]);
        if (result.rows.length === 0) {
            req.flash('error', 'No student account found with that email.');
            return res.redirect('/student/forgot-password');
        }

        const token = crypto.randomBytes(20).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour

        await db.query(
            'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE email = $3',
            [token, expires, email]
        );

        const appUrl = process.env.APP_URL || `http://${req.headers.host}`;
        const resetLink = `${appUrl}/student/reset-password/${token}`;

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #1a5f3f; color: white; padding: 20px; text-align: center;">
                    <h2>Islamic School - Password Reset</h2>
                </div>
                <div style="padding: 30px; background-color: #f9f9f9;">
                    <p>Hello,</p>
                    <p>Click below to reset your student portal password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background: #1a5f3f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">
                            Reset Password
                        </a>
                    </div>
                    <p>This link expires in 1 hour.</p>
                </div>
        `;

        const sent = await emailService.sendEmail(email, 'Reset Student Portal Password', emailHtml);
        if (sent) {
            req.flash('success', 'Password reset link sent to your email!');
        } else {
            req.flash('error', 'Email service temporarily unavailable. Contact admin.');
        }
        res.redirect('/student/forgot-password');
    } catch (err) {
        console.error('Student forgot-password error:', err);
        req.flash('error', 'Server error. Please try again.');
        res.redirect('/student/forgot-password');
    }
});

router.get('/reset-password/:token', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > $2',
            [req.params.token, new Date()]
        );
        if (result.rows.length === 0) {
            req.flash('error', 'Invalid or expired reset link.');
            return res.redirect('/student/forgot-password');
        }
        res.render('auth/student-reset-password', {
            title: 'Reset Password - Student Portal',
            page: 'student-reset-password',
            token: req.params.token
        });
    } catch (err) {
        console.error('Student reset-password check error:', err);
        req.flash('error', 'Invalid reset link.');
        res.redirect('/student/forgot-password');
    }
});

router.post('/reset-password/:token', async (req, res) => {
    try {
        const { password, confirm_password } = req.body;
        if (password !== confirm_password) {
            req.flash('error', 'Passwords do not match.');
            return res.redirect(`/student/reset-password/${req.params.token}`);
        }
        if (password.length < 6) {
            req.flash('error', 'Password must be at least 6 characters.');
            return res.redirect(`/student/reset-password/${req.params.token}`);
        }

        const result = await db.query(
            'SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > $2',
            [req.params.token, new Date()]
        );

        if (result.rows.length === 0) {
            req.flash('error', 'Invalid or expired reset link.');
            return res.redirect('/student/forgot-password');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            'UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE reset_password_token = $2',
            [hashedPassword, req.params.token]
        );

        req.flash('success', 'Password reset successfully! You can now login.');
        res.redirect('/auth/student-login');
    } catch (err) {
        console.error('Student reset-password POST error:', err);
        req.flash('error', 'Error resetting password. Please try again.');
        res.redirect(`/student/reset-password/${req.params.token}`);
    }
});

module.exports = router; // Note: Add BEFORE main module.exports in student.js
