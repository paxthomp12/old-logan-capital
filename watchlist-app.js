// ===================================
// Old Logan Capital - Watchlist Application
// Optimized and Refactored Version
// ===================================

// === GLOBAL STATE ===
let currentSubmissionId = null;

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    loadSubmissions();
    loadPendingReviews();
    loadWatchlist();
    setupEventListeners();
});

// === EVENT LISTENERS SETUP ===
function setupEventListeners() {
    document.getElementById('submitForm').addEventListener('submit', handleSubmit);
    document.getElementById('attachments').addEventListener('change', displayFileList);
    document.getElementById('ticker').addEventListener('blur', autoPopulateSector);
    document.getElementById('ticker').addEventListener('input', debounce(() => {
        const ticker = document.getElementById('ticker').value.trim();
        if (ticker.length >= 1) autoPopulateSector();
    }, 500));

    // Close modals when clicking outside
    ['submissionModal', 'reviewModal'].forEach(modalId => {
        document.getElementById(modalId).addEventListener('click', (e) => {
            if (e.target.id === modalId) {
                modalId === 'submissionModal' ? closeSubmissionModal() : closeReviewModal();
            }
        });
    });
}

// === UTILITY FUNCTIONS ===
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

function getSafeScore(value, defaultValue = 0) {
    if (value === null || value === undefined || value === '') return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

function formatPriceRange(range) {
    if (!range || range === 'N/A') return 'N/A';
    return range.includes('$') ? range : range.replace(/(\d+(?:\.\d+)?)/g, '$$$1');
}

function formatTimeHorizon(horizon) {
    if (!horizon) return 'N/A';
    const horizonMap = {
        'Short': 'Short Term (0-6 months)',
        'Medium': 'Medium Term (6-12 months)',
        'Long': 'Long Term (12+ months)'
    };
    return horizonMap[horizon] || horizon;
}

function calculateFinalScore(scores) {
    const sum = parseInt(scores.confidence) + parseInt(scores.technical) +
                parseInt(scores.fundamentals) + parseInt(scores.theme) +
                parseInt(scores.sector);
    return (sum / 4).toFixed(2);
}

function sortSubmissions(submissions, sortBy) {
    const sortFunctions = {
        'score': (a, b) => (b.avg_final_score || 0) - (a.avg_final_score || 0),
        'date': (a, b) => new Date(b.created_at) - new Date(a.created_at),
        'status': (a, b) => a.status.localeCompare(b.status),
        'ticker': (a, b) => a.ticker.localeCompare(b.ticker)
    };
    return sortFunctions[sortBy] ? submissions.sort(sortFunctions[sortBy]) : submissions;
}

// === TAB SWITCHING ===
function switchTab(tabName, event) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));

    if (event?.target) {
        event.target.classList.add('active');
    } else {
        document.querySelectorAll('.tab').forEach(tab => {
            const onclick = tab.getAttribute('onclick');
            if (onclick?.includes(`'${tabName}'`)) tab.classList.add('active');
        });
    }

    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');

    // Load data based on tab
    const loaders = {
        'dashboard': loadSubmissions,
        'reviews': loadPendingReviews,
        'watchlist': loadWatchlist
    };
    if (loaders[tabName]) loaders[tabName]();
}

// === SUBMISSIONS ===
async function loadSubmissions() {
    try {
        const response = await fetch(`${API_URL}/submissions`, { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to load submissions');

        let submissions = await response.json();
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

            const scoreDisplay = sub.status !== 'submitted' && sub.avg_final_score
                ? `${parseFloat(sub.avg_final_score).toFixed(2)}/10`
                : 'Pending';

            const hasAttachments = sub.attachment_count > 0;
            const attachmentIcon = hasAttachments
                ? `<span style="margin-left: 0.5rem; color: var(--gold);" title="${sub.attachment_count} attachment(s)">📎</span>`
                : '';

            row.innerHTML = `
                <td><strong>${sub.ticker}</strong>${attachmentIcon}</td>
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

async function viewSubmission(id) {
    try {
        const response = await fetch(`${API_URL}/submissions/${id}`, { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to load submission details');

        const submission = await response.json();
        currentSubmissionId = id;

        let html = buildSubmissionHTML(submission);
        document.getElementById('submissionDetail').innerHTML = html;
        document.getElementById('submissionModal').classList.add('active');
    } catch (error) {
        console.error('Error viewing submission:', error);
        alert('Failed to load submission details');
    }
}

function buildSubmissionHTML(submission) {
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

    if (submission.status !== 'submitted' && submission.attachments?.length > 0) {
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

    if (submission.reviewsComplete && submission.reviews.length > 0) {
        html += buildReviewsHTML(submission);
    } else {
        html += buildPendingReviewsHTML(submission);
    }

    return html;
}

function buildReviewsHTML(submission) {
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

    let html = `
        <div style="margin-top: 3rem;">
            <h3 style="font-size: 1.6rem; margin-bottom: 2rem; color: var(--dark);">Team Analysis</h3>

            <div style="background: linear-gradient(135deg, rgba(26, 58, 46, 0.08) 0%, rgba(26, 58, 46, 0.04) 100%); border: 1px solid rgba(26, 58, 46, 0.2); padding: 2rem; margin-bottom: 3rem; border-radius: 8px; border-left: 4px solid var(--forest);">
                <h4 style="margin-bottom: 1.5rem; color: var(--forest); font-size: 1.2rem;">Team Average Scores</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1.5rem;">
                    ${buildScoreCard('Final Score', avgScores.final, '10', true)}
                    ${buildScoreCard('Confidence', avgScores.confidence, '10')}
                    ${buildScoreCard('Technical', avgScores.technical, '10')}
                    ${buildScoreCard('Fundamentals', avgScores.fundamentals, '10')}
                    ${buildScoreCard('Theme', avgScores.theme, '5')}
                    ${buildScoreCard('Sector', avgScores.sector, '5')}
                </div>
            </div>

            <h3 style="font-size: 1.4rem; margin-bottom: 1.5rem; color: var(--dark);">Individual Reviews</h3>
            <div class="review-grid">
                ${buildIndividualReviewCard(submission, allScores[0], true)}
                ${submission.reviews.map((review, idx) => buildIndividualReviewCard(review, allScores[idx + 1], false)).join('')}
            </div>
        </div>
    `;

    html += buildActionButtons(submission);
    return html;
}

function buildScoreCard(label, value, max, isPrimary = false) {
    return `
        <div style="background: white; padding: 1rem; border-radius: 6px;">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">${label}</div>
            <div style="font-size: ${isPrimary ? '1.8rem' : '1.5rem'}; font-weight: 700; color: ${isPrimary ? 'var(--forest)' : 'var(--dark)'};">
                ${value}<span style="font-size: ${isPrimary ? '1rem' : '0.9rem'}; color: var(--text-muted);">/${max}</span>
            </div>
        </div>
    `;
}

function buildIndividualReviewCard(data, scores, isSubmitter) {
    const name = isSubmitter ? data.submitter_name : data.reviewer_name;
    const label = isSubmitter ? '<span style="color: var(--gold); font-size: 0.8rem;">(Submitter)</span>' : '';

    return `
        <div class="review-card">
            <h4>${name} ${label}</h4>
            <div class="detail-row"><span class="detail-label">Final Score:</span><span><strong>${scores.final_score.toFixed(2)}/10</strong></span></div>
            <div class="detail-row"><span class="detail-label">Confidence:</span><span>${scores.confidence}/10</span></div>
            <div class="detail-row"><span class="detail-label">Technical:</span><span>${scores.technical}/10</span></div>
            <div class="detail-row"><span class="detail-label">Fundamentals:</span><span>${scores.fundamentals}/10</span></div>
            <div class="detail-row"><span class="detail-label">Theme:</span><span>${scores.theme}/5</span></div>
            <div class="detail-row"><span class="detail-label">Sector:</span><span>${scores.sector}/5</span></div>
            ${isSubmitter ? `
                <div class="detail-row"><span class="detail-label">Entry Range:</span><span>${formatPriceRange(data.entry_range)}</span></div>
                <div class="detail-row"><span class="detail-label">Sell Range:</span><span>${formatPriceRange(data.sell_range)}</span></div>
                <div class="detail-row"><span class="detail-label">Time Horizon:</span><span>${formatTimeHorizon(data.time_horizon)}</span></div>
                <div class="detail-row"><span class="detail-label">Sector:</span><span>${data.sector || 'N/A'}</span></div>
                <div style="margin-top: 1rem;"><strong>Investment Thesis:</strong><p style="margin-top: 0.5rem; line-height: 1.6; white-space: pre-wrap;">${data.reasoning}</p></div>
            ` : `
                <div class="detail-row"><span class="detail-label">Entry Range:</span><span>${formatPriceRange(data.entry_range)}</span></div>
                <div class="detail-row"><span class="detail-label">Sell Range:</span><span>${formatPriceRange(data.sell_range)}</span></div>
                <div class="detail-row"><span class="detail-label">Time Horizon:</span><span>${formatTimeHorizon(data.time_horizon)}</span></div>
                ${data.reasoning && data.reasoning !== 'Review based on submitter\'s thesis and independent analysis.' ? `
                    <div style="margin-top: 1rem;"><strong>Notes:</strong><p style="margin-top: 0.5rem; line-height: 1.6; white-space: pre-wrap;">${data.reasoning}</p></div>
                ` : ''}
                ${data.attachments?.length > 0 ? `
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(26, 26, 26, 0.1);">
                        <strong>Supporting Documents:</strong>
                        <ul class="attachment-list" style="margin-top: 0.5rem; list-style: none; padding: 0;">
                            ${data.attachments.map(att => `<li style="padding: 0.25rem 0;"><a href="${API_URL}/files/${att.filepath}" target="_blank" style="color: var(--forest); text-decoration: none;">📎 ${att.filename}</a></li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            `}
        </div>
    `;
}

function buildPendingReviewsHTML(submission) {
    const completedReviews = submission.review_count || (submission.reviews ? submission.reviews.length : 0);
    return `
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
        <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(26, 26, 26, 0.1);">
            <button class="btn btn-danger" onclick="deleteSubmission(${submission.id})">🗑️ Delete Submission Permanently</button>
        </div>
    `;
}

function buildActionButtons(submission) {
    const currentTab = document.querySelector('.tab-content.active').id;

    if (submission.status === 'under_review') {
        return `
            <div style="margin-top: 2.5rem; padding: 2rem; background: rgba(45, 90, 74, 0.05); border-radius: 8px; border: 1px solid rgba(45, 90, 74, 0.15);">
                <p style="margin-bottom: 1.5rem; color: var(--text); font-size: 0.95rem;">All reviews are complete. Ready to make a decision on this ticker?</p>
                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                    <button class="btn btn-success" onclick="approveForWatchlist(${submission.id})">✓ Approve for Watchlist</button>
                    <button class="btn btn-secondary" onclick="denySubmission(${submission.id})" style="background: rgba(201, 73, 73, 0.9); color: white; border: none;">✗ Deny</button>
                    <button class="btn btn-danger" onclick="deleteSubmission(${submission.id})">🗑️ Delete Submission Permanently</button>
                </div>
            </div>
        `;
    } else if (submission.status === 'approved' || submission.status === 'denied') {
        return `
            <div style="margin-top: 2.5rem; padding-top: 2.5rem; border-top: 1px solid rgba(26, 26, 26, 0.1);">
                ${currentTab === 'watchlistTab' && submission.status === 'approved' ? `
                    <button class="btn btn-secondary" onclick="removeFromWatchlist(${submission.id})" style="margin-right: 1rem;">Remove from Watchlist</button>
                ` : ''}
                <button class="btn btn-danger" onclick="deleteSubmission(${submission.id})">🗑️ Delete Submission Permanently</button>
            </div>
        `;
    } else {
        return `
            <div style="margin-top: 2.5rem; padding-top: 2.5rem; border-top: 1px solid rgba(26, 26, 26, 0.1);">
                <button class="btn btn-danger" onclick="deleteSubmission(${submission.id})">🗑️ Delete Submission Permanently</button>
            </div>
        `;
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

        const response = await fetch(`${API_URL}/ticker-info/${ticker}`, { credentials: 'include' });

        if (response.status === 404) {
            const errorText = await response.text();
            sectorInput.value = '';
            sectorInput.placeholder = errorText.includes('Cannot GET') || errorText.includes('Not Found')
                ? 'Backend endpoint not ready - enter manually'
                : 'Ticker not found - enter manually';
            sectorInput.readOnly = false;
            sectorInput.style.background = 'rgba(255, 255, 255, 0.8)';
            return;
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const data = await response.json();
        sectorInput.value = data.sector || 'N/A';
        sectorInput.readOnly = false;
        sectorInput.style.background = 'rgba(255, 255, 255, 0.8)';
    } catch (error) {
        sectorInput.value = '';
        sectorInput.placeholder = 'Unable to auto-populate, enter manually';
        sectorInput.readOnly = false;
        sectorInput.style.background = 'rgba(255, 255, 255, 0.8)';
    }
}

async function handleSubmit(e) {
    e.preventDefault();

    const formData = new FormData();
    const fields = {
        ticker: 'ticker',
        submitterName: 'submitterName',
        companyName: 'companyName',
        reasoning: 'reasoning',
        entryRange: 'entryRange',
        sellRange: 'sellRange',
        timeHorizon: 'timeHorizon',
        sector: 'sector',
        confidenceLevel: 'confidenceLevel',
        technicalScore: 'technicalScore',
        fundamentalsScore: 'fundamentalsScore',
        themeScore: 'themeScore',
        sectorScore: 'sectorScore'
    };

    Object.entries(fields).forEach(([key, id]) => {
        const value = document.getElementById(id).value;
        formData.append(key, key === 'sellRange' && !value ? 'N/A' : value);
    });

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
    Array.from(files).forEach(file => formData.append('attachments', file));

    try {
        const response = await fetch(`${API_URL}/submissions`, {
            method: 'POST',
            credentials: 'include',
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

        loadSubmissions();

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

    fileList.innerHTML = `Selected: ${Array.from(files).map(f => f.name).join(', ')}`;
}

// === REVIEWS ===
async function loadPendingReviews() {
    try {
        const response = await fetch(`${API_URL}/pending-reviews`, { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to load pending reviews');

        let pending = await response.json();
        pending = pending.filter(sub => {
            if (sub.status === 'approved' || sub.status === 'denied') return false;
            if (sub.reviewsComplete !== undefined) return !sub.reviewsComplete;
            return (sub.review_count || 0) < 3;
        });

        const container = document.getElementById('pendingReviewsList');

        if (pending.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No pending reviews</p>';
            return;
        }

        container.innerHTML = pending.map(sub => {
            const hasAttachments = sub.attachment_count > 0;
            const attachmentIcon = hasAttachments
                ? `<span style="margin-left: 0.5rem; color: var(--gold);" title="${sub.attachment_count} attachment(s)">📎</span>`
                : '';

            return `
                <div class="card" style="margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <h3 style="margin-bottom: 0.5rem;">${sub.ticker} - ${sub.company_name}${attachmentIcon}</h3>
                            <p style="color: var(--text-muted); font-size: 0.9rem;">Submitted on ${new Date(sub.created_at).toLocaleDateString()}</p>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn" onclick="startReview(${sub.id})">Start Review</button>
                            <button class="btn btn-secondary" onclick="viewSubmission(${sub.id})">View Details</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading pending reviews:', error);
    }
}

async function startReview(submissionId) {
    try {
        const response = await fetch(`${API_URL}/submissions/${submissionId}`);
        if (!response.ok) throw new Error('Failed to load submission');

        const submission = await response.json();

        const html = buildReviewFormHTML(submission, submissionId);
        document.getElementById('reviewFormContainer').innerHTML = html;
        document.getElementById('reviewModal').classList.add('active');

        document.getElementById('reviewAttachments').addEventListener('change', () => {
            const files = document.getElementById('reviewAttachments').files;
            const fileList = document.getElementById('reviewFileList');
            fileList.innerHTML = files.length > 0
                ? `Selected: ${Array.from(files).map(f => f.name).join(', ')}`
                : '';
        });
    } catch (error) {
        console.error('Error starting review:', error);
        alert('Failed to load submission for review');
    }
}

function buildReviewFormHTML(submission, submissionId) {
    return `
        <h2>Review: ${submission.ticker} - ${submission.company_name}</h2>
        <p style="margin-bottom: 2rem; color: var(--text-muted);">
            Complete your independent review. Your analysis will remain hidden until all team members finish their reviews.
        </p>

        <div style="padding: 1.5rem; background: rgba(255, 255, 255, 0.8); border: 1px solid var(--border); margin-bottom: 2rem;">
            <h3 style="margin-bottom: 1rem;">Original Submission</h3>
            <div class="detail-row"><span class="detail-label">Ticker:</span><span><strong>${submission.ticker}</strong></span></div>
            <div class="detail-row"><span class="detail-label">Company:</span><span>${submission.company_name}</span></div>
            <div class="detail-row"><span class="detail-label">Sector:</span><span>${submission.sector || 'N/A'}</span></div>
            <div style="margin-top: 1.5rem;">
                <strong style="display: block; margin-bottom: 0.5rem;">Investment Thesis:</strong>
                <p style="line-height: 1.6; white-space: pre-wrap; color: var(--text);">${submission.reasoning}</p>
            </div>
            ${submission.attachments?.length > 0 ? `
            <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border);">
                <strong style="display: block; margin-bottom: 0.75rem;">Attachments:</strong>
                <ul class="attachment-list" style="list-style: none; padding: 0;">
                    ${submission.attachments.map(att => `
                        <li style="padding: 0.5rem 0;"><a href="${API_URL}/files/${att.filepath}" target="_blank" style="color: var(--forest); text-decoration: none;">📎 ${att.filename}</a></li>
                    `).join('')}
                </ul>
            </div>
            ` : ''}
        </div>

        <form id="reviewForm" onsubmit="submitReview(event, ${submissionId})">
            ${buildReviewFormFields()}
            <div style="display: flex; gap: 1rem;">
                <button type="submit" class="btn">Submit Review</button>
                <button type="button" class="btn btn-secondary" onclick="closeReviewModal()">Cancel</button>
            </div>
        </form>
    `;
}

function buildReviewFormFields() {
    const createSelect = (id, label, options) => `
        <div class="form-group">
            <label for="${id}">${label} *</label>
            <select id="${id}" required>
                <option value="">Select</option>
                ${options.map(val => `<option value="${val}">${val}</option>`).join('')}
            </select>
        </div>
    `;

    return `
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

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem;">
            ${createSelect('reviewConfidence', 'Confidence Level (1-10)', Array.from({length: 10}, (_, i) => i + 1))}
            ${createSelect('reviewTechnical', 'Technical Analysis (1-10)', Array.from({length: 10}, (_, i) => i + 1))}
            ${createSelect('reviewFundamentals', 'Fundamentals (1-10)', Array.from({length: 10}, (_, i) => i + 1))}
            ${createSelect('reviewTheme', 'Theme (1-5)', Array.from({length: 5}, (_, i) => i + 1))}
            ${createSelect('reviewSectorScore', 'Sector (1-5)', Array.from({length: 5}, (_, i) => i + 1))}
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
    `;
}

async function submitReview(e, submissionId) {
    e.preventDefault();

    const formData = new FormData();
    formData.append('submissionId', submissionId);
    formData.append('reviewerName', document.getElementById('reviewerName').value);
    formData.append('reasoning', document.getElementById('reviewNotes').value.trim() || 'Review based on submitter\'s thesis and independent analysis.');
    formData.append('entryRange', document.getElementById('reviewEntryRange').value);
    formData.append('sellRange', document.getElementById('reviewSellRange').value || 'N/A');
    formData.append('timeHorizon', document.getElementById('reviewTimeHorizon').value);

    const finalScore = calculateFinalScore({
        confidence: document.getElementById('reviewConfidence').value,
        technical: document.getElementById('reviewTechnical').value,
        fundamentals: document.getElementById('reviewFundamentals').value,
        theme: document.getElementById('reviewTheme').value,
        sector: document.getElementById('reviewSectorScore').value
    });

    formData.append('confidenceLevel', document.getElementById('reviewConfidence').value);
    formData.append('technicalScore', document.getElementById('reviewTechnical').value);
    formData.append('fundamentalsScore', document.getElementById('reviewFundamentals').value);
    formData.append('themeScore', document.getElementById('reviewTheme').value);
    formData.append('sectorScore', document.getElementById('reviewSectorScore').value);
    formData.append('finalScore', finalScore);

    const files = document.getElementById('reviewAttachments').files;
    Array.from(files).forEach(file => formData.append('attachments', file));

    try {
        const response = await fetch(`${API_URL}/reviews`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        if (!response.ok) {
            const responseText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(responseText);
            } catch (e) {
                errorData = { error: responseText || 'Unknown error' };
            }
            throw new Error(errorData.error || 'Review submission failed');
        }

        alert('Review submitted successfully! Notification sent to team.');
        closeReviewModal();
        loadPendingReviews();
        loadSubmissions();
    } catch (error) {
        alert('Review submission failed: ' + error.message);
    }
}

function closeReviewModal() {
    document.getElementById('reviewModal').classList.remove('active');
}

// === WATCHLIST ===
async function loadWatchlist() {
    try {
        const response = await fetch(`${API_URL}/watchlist`, { credentials: 'include' });
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
    if (!confirm('Are you sure you want to approve this ticker for the watchlist?')) return;

    try {
        const response = await fetch(`${API_URL}/watchlist/approve/${submissionId}`, {
            method: 'POST',
            credentials: 'include'
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
    if (!confirm('Are you sure you want to deny this submission? It will remain in the dashboard but will not be added to the watchlist.')) return;

    try {
        const response = await fetch(`${API_URL}/submissions/${submissionId}/deny`, {
            method: 'POST',
            credentials: 'include'
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
    if (!confirm('Are you sure you want to PERMANENTLY DELETE this submission? This action cannot be undone and will remove all data including reviews.')) return;

    try {
        const response = await fetch(`${API_URL}/submissions/${submissionId}`, {
            method: 'DELETE',
            credentials: 'include'
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

async function removeFromWatchlist(submissionId) {
    if (!confirm('Remove this ticker from the watchlist? The submission data will be preserved but it will no longer appear on the watchlist.')) return;

    try {
        const response = await fetch(`${API_URL}/watchlist/remove/${submissionId}`, {
            method: 'POST',
            credentials: 'include'
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
