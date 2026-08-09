/**
 * Shared API Client and JWT Utilities
 */

const API_BASE = '/api';
const TOKEN_KEY = 'skillsync_token';

// --- Token & Auth Helpers ---
export function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated() {
    return !!getToken();
}

export function logout() {
    removeToken();
    window.location.href = '/login';
}

// --- Loading Spinner UI Helpers ---
export function showSpinner(containerOrElement) {
    if (!containerOrElement) return;
    containerOrElement.dataset.originalHtml = containerOrElement.innerHTML;
    containerOrElement.innerHTML = `
        <div class="d-flex justify-content-center align-items-center p-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `;
}

export function hideSpinner(containerOrElement) {
    if (containerOrElement && containerOrElement.dataset.originalHtml !== undefined) {
        containerOrElement.innerHTML = containerOrElement.dataset.originalHtml;
        delete containerOrElement.dataset.originalHtml;
    }
}

// --- Core API Request Method with Retries & Error Handling ---
export async function apiFetch(endpoint, options = {}, retries = 2) {
    const url = endpoint.startsWith('/') ? `${API_BASE}${endpoint}` : `${API_BASE}/${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    const token = getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers
    };

    try {
        const response = await fetch(url, config);

        // Handle 401 Unauthorized globally
        if (response.status === 401) {
            removeToken();
            window.location.href = '/login?expired=1';
            throw new Error('Session expired. Please login again.');
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP error! Status: ${response.status}`);
        }

        return data;
    } catch (error) {
        if (retries > 0 && !error.message.includes('401')) {
            console.warn(`Request failed. Retrying... (${retries} attempts left)`);
            await new Promise((res) => setTimeout(res, 1000));
            return apiFetch(endpoint, options, retries - 1);
        }
        throw error;
    }
}