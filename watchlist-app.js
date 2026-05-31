// Auto-detect API URL based on environment
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : 'https://api.oldlogancapital.com/api';

let currentSubmissionId = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadSubmissions();
    loadPendingReviews();
    loadWatchlist();
    setupEventListeners();
});

function setupEventListeners() {
    // Submit form
    document.getElementById('submitForm').addEventListener('submit', handleSubmit);

    // File input display
    document.getElementById('attachments').addEventListener('change', displayFileList);

    // Ticker input for sector auto-population
    document.getElementById('ticker').addEventListener('blur', autoPopulateSector);
    document.getElementById('ticker').addEventListener('input', debounce(() => {
        const ticker = document.getElementById('ticker').value.trim();
        if (ticker.length >= 1) {
            autoPopulateSector();
        }
    }, 500));

    // Close modals when clicking outside
    document.getElementById('submissionModal').addEventListener('click', (e) => {
        if (e.target.id === 'submissionModal') {
            closeSubmissionModal();
        }
    });

    document.getElementById('reviewModal').addEventListener('click', (e) => {
        if (e.target.id === 'reviewModal') {
            closeReviewModal();
        }
    });
}

// Debounce function to limit API calls
function debounce(func, wait) {
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


// ===== TAB SWITCHING =====

function switchTab(tabName, event) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));

    // Only try to set active on event.target if event exists
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // Find and activate the correct tab button by matching the onclick attribute
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            const onclickAttr = tab.getAttribute('onclick');
            if (onclickAttr && onclickAttr.includes(`'${tabName}'`)) {
                tab.classList.add('active');
            }
        });
    }

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');

    // Load data if needed
    if (tabName === 'dashboard') loadSubmissions();
    if (tabName === 'reviews') loadPendingReviews();
    if (tabName === 'watchlist') loadWatchlist();
}

// ===== SUBMISSIONS =====

async function loadSubmissions() {
    try {
        const response = await fetch(`${API_URL}/submissions`, {
            
        });

        if (!response.ok) throw new Error('Failed to load submissions');

        let submissions = await response.json();

        // Sort based on selection
        const sortBy = document.getElementById('sortSelect').value;
        submissions = sortSubmissions(submissions, sortBy);

        const tbody = document.getElementById('submissionsTableBody');
        tbody.innerHTML = '';

        if (submissions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No submissions yet</td></tr>';
            return;
        }

        submissions.forEach(sub => {
            const row = document.createElement('tr');
            row.className = 'clickable-row';
            row.onclick = () => viewSubmission(sub.id);

            // Show "Pending" for submitted status, show avg score for under_review and approved
            let scoreDisplay = 'Pending';
            if (sub.status !== 'submitted' && sub.avg_final_score) {
                const avgScore = parseFloat(sub.avg_final_score).toFixed(2);
                scoreDisplay = `${avgScore}/10`;
            }

            row.innerHTML = `
                <td><strong>${sub.ticker}</strong></td>
                <td>${sub.company_name}</td>
                <td>${sub.review_count}/3</td>
                <td><strong>${scoreDisplay}</strong></td>
                <td><span class="status-badge status-${sub.status}">${sub.status.replace('_', ' ')}</span></td>
                <td>${new Date(sub.created_at).toLocaleDateString()}</td>
            `;

            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading submissions:', error);
    }
}

function sortSubmissions(submissions, sortBy) {
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

async function viewSubmission(id) {
    try {
        const response = await fetch(`${API_URL}/submissions/${id}`, {

        });

        if (!response.ok) throw new Error('Failed to load submission details');

        const submission = await response.json();

        // DEBUG: Log what backend is returning
        console.log('=== BACKEND RESPONSE DEBUG ===');
        console.log('Full submission object:', submission);
        console.log('Submission scores:', {
            confidence: submission.confidence_level,
            technical: submission.technical_score,
            fundamentals: submission.fundamentals_score,
            theme: submission.theme_score,
            sector: submission.sector_score,
            final: submission.final_score
        });
        if (submission.reviews && submission.reviews.length > 0) {
            console.log('Review 0 scores:', {
                confidence: submission.reviews[0].confidence_level,
                technical: submission.reviews[0].technical_score,
                final: submission.reviews[0].final_score
            });
        }
        console.log('============================');

        currentSubmissionId = id;

        let html = `
            <div style="margin-bottom: 2.5rem;">
                <h2 style="font-size: 2.2rem; margin-bottom: 1rem; color: var(--dark);">${submission.ticker} - ${submission.company_name}</h2>
                <div style="display: flex; gap: 1.5rem; align-items: center;">
                    <div>
                        <span style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 0.5rem;">Status</span>
                        <span class="status-badge status-${submission.status}">${submission.status.replace('_', ' ')}</span>
                    </div>
                    ${submission.reviewsComplete && submission.status !== 'submitted' ? `
                    <div>
                        <span style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 0.5rem;">Submitted By</span>
                        <span style="font-weight: 600;">${submission.submitter_name}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Only show details if status is NOT "submitted"
        if (submission.status !== 'submitted') {
            html += ``;

            // Show attachments if any
            if (submission.attachments && submission.attachments.length > 0) {
                html += `
                    <div style="margin-top: 2rem;">
                        <h3 style="margin-bottom: 1rem;">Attachments</h3>
                        <ul class="attachment-list">
                            ${submission.attachments.map(att => `
                                <li><a href="${API_URL}/files/${att.filepath}" target="_blank">📎 ${att.filename}</a></li>
                            `).join('')}
                        </ul>
                    </div>
                `;
            }
        }

        // Add tab-specific remove buttons - moved to after approve/deny section
        const currentTab = document.querySelector('.tab-content.active').id;

        // Show reviews if complete
        if (submission.reviewsComplete && submission.reviews.length > 0) {
            // Calculate team averages for all scores using safe getters
            const allScores = [
                {
                    name: submission.submitter_name,
                    confidence: getSafeScore(submission.confidence_level),
                    technical: getSafeScore(submission.technical_score),
                    fundamentals: getSafeScore(submission.fundamentals_score),
                    theme: getSafeScore(submission.theme_score),
                    sector: getSafeScore(submission.sector_score),
                    final_score: getSafeScore(submission.final_score)
                },
                ...submission.reviews.map(r => ({
                    name: r.reviewer_name,
                    confidence: getSafeScore(r.confidence_level),
                    technical: getSafeScore(r.technical_score),
                    fundamentals: getSafeScore(r.fundamentals_score),
                    theme: getSafeScore(r.theme_score),
                    sector: getSafeScore(r.sector_score),
                    final_score: getSafeScore(r.final_score)
                }))
            ];

            const avgScores = {
                confidence: (allScores.reduce((sum, s) => sum + s.confidence, 0) / allScores.length).toFixed(2),
                technical: (allScores.reduce((sum, s) => sum + s.technical, 0) / allScores.length).toFixed(2),
                fundamentals: (allScores.reduce((sum, s) => sum + s.fundamentals, 0) / allScores.length).toFixed(2),
                theme: (allScores.reduce((sum, s) => sum + s.theme, 0) / allScores.length).toFixed(2),
                sector: (allScores.reduce((sum, s) => sum + s.sector, 0) / allScores.length).toFixed(2),
                final: (allScores.reduce((sum, s) => sum + s.final_score, 0) / allScores.length).toFixed(2)
            };

            html += `
                <div style="margin-top: 3rem;">
                    <h3 style="font-size: 1.6rem; margin-bottom: 2rem; color: var(--dark);">Team Analysis</h3>

                    <!-- Team Averages Card -->
                    <div style="background: linear-gradient(135deg, rgba(26, 58, 46, 0.08) 0%, rgba(26, 58, 46, 0.04) 100%); border: 1px solid rgba(26, 58, 46, 0.2); padding: 2rem; margin-bottom: 3rem; border-radius: 8px; border-left: 4px solid var(--forest);">
                        <h4 style="margin-bottom: 1.5rem; color: var(--forest); font-size: 1.2rem;">Team Average Scores</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1.5rem;">
                            <div style="background: white; padding: 1rem; border-radius: 6px;">
                                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">Final Score</div>
                                <div style="font-size: 1.8rem; font-weight: 700; color: var(--forest);">${avgScores.final}<span style="font-size: 1rem; color: var(--text-muted);">/10</span></div>
                            </div>
                            <div style="background: white; padding: 1rem; border-radius: 6px;">
                                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">Confidence</div>
                                <div style="font-size: 1.5rem; font-weight: 700; color: var(--dark);">${avgScores.confidence}<span style="font-size: 0.9rem; color: var(--text-muted);">/10</span></div>
                            </div>
                            <div style="background: white; padding: 1rem; border-radius: 6px;">
                                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">Technical</div>
                                <div style="font-size: 1.5rem; font-weight: 700; color: var(--dark);">${avgScores.technical}<span style="font-size: 0.9rem; color: var(--text-muted);">/10</span></div>
                            </div>
                            <div style="background: white; padding: 1rem; border-radius: 6px;">
                                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">Fundamentals</div>
                                <div style="font-size: 1.5rem; font-weight: 700; color: var(--dark);">${avgScores.fundamentals}<span style="font-size: 0.9rem; color: var(--text-muted);">/10</span></div>
                            </div>
                            <div style="background: white; padding: 1rem; border-radius: 6px;">
                                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">Theme</div>
                                <div style="font-size: 1.5rem; font-weight: 700; color: var(--dark);">${avgScores.theme}<span style="font-size: 0.9rem; color: var(--text-muted);">/5</span></div>
                            </div>
                            <div style="background: white; padding: 1rem; border-radius: 6px;">
                                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">Sector</div>
                                <div style="font-size: 1.5rem; font-weight: 700; color: var(--dark);">${avgScores.sector}<span style="font-size: 0.9rem; color: var(--text-muted);">/5</span></div>
                            </div>
                        </div>
                    </div>

                    <h3 style="font-size: 1.4rem; margin-bottom: 1.5rem; color: var(--dark);">Individual Reviews</h3>
                    <div class="review-grid">
            `;

            // Show submitter's scores first
            const subScores = allScores[0]; // Already using safe getters
            html += `
                <div class="review-card">
                    <h4>${submission.submitter_name} <span style="color: var(--gold); font-size: 0.8rem;">(Submitter)</span></h4>
                    <div class="detail-row">
                        <span class="detail-label">Final Score:</span>
                        <span><strong>${subScores.final_score.toFixed(2)}/10</strong></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Confidence:</span>
                        <span>${subScores.confidence}/10</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Technical:</span>
                        <span>${subScores.technical}/10</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Fundamentals:</span>
                        <span>${subScores.fundamentals}/10</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Theme:</span>
                        <span>${subScores.theme}/5</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Sector:</span>
                        <span>${subScores.sector}/5</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Entry Range:</span>
                        <span>${formatPriceRange(submission.entry_range)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Sell Range:</span>
                        <span>${formatPriceRange(submission.sell_range)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Time Horizon:</span>
                        <span>${formatTimeHorizon(submission.time_horizon)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Sector:</span>
                        <span>${submission.sector || 'N/A'}</span>
                    </div>
                    <div style="margin-top: 1rem;">
                        <strong>Investment Thesis:</strong>
                        <p style="margin-top: 0.5rem; line-height: 1.6; white-space: pre-wrap;">${submission.reasoning}</p>
                    </div>
                </div>
            `;

            // Show reviewer scores
            submission.reviews.forEach((review, index) => {
                const revScore = allScores[index + 1]; // +1 because allScores[0] is the submitter
                html += `
                    <div class="review-card">
                        <h4>${review.reviewer_name}</h4>
                        <div class="detail-row">
                            <span class="detail-label">Final Score:</span>
                            <span><strong>${revScore.final_score.toFixed(2)}/10</strong></span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Confidence:</span>
                            <span>${revScore.confidence}/10</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Technical:</span>
                            <span>${revScore.technical}/10</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Fundamentals:</span>
                            <span>${revScore.fundamentals}/10</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Theme:</span>
                            <span>${revScore.theme}/5</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Sector:</span>
                            <span>${revScore.sector}/5</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Entry Range:</span>
                            <span>${formatPriceRange(review.entry_range)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Sell Range:</span>
                            <span>${formatPriceRange(review.sell_range)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Time Horizon:</span>
                            <span>${formatTimeHorizon(review.time_horizon)}</span>
                        </div>
                        ${review.reasoning && review.reasoning !== 'Review based on submitter\'s thesis and independent analysis.' ? `
                        <div style="margin-top: 1rem;">
                            <strong>Notes:</strong>
                            <p style="margin-top: 0.5rem; line-height: 1.6; white-space: pre-wrap;">${review.reasoning}</p>
                        </div>
                        ` : ''}
                    </div>
                `;
            });

            html += `</div></div>`;

            // Add approve/deny buttons if all reviews complete and not yet approved or denied
            if (submission.status === 'under_review') {
                html += `
                    <div style="margin-top: 2.5rem; padding: 2rem; background: rgba(45, 90, 74, 0.05); border-radius: 8px; border: 1px solid rgba(45, 90, 74, 0.15);">
                        <p style="margin-bottom: 1.5rem; color: var(--text); font-size: 0.95rem;">All reviews are complete. Ready to make a decision on this ticker?</p>
                        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                            <button class="btn btn-success" onclick="approveForWatchlist(${id})">
                                ✓ Approve for Watchlist
                            </button>
                            <button class="btn btn-secondary" onclick="denySubmission(${id})" style="background: rgba(201, 73, 73, 0.9); color: white; border: none;">
                                ✗ Deny
                            </button>
                            <button class="btn btn-danger" onclick="deleteSubmission(${id})">
                                🗑️ Delete Submission Permanently
                            </button>
                        </div>
                    </div>
                `;
            }
            // Add delete button for approved/denied submissions
            else if (submission.status === 'approved' || submission.status === 'denied') {
                html += `
                    <div style="margin-top: 2.5rem; padding-top: 2.5rem; border-top: 1px solid rgba(26, 26, 26, 0.1);">
                        ${currentTab === 'watchlistTab' && submission.status === 'approved' ? `
                            <button class="btn btn-secondary" onclick="removeFromWatchlist(${id})" style="margin-right: 1rem;">
                                Remove from Watchlist
                            </button>
                        ` : ''}
                        <button class="btn btn-danger" onclick="deleteSubmission(${id})">
                            🗑️ Delete Submission Permanently
                        </button>
                    </div>
                `;
            }
            // Add delete button for other statuses
            else {
                html += `
                    <div style="margin-top: 2.5rem; padding-top: 2.5rem; border-top: 1px solid rgba(26, 26, 26, 0.1);">
                        <button class="btn btn-danger" onclick="deleteSubmission(${id})">
                            🗑️ Delete Submission Permanently
                        </button>
                    </div>
                `;
            }
        } else {
            // Count actual completed reviews (not including submitter)
            // Use review_count from backend if available, otherwise count reviews array
            const completedReviews = submission.review_count || (submission.reviews ? submission.reviews.length : 0);

            html += `
                <div style="margin-top: 2.5rem; padding: 2rem; background: rgba(201, 169, 98, 0.08); border-radius: 8px; border-left: 4px solid var(--warning);">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="font-size: 2rem;">⏳</div>
                        <div>
                            <strong style="color: var(--dark); font-size: 1.05rem;">Reviews in Progress</strong>
                            <p style="color: var(--text-muted); margin-top: 0.5rem; font-size: 0.95rem;">
                                ${completedReviews}/3 reviews completed. Results will be visible to everyone once all reviews are finished.
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }

        document.getElementById('submissionDetail').innerHTML = html;
        document.getElementById('submissionModal').classList.add('active');
    } catch (error) {
        console.error('Error viewing submission:', error);
        alert('Failed to load submission details');
    }
}

function closeSubmissionModal() {
    document.getElementById('submissionModal').classList.remove('active');
}

// Auto-populate sector based on ticker
async function autoPopulateSector() {
    const ticker = document.getElementById('ticker').value.trim().toUpperCase();
    const sectorInput = document.getElementById('sector');

    if (!ticker) {
        sectorInput.value = '';
        sectorInput.placeholder = 'Enter ticker first';
        return;
    }

    try {
        sectorInput.value = 'Loading...';
        sectorInput.readOnly = true;

        console.log(`Fetching sector for ticker: ${ticker} from ${API_URL}/ticker-info/${ticker}`);

        const response = await fetch(`${API_URL}/ticker-info/${ticker}`);

        if (response.status === 404) {
            // Endpoint doesn't exist or ticker not found
            const errorText = await response.text();
            console.error('Sector fetch 404:', errorText);

            if (errorText.includes('Cannot GET') || errorText.includes('Not Found')) {
                console.warn('⚠️ Backend endpoint /api/ticker-info/:ticker not implemented yet');
                sectorInput.value = '';
                sectorInput.placeholder = 'Backend endpoint not ready - enter manually';
            } else {
                sectorInput.value = '';
                sectorInput.placeholder = 'Ticker not found - enter manually';
            }
            sectorInput.readOnly = false;
            sectorInput.style.background = 'rgba(255, 255, 255, 0.8)';
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Sector data received:', data);

        sectorInput.value = data.sector || 'N/A';
        sectorInput.readOnly = false;
        sectorInput.style.background = 'rgba(255, 255, 255, 0.8)';
        console.log(`✓ Sector auto-populated: ${data.sector}`);
    } catch (error) {
        console.error('Error fetching sector:', error);
        sectorInput.value = '';
        sectorInput.placeholder = 'Unable to auto-populate, enter manually';
        sectorInput.readOnly = false;
        sectorInput.style.background = 'rgba(255, 255, 255, 0.8)';
    }
}

// Helper function to safely get score value with fallback
function getSafeScore(value, defaultValue = 0) {
    if (value === null || value === undefined || value === '') {
        return defaultValue;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

// Helper function to format price range with dollar signs
function formatPriceRange(range) {
    if (!range || range === 'N/A') return 'N/A';
    // If it already has a dollar sign, return as is
    if (range.includes('$')) return range;
    // Otherwise, add dollar sign to numbers (including decimals)
    return range.replace(/(\d+(?:\.\d+)?)/g, '$$$1');
}

// Helper function to format time horizon with full text
function formatTimeHorizon(horizon) {
    if (!horizon) return 'N/A';
    const horizonMap = {
        'Short': 'Short Term (0-6 months)',
        'Medium': 'Medium Term (6-12 months)',
        'Long': 'Long Term (12+ months)'
    };
    return horizonMap[horizon] || horizon;
}

// Calculate final score from all scoring inputs
function calculateFinalScore(scores) {
    // scores object should contain: confidence, technical, fundamentals, theme, sector
    const finalScore = (
        parseInt(scores.confidence) +
        parseInt(scores.technical) +
        parseInt(scores.fundamentals) +
        parseInt(scores.theme) +
        parseInt(scores.sector)
    ) / 5;
    return finalScore.toFixed(2);
}

async function handleSubmit(e) {
    e.preventDefault();

    const formData = new FormData();
    formData.append('ticker', document.getElementById('ticker').value);
    formData.append('submitterName', document.getElementById('submitterName').value);
    formData.append('companyName', document.getElementById('companyName').value);
    formData.append('reasoning', document.getElementById('reasoning').value);
    formData.append('entryRange', document.getElementById('entryRange').value);
    formData.append('sellRange', document.getElementById('sellRange').value || 'N/A');
    formData.append('timeHorizon', document.getElementById('timeHorizon').value);
    formData.append('sector', document.getElementById('sector').value);

    // Add all scoring fields
    formData.append('confidenceLevel', document.getElementById('confidenceLevel').value);
    formData.append('technicalScore', document.getElementById('technicalScore').value);
    formData.append('fundamentalsScore', document.getElementById('fundamentalsScore').value);
    formData.append('themeScore', document.getElementById('themeScore').value);
    formData.append('sectorScore', document.getElementById('sectorScore').value);

    // Calculate and append final score
    const finalScore = calculateFinalScore({
        confidence: document.getElementById('confidenceLevel').value,
        technical: document.getElementById('technicalScore').value,
        fundamentals: document.getElementById('fundamentalsScore').value,
        theme: document.getElementById('themeScore').value,
        sector: document.getElementById('sectorScore').value
    });
    formData.append('finalScore', finalScore);

    // Add files
    const files = document.getElementById('attachments').files;
    for (let i = 0; i < files.length; i++) {
        formData.append('attachments', files[i]);
    }

    try {
        const response = await fetch(`${API_URL}/submissions`, {
            method: 'POST',
            
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Submission failed');
        }

        document.getElementById('submitSuccess').textContent = 'Ticker submitted successfully! Notification sent to team.';
        document.getElementById('submitSuccess').classList.remove('hidden');
        document.getElementById('submitError').classList.add('hidden');
        document.getElementById('submitForm').reset();
        document.getElementById('fileList').innerHTML = '';

        // Refresh dashboard
        loadSubmissions();

        // Switch to dashboard after 2 seconds
        setTimeout(() => {
            switchTab('dashboard');
            document.getElementById('submitSuccess').classList.add('hidden');
        }, 2000);
    } catch (error) {
        document.getElementById('submitError').textContent = error.message;
        document.getElementById('submitError').classList.remove('hidden');
        document.getElementById('submitSuccess').classList.add('hidden');
    }
}

function displayFileList() {
    const files = document.getElementById('attachments').files;
    const fileList = document.getElementById('fileList');

    if (files.length === 0) {
        fileList.innerHTML = '';
        return;
    }

    const fileNames = Array.from(files).map(f => f.name).join(', ');
    fileList.innerHTML = `Selected: ${fileNames}`;
}

// ===== REVIEWS =====

async function loadPendingReviews() {
    try {
        const response = await fetch(`${API_URL}/pending-reviews`, {

        });

        if (!response.ok) throw new Error('Failed to load pending reviews');

        let pending = await response.json();

        // Filter out submissions where all reviews are complete (3 reviews from other team members)
        // Also filter out approved and denied submissions
        pending = pending.filter(sub => {
            // If already approved or denied, don't show in pending reviews
            if (sub.status === 'approved' || sub.status === 'denied') {
                return false;
            }
            // Use reviewsComplete field if available
            if (sub.reviewsComplete !== undefined) {
                return !sub.reviewsComplete;
            }
            // Otherwise check if review_count < 3 (need 3 reviews from other team members)
            // So when review_count is 3, that means all 3 reviews are complete
            return (sub.review_count || 0) < 3;
        });

        const container = document.getElementById('pendingReviewsList');

        if (pending.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No pending reviews</p>';
            return;
        }

        container.innerHTML = pending.map(sub => `
            <div class="card" style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <h3 style="margin-bottom: 0.5rem;">${sub.ticker} - ${sub.company_name}</h3>
                        <p style="color: var(--text-muted); font-size: 0.9rem;">Submitted on ${new Date(sub.created_at).toLocaleDateString()}</p>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn" onclick="startReview(${sub.id})">Start Review</button>
                        <button class="btn btn-secondary" onclick="viewSubmission(${sub.id})">View Details</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading pending reviews:', error);
    }
}

async function startReview(submissionId) {
    try {
        const response = await fetch(`${API_URL}/submissions/${submissionId}`, {
            
        });

        if (!response.ok) throw new Error('Failed to load submission');

        const submission = await response.json();

        const html = `
            <h2>Review: ${submission.ticker} - ${submission.company_name}</h2>
            <p style="margin-bottom: 2rem; color: var(--text-muted);">
                Complete your independent review. Your analysis will remain hidden until all team members finish their reviews.
            </p>

            <div style="padding: 1.5rem; background: rgba(255, 255, 255, 0.8); border: 1px solid var(--border); margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1rem;">Original Submission</h3>
                <div class="detail-row">
                    <span class="detail-label">Ticker:</span>
                    <span><strong>${submission.ticker}</strong></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Company:</span>
                    <span>${submission.company_name}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Sector:</span>
                    <span>${submission.sector || 'N/A'}</span>
                </div>
                <div style="margin-top: 1.5rem;">
                    <strong style="display: block; margin-bottom: 0.5rem;">Investment Thesis:</strong>
                    <p style="line-height: 1.6; white-space: pre-wrap; color: var(--text);">${submission.reasoning}</p>
                </div>
            </div>

            <form id="reviewForm" onsubmit="submitReview(event, ${submissionId})">
                <div class="form-group">
                    <label for="reviewerName">Your Name *</label>
                    <select id="reviewerName" required>
                        <option value="">Select your name</option>
                        <option value="Paxton Thompson">Paxton</option>
                        <option value="Alex Evenson">Alex</option>
                        <option value="Garett Lake">Garett</option>
                        <option value="Sam Thoresen">Sam</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="reviewEntryRange">Entry Range *</label>
                    <input type="text" id="reviewEntryRange" required placeholder="e.g., $45-50">
                </div>

                <div class="form-group">
                    <label for="reviewSellRange">Sell Range <small style="color: var(--text-muted);">(Optional)</small></label>
                    <input type="text" id="reviewSellRange" placeholder="e.g., $75-85">
                </div>

                <div class="form-group">
                    <label for="reviewTimeHorizon">Your Time Horizon *</label>
                    <select id="reviewTimeHorizon" required>
                        <option value="">Select time horizon</option>
                        <option value="Short">Short Term (0-6 months)</option>
                        <option value="Medium">Medium Term (6-12 months)</option>
                        <option value="Long">Long Term (12+ months)</option>
                    </select>
                </div>

                <h3 style="margin: 2rem 0 1rem 0; font-size: 1.3rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem;">Your Scoring (All scores required)</h3>

                <!-- Core Scores -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem;">
                    <div class="form-group">
                        <label for="reviewConfidence">Confidence Level (1-10) *</label>
                        <select id="reviewConfidence" required>
                            <option value="">Select</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                            <option value="6">6</option>
                            <option value="7">7</option>
                            <option value="8">8</option>
                            <option value="9">9</option>
                            <option value="10">10</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="reviewTechnical">Technical Analysis (1-10) *</label>
                        <select id="reviewTechnical" required>
                            <option value="">Select</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                            <option value="6">6</option>
                            <option value="7">7</option>
                            <option value="8">8</option>
                            <option value="9">9</option>
                            <option value="10">10</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="reviewFundamentals">Fundamentals (1-10) *</label>
                        <select id="reviewFundamentals" required>
                            <option value="">Select</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                            <option value="6">6</option>
                            <option value="7">7</option>
                            <option value="8">8</option>
                            <option value="9">9</option>
                            <option value="10">10</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="reviewTheme">Theme (1-5) *</label>
                        <select id="reviewTheme" required>
                            <option value="">Select</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="reviewSectorScore">Sector (1-5) *</label>
                        <select id="reviewSectorScore" required>
                            <option value="">Select</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label for="reviewNotes">Notes / Additional Thoughts (Optional)</label>
                    <textarea id="reviewNotes" placeholder="Add any additional notes, thoughts, or observations about this opportunity..."></textarea>
                </div>

                <div class="form-group">
                    <label for="reviewAttachments">Supporting Documents (Optional)</label>
                    <div class="file-input-wrapper">
                        <input type="file" id="reviewAttachments" multiple accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx,.csv">
                        <label for="reviewAttachments" class="file-input-label">Choose files</label>
                    </div>
                    <div id="reviewFileList" class="file-list"></div>
                </div>

                <div style="display: flex; gap: 1rem;">
                    <button type="submit" class="btn">Submit Review</button>
                    <button type="button" class="btn btn-secondary" onclick="closeReviewModal()">Cancel</button>
                </div>
            </form>
        `;

        document.getElementById('reviewFormContainer').innerHTML = html;
        document.getElementById('reviewModal').classList.add('active');

        // Setup file list display for review attachments
        document.getElementById('reviewAttachments').addEventListener('change', () => {
            const files = document.getElementById('reviewAttachments').files;
            const fileList = document.getElementById('reviewFileList');
            if (files.length > 0) {
                const fileNames = Array.from(files).map(f => f.name).join(', ');
                fileList.innerHTML = `Selected: ${fileNames}`;
            } else {
                fileList.innerHTML = '';
            }
        });
    } catch (error) {
        console.error('Error starting review:', error);
        alert('Failed to load submission for review');
    }
}

async function submitReview(e, submissionId) {
    e.preventDefault();

    const formData = new FormData();
    formData.append('submissionId', submissionId);
    formData.append('reviewerName', document.getElementById('reviewerName').value);

    // Send notes as reasoning to maintain backend compatibility
    // If notes are empty, send a default message
    const notes = document.getElementById('reviewNotes').value.trim();
    formData.append('reasoning', notes || 'Review based on submitter\'s thesis and independent analysis.');

    formData.append('entryRange', document.getElementById('reviewEntryRange').value);
    formData.append('sellRange', document.getElementById('reviewSellRange').value || 'N/A');
    formData.append('timeHorizon', document.getElementById('reviewTimeHorizon').value);

    // Add all scoring fields
    formData.append('confidenceLevel', document.getElementById('reviewConfidence').value);
    formData.append('technicalScore', document.getElementById('reviewTechnical').value);
    formData.append('fundamentalsScore', document.getElementById('reviewFundamentals').value);
    formData.append('themeScore', document.getElementById('reviewTheme').value);
    formData.append('sectorScore', document.getElementById('reviewSectorScore').value);

    // Calculate and append final score
    const finalScore = calculateFinalScore({
        confidence: document.getElementById('reviewConfidence').value,
        technical: document.getElementById('reviewTechnical').value,
        fundamentals: document.getElementById('reviewFundamentals').value,
        theme: document.getElementById('reviewTheme').value,
        sector: document.getElementById('reviewSectorScore').value
    });
    formData.append('finalScore', finalScore);

    // Add files
    const files = document.getElementById('reviewAttachments').files;
    for (let i = 0; i < files.length; i++) {
        formData.append('attachments', files[i]);
    }

    try {
        console.log('=== SUBMITTING REVIEW ===');
        console.log('FormData contents:');
        for (let [key, value] of formData.entries()) {
            console.log(`  ${key}:`, value);
        }

        const response = await fetch(`${API_URL}/reviews`, {
            method: 'POST',

            body: formData
        });

        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);

        if (!response.ok) {
            const responseText = await response.text();
            console.error('Error response body:', responseText);

            let errorData;
            try {
                errorData = JSON.parse(responseText);
            } catch (e) {
                errorData = { error: responseText || 'Unknown error' };
            }

            console.error('Parsed error data:', errorData);
            throw new Error(errorData.error || 'Review submission failed');
        }

        alert('Review submitted successfully! Notification sent to team.');
        closeReviewModal();
        loadPendingReviews();
        loadSubmissions();
    } catch (error) {
        console.error('Full error details:', error);
        alert('Review submission failed: ' + error.message);
    }
}

function closeReviewModal() {
    document.getElementById('reviewModal').classList.remove('active');
}

// ===== WATCHLIST =====

async function loadWatchlist() {
    try {
        const response = await fetch(`${API_URL}/watchlist`, {
            
        });

        if (!response.ok) throw new Error('Failed to load watchlist');

        const watchlist = await response.json();
        const tbody = document.getElementById('watchlistTableBody');
        tbody.innerHTML = '';

        if (watchlist.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No approved items yet</td></tr>';
            return;
        }

        watchlist.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'clickable-row';
            row.onclick = () => viewSubmission(item.submission_id);

            const finalScore = item.avg_final_score ? parseFloat(item.avg_final_score).toFixed(2) : 'N/A';

            // Check if item is 30+ days old
            const daysOld = item.days_old || 0;
            const ageBadge = daysOld >= 30
                ? `<span style="display: inline-block; margin-left: 0.5rem; padding: 0.25rem 0.6rem; background: rgba(230, 126, 34, 0.15); color: #d97520; border: 1px solid rgba(230, 126, 34, 0.3); border-radius: 12px; font-size: 0.65rem; font-weight: 600; letter-spacing: 0.5px;">⏰ ${daysOld}d</span>`
                : '';

            row.innerHTML = `
                <td><strong>${item.ticker}</strong>${ageBadge}</td>
                <td>${item.company_name}</td>
                <td>${item.submitter_name}</td>
                <td><strong>${finalScore}/10</strong></td>
                <td>${item.sector || 'N/A'}</td>
                <td>${item.time_horizon}</td>
                <td>${new Date(item.added_at).toLocaleDateString()}</td>
            `;

            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading watchlist:', error);
    }
}

async function approveForWatchlist(submissionId) {
    if (!confirm('Are you sure you want to approve this ticker for the watchlist?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/watchlist/approve/${submissionId}`, {
            method: 'POST',

        });

        if (!response.ok) throw new Error('Approval failed');

        alert('Ticker approved and added to watchlist!');
        closeSubmissionModal();
        loadSubmissions();
        loadWatchlist();
    } catch (error) {
        alert('Failed to approve ticker: ' + error.message);
    }
}

async function denySubmission(submissionId) {
    if (!confirm('Are you sure you want to deny this submission? It will remain in the dashboard but will not be added to the watchlist.')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/submissions/${submissionId}/deny`, {
            method: 'POST',

        });

        if (!response.ok) throw new Error('Denial failed');

        alert('Submission denied. It will remain visible in the dashboard.');
        closeSubmissionModal();
        loadSubmissions();
    } catch (error) {
        alert('Failed to deny submission: ' + error.message);
    }
}

async function deleteSubmission(submissionId) {
    if (!confirm('Are you sure you want to PERMANENTLY DELETE this submission? This action cannot be undone and will remove all data including reviews.')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/submissions/${submissionId}`, {
            method: 'DELETE',

        });

        if (!response.ok) throw new Error('Delete failed');

        alert('Submission deleted permanently!');
        closeSubmissionModal();
        loadSubmissions();
        loadPendingReviews();
        loadWatchlist();
    } catch (error) {
        alert('Failed to delete submission: ' + error.message);
    }
}

async function removeFromPendingReviews(submissionId) {
    // Simply close the modal and reload - the pending reviews list filters based on reviewsComplete status
    closeSubmissionModal();
    loadPendingReviews();
}

async function removeFromWatchlist(submissionId) {
    if (!confirm('Remove this ticker from the watchlist? The submission data will be preserved but it will no longer appear on the watchlist.')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/watchlist/remove/${submissionId}`, {
            method: 'POST',
        });

        if (!response.ok) throw new Error('Failed to remove from watchlist');

        alert('Removed from watchlist!');
        closeSubmissionModal();
        loadWatchlist();
        loadSubmissions();
    } catch (error) {
        alert('Failed to remove from watchlist: ' + error.message);
    }
}
