const { initDatabase, query } = require('./database');

async function checkTickers() {
    console.log('=== Checking AMPX, CXDO, and CEPT ===\n');

    try {
        await initDatabase();

        const tickers = ['AMPX', 'CXDO', 'CEPT'];

        for (const ticker of tickers) {
            console.log(`\n--- ${ticker} ---`);

            // Get submission
            const submissions = query(`
                SELECT * FROM submissions WHERE ticker = ?
            `, [ticker]);

            if (submissions.length > 0) {
                const sub = submissions[0];
                console.log('Submission:', {
                    id: sub.id,
                    ticker: sub.ticker,
                    company_name: sub.company_name,
                    submitter_name: sub.submitter_name,
                    confidence_level: sub.confidence_level,
                    technical_score: sub.technical_score,
                    fundamentals_score: sub.fundamentals_score,
                    theme_score: sub.theme_score,
                    sector_score: sub.sector_score,
                    final_score: sub.final_score,
                    status: sub.status
                });

                // Get reviews
                const reviews = query(`
                    SELECT * FROM reviews WHERE submission_id = ?
                `, [sub.id]);

                console.log(`\nReviews (${reviews.length}):`);
                reviews.forEach((rev, idx) => {
                    console.log(`  Review ${idx + 1} (${rev.reviewer_name}):`, {
                        confidence_level: rev.confidence_level,
                        technical_score: rev.technical_score,
                        fundamentals_score: rev.fundamentals_score,
                        theme_score: rev.theme_score,
                        sector_score: rev.sector_score,
                        final_score: rev.final_score
                    });
                });
            } else {
                console.log('Not found in database');
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

checkTickers().then(() => process.exit(0));
