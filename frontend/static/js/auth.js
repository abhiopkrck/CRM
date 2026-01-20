document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    const errorMessage = document.getElementById('error-message');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorMessage.textContent = ''; // Clear previous errors

            const username = loginForm.elements.username.value;
            const password = loginForm.elements.password.value;

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    // Store user role in localStorage or session if needed for client-side logic
                    localStorage.setItem('userRole', data.role);
                    window.location.href = '/'; // Redirect to dashboard
                } else {
                    errorMessage.textContent = data.message || 'Login failed';
                }
            } catch (error) {
                console.error('Login error:', error);
                errorMessage.textContent = 'An unexpected error occurred. Please try again.';
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const response = await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    localStorage.removeItem('userRole'); // Clear user role
                    window.location.href = '/login'; // Redirect to login page
                } else {
                    const data = await response.json();
                    alert(data.message || 'Failed to log out.');
                }
            } catch (error) {
                console.error('Logout error:', error);
                alert('An error occurred during logout.');
            }
        });
    }

    // Function to check if user is logged in and redirect if not
    async function checkAuthAndRedirect() {
        const path = window.location.pathname;
        if (path === '/login') return; // Don't redirect on login page

        try {
            const response = await fetch('/api/auth/me', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                // Not authenticated, redirect to login
                window.location.href = '/login';
            } else {
                const userData = await response.json();
                localStorage.setItem('userRole', userData.role);
                // Update UI elements if they exist (e.g., username/role in navbar)
                const currentUsernameSpan = document.getElementById('current-username');
                const currentRoleSpan = document.getElementById('current-role');
                if (currentUsernameSpan) currentUsernameSpan.textContent = userData.username;
                if (currentRoleSpan) currentRoleSpan.textContent = userData.role;
            }
        } catch (error) {
            console.error('Auth check error:', error);
            // Even if there's a network error, assume not logged in for security
            window.location.href = '/login';
        }
    }

    // Call auth check on pages that require it (e.g., dashboard, followups)
    if (window.location.pathname !== '/login') {
        checkAuthAndRedirect();
    }
});

/**
 * Helper function to retrieve the current user's role.
 * @returns {string|null} The user's role (e.g., 'Admin', 'Sales Manager', 'Sales Executive') or null if not set.
 */
function getCurrentUserRole() {
    return localStorage.getItem('userRole');
}

/**
 * Helper function to send authenticated fetch requests.
 * @param {string} url - The URL to fetch.
 * @param {object} options - Fetch options (method, headers, body, etc.).
 * @returns {Promise<Response>} The fetch response.
 */
async function authenticatedFetch(url, options = {}) {
    // Add any global headers like Content-Type if not already present
    options.headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    const response = await fetch(url, options);

    // If the response is 401 Unauthorized, redirect to login
    if (response.status === 401) {
        localStorage.removeItem('userRole');
        window.location.href = '/login';
    }
    return response;
}