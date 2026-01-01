const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// GET Contact Page
router.get('/contact', (req, res) => {
    res.render('public/contact', {
        title: 'Contact Us - Islamic School',
        page: 'contact'
    });
});

// POST Contact Form - Send Email Directly (No Database)
router.post('/contact', async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        req.flash('error', 'All fields are required');
        return res.redirect('/contact');
    }

    try {
        // Configure Email Sender
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'hammadibikunle@gmail.com',
                pass: 'aozh wrwo icaq bajq'
            }
        });

        // Email Content
        const mailOptions = {
            from: email, // Sender's email
            to: 'hammadibikunle@gmail.com', // Your email (where you want to receive it)
            replyTo: email, // So you can click "Reply" in your email
            subject: `New Message: ${subject}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #1a5f3f; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                        <h2 style="margin: 0;">📬 New Contact Form Message</h2>
                        <p style="margin: 5px 0 0 0;">Islamic School Management System</p>
                    </div>
                    <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 5px 5px;">
                        <h3>Contact Details:</h3>
                        <p><strong>Name:</strong> ${name}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Subject:</strong> ${subject}</p>
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                        
                        <h3>Message:</h3>
                        <div style="background-color: #fff; padding: 15px; border-left: 4px solid #1a5f3f; border-radius: 3px;">
                            <p style="margin: 0; white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</p>
                        </div>
                    </div>
                </div>
            `
        };

        // Send the email
        await transporter.sendMail(mailOptions);
        req.flash('success', 'Message sent successfully! We will contact you via email.');
        res.redirect('/contact');

    } catch (err) {
        console.error('Email error:', err);
        req.flash('error', 'Error sending message. Please try again later.');
        res.redirect('/contact');
    }
});

module.exports = router;
