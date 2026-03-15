// Islamic School Management System - Main JavaScript

// Keep these helpers available globally for inline handlers in EJS.
window.confirmDelete = function confirmDelete(message) {
    return confirm(message || 'Are you sure you want to delete this item?');
};

window.printSection = function printSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>Print</title>');
    printWindow.document.write(
        '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">'
    );
    printWindow.document.write('<link rel="stylesheet" href="/css/style.css">');
    printWindow.document.write('</head><body>');
    printWindow.document.write(section.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
};

window.searchTable = function searchTable(inputId, tableId) {
    const input = document.getElementById(inputId);
    const table = document.getElementById(tableId);
    if (!input || !table) return;

    input.addEventListener('keyup', function () {
        const filter = this.value.toLowerCase();
        const rows = table.getElementsByTagName('tr');

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cells = row.getElementsByTagName('td');
            let found = false;

            for (let j = 0; j < cells.length; j++) {
                const cell = cells[j];
                if (!cell) continue;
                const textValue = cell.textContent || cell.innerText;
                if (textValue.toLowerCase().indexOf(filter) > -1) {
                    found = true;
                    break;
                }
            }

            row.style.display = found ? '' : 'none';
        }
    });
};

(function () {
    function initTooltips() {
        if (typeof bootstrap === 'undefined' || !bootstrap.Tooltip) return;
        const triggers = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        [...triggers].forEach((el) => new bootstrap.Tooltip(el));
    }

    function initAutoHideAlerts() {
        if (typeof bootstrap === 'undefined' || !bootstrap.Alert) return;
        const alerts = document.querySelectorAll('.alert');
        alerts.forEach((alert) => {
            setTimeout(() => {
                try {
                    const bsAlert = new bootstrap.Alert(alert);
                    bsAlert.close();
                } catch (e) {}
            }, 5000);
        });
    }

    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (!target) return;
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    }

    function initCardObserver() {
        if (typeof IntersectionObserver === 'undefined') return;
        const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
        const observer = new IntersectionObserver(function (entries) {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('fade-in');
                observer.unobserve(entry.target);
            });
        }, observerOptions);

        document.querySelectorAll('.card-islamic, .dashboard-card').forEach((card) => observer.observe(card));
    }

    function initImagePreview() {
        const imageInputs = document.querySelectorAll('input[type="file"][accept="image/*"]');
        imageInputs.forEach((input) => {
            input.addEventListener('change', function (e) {
                const file = e.target.files && e.target.files[0];
                const previewId = this.getAttribute('data-preview');
                if (!file || !previewId) return;

                const reader = new FileReader();
                reader.onload = function (evt) {
                    const preview = document.getElementById(previewId);
                    if (!preview) return;
                    preview.src = evt.target.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            });
        });
    }

    function hasRecaptchaWidget() {
        return Boolean(document.querySelector('form .g-recaptcha'));
    }

    // Templates use <div class="g-recaptcha" data-sitekey="..."></div> (reCAPTCHA v2 checkbox).
    function loadRecaptchaV2() {
        if (!hasRecaptchaWidget()) return;
        if (document.querySelector('script[data-recaptcha-v2="1"]')) return;

        const script = document.createElement('script');
        script.src = 'https://www.google.com/recaptcha/api.js';
        script.async = true;
        script.defer = true;
        script.setAttribute('data-recaptcha-v2', '1');
        document.head.appendChild(script);
    }

    function enforceRecaptchaOnForms() {
        if (!hasRecaptchaWidget()) return;

        const forms = Array.from(document.querySelectorAll('form')).filter((form) => form.querySelector('.g-recaptcha'));
        forms.forEach((form) => {
            if (form.getAttribute('data-recaptcha-bound') === '1') return;
            form.setAttribute('data-recaptcha-bound', '1');

            form.addEventListener('submit', function (e) {
                const tokenEl = form.querySelector('textarea[name="g-recaptcha-response"]');
                const token = tokenEl ? String(tokenEl.value || '').trim() : '';
                if (!token) {
                    e.preventDefault();
                    alert('Please complete the security verification');
                }
            });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        initTooltips();
        initAutoHideAlerts();
        initSmoothScroll();
        initCardObserver();
        initImagePreview();

        loadRecaptchaV2();
        enforceRecaptchaOnForms();
    });
})();
