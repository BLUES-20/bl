const path = require('path');
require('dotenv').config({path: path.join(__dirname, '..', '.env')});

const {
    sendEmail,
    getEmailStatus
} = require('../services/email');

async function main() {
    const to = 'hammadibikunle@gmail.com';

    const status = getEmailStatus();
    console.log('Email status:', status);

    const ok = await sendEmail(
        to,
        'Test Email - Islamic School Management',
        '<p>This is a test email from your app. Gmail config test.</p>'
    );

    if (!ok) {
        console.error('Email failed to send. Check your EMAIL_USER/PASS or Gmail app pw.');
        process.exit(1);
    }

    console.log('✅ Email sent successfully to ' + to);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
