document.addEventListener('DOMContentLoaded', () => {

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/static/service-worker.js");
    }

    const dashboardContainer = document.querySelector('.dashboard');
    if (dashboardContainer) {
        loadDashboardData();
    }

    async function loadDashboardData() {
        try {
            const response = await fetch('/api/dashboard');

            const data = await response.json();

            document.getElementById('pending-count').innerText = data.pending_count;
            document.getElementById('missed-count').innerText = data.missed_count;

        } catch (err) {
            console.error(err);
        }
    }

    async function loadDashboardData() {
        const pendingCountElem = document.getElementById('pending-count');
        const missedCountElem = document.getElementById('missed-count');
        const upcomingListElem = document.getElementById('upcoming-list');
        const missedListElem = document.getElementById('missed-list');

        try {
            const response = await authenticatedFetch('/api/dashboard/', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch dashboard data');
            }

            const data = await response.json();

            // Update summary counts
            pendingCountElem.textContent = data.pending_count;
            missedCountElem.textContent = data.missed_count;

            // Render upcoming follow-ups
            upcomingListElem.innerHTML = '';
            if (data.upcoming && data.upcoming.length > 0) {
                data.upcoming.forEach(followup => {
                    const item = document.createElement('div');
                    item.className = 'alert-item upcoming';
                    item.innerHTML = `
                        <div class="alert-item-details">
                            <strong>${followup.followup_type} for ${followup.lead_id || followup.customer_id}</strong>
                            <br>
                            Scheduled: ${new Date(followup.followup_datetime).toLocaleString()}
                            <br>
                            Assigned To: ${followup.assigned_username} | Priority: ${followup.priority}
                        </div>
                        <a href="/followups" class="btn btn-sm btn-info">View</a>
                    `;
                    upcomingListElem.appendChild(item);
                });
            } else {
                upcomingListElem.innerHTML = '<p class="no-data">No upcoming follow-ups.</p>';
            }

            // Render missed follow-ups
            missedListElem.innerHTML = '';
            if (data.missed && data.missed.length > 0) {
                data.missed.forEach(followup => {
                    const item = document.createElement('div');
                    item.className = 'alert-item missed';
                    item.innerHTML = `
                        <div class="alert-item-details">
                            <strong>${followup.followup_type} for ${followup.lead_id || followup.customer_id}</strong>
                            <br>
                            Scheduled: ${new Date(followup.followup_datetime).toLocaleString()}
                            <br>
                            Assigned To: ${followup.assigned_username} | Priority: ${followup.priority}
                        </div>
                        <a href="/followups" class="btn btn-sm btn-info">View</a>
                    `;
                    missedListElem.appendChild(item);
                });
            } else {
                missedListElem.innerHTML = '<p class="no-data">No missed follow-ups.</p>';
            }

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            // Optionally display a user-friendly error message on the dashboard
            if (pendingCountElem) pendingCountElem.textContent = 'Error';
            if (missedCountElem) missedCountElem.textContent = 'Error';
            if (upcomingListElem) upcomingListElem.innerHTML = '<p class="error-message">Failed to load upcoming tasks.</p>';
            if (missedListElem) missedListElem.innerHTML = '<p class="error-message">Failed to load missed tasks.</p>';
        }
    }
});
