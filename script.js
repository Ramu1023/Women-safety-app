// ================= CONFIGURATION =================
const SUPABASE_URL = 'https://cubnpddinqtubsptdipi.supabase.co'; // Paste your URL
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1Ym5wZGRpbnF0dWJzcHRkaXBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4NDA2MDMsImV4cCI6MjA3MTQxNjYwM30.Gy4XS-Br-DO8nl4Wq_qHhp2A9gd38raRvTokuqdfKqo';   // Paste your Key
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ================= DOM ELEMENTS =================
const pages = document.querySelectorAll('.page');
const navButtons = document.querySelectorAll('.nav-btn');
const sosButton = document.getElementById('sos-btn');
const setupPage = document.getElementById('setup-page');
const appContainer = document.getElementById('app-container');
const setupOkButton = document.getElementById('setup-ok-btn');

// ================= PAGE NAVIGATION =================
function showPage(pageId) {
    pages.forEach(page => {
        page.style.display = 'none'; // Use style for simpler show/hide
        if (page.id === pageId) {
            page.style.display = 'block';
        }
    });
}

navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        showPage(btn.dataset.page);
    });
});

// ================= MAIN APP LOGIC =================
document.addEventListener('DOMContentLoaded', () => {
    // Check if a user ID is already stored in the browser
    const userId = localStorage.getItem('userId');
    if (userId) {
        // If yes, hide setup and show the main app
        setupPage.style.display = 'none';
        appContainer.style.display = 'block';
        showPage('home-page');
        startDataPolling(userId);
    } else {
        // If no, show the setup page
        setupPage.style.display = 'block';
        appContainer.style.display = 'none';
    }
});

// --- Initial User Setup ---
setupOkButton.addEventListener('click', async () => {
    const name = document.getElementById('setup-name').value;
    const age = document.getElementById('setup-age').value;
    const gender = document.getElementById('setup-gender').value;

    if (!name || !age) {
        alert('Please fill in your name and age.');
        return;
    }

    try {
        // STEP 1: Insert data into the 'users' table and get the new record back.
        // The '.select().single()' part is crucial to get the ID of the new user.
        const { data: newUser, error: userError } = await supabase
            .from('users')
            .insert([{ name, age, gender }])
            .select()
            .single();

        if (userError) throw userError; // If this fails, stop here.

        // STEP 2: Use the 'id' from the newly created user to create the linked 'device_status' record.
        const { error: statusError } = await supabase
            .from('device_status')
            .insert([{ id: newUser.id }]); // Link using newUser.id

        if (statusError) throw statusError;

        // STEP 3: Save the new user's ID in the browser's local storage for future sessions.
        localStorage.setItem('userId', newUser.id);

        // STEP 4: Reload the page to transition to the main app view.
        window.location.reload();

    } catch (error) {
        console.error('Supabase setup failed:', error.message);
        alert('Setup failed. Please check the console for errors. Is RLS disabled on your tables?');
    }
});


// ================= DATA POLLING AND DISPLAY =================
let dataPollInterval;
function startDataPolling(userId) {
    fetchAndDisplayData(userId); // Fetch immediately on load
    // Set an interval to automatically refresh data from Supabase every 5 seconds
    dataPollInterval = setInterval(() => fetchAndDisplayData(userId), 5000);
}

async function fetchAndDisplayData(userId) {
    // Fetch the latest status for the current user
    const { data, error } = await supabase
        .from('device_status')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error('Error fetching status:', error);
        // Stop polling if there's an error (e.g., user deleted)
        clearInterval(dataPollInterval); 
        return;
    }
    if (!data) return; // Exit if no data is found

    // --- Update Home Page UI ---
    const emergencyStatusEl = document.getElementById('emergency-status');
    emergencyStatusEl.textContent = data.emergency_on ? 'ON' : 'OFF';
    emergencyStatusEl.style.color = data.emergency_on ? '#ff4d4d' : '#333';

    document.getElementById('pin27-status').textContent = data.pin_27_on ? 'ON' : 'OFF';
    document.getElementById('pin28-status').textContent = data.pin_28_on ? 'ON' : 'OFF';
    document.getElementById('watch-battery-status').textContent = `${data.watch_battery || 'N/A'}%`;
    document.getElementById('shoe-battery-status').textContent = `${data.shoe_battery || 'N/A'}%`;
    
    // --- Update Location Page UI ---
    const latDisplay = document.getElementById('lat-display');
    const lonDisplay = document.getElementById('lon-display');
    const mapEl = document.getElementById('map');
    
    if (data.latitude && data.longitude) {
        latDisplay.textContent = data.latitude.toFixed(5);
        lonDisplay.textContent = data.longitude.toFixed(5);
        // Use Google Maps iframe for a simple display
        mapEl.innerHTML = `<iframe width="100%" height="100%" frameborder="0" style="border:0"
            src="https://maps.google.com/maps?q=${data.latitude},${data.longitude}&hl=es;z=14&amp;output=embed">
        </iframe>`;
    } else {
        latDisplay.textContent = 'N/A';
        lonDisplay.textContent = 'N/A';
        mapEl.innerHTML = '<p>No location data available.</p>';
    }
}

// Get mobile battery using the browser's built-in Battery API
try {
    navigator.getBattery().then(battery => {
        const updateBatteryStatus = () => {
            document.getElementById('mobile-battery-status').textContent = `${Math.floor(battery.level * 100)}%`;
        };
        updateBatteryStatus();
        battery.addEventListener('levelchange', updateBatteryStatus);
    });
} catch (e) {
    document.getElementById('mobile-battery-status').textContent = 'N/A';
}
