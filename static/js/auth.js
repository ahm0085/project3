document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------------------
    // 1. Login Form Handling
    // -------------------------------------------------------------------------
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (loginError) loginError.classList.add('d-none');

            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok && data.token) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.href = '/courses';
                } else {
                    if (loginError) {
                        loginError.textContent = data.error || 'Login failed. Please try again.';
                        loginError.classList.remove('d-none');
                    }
                }
            } catch (err) {
                console.error('Login Error:', err);
                if (loginError) {
                    loginError.textContent = 'Network error. Please try again.';
                    loginError.classList.remove('d-none');
                }
            }
        });
    }

    // -------------------------------------------------------------------------
    // 2. Registration Form & Skill Selection Handling
    // -------------------------------------------------------------------------
    const registerForm = document.getElementById('register-form');
    const registerError = document.getElementById('register-error');
    const skillInput = document.getElementById('skill-autocomplete');
    const skillsListContainer = document.getElementById('selected-skills-list');
    
    let selectedSkills = [];

    // Skill Autocomplete Handler
    if (skillInput) {
        skillInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const skillName = skillInput.value.trim();
                if (!skillName) return;

                // Check if already added
                if (selectedSkills.some(s => s.name.toLowerCase() === skillName.toLowerCase())) {
                    skillInput.value = '';
                    return;
                }

                try {
                    // Search DB for skill ID or fallback to dynamic creation
                    const res = await fetch(`/api/skills?q=${encodeURIComponent(skillName)}`);
                    const skillsData = await res.json();
                    
                    let skillId = null;
                    if (skillsData.length > 0) {
                        skillId = skillsData[0].id;
                    }

                    const newSkill = { skill_id: skillId, name: skillName, proficiency_level: 'intermediate' };
                    selectedSkills.push(newSkill);
                    renderSkillBadges();
                    skillInput.value = '';
                } catch (err) {
                    console.error('Skill lookup error:', err);
                }
            }
        });
    }

    function renderSkillBadges() {
        if (!skillsListContainer) return;
        skillsListContainer.innerHTML = '';
        selectedSkills.forEach((skill, index) => {
            const badge = document.createElement('span');
            badge.className = 'tag';
            badge.style.marginRight = '5px';
            badge.style.cursor = 'pointer';
            badge.innerHTML = `${skill.name} &times;`;
            badge.onclick = () => {
                selectedSkills.splice(index, 1);
                renderSkillBadges();
            };
            skillsListContainer.appendChild(badge);
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (registerError) registerError.classList.add('d-none');

            const username = document.getElementById('username').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();
            const major = document.getElementById('major')?.value.trim() || '';

            const payload = {
                username,
                email,
                password,
                major,
                skills: selectedSkills
            };

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (response.status === 201 && data.token) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.href = '/courses';
                } else {
                    if (registerError) {
                        registerError.textContent = data.error || 'Registration failed.';
                        registerError.classList.remove('d-none');
                    }
                }
            } catch (err) {
                console.error('Register Error:', err);
                if (registerError) {
                    registerError.textContent = 'Server connection error.';
                    registerError.classList.remove('d-none');
                }
            }
        });
    }
});