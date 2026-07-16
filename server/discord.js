const axios = require('axios');

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Validate webhook URL format and security
if (!WEBHOOK_URL) {
    console.error('[Discord] ERROR: DISCORD_WEBHOOK_URL is not set in environment variables');
} else {
    try {
        const url = new URL(WEBHOOK_URL);
        // Ensure it's a Discord webhook URL
        if (!url.hostname.includes('discord.com') && !url.hostname.includes('discordapp.com')) {
            console.error('[Discord] WARNING: DISCORD_WEBHOOK_URL does not appear to be a valid Discord webhook URL');
        }
        // Ensure it's HTTPS
        if (url.protocol !== 'https:') {
            console.error('[Discord] WARNING: DISCORD_WEBHOOK_URL should use HTTPS protocol');
        }
    } catch (error) {
        console.error('[Discord] ERROR: DISCORD_WEBHOOK_URL is not a valid URL');
    }
}

// Helper function: Send webhook with retry logic for rate limiting
async function sendWebhookWithRetry(payload, maxRetries = 3) {
    if (!WEBHOOK_URL) {
        console.error('[Discord] Cannot send webhook - DISCORD_WEBHOOK_URL not configured');
        return false;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await axios.post(WEBHOOK_URL, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });

            // Success - always log successful webhook sends
            console.log(`[Discord] ✓ Webhook sent successfully${attempt > 1 ? ` after ${attempt} attempts` : ''}`);
            return true;
        } catch (error) {
            const status = error.response?.status;
            const retryAfter = error.response?.headers?.['retry-after'] || error.response?.data?.retry_after;

            // Handle rate limiting (429) with exponential backoff
            if (status === 429 && attempt < maxRetries) {
                // Use Discord's retry-after if provided, otherwise exponential backoff
                // Cap at 30 seconds to prevent excessive delays
                const baseWaitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
                const waitTime = Math.min(baseWaitTime, 30000);
                console.warn(`[Discord] Rate limited (429). Retrying in ${waitTime}ms (attempt ${attempt}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            // Log error on final attempt
            if (attempt === maxRetries) {
                console.error(`[Discord] ✗ Webhook failed after ${maxRetries} attempts:`, {
                    status: status,
                    message: error.message,
                    data: error.response?.data
                });
            }
        }
    }
    return false;
}

// Sanitize string input to prevent injection attacks
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    // Remove any potential malicious content, limit length
    return input.replace(/[<>]/g, '').substring(0, 100);
}

async function sendNewSubmissionNotification(ticker, submitterName) {
    console.log(`[Discord] Preparing to send new submission notification for ${ticker}`);

    // Sanitize inputs
    const safeTicker = sanitizeInput(ticker);
    const safeName = sanitizeInput(submitterName);

    const payload = {
        embeds: [{
            title: '📊 New Watchlist Submission',
            description: `**Team Member** has submitted **${safeTicker}** for review`,
            color: 0x1A3A2E, // Forest green
            timestamp: new Date().toISOString(),
            footer: {
                text: 'Old Logan Capital Watchlist System'
            }
        }]
    };
    return await sendWebhookWithRetry(payload);
}

async function sendReviewCompleteNotification(ticker, reviewerName, reviewsCompleted, totalReviews) {
    // Sanitize inputs
    const safeTicker = sanitizeInput(ticker);
    const safeName = sanitizeInput(reviewerName);
    const safeReviewsCompleted = Math.max(0, parseInt(reviewsCompleted) || 0);
    const safeTotalReviews = Math.max(0, parseInt(totalReviews) || 0);

    const payload = {
        embeds: [{
            title: '✅ Review Completed',
            description: `**Team Member** has completed their review of **${safeTicker}**\n\nProgress: ${safeReviewsCompleted}/${safeTotalReviews} reviews complete`,
            color: 0x2D5A4A, // Forest light
            timestamp: new Date().toISOString(),
            footer: {
                text: 'Old Logan Capital Watchlist System'
            }
        }]
    };
    await sendWebhookWithRetry(payload);
}

async function sendAllReviewsCompleteNotification(ticker, avgFinalScore) {
    // Sanitize inputs
    const safeTicker = sanitizeInput(ticker);
    const safeScore = Math.max(0, Math.min(10, parseFloat(avgFinalScore) || 0));

    const payload = {
        embeds: [{
            title: '🎯 Ready for Review',
            description: `All reviews for **${safeTicker}** are complete!\n\n**Team Avg Final Score:** ${safeScore.toFixed(2)}/10\n\nResults are now visible to the team.`,
            color: 0xC9A962, // Gold
            timestamp: new Date().toISOString(),
            footer: {
                text: 'Old Logan Capital Watchlist System'
            }
        }]
    };
    await sendWebhookWithRetry(payload);
}

async function send30DayWatchlistNotification(items) {
    if (!Array.isArray(items) || items.length === 0) return;

    // Sanitize and limit items to prevent abuse
    const safeItems = items.slice(0, 20).map(item => {
        const safeTicker = sanitizeInput(item.ticker || '');
        const safeCompanyName = sanitizeInput(item.company_name || '');
        const safeDaysOld = Math.max(0, parseInt(item.days_old) || 0);
        return `• **${safeTicker}** (${safeCompanyName}) - Added ${safeDaysOld} days ago`;
    });

    const tickerList = safeItems.join('\n');

    const payload = {
        embeds: [{
            title: '⏰ 30-Day Watchlist Review',
            description: `The following items have been on the watchlist for 30+ days and may need review:\n\n${tickerList}\n\nConsider reassessing these positions or removing them from the active watchlist.`,
            color: 0xE67E22, // Orange warning color
            timestamp: new Date().toISOString(),
            footer: {
                text: 'Old Logan Capital Watchlist System'
            }
        }]
    };
    await sendWebhookWithRetry(payload);
}

module.exports = {
    sendNewSubmissionNotification,
    sendReviewCompleteNotification,
    sendAllReviewsCompleteNotification,
    send30DayWatchlistNotification
};
