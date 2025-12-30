// ============================================
// ADMIN BOOKING MANAGEMENT SYSTEM
// ============================================

const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxtB7YD3gZBzwkSbQzG17v7k0OuCJ2DVgpZTw37rvazIV_JpSZxrv2Smvgs7hsaWUBd/exec';

// Global variables
let allBookings = [];
let currentEditingId = null;

// Activity names mapping
const activityNames = {
    'general-30': 'General Admission 30min',
    'general-1': 'General Admission 1hr',
    'general-2': 'General Admission 2hr',
    'toddler-30': 'Toddler 30min',
    'toddler-1': 'Toddler 1hr',
    'happy-party': 'Happy Jump Party',
    'mega-party': 'Mega Happy Party'
};


// ============================================
// GOOGLE SHEETS FUNCTIONS FOR ADMIN
// ============================================

// Load bookings from Google Sheets
async function loadBookingsFromGoogleSheets(filters = {}) {
    try {
        // Build query parameters
        const params = new URLSearchParams();
        if (filters.date) params.append('date', filters.date);
        if (filters.status) params.append('status', filters.status);
        if (filters.search) params.append('search', filters.search);

        const url = `${GOOGLE_SHEETS_URL}?${params.toString()}`;
        console.log('Fetching from:', url);

        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
            console.log(`✅ Loaded ${result.filtered} bookings from Google Sheets`);
            return result.data;
        } else {
            console.error('❌ Google Sheets error:', result.error);
            return [];
        }

    } catch (error) {
        console.error('❌ Network error loading bookings:', error);
        // Fallback to localStorage
        return loadBookingsFromLocalStorage(filters);
    }
}

// Load from localStorage (fallback)
function loadBookingsFromLocalStorage(filters = {}) {
    try {
        const storedBookings = localStorage.getItem('happyvilleBookings');
        if (!storedBookings) return [];

        let bookings = JSON.parse(storedBookings);

        // Apply filters
        if (filters.date) {
            bookings = bookings.filter(b => b.date === filters.date);
        }
        if (filters.status) {
            bookings = bookings.filter(b => b.status === filters.status);
        }
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            bookings = bookings.filter(b =>
                b.name.toLowerCase().includes(searchTerm) ||
                (b.email && b.email.toLowerCase().includes(searchTerm)) ||
                (b.phone && b.phone.includes(searchTerm))
            );
        }

        console.log(`📱 Loaded ${bookings.length} bookings from localStorage`);
        return bookings;

    } catch (error) {
        console.error('LocalStorage error:', error);
        return [];
    }
}

// Initialize bookings storage
async function initializeBookingsFromStorage() {
    console.log('Initializing bookings from storage...');

    // First try Google Sheets
    allBookings = await loadBookingsFromGoogleSheets();

    // If empty, try localStorage
    if (allBookings.length === 0) {
        allBookings = loadBookingsFromLocalStorage();
    }

    console.log(`📊 Total bookings loaded: ${allBookings.length}`);

    // Clean up old local bookings (older than 7 days)
    cleanupOldLocalBookings();

    // Display bookings
    displayBookings(allBookings);
}

// Filter bookings (updated)
async function filterBookings() {
    const dateFilter = document.getElementById('dateFilter');
    const statusFilter = document.getElementById('statusFilter');
    const activityFilter = document.getElementById('activityFilter');
    const searchInput = document.getElementById('searchInput');

    if (!dateFilter || !statusFilter || !activityFilter || !searchInput) {
        console.error('Filter elements not found');
        return;
    }

    const filters = {
        date: dateFilter.value || '',
        status: statusFilter.value || '',
        search: searchInput.value || ''
    };

    // Try Google Sheets first
    let filtered = await loadBookingsFromGoogleSheets(filters);

    // If Google Sheets fails or returns empty, use local
    if (filtered.length === 0) {
        filtered = loadBookingsFromLocalStorage(filters);
    }

    // Apply activity filter (client-side only)
    if (activityFilter.value) {
        filtered = filtered.filter(booking => booking.activity === activityFilter.value);
    }

    displayBookings(filtered);
}

function searchBookings() {
    filterBookings();
}

// Refresh bookings
async function refreshBookings() {
    const refreshBtn = document.querySelector('.btn-refresh');
    if (!refreshBtn) return;

    const originalText = refreshBtn.innerHTML;
    refreshBtn.innerHTML = '<span class="loading-spinner-small"></span>';
    refreshBtn.disabled = true;

    try {
        // Try to get latest from Google Sheets
        const newBookings = await loadBookingsFromGoogleSheets();

        if (newBookings.length > 0) {
            allBookings = newBookings;
            showNotification(`Bookings refreshed: ${allBookings.length} total`);
        } else {
            showNotification('Using local bookings');
        }

        filterBookings();

    } catch (error) {
        console.error('Refresh error:', error);
        showError('Refresh failed. Using cached data.');
    } finally {
        refreshBtn.innerHTML = originalText;
        refreshBtn.disabled = false;
    }
}

// Clean up old local bookings
function cleanupOldLocalBookings() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const localBookings = JSON.parse(localStorage.getItem('happyvilleBookings') || '[]');
    const freshBookings = localBookings.filter(booking => {
        if (!booking.createdAt) return true;
        const created = new Date(booking.createdAt);
        return created >= oneWeekAgo || booking.isLocal;
    });

    if (freshBookings.length < localBookings.length) {
        localStorage.setItem('happyvilleBookings', JSON.stringify(freshBookings));
        console.log(`🧹 Cleaned up ${localBookings.length - freshBookings.length} old local bookings`);
    }
}

// ============================================
// DISPLAY FUNCTIONS
// ============================================

function displayBookings(bookings) {
    const tbody = document.getElementById('bookingsTableBody');
    const emptyState = document.getElementById('emptyState');
    const bookingsCount = document.getElementById('bookingsCount');
    const totalBookingsEl = document.getElementById('totalBookings');
    const confirmedBookingsEl = document.getElementById('confirmedBookings');
    const pendingBookingsEl = document.getElementById('pendingBookings');
    const cancelledBookingsEl = document.getElementById('cancelledBookings');

    if (!tbody || !emptyState || !bookingsCount) {
        console.error('Display elements not found');
        return;
    }

    // Update counters
    if (totalBookingsEl) totalBookingsEl.textContent = allBookings.length;
    if (confirmedBookingsEl) confirmedBookingsEl.textContent = allBookings.filter(b => b.status === 'confirmed').length;
    if (pendingBookingsEl) pendingBookingsEl.textContent = allBookings.filter(b => b.status === 'pending').length;
    if (cancelledBookingsEl) cancelledBookingsEl.textContent = allBookings.filter(b => b.status === 'cancelled').length;

    if (bookings.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        bookingsCount.textContent = '0 bookings';
        return;
    }

    emptyState.style.display = 'none';
    bookingsCount.textContent = `${bookings.length} bookings`;

    const rows = bookings.map(booking => {
        const isLocal = booking.isLocal;
        const sourceBadge = isLocal ? '<span class="local-badge" title="Local backup">📱</span> ' : '';
        const statusClass = `status-${booking.status || 'pending'}`;
        const statusText = (booking.status || 'pending').charAt(0).toUpperCase() + (booking.status || 'pending').slice(1);

        return `
            <tr data-booking-id="${booking.id || booking.bookingid}" class="${isLocal ? 'local-booking' : ''}">
                <td>${sourceBadge}<strong>${booking.name || 'N/A'}</strong></td>
                <td>${booking.phone || 'N/A'}</td>
                <td>${booking.email || 'N/A'}</td>
                <td>${activityNames[booking.activity] || booking.activity || 'N/A'}</td>
                <td>${booking.kids || 0}</td>
                <td>${booking.adults || 0}</td>
                <td>${formatDate(booking.date)}</td>
                <td>${formatTime(booking.time)}</td>
                <td>
                    <span class="${statusClass}">${statusText}</span>
                    <select class="status-select" onchange="updateBookingStatus('${booking.id || booking.bookingid}', this.value)" style="margin-top: 5px; display: block; width: 100%;">
                        <option value="pending" ${(booking.status || 'pending') === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="confirmed" ${(booking.status || 'pending') === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="cancelled" ${(booking.status || 'pending') === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        <option value="completed" ${(booking.status || 'pending') === 'completed' ? 'selected' : ''}>Completed</option>
                    </select>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-edit" onclick="openEditModal('${booking.id || booking.bookingid}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-delete" onclick="deleteBookingPrompt('${booking.id || booking.bookingid}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = rows.join('');
}

// ============================================
// BOOKING CRUD OPERATIONS (LocalStorage only)
// ============================================

function getBookingById(bookingId) {
    // First check allBookings array
    let booking = allBookings.find(b => b.id === bookingId || b.bookingid === bookingId);

    // If not found, check localStorage
    if (!booking) {
        const localBookings = JSON.parse(localStorage.getItem('happyvilleBookings') || '[]');
        booking = localBookings.find(b => b.id === bookingId || b.bookingid === bookingId);
    }

    return booking;
}

function updateBookingStatus(bookingId, newStatus) {
    // Update in allBookings array
    const index = allBookings.findIndex(b => b.id === bookingId || b.bookingid === bookingId);

    if (index !== -1) {
        allBookings[index].status = newStatus;
        allBookings[index].updatedAt = new Date();

        // Also update localStorage
        const localBookings = JSON.parse(localStorage.getItem('happyvilleBookings') || '[]');
        const localIndex = localBookings.findIndex(b => b.id === bookingId || b.bookingid === bookingId);

        if (localIndex !== -1) {
            localBookings[localIndex].status = newStatus;
            localBookings[localIndex].updatedAt = new Date();
            localStorage.setItem('happyvilleBookings', JSON.stringify(localBookings));
        }

        showNotification(`Status updated to ${newStatus}`);
        displayBookings(allBookings);
        return true;
    }

    showError('Failed to update status - booking not found');
    return false;
}

function deleteBookingPrompt(bookingId) {
    if (confirm('Are you sure you want to delete this booking? This action cannot be undone.')) {
        // Remove from allBookings array
        const initialLength = allBookings.length;
        allBookings = allBookings.filter(b => b.id !== bookingId && b.bookingid !== bookingId);

        // Remove from localStorage
        const localBookings = JSON.parse(localStorage.getItem('happyvilleBookings') || '[]');
        const updatedLocalBookings = localBookings.filter(b => b.id !== bookingId && b.bookingid !== bookingId);

        if (updatedLocalBookings.length < localBookings.length) {
            localStorage.setItem('happyvilleBookings', JSON.stringify(updatedLocalBookings));
            showNotification('Booking deleted successfully');
            displayBookings(allBookings);
            return true;
        }

        if (allBookings.length < initialLength) {
            showNotification('Booking deleted from view');
            displayBookings(allBookings);
            return true;
        }

        showError('Failed to delete booking');
        return false;
    }
    return false;
}

// ============================================
// EDIT MODAL FUNCTIONS
// ============================================

function openEditModal(bookingId) {
    const booking = getBookingById(bookingId);

    if (!booking) {
        showError('Booking not found');
        return;
    }

    currentEditingId = bookingId;

    // Populate form
    document.getElementById('editName').value = booking.name || '';
    document.getElementById('editPhone').value = booking.phone || '';
    document.getElementById('editEmail').value = booking.email || '';
    document.getElementById('editActivity').value = booking.activity || '';
    document.getElementById('editKids').value = booking.kids || 1;
    document.getElementById('editAdults').value = booking.adults || 0;
    document.getElementById('editDate').value = booking.date || '';
    document.getElementById('editTime').value = booking.time || '';
    document.getElementById('editStatus').value = booking.status || 'pending';
    document.getElementById('editNotes').value = booking.notes || '';

    // Show modal
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    const editForm = document.getElementById('editBookingForm');
    if (editForm) editForm.reset();
    currentEditingId = null;
}

function setupEditForm() {
    const editForm = document.getElementById('editBookingForm');

    if (!editForm) {
        console.error('Edit form not found');
        return;
    }

    editForm.addEventListener('submit', function (e) {
        e.preventDefault();
        saveEditedBooking();
    });
}

function saveEditedBooking() {
    if (!currentEditingId) return;

    const saveBtn = document.querySelector('.btn-save');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="loading-spinner"></span> Saving...';
    saveBtn.disabled = true;

    try {
        const updates = {
            name: document.getElementById('editName').value,
            phone: document.getElementById('editPhone').value,
            email: document.getElementById('editEmail').value,
            activity: document.getElementById('editActivity').value,
            kids: parseInt(document.getElementById('editKids').value) || 0,
            adults: parseInt(document.getElementById('editAdults').value) || 0,
            date: document.getElementById('editDate').value,
            time: document.getElementById('editTime').value,
            status: document.getElementById('editStatus').value,
            notes: document.getElementById('editNotes').value,
            updatedAt: new Date()
        };

        // Update in allBookings array
        const index = allBookings.findIndex(b => b.id === currentEditingId || b.bookingid === currentEditingId);

        if (index !== -1) {
            allBookings[index] = { ...allBookings[index], ...updates };

            // Update localStorage
            const localBookings = JSON.parse(localStorage.getItem('happyvilleBookings') || '[]');
            const localIndex = localBookings.findIndex(b => b.id === currentEditingId || b.bookingid === currentEditingId);

            if (localIndex !== -1) {
                localBookings[localIndex] = { ...localBookings[localIndex], ...updates };
                localStorage.setItem('happyvilleBookings', JSON.stringify(localBookings));
            }

            closeEditModal();
            showNotification('Booking updated successfully');
            displayBookings(allBookings);
        } else {
            showError('Failed to update booking');
        }

    } catch (error) {
        console.error('Save booking error:', error);
        showError('Failed to save changes: ' + error.message);
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

function exportToCSV() {
    try {
        if (allBookings.length === 0) {
            showError('No bookings to export');
            return;
        }

        // CSV headers
        const headers = ['ID', 'Name', 'Phone', 'Email', 'Activity', 'Kids', 'Adults', 'Date', 'Time', 'Status', 'Total', 'Notes', 'Created At'];

        // CSV rows
        const rows = allBookings.map(booking => [
            booking.id || booking.bookingid || '',
            `"${booking.name || ''}"`,
            `"${booking.phone || ''}"`,
            `"${booking.email || ''}"`,
            `"${activityNames[booking.activity] || booking.activity || ''}"`,
            booking.kids || 0,
            booking.adults || 0,
            booking.date || '',
            booking.time || '',
            booking.status || 'pending',
            booking.total || 0,
            `"${booking.notes || ''}"`,
            booking.createdAt ? new Date(booking.createdAt).toLocaleString() : ''
        ]);

        // Combine
        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `happyville_bookings_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('CSV exported successfully');

    } catch (error) {
        console.error('Export error:', error);
        showError('Failed to export CSV: ' + error.message);
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    } catch (error) {
        return dateString;
    }
}

function formatTime(timeString) {
    if (!timeString) return 'N/A';
    try {
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    } catch (error) {
        return timeString;
    }
}

function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 5px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showError(message) {
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4757;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 5px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================
// LOGOUT FUNCTION
// ============================================

window.logout = function () {
    sessionStorage.removeItem('adminLoggedIn');
    sessionStorage.removeItem('adminEmail');
    window.location.href = 'landing.html';
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    console.log('Admin page initialized');

    // Add CSS for animations and styling
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        
        /* Loading spinners */
        .loading-spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #000080;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 0.5rem;
        }
        
        .loading-spinner-small {
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #000080;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Status badges */
        .status-pending { 
            background: #fff3cd; 
            color: #856404; 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 12px; 
            display: inline-block;
        }
        .status-confirmed { 
            background: #d4edda; 
            color: #155724; 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 12px;
            display: inline-block;
        }
        .status-cancelled { 
            background: #f8d7da; 
            color: #721c24; 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 12px;
            display: inline-block;
        }
        .status-completed { 
            background: #d1ecf1; 
            color: #0c5460; 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 12px;
            display: inline-block;
        }
        
        /* Action buttons */
        .action-buttons {
            display: flex;
            gap: 5px;
        }
        
        .btn-edit, .btn-delete, .btn-refresh {
            padding: 4px 8px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: inline-flex;
            align-items: center;
            gap: 3px;
        }
        
        .btn-edit { background: #ffa500; color: white; }
        .btn-delete { background: #ff4757; color: white; }
        .btn-refresh { background: #4CAF50; color: white; }
        
        .btn-refresh:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        /* Local booking indicator */
        .local-badge {
            color: #ff9800;
            font-size: 12px;
            cursor: help;
        }
        
        .local-booking {
            background-color: #fff8e1;
        }
        
        .local-booking:hover {
            background-color: #ffecb3;
        }
        
        /* Status select dropdown */
        .status-select {
            padding: 4px;
            border-radius: 4px;
            border: 1px solid #ddd;
            font-size: 12px;
            width: 100%;
            margin-top: 4px;
        }
        
        /* Modal styles */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            justify-content: center;
            align-items: center;
        }
        
        .modal-content {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .close-btn {
            float: right;
            font-size: 24px;
            cursor: pointer;
            color: #aaa;
        }
        
        .close-btn:hover {
            color: #000;
        }
    `;
    document.head.appendChild(style);

    // Set up login forms (if they exist on this page)
    setupLoginForm();
    setupForgotPasswordForm();

    // Check if user is logged in (for admin pages)
    const isAdmin = sessionStorage.getItem('adminLoggedIn') === 'true';

    if (!isAdmin && !window.location.pathname.includes('Login')) {
        // If we're on the admin dashboard but not logged in, redirect to home
        window.location.href = '/';
    }

    // Set up edit form
    setupEditForm();

    // Set admin name
    const adminName = sessionStorage.getItem('adminEmail') || 'Admin User';
    const adminUserSpan = document.querySelector('.admin-user span');
    if (adminUserSpan) {
        adminUserSpan.textContent = adminName;
    }

    // Set up filter event listeners
    const dateFilter = document.getElementById('dateFilter');
    const statusFilter = document.getElementById('statusFilter');
    const activityFilter = document.getElementById('activityFilter');
    const searchInput = document.getElementById('searchInput');

    if (dateFilter) {
        const today = new Date().toISOString().split('T')[0];
        dateFilter.value = today;
        dateFilter.addEventListener('change', () => filterBookings());
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', () => filterBookings());
    }

    if (activityFilter) {
        activityFilter.addEventListener('change', () => filterBookings());
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => filterBookings());
    }

    // Set up refresh button
    const refreshBtn = document.querySelector('.btn-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => refreshBookings());
    }

    // Set up export button
    const exportBtn = document.querySelector('.btn-export');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => exportToCSV());
    }

    // Initialize and load bookings
    initializeBookingsFromStorage();
});

// Close edit modal when clicking outside
window.onclick = function (event) {
    const editModal = document.getElementById('editModal');
    if (event.target === editModal) {
        closeEditModal();
    }

    // Also check for login modal if it exists
    const loginModal = document.getElementById('loginModal');
    if (event.target === loginModal) {
        window.closeLoginModal();
    }
};

// Close modal with Escape key
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        const editModal = document.getElementById('editModal');
        if (editModal && editModal.style.display === 'flex') {
            closeEditModal();
        }

        const loginModal = document.getElementById('loginModal');
        if (loginModal && loginModal.style.display === 'flex') {
            window.closeLoginModal();
        }
    }
});