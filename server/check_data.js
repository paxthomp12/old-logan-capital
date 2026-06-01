const { initDatabase, query } = require('./database');

async function checkData() {
    console.log('=== Checking Database Contents ===\n');

    try {
        await initDatabase();

        // Check submissions
        const submissions = query('SELECT * FROM submissions');
        console.log(`Submissions: ${submissions.length} total`);
        if (submissions.length > 0) {
            console.log('Sample submission:', submissions[0]);
        }

        // Check reviews
        const reviews = query('SELECT * FROM reviews');
        console.log(`\nReviews: ${reviews.length} total`);
        if (reviews.length > 0) {
            console.log('Sample review:', reviews[0]);
        }

        // Check watchlist
        const watchlist = query('SELECT * FROM watchlist');
        console.log(`\nWatchlist items: ${watchlist.length} total`);
        if (watchlist.length > 0) {
            console.log('Sample watchlist item:', watchlist[0]);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

checkData().then(() => process.exit(0));
