const axios = require('axios');

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || 'https://discordapp.com/api/webhooks/1500951215226355872/QYoU0Xk0f4CvDATn1SAYl2qxaZK7wVx39SaDTwOuFqgywcfj5cszM00FTO76pNuQcfxP';

console.log('[Discord] Webhook URL configured:', WEBHOOK_URL ? 'Yes (length: ' + WEBHOOK_URL.length + ')' : 'No');

// Helper function to send webhook with retry logic for rate limiting
async function sendWebhookWithRetry(payload, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`[Discord] Sending request (attempt ${attempt}/${retries})...`);
            const response = await axios.post(WEBHOOK_URL, payload, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            console.log(`[Discord] ✓ Request successful! Status: ${response.status}`);
            return response;
        } catch (error) {
            const status = error.response?.status;
            const retryAfter = error.response?.headers?.['retry-after'] || error.response?.data?.retry_after;

            // If rate limited (429), wait and retry
            if (status === 429 && attempt < retries) {
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(1000 * Math.pow(2, attempt), 10000);
                console.warn(`[Discord] ⚠ Rate limited (429). Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            // For other errors or final attempt, throw
            console.error(`[Discord] ✗ Request failed on attempt ${attempt}/${retries}`);
            console.error('[Discord]   Status:', status);
            console.error('[Discord]   Message:', error.message);
            console.error('[Discord]   Response data:', error.response?.data);

            if (attempt === retries) {
                throw error;
            }
        }
    }
}

async function sendNewSubmissionNotification(ticker, submitterName) {
    console.log('[Discord] Attempting to send new submission notification:', { ticker, submitterName });
    try {
        const payload = {
            embeds: [{
                title: '📊 New Watchlist Submission',
                description: `**${submitterName}** has submitted **${ticker}** for review`,
                color: 0x1A3A2E, // Forest green
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'Old Logan Capital Watchlist System'
                }
            }]
        };
        await sendWebhookWithRetry(payload);
        console.log('[Discord] ✓ New submission notification sent successfully');
    } catch (error) {
        console.error('[Discord] ✗ New submission notification FINAL FAILURE after all retries');
        console.error('[Discord]   This error will NOT block the submission');
    }
}

async function sendReviewCompleteNotification(ticker, reviewerName, reviewsCompleted, totalReviews) {
    console.log('[Discord] Attempting to send review complete notification:', { ticker, reviewerName, reviewsCompleted, totalReviews });
    try {
        const payload = {
            embeds: [{
                title: '✅ Review Completed',
                description: `**${reviewerName}** has completed their review of **${ticker}**\n\nProgress: ${reviewsCompleted}/${totalReviews} reviews complete`,
                color: 0x2D5A4A, // Forest light
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'Old Logan Capital Watchlist System'
                }
            }]
        };
        await sendWebhookWithRetry(payload);
        console.log('[Discord] ✓ Review complete notification sent successfully');
    } catch (error) {
        console.error('[Discord] ✗ Review complete notification FINAL FAILURE after all retries');
        console.error('[Discord]   This error will NOT block the review submission');
    }
}

async function sendAllReviewsCompleteNotification(ticker, avgConfidence) {
    console.log('[Discord] Attempting to send all reviews complete notification:', { ticker, avgConfidence });
    try {
        const confidenceStars = '⭐'.repeat(Math.round(avgConfidence));
        const payload = {
            embeds: [{
                title: '🎯 Ready for Review',
                description: `All reviews for **${ticker}** are complete!\n\n**Average Confidence:** ${avgConfidence.toFixed(2)}/5 ${confidenceStars}\n\nResults are now visible to the team.`,
                color: 0xC9A962, // Gold
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'Old Logan Capital Watchlist System'
                }
            }]
        };
        await sendWebhookWithRetry(payload);
        console.log('[Discord] ✓ All reviews complete notification sent successfully');
    } catch (error) {
        console.error('[Discord] ✗ All reviews complete notification FINAL FAILURE after all retries');
        console.error('[Discord]   This error will NOT block the process');
    }
}

module.exports = {
    sendNewSubmissionNotification,
    sendReviewCompleteNotification,
    sendAllReviewsCompleteNotification
};
