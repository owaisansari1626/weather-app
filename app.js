// --- CONFIGURATION ---
// We are using Open-Meteo API which is 100% free and requires no API key!
const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_API_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const REVERSE_GEOCODE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

// --- DOM ELEMENTS ---
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const locationBtn = document.getElementById('location-btn');
const themeToggle = document.getElementById('theme-toggle');

const mainContent = document.getElementById('main-content');
const loadingIndicator = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');

// Current Weather Elements
const cityNameEl = document.getElementById('city-name');
const currentDateEl = document.getElementById('current-date');
const weatherIconEl = document.getElementById('weather-icon');
const temperatureEl = document.getElementById('temperature');
const descriptionEl = document.getElementById('description');
const humidityEl = document.getElementById('humidity');
const windSpeedEl = document.getElementById('wind-speed');
const feelsLikeEl = document.getElementById('feels-like');

// Forecast Element
const forecastContainer = document.getElementById('forecast-container');

// --- WMO WEATHER CODE MAPPING ---
function getWeatherDetails(code) {
    const weatherMap = {
        0: { desc: 'Clear sky', icon: 'fa-sun' },
        1: { desc: 'Mainly clear', icon: 'fa-sun' },
        2: { desc: 'Partly cloudy', icon: 'fa-cloud-sun' },
        3: { desc: 'Overcast', icon: 'fa-cloud' },
        45: { desc: 'Fog', icon: 'fa-smog' },
        48: { desc: 'Depositing rime fog', icon: 'fa-smog' },
        51: { desc: 'Light drizzle', icon: 'fa-cloud-rain' },
        53: { desc: 'Moderate drizzle', icon: 'fa-cloud-rain' },
        55: { desc: 'Dense drizzle', icon: 'fa-cloud-showers-heavy' },
        56: { desc: 'Light freezing drizzle', icon: 'fa-snowflake' },
        57: { desc: 'Dense freezing drizzle', icon: 'fa-snowflake' },
        61: { desc: 'Slight rain', icon: 'fa-cloud-rain' },
        63: { desc: 'Moderate rain', icon: 'fa-cloud-rain' },
        65: { desc: 'Heavy rain', icon: 'fa-cloud-showers-heavy' },
        66: { desc: 'Light freezing rain', icon: 'fa-cloud-showers-heavy' },
        67: { desc: 'Heavy freezing rain', icon: 'fa-cloud-showers-heavy' },
        71: { desc: 'Slight snow', icon: 'fa-snowflake' },
        73: { desc: 'Moderate snow', icon: 'fa-snowflake' },
        75: { desc: 'Heavy snow', icon: 'fa-snowflake' },
        77: { desc: 'Snow grains', icon: 'fa-snowflake' },
        80: { desc: 'Slight rain showers', icon: 'fa-cloud-showers-heavy' },
        81: { desc: 'Moderate rain showers', icon: 'fa-cloud-showers-heavy' },
        82: { desc: 'Violent rain showers', icon: 'fa-cloud-showers-heavy' },
        85: { desc: 'Slight snow showers', icon: 'fa-snowflake' },
        86: { desc: 'Heavy snow showers', icon: 'fa-snowflake' },
        95: { desc: 'Thunderstorm', icon: 'fa-bolt' },
        96: { desc: 'Thunderstorm with hail', icon: 'fa-bolt' },
        99: { desc: 'Heavy Thunderstorm with hail', icon: 'fa-bolt' }
    };
    return weatherMap[code] || { desc: 'Unknown', icon: 'fa-cloud' };
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    // Try to get user location automatically
    getUserLocation();
});

// --- THEME MANAGEMENT ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    } else if (systemPrefersDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        updateThemeIcon('dark');
    }
}

themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
});

function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('i');
    if (theme === 'dark') {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

// --- LOCATION & API FETCHING ---
locationBtn.addEventListener('click', getUserLocation);

searchBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (city) {
        fetchWeatherByCity(city);
    }
});

cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const city = cityInput.value.trim();
        if (city) {
            fetchWeatherByCity(city);
        }
    }
});

function getUserLocation() {
    showLoading(true);
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                // Get City name via reverse geocoding
                let locationName = "Current Location";
                try {
                    const res = await fetch(`${REVERSE_GEOCODE_URL}?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
                    const data = await res.json();
                    locationName = data.city || data.locality || data.principalSubdivision || "Current Location";
                } catch(e) {} // Fallback to "Current Location" if it fails
                
                fetchWeatherByCoords(lat, lon, locationName);
            },
            (error) => {
                showError("Unable to retrieve your location. Please search for a city.");
                showLoading(false);
            }
        );
    } else {
        showError("Geolocation is not supported by your browser.");
        showLoading(false);
    }
}

async function fetchWeatherByCity(city) {
    try {
        showLoading(true);
        hideError();
        mainContent.classList.add('hidden');

        // Geocode the city string
        const geoRes = await fetch(`${GEOCODE_API_URL}?name=${city}&count=1&language=en&format=json`);
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
            throw new Error("City not found");
        }

        const location = geoData.results[0];
        const locationName = `${location.name}, ${location.country}`;
        
        await fetchWeatherByCoords(location.latitude, location.longitude, locationName);
        
    } catch (error) {
        showError(error.message === "City not found" ? "City not found. Please try again." : "Failed to load location data.");
        showLoading(false);
    }
}

async function fetchWeatherByCoords(lat, lon, locationName) {
    try {
        // Fetch weather data from Open-Meteo
        const weatherRes = await fetch(`${WEATHER_API_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`);
        
        if (!weatherRes.ok) throw new Error("Weather data not found");
        const weatherData = await weatherRes.json();

        updateUI(weatherData, locationName);
    } catch (error) {
        showError("Failed to load weather data.");
    } finally {
        showLoading(false);
    }
}

// --- UI UPDATING ---
function updateUI(weatherData, locationName) {
    // Extract Current Data
    const current = weatherData.current;
    const currentDetails = getWeatherDetails(current.weather_code);

    cityNameEl.textContent = locationName;
    
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateEl.textContent = new Date().toLocaleDateString('en-US', dateOptions);

    // Update Icon class
    weatherIconEl.className = `fa-solid ${currentDetails.icon} large-icon`;
    
    temperatureEl.textContent = `${Math.round(current.temperature_2m)}°C`;
    descriptionEl.textContent = currentDetails.desc;
    
    humidityEl.textContent = `${current.relative_humidity_2m}%`;
    
    // Wind is returned in km/h by default from Open-Meteo. Convert to m/s for display.
    const windMs = (current.wind_speed_10m / 3.6).toFixed(1);
    windSpeedEl.textContent = `${windMs} m/s`;
    
    feelsLikeEl.textContent = `${Math.round(current.apparent_temperature)}°C`;

    // Render Forecast View
    renderForecast(weatherData.daily);

    mainContent.classList.remove('hidden');
}

function renderForecast(daily) {
    forecastContainer.innerHTML = '';

    // The API provides up to 7 days, let's limit to 5 days
    const limit = Math.min(daily.time.length, 5);

    for (let i = 0; i < limit; i++) {
        const dateString = daily.time[i];
        const date = new Date(dateString);
        
        // Use timezone offsetting to get correct local name
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
        const shortDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        
        const details = getWeatherDetails(daily.weather_code[i]);
        const maxTemp = Math.round(daily.temperature_2m_max[i]);
        const minTemp = Math.round(daily.temperature_2m_min[i]);

        const cardPath = `
            <div class="forecast-item glass-panel-inner">
                <span class="forecast-time">${dayName}</span>
                <span class="forecast-date">${shortDate}</span>
                <i class="fa-solid ${details.icon}" style="font-size: 2rem; margin: 8px 0; color: var(--primary-color);"></i>
                <span class="forecast-temp">${maxTemp}°<span style="font-size: 0.8rem; color: var(--text-secondary);">/${minTemp}°</span></span>
            </div>
        `;
        forecastContainer.insertAdjacentHTML('beforeend', cardPath);
    }
}

function showLoading(show) {
    if (show) {
        loadingIndicator.classList.remove('hidden');
        mainContent.classList.add('hidden');
    } else {
        loadingIndicator.classList.add('hidden');
    }
}

function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}
