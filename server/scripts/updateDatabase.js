import db from '../config/db.js';

// Small, non-destructive upgrades for databases created by the earlier build.
export async function updateDatabase() {
    const [acceptedColumns] = await db.query("SHOW COLUMNS FROM bookings LIKE 'accepted_at'");
    if (!acceptedColumns.length) {
        await db.query('ALTER TABLE bookings ADD COLUMN accepted_at DATETIME NULL AFTER cancelled_by');
    }
    for (const table of ['bookings', 'payments']) {
        const [columns] = await db.query(`SHOW COLUMNS FROM ${table} LIKE 'payment_status'`);
        if (columns.length && !columns[0].Type.includes('refunded')) {
            await db.query(`ALTER TABLE ${table} MODIFY payment_status ENUM('pending', 'paid', 'refunded') NOT NULL DEFAULT 'pending'`);
        }
    }
    const [messageColumns] = await db.query("SHOW COLUMNS FROM messages LIKE 'created_at'");
    if (messageColumns[0].Type !== 'datetime(6)') {
        await db.query('ALTER TABLE messages MODIFY created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)');
    }
    await db.query(`UPDATE verification_requests SET document_path = 'fixtures/demo-verification.txt'
        WHERE document_path = 'uploads/verification/demo-ravi-document.pdf'`);
    await db.query(`UPDATE provider_profiles p SET
        rating = (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.provider_id = p.id),
        review_count = (SELECT COUNT(*) FROM reviews r WHERE r.provider_id = p.id),
        completed_jobs = (SELECT COUNT(*) FROM bookings b WHERE b.provider_id = p.id AND b.status = 'completed')`);
}
