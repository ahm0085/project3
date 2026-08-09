import { apiFetch, showSpinner, logout } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    const profileContainer = document.getElementById('profile-info');
    const skillsList = document.getElementById('user-skills-list');
    const logoutBtn = document.getElementById('logout-btn');

    async function loadUserProfile() {
        if (!profileContainer) return;

        showSpinner(profileContainer);

        try {
            const user = await apiFetch('/users/me');

            profileContainer.innerHTML = `
                <h4>${user.username}</h4>
                <p class="text-muted">${user.email}</p>
                <p><strong>Major:</strong> ${user.major || 'Not specified'}</p>
            `;

            renderUserSkills(user.skills || []);
        } catch (err) {
            profileContainer.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    Failed to load profile: ${err.message}
                </div>
            `;
        }
    }

    function renderUserSkills(skills) {
        if (!skillsList) return;

        if (!skills.length) {
            skillsList.innerHTML = '<li class="list-group-item text-muted">No skills added yet.</li>';
            return;
        }

        skillsList.innerHTML = skills.map(skill => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <strong>${skill.name}</strong>
                    <span class="badge bg-secondary ms-2">${skill.proficiency_level}</span>
                </div>
            </li>
        `).join('');
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    loadUserProfile();
});