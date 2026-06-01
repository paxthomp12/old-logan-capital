const { initDatabase, query, run, saveDatabase } = require('./database');

async function fixScores() {
    console.log('=== Fixing Final Scores ===');
    console.log('Recalculating scores with correct formula: (confidence + technical + fundamentals + theme + sector) / 4\n');

    try {
        // Initialize database
        await initDatabase();

        // Fix submissions
        console.log('Fixing submission scores...');
        const submissions = query(`
            SELECT id, confidence_level, technical_score, fundamentals_score,
                   theme_score, sector_score, final_score as old_final_score
            FROM submissions
            WHERE final_score IS NOT NULL
               OR (technical_score IS NOT NULL
                   AND fundamentals_score IS NOT NULL
                   AND theme_score IS NOT NULL
                   AND sector_score IS NOT NULL)
        `);

        let submissionsFixed = 0;
        submissions.forEach(sub => {
            // Calculate correct final score
            const newFinalScore = (
                (sub.confidence_level || 0) +
                (sub.technical_score || 0) +
                (sub.fundamentals_score || 0) +
                (sub.theme_score || 0) +
                (sub.sector_score || 0)
            ) / 4;

            // Update the submission
            run(`
                UPDATE submissions
                SET final_score = ?
                WHERE id = ?
            `, [newFinalScore, sub.id]);

            console.log(`  Submission ${sub.id}: ${sub.old_final_score?.toFixed(2) || 'NULL'} → ${newFinalScore.toFixed(2)}`);
            submissionsFixed++;
        });

        console.log(`\n✓ Fixed ${submissionsFixed} submission scores\n`);

        // Fix reviews
        console.log('Fixing review scores...');
        const reviews = query(`
            SELECT id, confidence_level, technical_score, fundamentals_score,
                   theme_score, sector_score, final_score as old_final_score
            FROM reviews
            WHERE final_score IS NOT NULL
               OR (technical_score IS NOT NULL
                   AND fundamentals_score IS NOT NULL
                   AND theme_score IS NOT NULL
                   AND sector_score IS NOT NULL)
        `);

        let reviewsFixed = 0;
        reviews.forEach(rev => {
            // Calculate correct final score
            const newFinalScore = (
                (rev.confidence_level || 0) +
                (rev.technical_score || 0) +
                (rev.fundamentals_score || 0) +
                (rev.theme_score || 0) +
                (rev.sector_score || 0)
            ) / 4;

            // Update the review
            run(`
                UPDATE reviews
                SET final_score = ?
                WHERE id = ?
            `, [newFinalScore, rev.id]);

            console.log(`  Review ${rev.id}: ${rev.old_final_score?.toFixed(2) || 'NULL'} → ${newFinalScore.toFixed(2)}`);
            reviewsFixed++;
        });

        console.log(`\n✓ Fixed ${reviewsFixed} review scores\n`);

        // Update watchlist avg_final_score
        console.log('Updating watchlist average scores...');
        const watchlistItems = query(`
            SELECT w.id, w.submission_id
            FROM watchlist w
        `);

        let watchlistFixed = 0;
        watchlistItems.forEach(item => {
            // Get all final scores for this submission (submitter + reviewers)
            const submission = query(`
                SELECT final_score FROM submissions WHERE id = ?
            `, [item.submission_id]);

            const reviewScores = query(`
                SELECT final_score FROM reviews WHERE submission_id = ?
            `, [item.submission_id]);

            const allScores = [
                ...submission.map(s => s.final_score),
                ...reviewScores.map(r => r.final_score)
            ].filter(score => score !== null && score !== undefined);

            if (allScores.length > 0) {
                const avgScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;

                run(`
                    UPDATE watchlist
                    SET avg_confidence = ?
                    WHERE id = ?
                `, [avgScore, item.id]);

                console.log(`  Watchlist item ${item.id}: Average final score = ${avgScore.toFixed(2)}`);
                watchlistFixed++;
            }
        });

        console.log(`\n✓ Fixed ${watchlistFixed} watchlist items\n`);

        console.log('=== Score Fix Complete ===');
        console.log(`Total fixed: ${submissionsFixed} submissions, ${reviewsFixed} reviews, ${watchlistFixed} watchlist items`);

    } catch (error) {
        console.error('Error fixing scores:', error);
        process.exit(1);
    }
}

// Run the fix
fixScores().then(() => {
    console.log('\nDone!');
    process.exit(0);
});
