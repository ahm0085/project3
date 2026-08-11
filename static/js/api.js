document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');

    // Helper for Authorization Headers
    function getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        };
    }

    // -------------------------------------------------------------------------
    // 1. Logout Button Listener
    // -------------------------------------------------------------------------
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        });
    }

    // -------------------------------------------------------------------------
    // 2. Profile Page Data Loader
    // -------------------------------------------------------------------------
    const profileUsername = document.getElementById('profile-username');
    const profileEmail = document.getElementById('profile-email');
    const profileMajor = document.getElementById('profile-major');

    if (profileUsername || profileEmail) {
        if (!token) {
            window.location.href = '/login';
            return;
        }

        fetch('/api/users/me', {
            method: 'GET',
            headers: getAuthHeaders()
        })
        .then(res => {
            if (!res.ok) throw new Error('Unauthorized');
            return res.json();
        })
        .then(user => {
            if (profileUsername) profileUsername.textContent = user.username || 'N/A';
            if (profileEmail) profileEmail.textContent = user.email || 'N/A';
            if (profileMajor) profileMajor.textContent = user.major || 'N/A';
        })
        .catch(err => {
            console.error('Profile load error:', err);
            localStorage.removeItem('token');
            window.location.href = '/login';
        });
    }

    // -------------------------------------------------------------------------
    // 3. Search and Course Loading
    // -------------------------------------------------------------------------
    const heroSearchInput = document.getElementById('hero-search');
    const heroSearchBtn = heroSearchInput?.nextElementSibling;

    if (heroSearchBtn && heroSearchInput) {
        heroSearchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const query = heroSearchInput.value.trim();
            loadCourses(query);
        });
    }

    function loadCourses(searchQuery = '') {
        const courseGrid = document.querySelector('.course-grid');
        if (!courseGrid) return;

        let url = `/api/courses?q=${encodeURIComponent(searchQuery)}`;

        fetch(url, { headers: getAuthHeaders() })
            .then(res => res.json())
            .then(data => {
                if (!data.courses || data.courses.length === 0) {
                    courseGrid.innerHTML = '<p>No courses found matching your criteria.</p>';
                    return;
                }

                courseGrid.innerHTML = data.courses.map(course => `
                    <div class="course-card">
                        <div class="course-image-placeholder">${course.title}</div>
                        <div class="course-content">
                            <h2 class="course-title">${course.title}</h2>
                            <p class="course-instructor">By ${course.instructor || 'Instructor'}</p>
                            <p class="course-description">${course.description || ''}</p>
                            <div class="skill-tags">
                                ${(course.skills || []).map(s => `<span class="tag">${s.name}</span>`).join('')}
                            </div>
                            ${course.match_score ? `<p><strong>Match Score:</strong> ${course.match_score}%</p>` : ''}
                            <button class="btn-primary" onclick="alert('Course Details ID: ${course.id}')">View Details</button>
                        </div>
                    </div>
                `).join('');
            })
            .catch(err => console.error('Error fetching courses:', err));
    }

    // Auto load courses on courses page startup
    if (document.querySelector('.course-grid')) {
        loadCourses();
    }

    // -------------------------------------------------------------------------
    // 4. Analyze Text Form Submission
    // -------------------------------------------------------------------------
    const analysisForm = document.getElementById('analysis-form');
    const resultsContainer = document.getElementById('results-container');

    if (analysisForm) {
        analysisForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const textInput = document.getElementById('text-input').value;

            if (resultsContainer) {
                resultsContainer.innerHTML = '<p>Analyzing skills and content...</p>';
            }

            // Calls POST /api/recommend
            fetch('/api/recommend', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ text: textInput, limit: 5 })
            })
            .then(res => {
                if (res.status === 401) {
                    window.location.href = '/login';
                    return;
                }
                return res.json();
            })
            .then(data => {
                if (!data || !data.recommendations) {
                    if (resultsContainer) resultsContainer.innerHTML = '<p>Analysis completed. No recommended courses found.</p>';
                    return;
                }

                resultsContainer.innerHTML = `
                    <h3>Recommended Courses for You:</h3>
                    <ul>
                        ${data.recommendations.map(c => `
                            <li style="margin-bottom: 10px;">
                                <strong>${c.title}</strong> (${c.match_score}% Match)<br>
                                <small>${c.explanation || ''}</small>
                            </li>
                        `).join('')}
                    </ul>
                `;
            })
            .catch(err => {
                console.error('Analysis error:', err);
                if (resultsContainer) resultsContainer.innerHTML = '<p style="color: red;">Failed to run analysis. Make sure you are logged in.</p>';
            });
        });
    }
});