import { apiFetch, setToken } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const skillInput = document.getElementById('skill-autocomplete');
    const selectedSkillsContainer = document.getElementById('selected-skills-list');

    let selectedSkills = [];

    // --- Dynamic Skill Selection with Autocomplete ---
    if (skillInput) {
        skillInput.addEventListener('input', async (e) => {
            const query = e.target.value.trim();
            if (query.length < 2) return;

            try {
                // Fetch skill suggestions from backend
                const response = await apiFetch(`/skills?q=${encodeURIComponent(query)}`);
                renderSkillSuggestions(response.skills || []);
            } catch (err) {
                console.error('Skill lookup error:', err);
            }
        });
    }

    function renderSkillSuggestions(skills) {
        let suggestionBox = document.getElementById('skill-suggestions');
        if (!suggestionBox) {
            suggestionBox = document.createElement('div');
            suggestionBox.id = 'skill-suggestions';
            suggestionBox.className = 'list-group position-absolute w-100 z-3 shadow-sm';
            skillInput.parentNode.appendChild(suggestionBox);
        }

        suggestionBox.innerHTML = skills.map(skill => `
            <button type="button" class="list-group-item list-group-item-action skill-item" data-id="${skill.id}" data-name="${skill.name}">
                ${skill.name}
            </button>
        `).join('');

        suggestionBox.querySelectorAll('.skill-item').forEach(btn => {
            btn.addEventListener('click', () => {
                addSkillBadge(btn.dataset.id, btn.dataset.name);
                suggestionBox.innerHTML = '';
                skillInput.value = '';
            });
        });
    }

    function addSkillBadge(id, name) {
        if (selectedSkills.some(s => s.skill_id === parseInt(id))) return;

        const skillObj = { skill_id: parseInt(id), name, proficiency_level: 'beginner' };
        selectedSkills.push(skillObj);

        const badge = document.createElement('div');
        badge.className = 'badge bg-primary me-2 mb-2 p-2 d-inline-flex align-items-center gap-2';
        badge.dataset.id = id;
        badge.innerHTML = `
            <span>${name}</span>
            <select class="form-select form-select-sm border-0 py-0 text-dark" style="font-size:0.75rem;">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
            </select>
            <button type="button" class="btn-close btn-close-white ms-1" aria-label="Remove"></button>
        `;

        badge.querySelector('select').addEventListener('change', (e) => {
            skillObj.proficiency_level = e.target.value;
        });

        badge.querySelector('.btn-close').addEventListener('click', () => {
            selectedSkills = selectedSkills.filter(s => s.skill_id !== parseInt(id));
            badge.remove();
        });

        selectedSkillsContainer.appendChild(badge);
    }

    // --- Form Handlers ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorAlert = document.getElementById('login-error');

            try {
                const res = await apiFetch('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                });

                setToken(res.token);
                window.location.href = '/courses';
            } catch (err) {
                if (errorAlert) {
                    errorAlert.textContent = err.message;
                    errorAlert.classList.remove('d-none');
                }
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorAlert = document.getElementById('register-error');

            try {
                const res = await apiFetch('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({
                        username,
                        email,
                        password,
                        skills: selectedSkills
                    })
                });

                setToken(res.token);
                window.location.href = '/courses';
            } catch (err) {
                if (errorAlert) {
                    errorAlert.textContent = err.message;
                    errorAlert.classList.remove('d-none');
                }
            }
        });
    }
});