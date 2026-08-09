import { apiFetch, showSpinner } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    const recContainer = document.getElementById('recommendations-container');
    const shareBtn = document.getElementById('share-recs-btn');

    async function loadRecommendations() {
        if (!recContainer) return;

        showSpinner(recContainer);

        try {
            const data = await apiFetch('/recommend', {
                method: 'POST',
                body: JSON.stringify({ limit: 6 })
            });

            renderRecommendations(data.recommendations || []);
        } catch (err) {
            recContainer.innerHTML = `
                <div class="alert alert-danger col-12" role="alert">
                    Could not fetch recommendations: ${err.message}
                </div>
            `;
        }
    }

    function renderRecommendations(recommendations) {
        if (!recommendations.length) {
            recContainer.innerHTML = '<p class="text-muted col-12 text-center">No recommendations found. Try adding more skills to your profile.</p>';
            return;
        }

        recContainer.innerHTML = recommendations.map(rec => `
            <div class="col-md-6 mb-4">
                <div class="card h-100 border-primary shadow-sm">
                    <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                        <span class="fw-bold">${rec.title}</span>
                        <span class="badge bg-light text-primary fs-6">${rec.match_score}% Match</span>
                    </div>
                    <div class="card-body">
                        <p class="text-muted mb-1"><strong>Instructor:</strong> ${rec.instructor}</p>
                        <p class="card-text">${rec.description}</p>
                        <div class="alert alert-info py-2 px-3 small mb-2">
                            💡 <strong>Why recommended:</strong> ${rec.explanation}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // --- Share Recommendations Feature ---
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            const shareUrl = window.location.href;
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'My SkillSync AI Recommendations',
                        url: shareUrl
                    });
                } catch (err) {
                    console.log('Share canceled:', err);
                }
            } else {
                await navigator.clipboard.writeText(shareUrl);
                alert('Recommendation link copied to clipboard!');
            }
        });
    }

    loadRecommendations();
});