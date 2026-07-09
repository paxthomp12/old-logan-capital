const db = require('./server/database');

async function checkAttachments() {
    await db.initDatabase();

    console.log('\n=== ALL Submissions ===');
    const allSubmissions = db.query('SELECT id, ticker, company_name, submitter_name, created_at FROM submissions ORDER BY id DESC LIMIT 10');
    console.log('Recent submissions:', allSubmissions);

    console.log('\n=== ALL Attachments in Database ===');
    const allAttachments = db.query('SELECT * FROM attachments');
    console.log('All attachments:', allAttachments);

    if (allSubmissions.length > 0) {
        const latestId = allSubmissions[0].id;
        console.log(`\n=== Checking Latest Submission (ID ${latestId}) ===`);
        const submission = db.query('SELECT * FROM submissions WHERE id = ?', [latestId]);
        console.log('Latest submission:', submission);

        const attachments = db.query('SELECT * FROM attachments WHERE submission_id = ?', [latestId]);
        console.log('Attachments for latest:', attachments);
    }

    process.exit(0);
}

checkAttachments();
