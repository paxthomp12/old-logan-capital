const { initDatabase, query } = require('./database');

async function listAll() {
    console.log('=== All Submissions ===\n');

    try {
        await initDatabase();

        const submissions = query('SELECT * FROM submissions ORDER BY id');

        console.log(`Total submissions: ${submissions.length}\n`);

        submissions.forEach(sub => {
            console.log(`ID ${sub.id}: ${sub.ticker} (${sub.company_name})`);
            console.log(`  Submitter: ${sub.submitter_name}`);
            console.log(`  Status: ${sub.status}`);
            console.log(`  Scores:`, {
                confidence: sub.confidence_level,
                technical: sub.technical_score,
                fundamentals: sub.fundamentals_score,
                theme: sub.theme_score,
                sector: sub.sector_score,
                final: sub.final_score
            });

            // Get review count
            const reviews = query('SELECT COUNT(*) as count FROM reviews WHERE submission_id = ?', [sub.id]);
            console.log(`  Reviews: ${reviews[0].count}`);
            console.log('');
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

listAll().then(() => process.exit(0));
