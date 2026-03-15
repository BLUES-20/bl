// routes/student.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const emailService = require('../services/email');

// Middleware to check if student is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.student) {
        return next();
    }
    req.flash('error', 'Please login to access this page');
    res.redirect('/auth/student-login');
};

// Forgot/Reset password routes (public - no auth required)
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
            req.flash('error', 'No student account with that email.');
            return res.redirect('/student/forgot-password');
        }

        const token = crypto.randomBytes(20).toString('hex');
        const expires = new Date(Date.now() + 3600000);
        await db.query('UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE email = $3', [token, expires, email]);

        const appUrl = process.env.APP_URL || `http://${req.headers.host}`;
        const resetLink = `${appUrl}/student/reset-password/${token}`;

        const sent = await emailService.sendEmail(email, 'Reset Student Password', `Click to reset: ${resetLink}`);
        req.flash('success', sent ? 'Reset link sent to email!' : 'Email service issue - contact admin');
        res.redirect('/student/forgot-password');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Try again.');
        res.redirect('/student/forgot-password');
    }
});

router.get('/reset-password/:token', async (req, res) => {
    const result = await db.query('SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()', [req.params.token]);
    if (result.rows.length === 0) {
        req.flash('error', 'Invalid/expired link');
        return res.redirect('/student/forgot-password');
    }
    res.render('auth/student-reset-password', {
        title: 'Reset Password',
        page: 'student-reset-password',
        token: req.params.token
    });
});

router.post('/reset-password/:token', async (req, res) => {
    const { password, confirm_password } = req.body;
    if (password !== confirm_password || password.length < 6) {
        req.flash('error', 'Passwords mismatch or too short');
        return res.redirect(`/student/reset-password/${req.params.token}`);
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE reset_password_token = $2', [hashedPassword, req.params.token]);
    req.flash('success', 'Password reset! Login now.');
    res.redirect('/auth/student-login');
});

// Print Profile PDF - BEAUTIFIED with better layout, fonts, profile pic
router.get('/print-profile', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT s.*, u.email as user_email
            FROM students s LEFT JOIN users u ON s.user_id = u.id 
            WHERE s.id = $1
        `, [req.session.student.id]);
        const data = rows[0] || {};

        const fetchImageBuffer = async (imageUrl) => {
            const { URL } = require('url');
            const parsed = new URL(imageUrl);
            const httpModule = parsed.protocol === 'http:' ? require('http') : require('https');

            const maxBytes = 5 * 1024 * 1024; // 5MB
            const timeoutMs = 4000;

            return new Promise((resolve, reject) => {
                const req2 = httpModule.get(parsed, { timeout: timeoutMs, headers: { 'User-Agent': 'islamic-school/print-profile' } }, (resp) => {
                    if (resp.statusCode && resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
                        return resolve(fetchImageBuffer(resp.headers.location));
                    }
                    if (!resp.statusCode || resp.statusCode < 200 || resp.statusCode >= 300) {
                        return reject(new Error(`Image fetch failed (${resp.statusCode || 'no status'})`));
                    }

                    const chunks = [];
                    let total = 0;
                    resp.on('data', (chunk) => {
                        total += chunk.length;
                        if (total > maxBytes) {
                            resp.destroy();
                            reject(new Error('Image too large'));
                            return;
                        }
                        chunks.push(chunk);
                    });
                    resp.on('end', () => resolve(Buffer.concat(chunks)));
                });
                req2.on('timeout', () => {
                    req2.destroy(new Error('Image fetch timeout'));
                });
                req2.on('error', reject);
            });
        };

        const isAllowedImageUrl = (imageUrl) => {
            try {
                const parsed = new URL(imageUrl);
                if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

                const host = (parsed.hostname || '').toLowerCase();
                const reqHost = (req.headers.host || '').split(':')[0].toLowerCase();
                if (host === reqHost) return true;

                // Cloudinary (common for this app)
                if (host === 'res.cloudinary.com' || host.endsWith('.cloudinary.com')) return true;

                return false;
            } catch {
                return false;
            }
        };
        
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ size: 'A4', margin: 72 });
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            const pdf = Buffer.concat(buffers);
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Student_Profile_${data.admission_number || 'STU'}.pdf"`
            }).send(pdf);
        });

        // Subtle page background (keeps it official, not loud)
        doc.save();
        doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f6fbf8');
        doc.restore();

        // HEADER - Enhanced
        doc.fillColor('#1a5f3f').fontSize(28).font('Helvetica-Bold')
            .text('ISLAMIC SCHOOL', 50, 50, { width: 450, align: 'left' })
            .fontSize(16).text('Student Profile Record', 50, 85, { width: 450 });
        doc.fontSize(10).fillColor('#666').text('Excellence in Education & Islamic Values', 50, 105);
        
        doc.rect(50, 125, 510, 2).fill('#1a5f3f');
        // (Gold accent removed by request)

        // PROFILE PHOTO - Prominent
        doc.roundedRect(60, 130, 150, 180, 12).fillAndStroke('#ffffff', '#1a5f3f', 1.5);
        doc.save();
        doc.rect(60, 130, 150, 26).fill('#1a5f3f');
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9).text('PROFILE PHOTO', 60, 139, { width: 150, align: 'center' });
        doc.restore();
        const drawPhotoPlaceholder = (label = 'No Photo') => {
            doc.save();
            doc.fillColor('#e8f5e9').roundedRect(70, 160, 130, 150, 10).fill();
            doc.fillColor('#1a5f3f').font('Helvetica-Bold').fontSize(11).text(label, 70, 225, { width: 130, align: 'center' });
            doc.restore();
        };

        if (data.picture) {
            const stored = String(data.picture).replace(/\\/g, '/').trim();
            const normalized = stored.startsWith('/http://') || stored.startsWith('/https://') ? stored.slice(1) : stored;

            if (/^https?:\/\//i.test(normalized)) {
                if (isAllowedImageUrl(normalized)) {
                    try {
                        const buf = await fetchImageBuffer(normalized);
                        doc.save();
                        doc.roundedRect(70, 135, 130, 160, 10).clip();
                        doc.image(buf, 70, 135, { fit: [130, 160], align: 'center', valign: 'center' });
                        doc.restore();
                        doc.roundedRect(70, 135, 130, 160, 10).stroke('#ffffff');
                    } catch (e) {
                        drawPhotoPlaceholder('No Photo');
                    }
                } else {
                    drawPhotoPlaceholder('No Photo');
                }
            } else {
                const filePath =
                    normalized.startsWith('/')
                        ? path.join(__dirname, '../public', normalized.replace(/^\/+/, ''))
                        : /^[a-zA-Z]:[\\/]/.test(normalized)
                            ? normalized
                            : path.join(__dirname, '../public', normalized.replace(/^\/+/, ''));

                try {
                    doc.save();
                    doc.roundedRect(70, 135, 130, 160, 10).clip();
                    doc.image(filePath, 70, 135, { fit: [130, 160], align: 'center', valign: 'center' });
                    doc.restore();
                    doc.roundedRect(70, 135, 130, 160, 10).stroke('#ffffff');
                } catch (e) {
                    drawPhotoPlaceholder('No Photo');
                }
            }
        } else {
            drawPhotoPlaceholder('No Photo');
        }

        // BODY CONTENT - Official profile layout
        const pageLeft = 50;
        const pageWidth = 510;
        const bodyTop = 140;
        const cardPad = 12;
        const headerH = 24;
        const rowH = 22;
        const border = '#dfe7e3';
        const muted = '#6b7280';
        const ink = '#0f172a';
        const brandGreen = '#1a5f3f';
        const softRow = '#f0fbf4';
        const labelInk = '#065f46';

        const safeText = (v, fallback = 'N/A') => {
            if (v === null || v === undefined) return fallback;
            const s = String(v).trim();
            return s ? s : fallback;
        };

        const drawCard = (x, y, w, h, title, accentColor) => {
            doc.save();
            doc.lineWidth(1).strokeColor(border).fillColor('#ffffff');
            doc.roundedRect(x, y, w, h, 12).fillAndStroke();

            // Accent strip (optional)
            if (accentColor) doc.fillColor(accentColor).roundedRect(x, y, 7, h, 12).fill();

            // Title bar (brand)
            doc.fillColor(brandGreen).roundedRect(x, y, w, headerH, 12).fill();
            doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
                .text(title, x + cardPad, y + 7, { width: w - cardPad * 2 });

            // Underline under title (subtle)
            doc.fillColor('#dfe7e3').rect(x + 10, y + headerH - 1, w - 20, 2).fill();

            // Divider under title
            doc.lineWidth(1).strokeColor(border)
                .moveTo(x + 10, y + headerH).lineTo(x + w - 10, y + headerH).stroke();
            doc.restore();

            return y + headerH + 10;
        };

        const drawKeyValueRows = (rows, x, startY, w, labelW) => {
            let y = startY;
            const valueX = x + cardPad + labelW + 10;
            const valueW = w - cardPad * 2 - labelW - 10;

            rows.forEach((r, idx) => {
                const rowY = y + idx * rowH;

                if (idx % 2 === 0) {
                    doc.save();
                    doc.fillColor(softRow).rect(x + 1, rowY - 4, w - 2, rowH).fill();
                    doc.restore();
                }

                doc.fillColor(labelInk).font('Helvetica-Bold').fontSize(8.5)
                    .text(String(r[0]).toUpperCase(), x + cardPad, rowY, { width: labelW });

                doc.fillColor(ink).font('Helvetica').fontSize(10)
                    .text(safeText(r[1]), valueX, rowY - 1, { width: valueW });

                doc.save();
                doc.lineWidth(1).strokeColor('#eef2f7')
                    .moveTo(x + cardPad, rowY + rowH - 6).lineTo(x + w - cardPad, rowY + rowH - 6).stroke();
                doc.restore();
            });

            return startY + rows.length * rowH;
        };

        // Personal information (right of photo)
        const personalX = 220;
        const personalY = bodyTop;
        const personalW = 340;
        const personalH = 190;
        let cursorY = drawCard(personalX, personalY, personalW, personalH, 'PERSONAL INFORMATION', null);

        const personalRows = [
            ['Admission Number', data.admission_number || 'N/A'],
            ['Full Name', `${(data.first_name || '') + ' ' + (data.last_name || '')}`.trim()],
            ['Class / Grade', data.class],
            ['Email Address', data.user_email || data.email],
            ['Date of Birth', data.date_of_birth ? new Date(data.date_of_birth).toLocaleDateString('en-GB') : 'N/A'],
            ['Gender', data.gender ? String(data.gender).toUpperCase() : 'N/A']
        ];
        drawKeyValueRows(personalRows, personalX, cursorY, personalW, 120);

        // Parent / Guardian (full width)
        const guardianX = pageLeft;
        const guardianY = bodyTop + personalH + 18;
        const guardianW = pageWidth;
        const guardianH = 112;
        cursorY = drawCard(guardianX, guardianY, guardianW, guardianH, 'PARENT / GUARDIAN INFORMATION', null);
        const guardianRows = [
            ['Emergency Contact', data.parent_name],
            ['Contact Phone', data.parent_phone],
            ['Parent Email', data.parent_email]
        ];
        drawKeyValueRows(guardianRows, guardianX, cursorY, guardianW, 150);

        // Address (full width, auto height)
        const addressText = safeText(data.address, 'Not Provided');
        const addressX = pageLeft;
        const addressY = guardianY + guardianH + 14;
        const addressW = pageWidth;

        // Pre-calc content height
        doc.font('Helvetica').fontSize(10);
        const addressContentH = doc.heightOfString(addressText, { width: addressW - cardPad * 2, align: 'left' });
        const addressH = Math.max(78, headerH + 18 + addressContentH + 16);
        cursorY = drawCard(addressX, addressY, addressW, addressH, 'RESIDENTIAL ADDRESS', null);
        doc.fillColor(ink).font('Helvetica').fontSize(10)
            .text(addressText, addressX + cardPad, cursorY, { width: addressW - cardPad * 2, align: 'left' });

        // Soft watermark in the background (very light)
        doc.save();
        doc.opacity(0.05);
        doc.fillColor(brandGreen).font('Helvetica-Bold').fontSize(64)
            .text('ISLAMIC', pageLeft, 510, { width: pageWidth, align: 'center' })
            .text('SCHOOL', pageLeft, 570, { width: pageWidth, align: 'center' });
        doc.opacity(1);
        doc.restore();

        // Signature at footer (optional image)
        try {
            const signaturePath = path.join(__dirname, '../public/images/principal-signature.png');
            const sigX = pageLeft;
            // Keep signature clearly above the footer rule
            const sigY = 600;
            const sigW = 510;
            const sigH = 135;

            doc.save();
            doc.lineWidth(1).strokeColor(border).fillColor('#ffffff');
            doc.roundedRect(sigX, sigY, sigW, sigH, 12).fillAndStroke();
            doc.fillColor(brandGreen).font('Helvetica-Bold').fontSize(10)
                .text('AUTHORIZED SIGNATURE', sigX + 12, sigY + 10, { width: sigW - 24 });

            doc.image(signaturePath, sigX + 12, sigY + 40, { fit: [350, 85], align: 'left', valign: 'center' });
            doc.fillColor(muted).font('Helvetica').fontSize(10)
                .text('Principal / Registrar', sigX + 375, sigY + 88, { width: sigW - 387 });
            doc.restore();
        } catch (e) {
            // Silent fail - missing signature asset
        }

        // Footer timestamp
        doc.save();
        doc.fillColor(brandGreen).rect(pageLeft, 770, pageWidth, 2).fill();
        doc.restore();
        doc.fillColor(muted).font('Helvetica').fontSize(8.5)
            .text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`, pageLeft, 780, { width: pageWidth, align: 'right' });

        // (Certification/signature section removed by request)

        doc.end();
    } catch (err) {
        console.error('Print profile error:', err);
        req.flash('error', 'Print failed');
        res.redirect('/student/profile');
    }
});


// Apply authentication middleware to protected routes
router.use(isAuthenticated);

// Apply authentication middleware to protected routes
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
router.get('/check-result', async (req, res) => {
    let results = [];
    const {
        term,
        academic_year
    } = req.query;

    if (term && academic_year) {
        try {
            const query = `
                SELECT subject, score, grade 
                FROM results 
                WHERE student_id = $1 AND term = $2 AND academic_year = $3
            `;
            const {
                rows
            } = await db.query(query, [req.session.student.id, term, academic_year]);
            results = rows;

            if (results.length === 0) {
                req.flash('error', `No results found for ${term} ${academic_year}. Please check the term/year selected.`);
            }
        } catch (err) {
            console.error('Error fetching results:', err);
            req.flash('error', 'Error fetching results');
        }
    }

    res.render('student/check-result', {
        title: 'Check Result - Islamic School',
        page: 'check-result',
        student: req.session.student,
        results,
        term,
        academic_year
    });
});

router.post('/check-result', (req, res) => {
    const {
        term,
        academic_year
    } = req.body;
    res.redirect(`/student/check-result?term=${encodeURIComponent(term)}&academic_year=${encodeURIComponent(academic_year)}`);
});

// Announcements Page
router.get('/announcements', (req, res) => {
    res.render('student/announcements', {
        title: 'Announcements - Islamic School',
        page: 'announcements',
        student: req.session.student
    });
});

// Profile Page - Fetch student data including picture
router.get('/profile', async (req, res) => {
    try {
        // Fetch student details including picture from database
        const query = `
            SELECT s.id, s.admission_number, s.first_name, s.last_name, s.email,
                   s.class, s.date_of_birth, s.gender, s.picture, s.parent_name,
                   s.parent_phone, s.parent_email, s.address, u.email as user_email
            FROM students s 
            LEFT JOIN users u ON s.user_id = u.id
            WHERE s.id = $1
        `;

        const {
            rows
        } = await db.query(query, [req.session.student.id]);

        if (rows.length === 0) {
            req.flash('error', 'Student record not found');
            return res.redirect('/student/dashboard');
        }

        const studentData = rows[0];

        res.render('student/profile', {
            title: 'My Profile - Islamic School',
            page: 'profile',
            student: req.session.student,
            studentData: studentData
        });
    } catch (err) {
        console.error('Error fetching profile:', err);
        req.flash('error', 'Error loading profile');
        res.redirect('/student/dashboard');
    }
});

// Generate PDF Result
router.get('/download-result/:term/:academic_year', async (req, res) => {
    const {
        term,
        academic_year
    } = req.params;

    try {
        const query = `
            SELECT subject, score, grade
            FROM results
            WHERE student_id = $1 AND term = $2 AND academic_year = $3
            ORDER BY subject
        `;
        const {
            rows: results
        } = await db.query(query, [req.session.student.id, term, academic_year]);

        if (results.length === 0) {
            req.flash('error', 'No results found for the selected term and year.');
            return res.redirect('/student/check-result');
        }

        const totalScore = results.reduce((sum, result) => sum + parseFloat(result.score), 0);
        const averageScore = results.length > 0 ? (totalScore / results.length).toFixed(2) : '0.00';

        // Generate PDF using PDFKit with enhanced styling
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            bufferPages: true
        });

        // Collect PDF buffer
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            let pdfBuffer = Buffer.concat(buffers);
            const filename = `Academic_Result_${req.session.student.name.split(' ').join('_')}_${term.replace(' ', '_')}_${academic_year.replace('/', '_')}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(pdfBuffer);
        });

        // --- NEW PROFESSIONAL STYLE ---

        // 1. Header Section
        doc.fillColor('#1a5f3f') // Islamic Green Theme
            .fontSize(22)
            .font('Helvetica-Bold')
            .text('ISLAMIC SCHOOL MANAGEMENT SYSTEM', {
                align: 'center'
            });

        doc.fontSize(10)
            .font('Helvetica')
            .text('Excellence in Education & Morals', {
                align: 'center'
            });

        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#1a5f3f').lineWidth(2).stroke();
        doc.moveDown(1.5);

        // 2. Student Information (Grid Layout)
        const startY = doc.y;

        // Left Column
        doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold').text('Name:', 50, startY);
        doc.font('Helvetica').text(req.session.student.name, 130, startY);

        doc.font('Helvetica-Bold').text('Admission No:', 50, startY + 20);
        doc.font('Helvetica').text(req.session.student.admission_number, 130, startY + 20);

        // Right Column
        doc.font('Helvetica-Bold').text('Class:', 350, startY);
        doc.font('Helvetica').text(req.session.student.class || 'N/A', 420, startY);

        doc.font('Helvetica-Bold').text('Term:', 350, startY + 20);
        doc.font('Helvetica').text(term, 420, startY + 20);

        doc.font('Helvetica-Bold').text('Session:', 350, startY + 40);
        doc.font('Helvetica').text(academic_year, 420, startY + 40);

        doc.moveDown(4);

        // 3. Results Table
        const tableTop = doc.y;
        const itemHeight = 25;

        // Header Row
        doc.rect(50, tableTop, 500, itemHeight).fill('#1a5f3f');
        doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold');
        doc.text('SUBJECT', 60, tableTop + 8);
        doc.text('SCORE', 300, tableTop + 8, {
            width: 50,
            align: 'center'
        });
        doc.text('GRADE', 380, tableTop + 8, {
            width: 50,
            align: 'center'
        });
        doc.text('REMARK', 460, tableTop + 8, {
            width: 80,
            align: 'center'
        });

        let currentY = tableTop + itemHeight;

        // Data Rows
        doc.font('Helvetica').fontSize(10);

        results.forEach((result, i) => {
            // Zebra Striping
            if (i % 2 === 0) {
                doc.rect(50, currentY, 500, itemHeight).fill('#f9f9f9');
            }

            // Determine Remark
            let remark = 'Fail';
            if (result.grade === 'A') remark = 'Excellent';
            else if (result.grade === 'B') remark = 'Very Good';
            else if (result.grade === 'C') remark = 'Good';
            else if (result.grade === 'D') remark = 'Fair';
            else if (result.grade === 'E') remark = 'Pass';

            doc.fillColor('#000000');
            doc.text(result.subject, 60, currentY + 8);
            doc.text(result.score, 300, currentY + 8, {
                width: 50,
                align: 'center'
            });

            // Colorize Grade
            if (result.grade === 'F') doc.fillColor('#dc3545'); // Red
            else if (result.grade === 'A') doc.fillColor('#198754'); // Green
            else doc.fillColor('#000000');

            doc.text(result.grade, 380, currentY + 8, {
                width: 50,
                align: 'center'
            });

            doc.fillColor('#000000');
            doc.text(remark, 460, currentY + 8, {
                width: 80,
                align: 'center'
            });

            currentY += itemHeight;
        });

        // Bottom Line
        doc.moveTo(50, currentY).lineTo(550, currentY).strokeColor('#aaaaaa').lineWidth(1).stroke();

        // 4. Summary Section (Aggregate & Average)
        const summaryY = currentY + 30;

        // Summary Box
        doc.rect(350, summaryY, 200, 80).strokeColor('#1a5f3f').lineWidth(1).stroke();
        doc.rect(350, summaryY, 200, 25).fill('#1a5f3f');

        doc.fillColor('#ffffff').font('Helvetica-Bold').text('PERFORMANCE SUMMARY', 350, summaryY + 8, {
            width: 200,
            align: 'center'
        });

        doc.fillColor('#000000').fontSize(10).font('Helvetica');

        // Aggregate Score
        doc.text('Aggregate Score:', 360, summaryY + 35);
        doc.font('Helvetica-Bold').text(totalScore.toFixed(2), 480, summaryY + 35, {
            align: 'right',
            width: 60
        });

        // Average Score
        doc.font('Helvetica').text('Average Score:', 360, summaryY + 55);
        doc.font('Helvetica-Bold').text(averageScore + '%', 480, summaryY + 55, {
            align: 'right',
            width: 60
        });

        // 5. Footer / Signatures
        const footerY = doc.page.height - 120;

        // Add Signature Image (if exists) - Centered and "signed" on the line
        try {
            const path = require('path');
            const sigPath = path.join(__dirname, '../public/images/principal-signature.png');
            // Positioned to slightly overlap the line for a real signed look
            doc.image(sigPath, 60, footerY - 50, {
                width: 130
            });
        } catch (e) {
            console.log('Signature image not found, skipping...');
        }

        doc.moveTo(50, footerY).lineTo(200, footerY).strokeColor('#000000').lineWidth(1).stroke();
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text('Principal\'s Signature', 50, footerY + 10, {
            width: 150,
            align: 'center'
        });

        // Automatic Date - Arranged to the right margin with premium styling
        const currentDate = new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a5f3f').text(currentDate, 350, footerY - 18, {
            width: 150,
            align: 'center'
        });

        doc.moveTo(350, footerY).lineTo(500, footerY).strokeColor('#000000').stroke();
        doc.fontSize(10).font('Helvetica').fillColor('#666666').text('Date Issued', 350, footerY + 10, {
            width: 150,
            align: 'center'
        });

        // Disclaimer - Well arranged at the bottom
        doc.fontSize(8).fillColor('#999999').text('This academic report is computer generated and officially validated by the school administration.', 50, doc.page.height - 40, {
            align: 'center',
            width: 500
        });

        doc.end();

    } catch (err) {
        console.error('PDF generation error:', err);
        req.flash('error', 'Error generating PDF. Please try again.');
        res.redirect('/student/check-result');
    }
});

module.exports = router;
