// ============================================
// PAGE DETECTION FUNCTIONS
// ============================================
function isBookingPage() {
    return document.getElementById('bookingForm') !== null ||
        document.getElementById('date') !== null ||
        document.getElementById('activity') !== null;
}

function isAdminPage() {
    return document.getElementById('loginForm') !== null ||
        document.getElementById('loginModal') !== null ||
        window.location.pathname.includes('Admin') ||
        document.querySelector('.logout-btn') !== null;
}

// ============================================
// GOOGLE SHEETS CONFIG (ONE TIME ONLY)
// ============================================
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxtB7YD3gZBzwkSbQzG17v7k0OuCJ2DVgpZTw37rvazIV_JpSZxrv2Smvgs7hsaWUBd/exec';

// ============================================
// BOOKING STORAGE FUNCTIONS (GLOBAL)
// ============================================
window.saveBookingToStorage = function (bookingData) {
    try {
        const existingBookings = JSON.parse(localStorage.getItem('happyvilleBookings')) || [];
        const bookingId = 'booking_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const completeBooking = {
            id: bookingId,
            ...bookingData,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        existingBookings.unshift(completeBooking);
        localStorage.setItem('happyvilleBookings', JSON.stringify(existingBookings));

        console.log('Booking saved to localStorage:', completeBooking);
        console.log('Total bookings:', existingBookings.length);

        return bookingId;

    } catch (error) {
        console.error('Error saving booking to localStorage:', error);
        alert('Error saving booking. Please try again.');
        return null;
    }
};

window.formatTimeForDisplay = function (time) {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
};

// ============================================
// BOOKING PAGE JAVASCRIPT (Only runs on booking page)
// ============================================

    console.log('Initializing booking page JavaScript...');

    // Form validation and submission
    const form = document.getElementById('bookingForm');
    const payNowBtn = document.getElementById('payNow');

    if (form) {
        const message = document.getElementById('formMessage');
        const paymentSection = document.getElementById('paymentSection');

        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            if (!validateForm()) return;

            const bookingData = {
                name: document.getElementById('name').value.trim(),
                phone: document.getElementById('phone').value.trim(),
                email: document.getElementById('email').value.trim(),
                activity: document.getElementById('activity').value,
                activityName: document.getElementById('activity').options[document.getElementById('activity').selectedIndex].text,
                kids: parseInt(document.getElementById('kids').value) || 0,
                adults: parseInt(document.getElementById('adults').value) || 0,
                date: document.getElementById('date').value,
                time: selectedTimeSlot,
                total: parseInt(document.getElementById('grandTotal').textContent) || 0,
                notes: document.getElementById('notes').value.trim() || '',
                gripSocks: document.getElementById('gripSocks').checked,
                waiver: document.getElementById('waiver').checked
            };

            // Save to localStorage (always)
            const bookingId = window.saveBookingToStorage(bookingData);

            // Attempt Google Sheets
            try {
                const saved = await saveToGoogleSheets({ ...bookingData, bookingId });
                if (saved && saved.success) {
                    console.log('Saved to Google Sheets');
                    console.log('Google Sheets response:', result);

                } else {
                    console.warn('Saved locally only');
                }
            } catch (err) {
                console.error('Google Sheets error, booking saved locally', err);
            }

            // Show confirmation
            showBookingConfirmation(bookingData, bookingId);

            // Reset form
            resetForm();
        });

    }

    if (payNowBtn) {
        payNowBtn.addEventListener('click', function () {
            window.open('https://www.payfast.co.za/', '_blank');
            alert('Redirecting to PayFast for payment. (This is a simulation.)');
        });
    }

    const activitySelect = document.getElementById('activity');
    if (activitySelect) {
        activitySelect.addEventListener('change', function () {
            const prices = {
                'general-30': 'R50/person',
                'general-1': 'R90/person',
                'general-2': 'R140/person',
                'toddler-30': 'R50/toddler',
                'toddler-1': 'R90/toddler',
                'happy-party': 'R1,500',
                'mega-party': 'R2,900'
            };
        });
    }

// ==============================
// BOOKING MODAL GLOBAL FUNCTIONS
// ==============================
window.openBookingModal = function () {
    const modal = document.getElementById("bookingModal");
    if (modal) {
        modal.style.display = "flex";
        document.body.style.overflow = "hidden";
    }
};

window.closeBookingModal = function () {
    const modal = document.getElementById("bookingModal");
    if (modal) {
        modal.style.display = "none";
        document.body.style.overflow = "auto";
    }
};


    // ============================================
    // BOOKING PAGE VARIABLES
    // ============================================
    let selectedDate = new Date();
    let selectedTimeSlot = null;
    let selectedActivity = null;
    let activityPrices = {
        'general-30': { price: 80, duration: '30 minutes', adultPrice: 80 },
        'general-1': { price: 120, duration: '1 hour', adultPrice: 120 },
        'general-2': { price: 200, duration: '2 hours', adultPrice: 200 },
        'toddler-30': { price: 60, duration: '30 minutes', adultPrice: 0 },
        'toddler-1': { price: 90, duration: '1 hour', adultPrice: 0 },
        'happy-party': { price: 1500, duration: '1.5 hours', adultPrice: 1500 },
        'mega-party': { price: 2500, duration: '2 hours', adultPrice: 2500 }
    };

    const availableTimeSlots = {
        'weekday': ['09:00', '10:30', '13:00', '15:00', '17:00', '19:00'],
        'weekend': ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']
    };

    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();

    // ============================================
    // BOOKING FORM FUNCTIONS (Only for booking page)
    // ============================================
    
    // Save to Google Sheets
    async function saveToGoogleSheets(bookingData) {
        try {
            console.log('Sending to Google Sheets:', bookingData);
            
            const response = await fetch(GOOGLE_SHEETS_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookingData)
            });

            const result = await response.json();
            console.log('Google Sheets response:', result);

            if (result.success) {
                console.log('✅ Saved to Google Sheets:', result);
                return result;
            } else {
                console.error('❌ Google Sheets error:', result.error);
                return null;
            }

        } catch (error) {
            console.error('❌ Network error:', error);
            return null;
        }
    }

    // Save to localStorage (fallback)
    function saveToLocalStorage(bookingData) {
        try {
            const existingBookings = JSON.parse(localStorage.getItem('happyvilleBookings')) || [];
            const bookingId = bookingData.bookingId || 'LOCAL_' + Date.now();

            const completeBooking = {
                ...bookingData,
                id: bookingId,
                status: 'pending',
                createdAt: new Date().toISOString(),
                isLocal: true
            };

            existingBookings.unshift(completeBooking);
            localStorage.setItem('happyvilleBookings', JSON.stringify(existingBookings));

            console.log('📱 Saved to localStorage:', completeBooking);
            return bookingId;

        } catch (error) {
            console.error('LocalStorage error:', error);
            return null;
        }
    }

    // Show booking confirmation
    function showBookingConfirmation(data, bookingId) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <span class="close-btn" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h2 style="color: #4CAF50;">✓ Booking Confirmed!</h2>
                <div class="modal-body">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <div style="font-size: 60px; color: #4CAF50;">✓</div>
                        <h3>Thank you, ${data.name}!</h3>
                        <p style="background: #e3f2fd; padding: 10px; border-radius: 5px;">
                            <strong>Booking ID:</strong> ${bookingId}
                        </p>
                    </div>
                    
                    <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h4>Booking Details:</h4>
                        <p><strong>Activity:</strong> ${data.activityName}</p>
                        <p><strong>Date:</strong> ${new Date(data.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        <p><strong>Time:</strong> ${window.formatTimeForDisplay(data.time)}</p>
                        <p><strong>Group:</strong> ${data.kids} kids, ${data.adults} adults</p>
                        <p><strong>Total:</strong> R${data.total}</p>
                    </div>
                    
                    <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                        <p><strong>📧 Confirmation sent to:</strong> ${data.email}</p>
                        <p><strong>📱 Contact:</strong> ${data.phone}</p>
                    </div>
                    
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                            class="submit-btn" 
                            style="margin-top: 20px; width: 100%; background: #4CAF50;">
                        Close
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // Reset form
    function resetForm() {
        const form = document.getElementById('bookingForm');
        if (form) form.reset();

        selectedTimeSlot = null;
        selectedActivity = null;
        selectedDate = new Date(new Date().setDate(new Date().getDate() + 1));

        const dateInput = document.getElementById('date');
        if (dateInput) dateInput.value = selectedDate.toISOString().split('T')[0];

        const selectedTimeDisplay = document.getElementById('selectedTimeDisplay');
        if (selectedTimeDisplay) selectedTimeDisplay.style.display = 'none';

        document.querySelectorAll('.time-slot.selected').forEach(el => {
            el.classList.remove('selected');
        });

        calculateTotal();
        generateTimeSlots();
        updateMiniCalendar();
    }

    // Validate form
    function validateForm() {
        const requiredFields = [
            { id: 'name', name: 'Name' },
            { id: 'phone', name: 'Phone' },
            { id: 'email', name: 'Email' },
            { id: 'activity', name: 'Activity' },
            { id: 'date', name: 'Date' }
        ];

        let isValid = true;

        for (const field of requiredFields) {
            const element = document.getElementById(field.id);
            if (!element || !element.value.trim()) {
                alert(`Please enter your ${field.name}`);
                if (element) element.focus();
                isValid = false;
                break;
            }
        }

        if (!selectedTimeSlot) {
            alert('Please select a time slot');
            isValid = false;
        }

        const gripSocks = document.getElementById('gripSocks');
        const waiver = document.getElementById('waiver');

        if (!gripSocks || !gripSocks.checked) {
            alert('Please agree to purchase grip socks');
            if (gripSocks) gripSocks.focus();
            isValid = false;
        }

        if (!waiver || !waiver.checked) {
            alert('Please agree to the waiver terms');
            if (waiver) waiver.focus();
            isValid = false;
        }

        const kidsInput = document.getElementById('kids');
        const kids = kidsInput ? parseInt(kidsInput.value) || 0 : 0;
        if (kids < 1) {
            alert('Please enter at least 1 child');
            if (kidsInput) kidsInput.focus();
            isValid = false;
        }

        return isValid;
    }

    // Initialize form validation
    function initializeFormValidation() {
        const form = document.getElementById('bookingForm');
        const clearTimeBtn = document.getElementById('clearTime');

        if (form) {
            if (clearTimeBtn) {
                clearTimeBtn.addEventListener('click', () => {
                    selectedTimeSlot = null;
                    const timeInput = document.getElementById('time');
                    if (timeInput) timeInput.value = '';
                    document.querySelectorAll('.time-slot.selected').forEach(el => {
                        el.classList.remove('selected');
                    });
                    updateSelectedTimeDisplay();
                });
            }

            // Form submission
            form.addEventListener('submit', async function (e) {
                e.preventDefault();

                if (!validateForm()) {
                    return;
                }

                const submitBtn = form.querySelector('.submit-btn');
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<span class="loading-spinner"></span> Processing...';
                submitBtn.disabled = true;

                // Get form data
                const bookingData = {
                    name: document.getElementById('name').value.trim(),
                    phone: document.getElementById('phone').value.trim(),
                    email: document.getElementById('email').value.trim(),
                    activity: document.getElementById('activity').value,
                    activityName: document.getElementById('activity').options[document.getElementById('activity').selectedIndex].text,
                    kids: parseInt(document.getElementById('kids').value) || 0,
                    adults: parseInt(document.getElementById('adults').value) || 0,
                    date: document.getElementById('date').value,
                    time: selectedTimeSlot,
                    total: parseInt(document.getElementById('grandTotal').textContent) || 0,
                    notes: document.getElementById('notes').value.trim() || '',
                    gripSocks: document.getElementById('gripSocks').checked,
                    waiver: document.getElementById('waiver').checked,
                    bookingId: 'HV' + Date.now() + Math.floor(Math.random() * 1000)
                };

                console.log('Sending booking:', bookingData);

                try {
                    // Try to save to Google Sheets
                    const saved = await saveToGoogleSheets(bookingData);

                    if (saved && saved.success) {
                        // Success - show confirmation
                        showBookingConfirmation(bookingData, saved.bookingId || bookingData.bookingId);

                        // Also save to localStorage as backup
                        saveToLocalStorage(bookingData);

                        // Reset form after 2 seconds
                        setTimeout(() => {
                            resetForm();
                            submitBtn.innerHTML = originalText;
                            submitBtn.disabled = false;
                        }, 2000);

                    } else {
                        // Fallback to localStorage only
                        const localId = saveToLocalStorage(bookingData);
                        showBookingConfirmation(bookingData, localId);
                        alert('⚠️ Booking saved locally. Admin will contact you.');

                        submitBtn.innerHTML = originalText;
                        submitBtn.disabled = false;
                        resetForm();
                    }

                } catch (error) {
                    console.error('Submission error:', error);
                    alert('Error saving booking. Please try again or contact us.');
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            });
        }
    }

    // ============================================
    // CALENDAR & DATE FUNCTIONS
    // ============================================
    function initializeCalendar() {
        const dateInput = document.getElementById('date');

        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.min = today;
            dateInput.max = new Date(new Date().setDate(new Date().getDate() + 60)).toISOString().split('T')[0];

            const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0];
            dateInput.value = tomorrow;
            selectedDate = new Date(tomorrow);

            const todayBtn = document.getElementById('todayBtn');
            const tomorrowBtn = document.getElementById('tomorrowBtn');
            const weekendBtn = document.getElementById('weekendBtn');

            if (todayBtn) todayBtn.addEventListener('click', () => setQuickDate(0));
            if (tomorrowBtn) tomorrowBtn.addEventListener('click', () => setQuickDate(1));
            if (weekendBtn) weekendBtn.addEventListener('click', setToNextWeekend);

            dateInput.addEventListener('change', function (e) {
                selectedDate = new Date(e.target.value);
                generateTimeSlots();
                updateMiniCalendar();
                updateSelectedTimeDisplay();
            });

            const prevMonthBtn = document.getElementById('prevMonth');
            const nextMonthBtn = document.getElementById('nextMonth');

            if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => changeMonth(-1));
            if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => changeMonth(1));

            generateMiniCalendar();
            generateTimeSlots();
        }
    }

    function setQuickDate(daysToAdd) {
        const newDate = new Date();
        newDate.setDate(newDate.getDate() + daysToAdd);
        const dateStr = newDate.toISOString().split('T')[0];
        document.getElementById('date').value = dateStr;
        selectedDate = newDate;
        generateTimeSlots();
        updateMiniCalendar();
        updateSelectedTimeDisplay();
    }

    function setToNextWeekend() {
        const today = new Date();
        const dayOfWeek = today.getDay();
        let daysToAdd;

        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            daysToAdd = 6 - dayOfWeek;
        } else {
            daysToAdd = 6 - dayOfWeek + 7;
        }

        setQuickDate(daysToAdd);
    }

    function generateMiniCalendar() {
        const calendarEl = document.getElementById('miniCalendar');
        const monthYearEl = document.getElementById('currentMonth');

        if (!calendarEl || !monthYearEl) return;

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        monthYearEl.textContent = `${monthNames[currentMonth]} ${currentYear}`;

        calendarEl.innerHTML = '';

        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.className = 'day-header';
            dayEl.textContent = day;
            calendarEl.appendChild(dayEl);
        });

        const firstDay = new Date(currentYear, currentMonth, 1);
        const startingDay = firstDay.getDay();

        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        for (let i = 0; i < startingDay; i++) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'day empty';
            calendarEl.appendChild(emptyEl);
        }

        const today = new Date();
        const selectedDay = selectedDate.getDate();
        const selectedMonth = selectedDate.getMonth();
        const selectedYear = selectedDate.getFullYear();

        for (let day = 1; day <= daysInMonth; day++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'day';
            dayEl.textContent = day;

            if (day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
                dayEl.classList.add('today');
            }

            if (day === selectedDay && currentMonth === selectedMonth && currentYear === selectedYear) {
                dayEl.classList.add('selected');
            }

            const thisDate = new Date(currentYear, currentMonth, day);
            if (thisDate < new Date().setHours(0, 0, 0, 0)) {
                dayEl.classList.add('unavailable');
            } else {
                dayEl.addEventListener('click', () => selectCalendarDate(day));
            }

            calendarEl.appendChild(dayEl);
        }
    }

    function selectCalendarDate(day) {
        selectedDate = new Date(currentYear, currentMonth, day);
        const dateStr = selectedDate.toISOString().split('T')[0];
        document.getElementById('date').value = dateStr;
        generateTimeSlots();
        updateMiniCalendar();
        updateSelectedTimeDisplay();
    }

    function changeMonth(direction) {
        currentMonth += direction;

        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        } else if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }

        generateMiniCalendar();
    }

    function updateMiniCalendar() {
        const days = document.querySelectorAll('#miniCalendar .day:not(.empty)');
        const selectedDay = selectedDate.getDate();
        const selectedMonth = selectedDate.getMonth();
        const selectedYear = selectedDate.getFullYear();

        days.forEach(dayEl => {
            const day = parseInt(dayEl.textContent);
            dayEl.classList.remove('selected');

            if (day === selectedDay && currentMonth === selectedMonth && currentYear === selectedYear) {
                dayEl.classList.add('selected');
            }
        });
    }

    // ============================================
    // TIME SLOT FUNCTIONS
    // ============================================
    function generateTimeSlots() {
        const timeSlotsContainer = document.getElementById('timeSlots');
        if (!timeSlotsContainer) return;

        timeSlotsContainer.innerHTML = '';

        const dayOfWeek = selectedDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const slots = isWeekend ? availableTimeSlots.weekend : availableTimeSlots.weekday;

        const maxDays = 30;
        const daysDiff = Math.ceil((selectedDate - new Date()) / (1000 * 60 * 60 * 24));
        const isTooFarFuture = daysDiff > maxDays;

        if (isTooFarFuture) {
            timeSlotsContainer.innerHTML = `
                <div class="no-slots">
                    <p>⚠️ Bookings available only for next ${maxDays} days</p>
                    <p>Please select an earlier date</p>
                </div>
            `;
            return;
        }

        slots.forEach(time => {
            const slotEl = document.createElement('div');
            slotEl.className = 'time-slot';
            slotEl.dataset.time = time;

            const totalSpots = 20;
            const bookedSpots = Math.floor(Math.random() * 8);
            const availableSpots = totalSpots - bookedSpots;
            const isAvailable = availableSpots > 0;

            if (!isAvailable) {
                slotEl.classList.add('unavailable');
            }

            const [hours, minutes] = time.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            const displayTime = `${displayHour}:${minutes} ${ampm}`;

            slotEl.innerHTML = `
                <div class="time-display">${displayTime}</div>
                <div class="spots">${availableSpots}/${totalSpots} spots</div>
            `;

            if (isAvailable) {
                slotEl.addEventListener('click', () => selectTimeSlot(slotEl, time));
            }

            timeSlotsContainer.appendChild(slotEl);
        });
    }

    function selectTimeSlot(slotEl, time) {
        document.querySelectorAll('.time-slot').forEach(el => {
            el.classList.remove('selected');
        });

        slotEl.classList.add('selected');
        selectedTimeSlot = time;

        const timeInput = document.getElementById('time');
        if (timeInput) timeInput.value = time;

        updateSelectedTimeDisplay();
    }

    function updateSelectedTimeDisplay() {
        const display = document.getElementById('selectedTimeDisplay');
        const selectedDateSpan = document.getElementById('selectedDate');
        const selectedTimeSpan = document.getElementById('selectedTime');

        if (!display || !selectedDateSpan || !selectedTimeSpan) return;

        if (selectedDate && selectedTimeSlot) {
            const dateStr = selectedDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });

            const [hours, minutes] = selectedTimeSlot.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            const timeStr = `${displayHour}:${minutes} ${ampm}`;

            selectedDateSpan.textContent = dateStr;
            selectedTimeSpan.textContent = timeStr;
            display.style.display = 'flex';

            const dateTimeStr = `${selectedDate.toISOString().split('T')[0]}T${selectedTimeSlot}`;
            const selectedDateTimeInput = document.getElementById('selectedDateTime');
            if (selectedDateTimeInput) selectedDateTimeInput.value = dateTimeStr;
        } else {
            display.style.display = 'none';
        }
    }

    // ============================================
    // ACTIVITY & PRICE FUNCTIONS
    // ============================================
    function initializeActivitySelection() {
        const activitySelect = document.getElementById('activity');
        const priceDisplay = document.getElementById('priceDisplay');
        const activityPrice = document.getElementById('activityPrice');
        const durationText = document.getElementById('durationText');

        if (activitySelect) {
            activitySelect.addEventListener('change', function () {
                selectedActivity = this.value;
                const activity = activityPrices[selectedActivity];

                if (activity) {
                    if (priceDisplay) priceDisplay.style.display = 'block';
                    if (activityPrice) activityPrice.textContent = activity.price;
                    if (durationText) durationText.textContent = activity.duration;
                    updatePrices();
                } else {
                    if (priceDisplay) priceDisplay.style.display = 'none';
                }

                calculateTotal();
            });

            activitySelect.dispatchEvent(new Event('change'));
        }
    }

    function updatePrices() {
        const activity = activityPrices[selectedActivity];
        if (!activity) return;

        const kidPriceEl = document.getElementById('kidPrice');
        const adultPriceEl = document.getElementById('adultPrice');

        if (kidPriceEl) kidPriceEl.textContent = activity.price;
        if (adultPriceEl) adultPriceEl.textContent = activity.adultPrice || activity.price;
    }

    // ============================================
    // GROUP SIZE COUNTERS
    // ============================================
    function initializeCounters() {
        const kidsInput = document.getElementById('kids');
        const kidsCount = document.getElementById('kidsCount');
        const kidsMinus = document.querySelector('[data-target="kids"].minus');
        const kidsPlus = document.querySelector('[data-target="kids"].plus');

        if (kidsInput) {
            if (kidsMinus) kidsMinus.addEventListener('click', () => updateCounter(kidsInput, -1));
            if (kidsPlus) kidsPlus.addEventListener('click', () => updateCounter(kidsInput, 1));
            kidsInput.addEventListener('change', () => {
                if (kidsCount) kidsCount.textContent = kidsInput.value;
                calculateTotal();
            });
        }

        const adultsInput = document.getElementById('adults');
        const adultsCount = document.getElementById('adultsCount');
        const adultsMinus = document.querySelector('[data-target="adults"].minus');
        const adultsPlus = document.querySelector('[data-target="adults"].plus');

        if (adultsInput) {
            if (adultsMinus) adultsMinus.addEventListener('click', () => updateCounter(adultsInput, -1));
            if (adultsPlus) adultsPlus.addEventListener('click', () => updateCounter(adultsInput, 1));
            adultsInput.addEventListener('change', () => {
                if (adultsCount) adultsCount.textContent = adultsInput.value;
                calculateTotal();
            });
        }
    }

    function updateCounter(input, change) {
        let value = parseInt(input.value) + change;
        const min = parseInt(input.min) || 0;
        const max = parseInt(input.max) || 100;

        if (input.id === 'kids' && value < 1) value = 1;
        if (value < min) value = min;
        if (value > max) value = max;

        input.value = value;

        if (input.id === 'kids') {
            const kidsCount = document.getElementById('kidsCount');
            if (kidsCount) kidsCount.textContent = value;
        } else {
            const adultsCount = document.getElementById('adultsCount');
            if (adultsCount) adultsCount.textContent = value;
        }

        calculateTotal();
    }

    // ============================================
    // PRICE CALCULATION
    // ============================================
    function calculateTotal() {
        const kidsInput = document.getElementById('kids');
        const adultsInput = document.getElementById('adults');

        if (!kidsInput || !adultsInput) return;

        const kids = parseInt(kidsInput.value) || 0;
        const adults = parseInt(adultsInput.value) || 0;
        const totalPeople = kids + adults;

        const totalKidsEl = document.getElementById('totalKids');
        const totalAdultsEl = document.getElementById('totalAdults');
        const totalPeopleEl = document.getElementById('totalPeople');

        if (totalKidsEl) totalKidsEl.textContent = kids;
        if (totalAdultsEl) totalAdultsEl.textContent = adults;
        if (totalPeopleEl) totalPeopleEl.textContent = totalPeople;

        const activity = activityPrices[selectedActivity];
        if (!activity) {
            resetTotals();
            return;
        }

        const kidPrice = activity.price;
        const adultPrice = activity.adultPrice || activity.price;

        const kidsTotal = kids * kidPrice;
        const adultsTotal = adults * adultPrice;
        const socksTotal = totalPeople * 20;

        const kidsTotalEl = document.getElementById('kidsTotal');
        const adultsTotalEl = document.getElementById('adultsTotal');
        const socksTotalEl = document.getElementById('socksTotal');
        const grandTotalEl = document.getElementById('grandTotal');
        const totalPriceEl = document.getElementById('totalPrice');
        const submitTextEl = document.getElementById('submitText');

        if (kidsTotalEl) kidsTotalEl.textContent = kidsTotal;
        if (adultsTotalEl) adultsTotalEl.textContent = adultsTotal;
        if (socksTotalEl) socksTotalEl.textContent = socksTotal;

        const grandTotal = kidsTotal + adultsTotal + socksTotal;
        if (grandTotalEl) grandTotalEl.textContent = grandTotal;

        if (totalPriceEl) totalPriceEl.textContent = `R${grandTotal}`;
        if (submitTextEl) submitTextEl.textContent = `Book Now - R${grandTotal}`;
    }

    function resetTotals() {
        const kidsTotalEl = document.getElementById('kidsTotal');
        const adultsTotalEl = document.getElementById('adultsTotal');
        const socksTotalEl = document.getElementById('socksTotal');
        const grandTotalEl = document.getElementById('grandTotal');
        const totalPriceEl = document.getElementById('totalPrice');

        if (kidsTotalEl) kidsTotalEl.textContent = '0';
        if (adultsTotalEl) adultsTotalEl.textContent = '0';
        if (socksTotalEl) socksTotalEl.textContent = '0';
        if (grandTotalEl) grandTotalEl.textContent = '0';
        if (totalPriceEl) totalPriceEl.textContent = 'R0';
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    function showWaiverModal() {
        const modal = document.getElementById('waiverModal');
        if (modal) modal.style.display = 'flex';
    }

    function closeWaiverModal() {
        const modal = document.getElementById('waiverModal');
        if (modal) modal.style.display = 'none';
    }

    // ============================================
    // BOOKING PAGE INITIALIZATION
    // ============================================
    document.addEventListener('DOMContentLoaded', function () {
        // Add loading spinner CSS
        const style = document.createElement('style');
        style.textContent = `
            .loading-spinner {
                display: inline-block;
                width: 16px;
                height: 16px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #000080;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-right: 8px;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);

        initializeCalendar();
        initializeActivitySelection();
        initializeCounters();
        initializeFormValidation();
        calculateTotal();

        window.onclick = function (event) {
            const bookingModal = document.getElementById("bookingModal");
            if (event.target === bookingModal) {
                closeBookingModal();
            }

            const waiverModal = document.getElementById("waiverModal");
            if (event.target === waiverModal) {
                closeWaiverModal();
            }
        };

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                const bookingModal = document.getElementById("bookingModal");
                if (bookingModal && bookingModal.style.display === 'flex') {
                    closeBookingModal();
                }

                const waiverModal = document.getElementById("waiverModal");
                if (waiverModal && waiverModal.style.display === 'flex') {
                    closeWaiverModal();
                }
            }
        });
    });



    // ============================================
    // LOGIN VARIABLES AND FUNCTIONS
    //  ============================================
let loginAttempts = parseInt(localStorage.getItem('loginAttempts')) || 0;
const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds
let lockoutUntil = localStorage.getItem('lockoutUntil') || 0;

// LOGIN FUNCTIONS (Define them first so they're available)
window.openLoginModal = function () {
    // Check if account is locked out
    const now = Date.now();
    const lockoutTime = parseInt(lockoutUntil);
    if (lockoutTime > now) {
        const remainingTime = Math.ceil((lockoutTime - now) / 1000 / 60);
        alert(`Account is locked. Please try again in ${remainingTime} minutes.`);
        return;
    }

    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    // Auto-fill remembered email if exists
    const rememberedEmail = localStorage.getItem('adminRememberedEmail');
    if (rememberedEmail) {
        const loginEmail = document.getElementById('loginEmail');
        const rememberMe = document.getElementById('rememberMe');

        if (loginEmail) loginEmail.value = rememberedEmail;
        if (rememberMe) rememberMe.checked = true;
    }
};

window.closeLoginModal = function () {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    resetLoginForm();
};

window.showForgotPassword = function () {
    const loginForm = document.getElementById('loginForm');
    const forgotPasswordSection = document.getElementById('forgotPasswordSection');
    const loginMessage = document.getElementById('loginMessage');

    if (loginForm) loginForm.style.display = 'none';
    if (forgotPasswordSection) forgotPasswordSection.style.display = 'block';
    if (loginMessage) loginMessage.style.display = 'none';
};

window.hideForgotPassword = function () {
    const loginForm = document.getElementById('loginForm');
    const forgotPasswordSection = document.getElementById('forgotPasswordSection');

    if (forgotPasswordSection) forgotPasswordSection.style.display = 'none';
    if (loginForm) loginForm.style.display = 'block';
};

window.togglePasswordVisibility = function () {
    const passwordInput = document.getElementById('loginPassword');
    const showPasswordBtn = document.querySelector('.show-password');

    if (passwordInput && showPasswordBtn) {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            showPasswordBtn.textContent = '👁️‍🗨️';
        } else {
            passwordInput.type = 'password';
            showPasswordBtn.textContent = '👁️';
        }
    }
};

function resetLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const loginMessage = document.getElementById('loginMessage');
    const resetMessage = document.getElementById('resetMessage');

    if (loginForm) loginForm.reset();
    if (loginMessage) {
        loginMessage.textContent = '';
        loginMessage.className = 'form-message';
    }
    if (resetMessage) resetMessage.textContent = '';
    window.hideForgotPassword();
}

function setupLoginForm() {
    const loginForm = document.getElementById('loginForm');

    if (!loginForm) {
        console.log('No login form found on this page');
        return;
    }

    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const loginEmail = document.getElementById('loginEmail');
        const loginPassword = document.getElementById('loginPassword');
        const rememberMe = document.getElementById('rememberMe');
        const loginMessage = document.getElementById('loginMessage');

        if (!loginEmail || !loginPassword || !loginMessage) return;

        const email = loginEmail.value.trim().toLowerCase();
        const password = loginPassword.value;
        const remember = rememberMe ? rememberMe.checked : false;

        // Check lockout status
        const now = Date.now();
        const lockoutTime = parseInt(lockoutUntil);
        if (lockoutTime > now) {
            const remainingTime = Math.ceil((lockoutTime - now) / 1000 / 60);
            loginMessage.textContent = `Too many failed attempts. Try again in ${remainingTime} minutes.`;
            loginMessage.className = 'form-message error';
            return;
        }

        // Basic validation
        if (!email || !password) {
            loginMessage.textContent = 'Please enter both email and password';
            loginMessage.className = 'form-message error';
            return;
        }

        // Show loading state
        const submitBtn = document.querySelector('.login-btn');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Authenticating...';
        submitBtn.disabled = true;

        // Simulate API call to your backend
        setTimeout(() => {
            // REPLACE THIS WITH ACTUAL ADMIN AUTHENTICATION
            const validAdminEmails = [
                'admin@example.com',
                'supervisor@example.com',
                'manager@example.com'
            ];

            const isValidAdmin = validAdminEmails.includes(email);
            const isCorrectPassword = password === 'admin123'; // Change this!
            if (isValidAdmin && isCorrectPassword) {
                // Successful login
                loginMessage.textContent = '✓ Login successful! Redirecting to admin panel...';
                loginMessage.className = 'form-message success';

                // Store session
                sessionStorage.setItem('adminLoggedIn', 'true');
                sessionStorage.setItem('adminEmail', email);

                if (remember) {
                    localStorage.setItem('adminRememberedEmail', email);
                }

                // Reset login attempts on success
                loginAttempts = 0;
                localStorage.removeItem('loginAttempts');
                localStorage.removeItem('lockoutUntil');

                // Redirect to admin dashboard or update UI
                setTimeout(() => {
                    window.closeLoginModal();
                    window.location.href = 'admin.html'; // Update with your route
                }, 1500);

            } else {
                // Failed login
                loginAttempts++;
                localStorage.setItem('loginAttempts', loginAttempts.toString());

                if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
                    lockoutUntil = (now + LOCKOUT_TIME).toString();
                    localStorage.setItem('lockoutUntil', lockoutUntil);
                    loginMessage.textContent = `Too many failed attempts. Account locked for 5 minutes.`;
                } else {
                    loginMessage.textContent = `Invalid credentials. ${MAX_LOGIN_ATTEMPTS - loginAttempts} attempts remaining.`;
                }

                loginMessage.className = 'form-message error';
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        }, 1000);
    });
}

function setupForgotPasswordForm() {
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');

    if (!forgotPasswordForm) {
        console.log('No forgot password form found');
        return;
    }

    forgotPasswordForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const resetEmail = document.getElementById('resetEmail');
        const resetMessage = document.getElementById('resetMessage');

        if (!resetEmail || !resetMessage) return;

        const email = resetEmail.value.trim().toLowerCase();

        // Validate admin email format
        if (!email || !email.includes('@')) {
            resetMessage.textContent = 'Please enter a valid admin email';
            resetMessage.className = 'form-message error';
            return;
        }

        // Show loading state
        const submitBtn = this.querySelector('.submit-btn');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending request...';
        submitBtn.disabled = true;

        // Simulate API call to admin password reset endpoint
        setTimeout(() => {
            // In real implementation, this would send to your backend
            resetMessage.textContent = `Password reset request sent for ${email}. An email with instructions has been sent to all administrators.`;
            resetMessage.className = 'form-message success';

            // Reset button
            setTimeout(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                window.hideForgotPassword();
            }, 2000);
        }, 1500);
    });
}


// ============================================
// GLOBAL FUNCTIONS (Available on all pages)
// ============================================
if (typeof logout === 'undefined') {
    window.logout = function () {
        sessionStorage.removeItem('adminLoggedIn');
        sessionStorage.removeItem('adminEmail');
        window.location.href = '/';
    };
}

//if (typeof openLoginModal === 'undefined') {
//    window.openLoginModal = openLoginModal || function () {
//        console.log('openLoginModal not available on this page');
//    };
//}

//if (typeof closeLoginModal === 'undefined') {
//    window.closeLoginModal = closeLoginModal || function () {
//        console.log('closeLoginModal not available on this page');
//    };
//}

if (typeof togglePasswordVisibility === 'undefined') {
    window.togglePasswordVisibility = togglePasswordVisibility || function () {
        console.log('togglePasswordVisibility not available on this page');
    };
}