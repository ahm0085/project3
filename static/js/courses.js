import { apiFetch, showSpinner, hideSpinner } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    const courseGrid = document.getElementById('courses-grid');
    const searchInput = document.getElementById('search-input');
    const skillSelect = document.getElementById('skill-filter');
    const sortSelect = document.getElementById('sort-filter');

    let savedBookmarks = JSON.parse(localStorage.getItem('saved_courses') || '[]');

    async function loadCourses() {
        if (!courseGrid) return;

        showSpinner(courseGrid);

        const params = new URLSearchParams();
        if (searchInput && searchInput.value) params.append('q', searchInput.value.trim());
        if (skillSelect && skillSelect.value) params.append('skill', skillSelect.value);
        if (sortSelect && sortSelect.value) params.append('sort', sortSelect.value);

        try {
            const data = await apiFetch(`/courses?${params.toString()}`);
            renderCourses(data.courses);
        } catch (err) {
            courseGrid.innerHTML = `
                <div class="alert alert-danger w-100" role="alert">
                    Failed to load courses: ${err.message}
                </div>
            `;
        }
    }

    function renderCourses(courses) {
        if (!courses || courses.length === 0) {
            courseGrid.innerHTML = '<p class="text-muted text-center col-12">No courses found.</p>';
            return;
        }

        courseGrid.innerHTML = courses.map(course => {
            const isBookmarked = savedBookmarks.includes(course.id);

            return `
                <div class="col-md-4 mb-4">
                    <div class="card h-100 course-card shadow-sm hover-lift">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <h5 class="card-title text-truncate">${course.title}</h5>
                                <button class="btn btn-sm bookmark-btn ${isBookmarked ? 'btn-warning' : 'btn-outline-secondary'}" data-id="${course.id}">
                                    ★
                                </button>
                            </div>
                            <h6 class="card-subtitle mb-2 text-muted">${course.instructor}</h6>
                            <p class="card-text text-truncate-3">${course.description}</p>
                            ${course.match_score ? `<span class="badge bg-success mb-2">Match: ${course.match_score}%</span>` : ''}
                            <div class="d-flex flex-wrap gap-1">
                                ${course.skills.map(s => `<span class="badge bg-light text-dark border">${s.name}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Attach Bookmark Event Handlers
        document.querySelectorAll('.bookmark-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                toggleBookmark(id, e.target);
            });
        });
    }

    function toggleBookmark(id, buttonEl) {
        if (savedBookmarks.includes(id)) {
            savedBookmarks = savedBookmarks.filter(bId => bId !== id);
            buttonEl.classList.replace('btn-warning', 'btn-outline-secondary');
        } else {
            savedBookmarks.push(id);
            buttonEl.classList.replace('btn-outline-secondary', 'btn-warning');
        }
        localStorage.setItem('saved_courses', JSON.stringify(savedBookmarks));
    }

    // Attach Event Listeners
    if (searchInput) searchInput.addEventListener('input', debounce(loadCourses, 400));
    if (skillSelect) skillSelect.addEventListener('change', loadCourses);
    if (sortSelect) sortSelect.addEventListener('change', loadCourses);

    function debounce(func, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    }

    // Initial Load
    loadCourses();
});