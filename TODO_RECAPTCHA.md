# reCAPTCHA v3 Implementation TODO

## Status: [IN PROGRESS]

### Phase 1: Backend Verification [✅]
- [✅] routes/auth.js - Add verifyRecaptcha() + protect 5 POST endpoints
- [✅] routes/contact.js - Protect POST /contact
- [✅] Delete routes/auth-fixed.js (duplicate)

### Phase 2: Client Integration [✅]
- [✅] public/js/main.js - Load reCAPTCHA v3 + form integration
- [✅] views/auth/student-login.ejs - Add recaptcha div
- [✅] views/auth/staff-login.ejs - Add recaptcha div
- [✅] views/auth/student-register.ejs - Add recaptcha div
- [✅] views/auth/forgot-password.ejs - Add recaptcha div
- [✅] views/auth/reset-password.ejs - Add recaptcha div  
- [✅] views/public/contact.ejs - Add recaptcha div

### Phase 3: Config & Deploy [✅]
- [✅] server.js - Add env logging
- [✅] render.yaml - Add RECAPTCHA env vars
- [✅] Create .env + RECAPTCHA_SETUP.md
- [✅] Local testing: npm start
- [ ] Deploy & verify Render

### Phase 4: Completion [ ]
- [ ] Update README.md
- [ ] attempt_completion
