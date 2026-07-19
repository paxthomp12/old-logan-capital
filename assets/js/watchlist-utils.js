// ===================================
// Watchlist Utils - Helper Functions
// ===================================

// Debounce function to limit API calls
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Helper function to safely get score value with fallback
export function getSafeScore(value, defaultValue = 0) {
    if (value === null || value === undefined || value === '') {
        return defaultValue;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

// Helper function to format price range with dollar signs
export function formatPriceRange(range) {
    if (!range || range === 'N/A') return 'N/A';
    if (range.includes('$')) return range;
    return range.replace(/(\d+(?:\.\d+)?)/g, '$$$1');
}

// Helper function to format time horizon with full text
export function formatTimeHorizon(horizon) {
    if (!horizon) return 'N/A';
    const horizonMap = {
        'Short': 'Short Term (0-6 months)',
        'Medium': 'Medium Term (6-12 months)',
        'Long': 'Long Term (12+ months)'
    };
    return horizonMap[horizon] || horizon;
}

// Calculate final score from all scoring inputs
export function calculateFinalScore(scores) {
    const finalScore = (
        parseInt(scores.confidence) +
        parseInt(scores.technical) +
        parseInt(scores.fundamentals) +
        parseInt(scores.theme) +
        parseInt(scores.sector)
    ) / 4;
    return finalScore.toFixed(2);
}

// Sort submissions based on criteria
export function sortSubmissions(submissions, sortBy) {
    switch (sortBy) {
        case 'score':
            return submissions.sort((a, b) => (b.avg_final_score || 0) - (a.avg_final_score || 0));
        case 'date':
            return submissions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        case 'status':
            return submissions.sort((a, b) => a.status.localeCompare(b.status));
        case 'ticker':
            return submissions.sort((a, b) => a.ticker.localeCompare(b.ticker));
        default:
            return submissions;
    }
}
