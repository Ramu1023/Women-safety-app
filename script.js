// --- CONFIGURATION ---
const SUPABASE_URL = 'https://cubnpddinqtubsptdipi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1Ym5wZGRpbnF0dWJzcHRkaXBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4NDA2MDMsImV4cCI6MjA3MTQxNjYwM30.Gy4XS-Br-DO8nl4Wq_qHhp2A9gd38raRvTokuqdfKqo';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
    // Check if user is set up
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

// Initial Setup
document.getElementById('setup-ok-btn').addEventListener('click', async () => {
    const name = document.getElementById('setup-name').value;
    const age = document.getElementById('setup-age').value;
    const gender = document.getElementById('setup-gender').value;

    if (!name || !age) {
        alert('Please fill in all fields.');
        return;
    }

    // 1. Create User
    const { data: userData, error: userError } = await supabase
        .from('users')
        .insert([{ name, age, gender }])
        .select()
        .single();

    if (userError) {
        console.error('Error creating user:', userError);
        return;
    }
    
    // 2. Create initial device_status row
    const { error: statusError } = await supabase
        .from('device_status')
        .insert([{ id: userData.id }]);

    if(statusError) {
        console.error('Error creating device status:', statusError);
        return;
    }
    
    localStorage.setItem('userId', userData.id);
    window.location.reload(); // Reload to start the app
});

// --- DATA POLLING AND DISPLAY ---
let dataPollInterval;
function startDataPolling(userId) {
    fetchAndDisplayData(userId); // Fetch immediately
    dataPollInterval = setInterval(() => fetchAndDisplayData(userId), 5000); // Poll every 5 seconds
}

async function fetchAndDisplayData(userId) {
    const { data, error } = await supabase
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
    document.getElementById('watch-battery-status').textContent = `${data.watch_battery || '--'}%`;
    document.getElementById('shoe-battery-status').textContent = `${data.shoe_battery || '--'}%`;
    
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

// Mobile Battery (using browser API)
navigator.getBattery().then(battery => {
    const updateBatteryStatus = () => {
        document.getElementById('mobile-battery-status').textContent = `${Math.floor(battery.level * 100)}%`;
    };
    updateBatteryStatus();
    battery.addEventListener('levelchange', updateBatteryStatus);
});


// --- ACTIONS ---
sosButton.addEventListener('click', async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    // Get current state to toggle it
    const { data, error } = await supabase.from('device_status').select('emergency_on').eq('id', userId).single();
    if(error) return;

    const newStatus = !data.emergency_on;

    const { error: updateError } = await supabase
        .from('device_status')
        .update({ emergency_on: newStatus, pin_27_on: newStatus, pin_28_on: newStatus })
        .eq('id', userId);
    
    if (updateError) {
        console.error('Error toggling SOS:', updateError);
    } else {
        alert(`Emergency mode turned ${newStatus ? 'ON' : 'OFF'}`);
        fetchAndDisplayData(userId); // Update UI immediately
    }
});

// Placeholder for settings logic (add contact, save profile, etc.)
// You would add event listeners and Supabase functions for the settings page here.

