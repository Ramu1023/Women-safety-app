// --- CONFIGURATION ---
const SUPABASE_URL = 'https://cubnpddinqtubsptdipi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1Ym5wZGRpbnF0dWJzcHRkaXBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4NDA2MDMsImV4cCI6MjA3MTQxNjYwM30.Gy4XS-Br-DO8nl4Wq_qHhp2A9gd38raRvTokuqdfKqo';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- DOM ELEMENTS ---
const pages = document.querySelectorAll('.page');
const navButtons = document.querySelectorAll('.nav-btn');
const sosButton = document.getElementById('sos-btn');

// --- PAGE NAVIGATION ---
function showPage(pageId) {
    pages.forEach(page => {
        page.classList.remove('active');
        if (page.id === pageId) {
            page.classList.add('active');
        }
    });
}
navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        showPage(btn.dataset.page);
    });
});

// --- MAIN APP LOGIC ---
document.addEventListener('DOMContentLoaded', async () => {
    const userId = localStorage.getItem('userId');
    if (userId) {
        document.getElementById('setup-page').classList.remove('active');
        document.getElementById('app-container').classList.remove('hidden');
        showPage('home-page');
        startDataPolling(userId);
    } else {
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('setup-page').classList.add('active');
    }
});

// --- Initial Setup ---
document.getElementById('setup-ok-btn').addEventListener('click', async () => {
    const name = document.getElementById('setup-name').value;
    const age = document.getElementById('setup-age').value;
    const gender = document.getElementById('setup-gender').value;

    if (!name || !age) {
        alert('Please fill in all fields.');
        return;
    }

    // 1. Create User
    const { data: userData, error: userError } = await supabaseClient
        .from('users')
        .insert([{ name, age, gender }])
        .select()
        .single();

    if (userError) {
        console.error('Error creating user:', userError);
        alert("User creation failed. Check Supabase setup.");
        return;
    }

    // 2. Create initial device_status row
    const { error: statusError } = await supabaseClient
        .from('device_status')
        .insert([{ id: userData.id }]);

    if(statusError) {
        console.error('Error creating device status:', statusError);
        return;
    }

    // Save and redirect
    localStorage.setItem('userId', userData.id);
    document.getElementById('setup-page').classList.remove('active');
    document.getElementById('app-container').classList.remove('hidden');
    showPage('home-page');
    startDataPolling(userData.id);
});

// --- DATA POLLING AND DISPLAY ---
let dataPollInterval;
function startDataPolling(userId) {
    fetchAndDisplayData(userId);
    dataPollInterval = setInterval(() => fetchAndDisplayData(userId), 5000);
}

async function fetchAndDisplayData(userId) {
    const { data, error } = await supabaseClient
        .from('device_status')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error fetching status:', error);
        return;
    }

    // Update Home Page
    const emergencyStatusEl = document.getElementById('emergency-status');
    emergencyStatusEl.textContent = data.emergency_on ? 'ON' : 'OFF';
    emergencyStatusEl.className = data.emergency_on ? 'on' : '';
    document.getElementById('pin27-status').textContent = data.pin_27_on ? 'ON' : 'OFF';
    document.getElementById('pin28-status').textContent = data.pin_28_on ? 'ON' : 'OFF';
    document.getElementById('watch-battery-status').textContent = ${data.watch_battery || '--'}%;
    document.getElementById('shoe-battery-status').textContent = ${data.shoe_battery || '--'}%;

    // Update Location Page
    if (data.latitude && data.longitude) {
        const mapEl = document.getElementById('map');
        mapEl.innerHTML = `<iframe width="100%" height="100%" frameborder="0" style="border:0"
            src="https://www.google.com/maps/embed/v1/place?key=YOUR_GOOGLE_MAPS_API_KEY&q=${data.latitude},${data.longitude}" allowfullscreen>
        </iframe>`;
        document.getElementById('lat-display').textContent = data.latitude;
        document.getElementById('lon-display').textContent = data.longitude;
    }
}

// --- Mobile Battery (Browser API) ---
navigator.getBattery().then(battery => {
    const updateBatteryStatus = () => {
        document.getElementById('mobile-battery-status').textContent =
            ${Math.floor(battery.level * 100)}%;
    };
    updateBatteryStatus();
    battery.addEventListener('levelchange', updateBatteryStatus);
});

// --- SOS BUTTON ---
sosButton.addEventListener('click', async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    const { data, error } = await supabaseClient
        .from('device_status')
        .select('emergency_on')
        .eq('id', userId)
        .single();
    if(error) return;

    const newStatus = !data.emergency_on;

    const { error: updateError } = await supabaseClient
        .from('device_status')
        .update({ emergency_on: newStatus, pin_27_on: newStatus, pin_28_on: newStatus })
        .eq('id', userId);

    if (updateError) {
        console.error('Error toggling SOS:', updateError);
    } else {
        alert(Emergency mode turned ${newStatus ? 'ON' : 'OFF'});
        fetchAndDisplayData(userId);
    }
});

// --- SETTINGS PAGE LOGIC ---

// Save Profile
document.getElementById('save-profile-btn').addEventListener('click', async () => {
    const userId = localStorage.getItem('userId');
    const name = document.getElementById('setting-name').value;
    const age = document.getElementById('setting-age').value;

    const { error } = await supabaseClient
        .from('users')
        .update({ name, age })
        .eq('id', userId);

    if (error) {
        console.error("Profile update failed:", error);
    } else {
        alert("Profile updated!");
    }
});

// Add Contact
document.getElementById('add-contact-btn').addEventListener('click', async () => {
    const userId = localStorage.getItem('userId');
    const contactName = document.getElementById('contact-name').value;
    const phoneNumber = document.getElementById('contact-phone').value;

    const { error } = await supabaseClient
        .from('contacts')
        .insert([{ user_id: userId, contact_name: contactName, phone_number: phoneNumber }]);

    if (error) {
        console.error("Error adding contact:", error);
    } else {
        alert("Contact added!");
        document.getElementById('contact-name').value = "";
        document.getElementById('contact-phone').value = "";
    }
});

// Save Menstrual Cycle
document.getElementById('save-period-btn').addEventListener('click', async () => {
    const userId = localStorage.getItem('userId');
    const startDate = document.getElementById('period-date').value;
    const notes = document.getElementById('period-notes').value;

    const { error } = await supabaseClient
        .from('menstrual_cycle')
        .insert([{ user_id: userId, start_date: startDate, notes }]);

    if (error) {
        console.error("Error saving period:", error);
    } else {
        alert("Cycle saved!");
    }
});
