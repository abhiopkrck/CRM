
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const followupListTable = document.getElementById('followup-list');
    const addFollowupBtn = document.getElementById('add-followup-btn');

    // Modals
    const followupModal = document.getElementById('followup-modal');
    const historyModal = document.getElementById('history-modal');
    const rescheduleModal = document.getElementById('reschedule-modal');

    const closeModalBtns = document.querySelectorAll('.close-button');

    // Forms
    const followupForm = document.getElementById('followup-form');
    const rescheduleForm = document.getElementById('reschedule-form');

    // Form fields for Followup Modal
    const followupIdField = document.getElementById('followup-id');
    const modalTitle = document.getElementById('modal-title');
    const leadIdField = document.getElementById('lead-id');
    const customerIdField = document.getElementById('customer-id');
    const followupTypeField = document.getElementById('followup-type');
    const followupDatetimeField = document.getElementById('followup-datetime');
    const priorityField = document.getElementById('priority');
    const assignedToField = document.getElementById('assigned-to');
    const notesField = document.getElementById('notes');
    const formErrorMessage = document.getElementById('form-error-message');

    // Form fields for Reschedule Modal
    const rescheduleIdField = document.getElementById('reschedule-id');
    const newDatetimeField = document.getElementById('new-datetime');
    const rescheduleRemarksField = document.getElementById('reschedule-remarks');
    const rescheduleErrorMessage = document.getElementById('reschedule-error-message');

    // Filters
    const statusFilter = document.getElementById('status-filter');
    const typeFilter = document.getElementById('type-filter');
    const priorityFilter = document.getElementById('priority-filter');
    const assignedFilter = document.getElementById('assigned-filter');
    const searchInput = document.getElementById('search-input');

    let allFollowups = []; // Cache all follow-ups for client-side filtering
    let users = []; // Cache users for assigned_to dropdown

    const currentUserRole = getCurrentUserRole(); // From auth.js

    // --- Event Listeners ---
    addFollowupBtn.addEventListener('click', () => openFollowupModal());

    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', (event) => {
            const modal = event.target.closest('.modal');
            if (modal) modal.style.display = 'none';
            formErrorMessage.textContent = ''; // Clear errors
            rescheduleErrorMessage.textContent = '';
        });
    });

    window.addEventListener('click', (event) => {
        if (event.target == followupModal) followupModal.style.display = 'none';
        if (event.target == historyModal) historyModal.style.display = 'none';
        if (event.target == rescheduleModal) rescheduleModal.style.display = 'none';
    });

    followupForm.addEventListener('submit', handleFollowupFormSubmit);
    rescheduleForm.addEventListener('submit', handleRescheduleFormSubmit);

    // Filter change listeners
    statusFilter.addEventListener('change', renderFollowups);
    typeFilter.addEventListener('change', renderFollowups);
    priorityFilter.addEventListener('change', renderFollowups);
    assignedFilter.addEventListener('change', renderFollowups);
    searchInput.addEventListener('input', renderFollowups);

    // Initial load
    fetchUsersAndFollowups();

    // Check URL for pre-filling add form
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'add') {
        openFollowupModal();
    }


    // --- Functions ---

    async function fetchUsersAndFollowups() {
        try {
            // Fetch users for dropdowns
            const userResponse = await authenticatedFetch('/api/auth/users');
            if (!userResponse.ok) throw new Error('Failed to fetch users.');
            users = await userResponse.json();
            populateAssignedToDropdown(assignedToField, users);
            populateAssignedToDropdown(assignedFilter, users, true); // For filter

            // Fetch follow-ups
            const followupResponse = await authenticatedFetch('/api/followups/', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!followupResponse.ok) {
                const errorData = await followupResponse.json();
                throw new Error(errorData.message || 'Failed to fetch follow-ups.');
            }
            allFollowups = await followupResponse.json();
            renderFollowups();

        } catch (error) {
            console.error('Error initialising page:', error);
            followupListTable.innerHTML = `<tr><td colspan="9" class="error-message">Error loading data: ${error.message}</td></tr>`;
        }
    }

    function populateAssignedToDropdown(selectElement, usersList, isFilter = false) {
        selectElement.innerHTML = '';
        if (isFilter) {
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'All';
            selectElement.appendChild(defaultOption);
        }

        usersList.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.username} (${user.role})`;
            selectElement.appendChild(option);
        });

        // If not a filter and current user is Sales Executive, pre-select them and disable
        if (!isFilter && currentUserRole === 'Sales Executive') {
            fetch('/api/auth/me')
                .then(response => response.json())
                .then(userData => {
                    if (userData && userData.user_id) {
                        selectElement.value = userData.user_id;
                        selectElement.disabled = true; // Sales Executive can only assign to self
                    }
                })
                .catch(error => console.error('Error fetching current user for dropdown:', error));
        } else {
            selectElement.disabled = false; // Ensure it's not disabled for Admin/Manager/filters
        }
    }


    function renderFollowups() {
        const filteredFollowups = allFollowups.filter(followup => {
            const statusMatch = statusFilter.value === '' || followup.status === statusFilter.value;
            const typeMatch = typeFilter.value === '' || followup.followup_type === typeFilter.value;
            const priorityMatch = priorityFilter.value === '' || followup.priority === priorityFilter.value;
            const assignedMatch = assignedFilter.value === '' || followup.assigned_to == assignedFilter.value;
            const searchLower = searchInput.value.toLowerCase();
            const searchMatch = searchInput.value === '' ||
                                (followup.lead_id && followup.lead_id.toLowerCase().includes(searchLower)) ||
                                (followup.customer_id && followup.customer_id.toLowerCase().includes(searchLower)) ||
                                (followup.notes && followup.notes.toLowerCase().includes(searchLower));
            return statusMatch && typeMatch && priorityMatch && assignedMatch && searchMatch;
        });

        followupListTable.innerHTML = ''; // Clear existing rows

        if (filteredFollowups.length === 0) {
            followupListTable.innerHTML = '<tr><td colspan="9">No follow-ups to display.</td></tr>';
            return;
        }

        filteredFollowups.forEach(followup => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${followup.id}</td>
                <td>${followup.lead_id || followup.customer_id || 'N/A'}</td>
                <td>${followup.followup_type}</td>
                <td>${new Date(followup.followup_datetime).toLocaleString()}</td>
                <td>${followup.priority}</td>
                <td class="status-cell status-${followup.status.toLowerCase()}">${followup.status}</td>
                <td>${followup.assigned_username}</td>
                <td>${followup.notes ? followup.notes.substring(0, 50) + (followup.notes.length > 50 ? '...' : '') : ''}</td>
                <td class="action-buttons">
                    ${(currentUserRole === 'Admin' || currentUserRole === 'Sales Manager' || (currentUserRole === 'Sales Executive' && followup.assigned_to === currentUserId)) ?
                        `<button class="btn btn-sm btn-primary edit-btn" data-id="${followup.id}">Edit</button>` : ''
                    }
                    ${(currentUserRole === 'Admin' || currentUserRole === 'Sales Manager' || (currentUserRole === 'Sales Executive' && followup.assigned_to === currentUserId)) && followup.status === 'Pending' ?
                        `<button class="btn btn-sm btn-success complete-btn" data-id="${followup.id}">Complete</button>
                         <button class="btn btn-sm btn-info reschedule-btn" data-id="${followup.id}">Reschedule</button>` : ''
                    }
                    <button class="btn btn-sm btn-secondary history-btn" data-id="${followup.id}">History</button>
                    ${(currentUserRole === 'Admin' || currentUserRole === 'Sales Manager') && followup.status !== 'Missed' ?
                        `<button class="btn btn-sm btn-danger mark-missed-btn" data-id="${followup.id}">Mark Missed</button>` : ''
                    }
                </td>
            `;
            followupListTable.appendChild(row);
        });

        // Attach event listeners for dynamically created buttons
        document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            const followup = allFollowups.find(f => f.id == id);
            openFollowupModal(followup);
        }));
        document.querySelectorAll('.complete-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            if (confirm('Are you sure you want to mark this follow-up as Completed?')) {
                updateFollowupStatus(id, 'Completed', 'Follow-up marked as completed by user.');
            }
        }));
        document.querySelectorAll('.reschedule-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            const followup = allFollowups.find(f => f.id == id);
            openRescheduleModal(followup);
        }));
        document.querySelectorAll('.history-btn').forEach(btn => btn.addEventListener('click', (e) => {
            openHistoryModal(e.target.dataset.id);
        }));
        document.querySelectorAll('.mark-missed-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            if (confirm('Are you sure you want to manually mark this follow-up as Missed? This action cannot be undone.')) {
                updateFollowupStatus(id, 'Missed', 'Follow-up manually marked as missed by user.');
            }
        }));
    }

    // This is needed because currentUserId is from the server-rendered template
    const currentUserId = document.getElementById('current-user-id') ? parseInt(document.getElementById('current-user-id').textContent) : null;


    function openFollowupModal(followup = null) {
        formErrorMessage.textContent = ''; // Clear errors
        followupForm.reset();
        assignedToField.disabled = false; // Reset disabled state for exec
        followupIdField.value = '';

        if (followup) {
            modalTitle.textContent = 'Edit Follow-Up';
            followupIdField.value = followup.id;
            leadIdField.value = followup.lead_id || '';
            customerIdField.value = followup.customer_id || '';
            followupTypeField.value = followup.followup_type;
            // Format datetime-local requires 'YYYY-MM-DDTHH:MM'
            const dt = new Date(followup.followup_datetime);
            followupDatetimeField.value = dt.toISOString().slice(0, 16);
            priorityField.value = followup.priority;
            assignedToField.value = followup.assigned_to;
            notesField.value = followup.notes || '';
        } else {
            modalTitle.textContent = 'Schedule New Follow-Up';
            // Set default assigned to current user if Sales Executive
            if (currentUserRole === 'Sales Executive' && currentUserId) {
                assignedToField.value = currentUserId;
                assignedToField.disabled = true; // Disable selection for Sales Executive
            } else if (users.length > 0) {
                // If not executive, try to select the first user as a default or leave blank
                assignedToField.value = users[0].id;
            }
            // Set default datetime to now
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // Adjust for timezone offset
            followupDatetimeField.value = now.toISOString().slice(0, 16);
        }
        followupModal.style.display = 'block';
    }

    async function handleFollowupFormSubmit(e) {
        e.preventDefault();
        formErrorMessage.textContent = '';

        const id = followupIdField.value;
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/followups/${id}` : '/api/followups/';

        // Temporarily enable assignedToField if it was disabled for Sales Executive
        const wasAssignedToDisabled = assignedToField.disabled;
        if (wasAssignedToDisabled) {
            assignedToField.disabled = false;
        }

        const formData = {
            lead_id: leadIdField.value.trim() || null,
            customer_id: customerIdField.value.trim() || null,
            followup_type: followupTypeField.value,
            followup_datetime: followupDatetimeField.value,
            priority: priorityField.value,
            assigned_to: parseInt(assignedToField.value),
            notes: notesField.value.trim() || null
        };

        // Re-disable if it was originally disabled
        if (wasAssignedToDisabled) {
            assignedToField.disabled = true;
        }

        // Client-side validation
        if (!formData.lead_id && !formData.customer_id) {
            formErrorMessage.textContent = 'Either Lead ID or Customer ID must be provided.';
            return;
        }
        if (!formData.followup_type || !formData.followup_datetime || !formData.priority || !formData.assigned_to) {
            formErrorMessage.textContent = 'Please fill in all required fields (Type, Date & Time, Priority, Assigned To).';
            return;
        }

        try {
            const response = await authenticatedFetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                followupModal.style.display = 'none';
                fetchUsersAndFollowups(); // Refresh the list
            } else {
                formErrorMessage.textContent = data.message || 'Error saving follow-up.';
            }
        } catch (error) {
            console.error('Follow-up form submission error:', error);
            formErrorMessage.textContent = 'An unexpected error occurred. Please try again.';
        }
    }

    async function updateFollowupStatus(id, newStatus, remarks = '') {
        try {
            const response = await authenticatedFetch(`/api/followups/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, remarks: remarks })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to update status to ${newStatus}`);
            }

            // Optionally auto-create next follow-up after marking completed
            if (newStatus === 'Completed') {
                const followup = allFollowups.find(f => f.id == id);
                if (confirm('Follow-up completed! Do you want to schedule a new follow-up for this Lead/Customer?')) {
                    openFollowupModal(null); // Open a new form
                    leadIdField.value = followup.lead_id || '';
                    customerIdField.value = followup.customer_id || '';
                    followupTypeField.value = followup.followup_type; // Suggest same type
                    // Suggest next week same time
                    const now = new Date();
                    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                    nextWeek.setMinutes(nextWeek.getMinutes() - nextWeek.getTimezoneOffset());
                    followupDatetimeField.value = nextWeek.toISOString().slice(0, 16);
                    priorityField.value = followup.priority;
                    assignedToField.value = followup.assigned_to;
                    notesField.value = `Next follow-up for ${followup.lead_id || followup.customer_id}`;
                }
            }

            fetchUsersAndFollowups(); // Refresh the list
        } catch (error) {
            console.error('Error updating follow-up status:', error);
            alert(`Failed to update status: ${error.message}`);
        }
    }

    function openRescheduleModal(followup) {
        rescheduleErrorMessage.textContent = '';
        rescheduleForm.reset();
        rescheduleIdField.value = followup.id;
        document.getElementById('reschedule-followup-id').textContent = followup.id;

        // Set default new datetime to a bit in the future or current time + 1 hour
        const dt = new Date(followup.followup_datetime);
        const now = new Date();
        let defaultTime = dt > now ? dt : new Date(now.getTime() + 60 * 60 * 1000);
        defaultTime.setMinutes(defaultTime.getMinutes() - defaultTime.getTimezoneOffset());
        newDatetimeField.value = defaultTime.toISOString().slice(0, 16);

        rescheduleModal.style.display = 'block';
    }

    async function handleRescheduleFormSubmit(e) {
        e.preventDefault();
        rescheduleErrorMessage.textContent = '';

        const id = rescheduleIdField.value;
        const newDatetime = newDatetimeField.value;
        const remarks = rescheduleRemarksField.value.trim();

        if (!newDatetime) {
            rescheduleErrorMessage.textContent = 'Please select a new date and time.';
            return;
        }

        try {
            // First, update the datetime and notes (if any)
            const currentFollowup = allFollowups.find(f => f.id == id);
            const updatedNotes = remarks ? `${currentFollowup.notes || ''}\nRescheduled: ${new Date().toLocaleString()} - ${remarks}`.trim() : currentFollowup.notes;

            const updateResponse = await authenticatedFetch(`/api/followups/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lead_id: currentFollowup.lead_id,
                    customer_id: currentFollowup.customer_id,
                    followup_type: currentFollowup.followup_type,
                    followup_datetime: newDatetime,
                    priority: currentFollowup.priority,
                    assigned_to: currentFollowup.assigned_to,
                    notes: updatedNotes // Update notes with reschedule remark
                })
            });

            if (!updateResponse.ok) {
                const errorData = await updateResponse.json();
                throw new Error(errorData.message || 'Failed to update follow-up details.');
            }

            // Then, update the status to 'Rescheduled'
            const statusResponse = await authenticatedFetch(`/api/followups/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Rescheduled', remarks: `Rescheduled to ${new Date(newDatetime).toLocaleString()}. ${remarks}`.trim() })
            });

            if (!statusResponse.ok) {
                const errorData = await statusResponse.json();
                throw new Error(errorData.message || 'Failed to update follow-up status to Rescheduled.');
            }

            rescheduleModal.style.display = 'none';
            fetchUsersAndFollowups(); // Refresh the list
        } catch (error) {
            console.error('Reschedule error:', error);
            rescheduleErrorMessage.textContent = `Error rescheduling: ${error.message}`;
        }
    }

    async function openHistoryModal(followupId) {
        document.getElementById('history-followup-id').textContent = followupId;
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '<p>Loading history...</p>';
        historyModal.style.display = 'block';

        try {
            const response = await authenticatedFetch(`/api/followups/${followupId}/history`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch history.');
            }

            const history = await response.json();
            historyList.innerHTML = ''; // Clear loading message

            if (history.length === 0) {
                historyList.innerHTML = '<p class="no-data">No history found for this follow-up.</p>';
                return;
            }

            history.forEach(item => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.innerHTML = `
                    <p>
                        <span class="action">${item.action}</span>
                        <span class="date">on ${new Date(item.action_date).toLocaleString()}</span>
                        by <strong>${item.acted_by_username || 'System'}</strong>.
                    </p>
                    ${item.remarks ? `<p class="remarks">${item.remarks}</p>` : ''}
                `;
                historyList.appendChild(historyItem);
            });

        } catch (error) {
            console.error('Error fetching history:', error);
            historyList.innerHTML = `<p class="error-message">Error loading history: ${error.message}</p>`;
        }
    }
});
