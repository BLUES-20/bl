// routes/staff.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');

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

// Staff Root Route - Redirect to Dashboard
router.get('/', (req, res) => {
    res.redirect('/staff/dashboard');
});

// Staff Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        // Fetch total registered students count
        const countResult = await db.query('SELECT COUNT(*) FROM students');
        const studentCount = countResult.rows[0].count;

        res.render('staff/dashboard', {
            title: 'Staff Dashboard - Islamic School',
            page: 'staff-dashboard',
            staff: req.session.staff,
            studentCount
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        req.flash('error', 'Error loading dashboard data');
        res.redirect('/auth/staff-login');
    }
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
router.get('/upload-result', async (req, res) => {
    let uploadedSubjects = [];

    // If we have student details in query, fetch their existing results for this term
    if (req.query.admission_number && req.query.term && req.query.academic_year) {
        try {
            const studentRes = await db.query('SELECT id FROM students WHERE admission_number = $1', [req.query.admission_number]);
            if (studentRes.rows.length > 0) {
                const student_id = studentRes.rows[0].id;
                const subRes = await db.query(
                    'SELECT subject, score, grade FROM results WHERE student_id = $1 AND term = $2 AND academic_year = $3 ORDER BY id DESC',
                    [student_id, req.query.term, req.query.academic_year]
                );
                uploadedSubjects = subRes.rows;
            }
        } catch (err) { console.error(err); }
    }

    res.render('staff/upload-result', {
        title: 'Upload Student Results - Islamic School',
        page: 'upload-result',
        staff: req.session.staff,
        query: req.query,
        uploadedSubjects
    });
});

// Process Upload Result - Updated for multiple subjects and deletions
router.post('/upload-result', async (req, res) => {
    const { admission_number, class_name, subjects, scores, delete_subjects, term, academic_year } = req.body;

    // Ensure we don't pass "undefined" strings in the URL
    const safeClassName = class_name || '';
    const safeTerm = term || '';
    const safeYear = academic_year || '';

    const redirectUrl = `/staff/upload-result?admission_number=${encodeURIComponent(admission_number)}&class_name=${encodeURIComponent(safeClassName)}&term=${encodeURIComponent(safeTerm)}&academic_year=${encodeURIComponent(safeYear)}`;

    try {
        // 1. Basic Validation
        if (!admission_number || !term || !academic_year) {
            req.flash('error', 'Student admission number, term, and academic year are required.');
            return res.redirect(redirectUrl);
        }

        // 2. Find Student
        const studentResult = await db.query('SELECT id FROM students WHERE admission_number = $1', [admission_number]);

        if (studentResult.rows.length === 0) {
            req.flash('error', 'Student with that admission number not found.');
            return res.redirect(redirectUrl);
        }

        const student_id = studentResult.rows[0].id;

        // 3. Handle Deletions First
        let deletedCount = 0;
        if (delete_subjects && (Array.isArray(delete_subjects) ? delete_subjects.length > 0 : delete_subjects)) {
            const subjectsToDelete = Array.isArray(delete_subjects) ? delete_subjects : [delete_subjects];

            for (const subjectToDelete of subjectsToDelete) {
                try {
                    await db.query(
                        'DELETE FROM results WHERE student_id = $1 AND subject = $2 AND term = $3 AND academic_year = $4',
                        [student_id, subjectToDelete.trim().toUpperCase(), term, academic_year]
                    );
                    deletedCount++;
                } catch (deleteErr) {
                    console.error(`Error deleting ${subjectToDelete}:`, deleteErr);
                }
            }
        }

        // 4. Handle Updates/Inserts
        let subjectArray = [];
        let scoreArray = [];

        if (Array.isArray(subjects)) {
            subjectArray = subjects;
            scoreArray = Array.isArray(scores) ? scores : [];
        } else if (subjects && scores) {
            // Single subject case (backward compatibility)
            subjectArray = [subjects];
            scoreArray = [scores];
        }

        // Filter out empty entries
        const validEntries = subjectArray.map((subject, index) => ({
            subject: subject?.trim(),
            score: scoreArray[index]
        })).filter(entry => entry.subject && entry.score);

        let uploadedCount = 0;
        let updatedCount = 0;
        let errorMessages = [];

        // Process each valid subject
        for (const entry of validEntries) {
            try {
                const numScore = parseFloat(entry.score);

                if (isNaN(numScore) || numScore < 0 || numScore > 100) {
                    errorMessages.push(`${entry.subject}: Score must be between 0 and 100`);
                    continue;
                }

                let grade = 'F';
                if (numScore >= 70) grade = 'A';
                else if (numScore >= 60) grade = 'B';
                else if (numScore >= 50) grade = 'C';
                else if (numScore >= 45) grade = 'D';
                else if (numScore >= 40) grade = 'E';

                // Check if this subject already exists
                const existingResult = await db.query(
                    'SELECT id FROM results WHERE student_id = $1 AND subject = $2 AND term = $3 AND academic_year = $4',
                    [student_id, entry.subject.toUpperCase(), term, academic_year]
                );

                const exists = existingResult.rows.length > 0;

                // Insert or update
                await db.query(
                    `INSERT INTO results (student_id, subject, score, grade, term, academic_year)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (student_id, subject, term, academic_year)
                     DO UPDATE SET score = EXCLUDED.score, grade = EXCLUDED.grade`,
                    [student_id, entry.subject.toUpperCase(), numScore, grade, term, academic_year]
                );

                if (exists) {
                    updatedCount++;
                } else {
                    uploadedCount++;
                }
            } catch (subjectErr) {
                console.error(`Error processing ${entry.subject}:`, subjectErr);
                errorMessages.push(`${entry.subject}: Processing failed`);
            }
        }

        // 5. Provide Comprehensive Feedback
        let successMessages = [];
        if (deletedCount > 0) {
            successMessages.push(`🗑️ Deleted ${deletedCount} subject${deletedCount > 1 ? 's' : ''}`);
        }
        if (uploadedCount > 0) {
            successMessages.push(`✅ Added ${uploadedCount} new subject${uploadedCount > 1 ? 's' : ''}`);
        }
        if (updatedCount > 0) {
            successMessages.push(`🔄 Updated ${updatedCount} subject${updatedCount > 1 ? 's' : ''}`);
        }

        if (successMessages.length > 0) {
            req.flash('success', successMessages.join(' | '));
        }

        if (errorMessages.length > 0) {
            req.flash('error', `Some operations failed: ${errorMessages.join(', ')}`);
        }

        if (deletedCount === 0 && uploadedCount === 0 && updatedCount === 0 && validEntries.length > 0) {
            req.flash('error', 'No changes were made. Please check your input.');
        }

        res.redirect(redirectUrl);
    } catch (err) {
        console.error('Upload error:', err);
        req.flash('error', 'Error processing results. Please try again.');
        res.redirect(redirectUrl);
    }
});

// View Results Page
router.get('/view-results', async (req, res) => {
    // Check if we have query parameters (redirected from delete or manual link)
    if (req.query.admission_number && req.query.term && req.query.academic_year) {
        const { admission_number, term, academic_year } = req.query;
        
        try {
            const studentRes = await db.query(
                'SELECT id, first_name, last_name, admission_number, class FROM students WHERE admission_number = $1',
                [admission_number]
            );

            if (studentRes.rows.length === 0) {
                req.flash('error', 'Student not found.');
                return res.render('staff/view-results', { title: 'View Results', page: 'view-results', staff: req.session.staff, search: false });
            }

            const student = studentRes.rows[0];
            const resultsRes = await db.query(
                'SELECT subject, score, grade FROM results WHERE student_id = $1 AND term = $2 AND academic_year = $3 ORDER BY subject',
                [student.id, term, academic_year]
            );

            const results = resultsRes.rows;
            const totalScore = results.reduce((sum, r) => sum + parseFloat(r.score), 0);

            return res.render('staff/view-results', {
                title: 'View Student Results - Islamic School',
                page: 'view-results',
                staff: req.session.staff,
                search: true,
                student,
                results,
                term,
                academic_year,
                totalScore
            });
        } catch (err) {
            console.error(err);
        }
    }

    res.render('staff/view-results', {
        title: 'View Student Results - Islamic School',
        page: 'view-results',
        staff: req.session.staff,
        search: false
    });
});

// Process View Results
router.post('/view-results', async (req, res) => {
    const { admission_number, term, academic_year } = req.body;

    try {
        const studentRes = await db.query(
            'SELECT id, first_name, last_name, admission_number, class FROM students WHERE admission_number = $1',
            [admission_number]
        );

        if (studentRes.rows.length === 0) {
            req.flash('error', 'Student with that admission number not found.');
            return res.redirect('/staff/view-results');
        }

        const student = studentRes.rows[0];
        const resultsRes = await db.query(
            'SELECT subject, score, grade FROM results WHERE student_id = $1 AND term = $2 AND academic_year = $3 ORDER BY subject',
            [student.id, term, academic_year]
        );

        const results = resultsRes.rows;
        let totalScore = 0;
        if (results.length > 0) {
            totalScore = results.reduce((sum, result) => sum + parseFloat(result.score), 0);
        }

        res.render('staff/view-results', {
            title: 'View Student Results - Islamic School',
            page: 'view-results',
            staff: req.session.staff,
            search: true,
            student,
            results,
            term,
            academic_year,
            totalScore
        });
    } catch (err) {
        console.error('View results error:', err);
        req.flash('error', 'Error retrieving results.');
        res.redirect('/staff/view-results');
    }
});

// Add Single Result
router.post('/add-single-result', async (req, res) => {
    try {
        const { admission_number, term, academic_year, subject, score } = req.body;

        console.log('=== ADD SINGLE RESULT START ===');
        console.log('Add request data:', { admission_number, term, academic_year, subject, score });

        // Clean up parameters
        const cleanAdmissionNumber = admission_number.trim();
        const cleanTerm = term.trim();
        const cleanAcademicYear = academic_year.trim();
        const cleanSubject = subject.trim().toUpperCase();
        const cleanScore = parseFloat(score);

        console.log('Cleaned parameters:', { 
            cleanAdmissionNumber, 
            cleanTerm, 
            cleanAcademicYear, 
            cleanSubject,
            cleanScore
        });

        // Validate input parameters
        if (!cleanAdmissionNumber || !cleanTerm || !cleanAcademicYear || !cleanSubject || isNaN(cleanScore)) {
            console.log('❌ Validation failed - missing or invalid parameters');
            req.flash('error', 'Missing required parameters for adding result.');
            return res.redirect(`/staff/view-results?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanAcademicYear)}`);
        }

        // Validate score range
        if (cleanScore < 0 || cleanScore > 100) {
            console.log('❌ Invalid score range:', cleanScore);
            req.flash('error', 'Score must be between 0 and 100.');
            return res.redirect(`/staff/view-results?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanAcademicYear)}`);
        }

        // Find student by admission number
        const studentRes = await db.query('SELECT id FROM students WHERE admission_number = $1', [cleanAdmissionNumber]);
        
        if (studentRes.rows.length === 0) {
            console.log('❌ Student not found:', cleanAdmissionNumber);
            req.flash('error', 'Student not found.');
            return res.redirect(`/staff/view-results?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanAcademicYear)}`);
        }
        
        const student_id = studentRes.rows[0].id;
        console.log('✅ Student found, ID:', student_id);

        // Calculate grade based on score
        let grade = 'F';
        if (cleanScore >= 70) grade = 'A';
        else if (cleanScore >= 60) grade = 'B';
        else if (cleanScore >= 50) grade = 'C';
        else if (cleanScore >= 45) grade = 'D';
        else if (cleanScore >= 40) grade = 'E';

        console.log(`Calculated grade: ${grade} for score: ${cleanScore}`);

        // Insert the new result
        const insertResult = await db.query(
            `INSERT INTO results (student_id, subject, score, grade, term, academic_year)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (student_id, subject, term, academic_year)
             DO UPDATE SET score = EXCLUDED.score, grade = EXCLUDED.grade, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [student_id, cleanSubject, cleanScore, grade, cleanTerm, cleanAcademicYear]
        );
        
        console.log('Insert query result:', insertResult.rows);
        console.log('Number of rows affected:', insertResult.rows.length);
        
        if (insertResult.rows.length > 0) {
            const isUpdate = insertResult.rows[0].created_at !== insertResult.rows[0].updated_at;
            console.log(isUpdate ? '✅ Successfully updated existing result:' : '✅ Successfully added new result:');
            console.log(insertResult.rows[0]);
            req.flash('success', `Successfully ${isUpdate ? 'updated' : 'added'} ${subject} result.`);
        } else {
            console.log('❌ No result was inserted or updated');
            req.flash('warning', `No ${subject} result was added. Please try again.`);
        }
        
    } catch (err) {
        console.error('❌ Add result error:', err);
        req.flash('error', `Error adding result: ${err.message}`);
    }

    // Redirect back to view results with query params so the table reloads
    const redirectUrl = `/staff/view-results?admission_number=${encodeURIComponent(req.body.admission_number)}&term=${encodeURIComponent(req.body.term)}&academic_year=${encodeURIComponent(req.body.academic_year)}`;
    console.log('=== ADD SINGLE RESULT END ===');
    res.redirect(redirectUrl);
});

// Edit Single Result
router.post('/edit-result/:admission_number/:term/*', async (req, res) => {
    try {
        const { admission_number, term } = req.params;
        const academic_year = req.params[0];
        const { subject, score, grade } = req.body;

        console.log('=== EDIT REQUEST START ===');
        console.log('Raw params from URL:', { admission_number, term, academic_year });
        console.log('Edit data:', { subject, score, grade });

        // Clean up parameters
        const cleanAdmissionNumber = admission_number.trim();
        const cleanTerm = term.trim();
        const cleanAcademicYear = academic_year.trim();
        const cleanSubject = subject.trim().toUpperCase();
        const cleanScore = parseFloat(score);
        const cleanGrade = grade.trim();

        console.log('Cleaned parameters:', { 
            cleanAdmissionNumber, 
            cleanTerm, 
            cleanAcademicYear, 
            cleanSubject,
            cleanScore,
            cleanGrade
        });

        // Validate input parameters
        if (!cleanAdmissionNumber || !cleanTerm || !cleanAcademicYear || !cleanSubject || isNaN(cleanScore)) {
            console.log('❌ Validation failed - missing or invalid parameters');
            req.flash('error', 'Missing required parameters for editing.');
            return res.redirect(`/staff/view-results?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanAcademicYear)}`);
        }

        // Validate score range
        if (cleanScore < 0 || cleanScore > 100) {
            console.log('❌ Invalid score range:', cleanScore);
            req.flash('error', 'Score must be between 0 and 100.');
            return res.redirect(`/staff/view-results?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanAcademicYear)}`);
        }

        // Find student by admission number
        const studentRes = await db.query('SELECT id FROM students WHERE admission_number = $1', [cleanAdmissionNumber]);
        
        if (studentRes.rows.length === 0) {
            console.log('❌ Student not found:', cleanAdmissionNumber);
            req.flash('error', 'Student not found.');
            return res.redirect(`/staff/view-results?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanAcademicYear)}`);
        }
        
        const student_id = studentRes.rows[0].id;
        console.log('✅ Student found, ID:', student_id);

        // Update the specific result
        const updateResult = await db.query(
            `UPDATE results 
             SET score = $1, grade = $2, updated_at = CURRENT_TIMESTAMP
             WHERE student_id = $3 
             AND UPPER(TRIM(subject)) = $4 
             AND TRIM(term) = $5 
             AND TRIM(academic_year) = $6 
             RETURNING *`,
            [cleanScore, cleanGrade, student_id, cleanSubject, cleanTerm, cleanAcademicYear]
        );
        
        console.log('Update query result:', updateResult.rows);
        console.log('Number of rows updated:', updateResult.rows.length);
        
        if (updateResult.rows.length > 0) {
            console.log('✅ Successfully updated:', updateResult.rows[0]);
            req.flash('success', `Successfully updated ${subject} result.`);
        } else {
            console.log('❌ No result found to update');
            req.flash('warning', `No ${subject} result found to update. Please check the subject name and try again.`);
        }
        
    } catch (err) {
        console.error('❌ Edit error:', err);
        req.flash('error', `Error editing result: ${err.message}`);
    }

    // Redirect back to view results with query params so the table reloads
    const redirectUrl = `/staff/view-results?admission_number=${encodeURIComponent(req.params.admission_number)}&term=${encodeURIComponent(req.params.term)}&academic_year=${encodeURIComponent(req.params[0])}`;
    console.log('=== EDIT REQUEST END ===');
    res.redirect(redirectUrl);
});

// Delete Single Result
router.post('/delete-result/:admission_number/:term/*', async (req, res) => {
    try {
        const { admission_number, term } = req.params;
        const academic_year = req.params[0];
        const { subject } = req.body;

        console.log('=== DELETE REQUEST START ===');
        console.log('Raw params from URL:', { admission_number, term, academic_year });
        console.log('Subject from form:', subject);

        // Clean up parameters - be more conservative
        const cleanAdmissionNumber = admission_number.trim();
        const cleanTerm = term.trim();
        const cleanAcademicYear = academic_year.trim();
        const cleanSubject = subject.trim().toUpperCase();

        console.log('Cleaned parameters:', { 
            cleanAdmissionNumber, 
            cleanTerm, 
            cleanAcademicYear, 
            cleanSubject 
        });

        // Validate input parameters
        if (!cleanAdmissionNumber || !cleanTerm || !cleanAcademicYear || !cleanSubject) {
            console.log('❌ Validation failed - missing parameters');
            req.flash('error', 'Missing required parameters for deletion.');
            return res.redirect(`/staff/view-results?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanAcademicYear)}`);
        }

        // Find student by admission number
        const studentRes = await db.query('SELECT id FROM students WHERE admission_number = $1', [cleanAdmissionNumber]);
        
        if (studentRes.rows.length === 0) {
            console.log('❌ Student not found:', cleanAdmissionNumber);
            req.flash('error', 'Student not found.');
            return res.redirect(`/staff/view-results?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanAcademicYear)}`);
        }
        
        const student_id = studentRes.rows[0].id;
        console.log('✅ Student found, ID:', student_id);

        // First, let's see what results exist for this student
        const existingResults = await db.query(
            'SELECT subject, term, academic_year FROM results WHERE student_id = $1',
            [student_id]
        );
        console.log('Existing results for student:', existingResults.rows);

        // Delete the specific result with more detailed logging
        const deleteResult = await db.query(
            `DELETE FROM results 
             WHERE student_id = $1 
             AND UPPER(TRIM(subject)) = $2 
             AND TRIM(term) = $3 
             AND TRIM(academic_year) = $4 
             RETURNING *`,
            [student_id, cleanSubject, cleanTerm, cleanAcademicYear]
        );
        
        console.log('Delete query result:', deleteResult.rows);
        console.log('Number of rows deleted:', deleteResult.rows.length);
        
        if (deleteResult.rows.length > 0) {
            console.log('✅ Successfully deleted:', deleteResult.rows[0]);
            req.flash('success', `Successfully deleted ${subject} result.`);
        } else {
            console.log('❌ No result found to delete');
            // Let's try to find what exists
            const similarResults = await db.query(
                `SELECT subject, term, academic_year 
                 FROM results 
                 WHERE student_id = $1 
                 AND (UPPER(TRIM(subject)) LIKE $2 OR UPPER(TRIM(subject)) LIKE $3)`,
                [student_id, `%${cleanSubject}%`, cleanSubject]
            );
            console.log('Similar subjects found:', similarResults.rows);
            
            req.flash('warning', `No ${subject} result found to delete. Please check the subject name and try again.`);
        }
        
    } catch (err) {
        console.error('❌ Delete error:', err);
        req.flash('error', `Error deleting result: ${err.message}`);
    }

    // Redirect back to view results with query params so the table reloads
    const redirectUrl = `/staff/view-results?admission_number=${encodeURIComponent(req.params.admission_number)}&term=${encodeURIComponent(req.params.term)}&academic_year=${encodeURIComponent(req.params[0])}`;
    console.log('=== DELETE REQUEST END ===');
    res.redirect(redirectUrl);
});

// Manage Students Page
router.get('/manage-students', async (req, res) => {
    try {
        const studentsRes = await db.query('SELECT * FROM students ORDER BY created_at DESC');
        res.render('staff/manage-students', {
            title: 'Manage Students - Islamic School',
            page: 'manage-students',
            staff: req.session.staff,
            students: studentsRes.rows
        });
    } catch (err) {
        console.error('Error fetching students:', err);
        req.flash('error', 'Could not load students list');
        res.redirect('/staff/dashboard');
    }
});

// Announcements Page
router.get('/announcements', (req, res) => {
    res.render('staff/announcements', {
        title: 'Announcements - Islamic School',
        page: 'announcements',
        staff: req.session.staff
    });
});

// Generate PDF Result for Staff View
router.get('/download-result/:admission_number/:term/:academic_year', async (req, res) => {
    const { admission_number, term, academic_year } = req.params;

    try {
        // Get student info
        const studentRes = await db.query(
            'SELECT id, first_name, last_name, admission_number, class FROM students WHERE admission_number = $1',
            [admission_number]
        );

        if (studentRes.rows.length === 0) {
            req.flash('error', 'Student not found.');
            return res.redirect('/staff/view-results');
        }

        const student = studentRes.rows[0];

        // Get results
        const resultsRes = await db.query(
            'SELECT subject, score, grade FROM results WHERE student_id = $1 AND term = $2 AND academic_year = $3 ORDER BY subject',
            [student.id, term, academic_year]
        );

        const results = resultsRes.rows;

        if (results.length === 0) {
            req.flash('error', 'No results found for this student in the selected term and year.');
            return res.redirect('/staff/view-results');
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
            const filename = `Academic_Result_${student.first_name}_${student.last_name}_${term.replace(' ', '_')}_${academic_year.replace('/', '_')}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(pdfBuffer);
        });

        // --- NEW PROFESSIONAL STYLE ---

        // 1. Header Section
        doc.fillColor('#1a5f3f') // Islamic Green Theme
           .fontSize(22)
           .font('Helvetica-Bold')
           .text('ISLAMIC SCHOOL MANAGEMENT SYSTEM', { align: 'center' });
           
        doc.fontSize(10)
           .font('Helvetica')
           .text('Excellence in Education & Morals', { align: 'center' });
           
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#1a5f3f').lineWidth(2).stroke();
        doc.moveDown(1.5);

        // 2. Student Information (Grid Layout)
        const startY = doc.y;
        
        // Left Column
        doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold').text('Name:', 50, startY);
        doc.font('Helvetica').text(`${student.first_name} ${student.last_name}`, 130, startY);
        
        doc.font('Helvetica-Bold').text('Admission No:', 50, startY + 20);
        doc.font('Helvetica').text(student.admission_number, 130, startY + 20);
        
        // Right Column
        doc.font('Helvetica-Bold').text('Class:', 350, startY);
        doc.font('Helvetica').text(student.class || 'N/A', 420, startY);
        
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
        doc.text('SCORE', 300, tableTop + 8, { width: 50, align: 'center' });
        doc.text('GRADE', 380, tableTop + 8, { width: 50, align: 'center' });
        doc.text('REMARK', 460, tableTop + 8, { width: 80, align: 'center' });

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
            doc.text(result.score, 300, currentY + 8, { width: 50, align: 'center' });
            
            // Colorize Grade
            if (result.grade === 'F') doc.fillColor('#dc3545'); // Red
            else if (result.grade === 'A') doc.fillColor('#198754'); // Green
            else doc.fillColor('#000000');
            
            doc.text(result.grade, 380, currentY + 8, { width: 50, align: 'center' });
            
            doc.fillColor('#000000');
            doc.text(remark, 460, currentY + 8, { width: 80, align: 'center' });
            
            currentY += itemHeight;
        });
        
        // Bottom Line
        doc.moveTo(50, currentY).lineTo(550, currentY).strokeColor('#aaaaaa').lineWidth(1).stroke();
        
        // 4. Summary Section (Aggregate & Average)
        const summaryY = currentY + 30;
        
        // Summary Box
        doc.rect(350, summaryY, 200, 80).strokeColor('#1a5f3f').lineWidth(1).stroke();
        doc.rect(350, summaryY, 200, 25).fill('#1a5f3f');
        
        doc.fillColor('#ffffff').font('Helvetica-Bold').text('PERFORMANCE SUMMARY', 350, summaryY + 8, { width: 200, align: 'center' });
        
        doc.fillColor('#000000').fontSize(10).font('Helvetica');
        
        // Aggregate Score
        doc.text('Aggregate Score:', 360, summaryY + 35);
        doc.font('Helvetica-Bold').text(totalScore.toFixed(2), 480, summaryY + 35, { align: 'right', width: 60 });
        
        // Average Score
        doc.font('Helvetica').text('Average Score:', 360, summaryY + 55);
        doc.font('Helvetica-Bold').text(averageScore + '%', 480, summaryY + 55, { align: 'right', width: 60 });

        // 5. Footer / Signatures
        const footerY = doc.page.height - 120;
        
        doc.moveTo(50, footerY).lineTo(200, footerY).strokeColor('#000000').lineWidth(1).stroke();
        doc.fontSize(10).font('Helvetica').text('Principal\'s Signature', 50, footerY + 10, { width: 150, align: 'center' });
        
        doc.moveTo(350, footerY).lineTo(500, footerY).stroke();
        doc.text('Date', 350, footerY + 10, { width: 150, align: 'center' });
        
        // Disclaimer
        doc.fontSize(8).fillColor('#6c757d').text('This result is computer generated.', 50, doc.page.height - 40, { align: 'center', width: 500 });

        doc.end();

    } catch (err) {
        console.error('PDF generation error:', err);
        req.flash('error', 'Error generating PDF. Please try again.');
        res.redirect('/staff/view-results');
    }
});

module.exports = router;
