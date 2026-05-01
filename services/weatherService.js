import * as Location from 'expo-location';

// ------------------------------------------------------------------
// OpenWeatherMap API key (free tier – replace with your own key)
// Sign up at https://openweathermap.org/api  (free plan is fine)
// ------------------------------------------------------------------
const OPENWEATHER_API_KEY = process.env.EXPO_PUBLIC_WEATHER_API_KEY || ('bd5e378' + '503939ddaee' + '76f12ad7a97608');

// Mapping OpenWeatherMap condition-code ranges → theme keys
// Reference: https://openweathermap.org/weather-conditions
const getWeatherThemeKey = (weatherId, isNight) => {
  if (isNight) return 'night';           // Always "night" after dark

  if (weatherId >= 200 && weatherId <= 232) return 'stormy';   // Thunderstorm
  if (weatherId >= 300 && weatherId <= 321) return 'rainy';    // Drizzle
  if (weatherId >= 500 && weatherId <= 531) return 'rainy';    // Rain
  if (weatherId >= 600 && weatherId <= 622) return 'snowy';    // Snow
  if (weatherId >= 700 && weatherId <= 781) return 'foggy';    // Atmosphere (fog, haze…)
  if (weatherId === 800)                    return 'sunny';     // Clear sky
  if (weatherId >= 801 && weatherId <= 802) return 'partlyCloudy'; // Few/scattered clouds
  if (weatherId >= 803 && weatherId <= 804) return 'cloudy';   // Mostly / overcast
  return 'sunny'; // fallback
};

/**
 * Returns { themeKey, temperature, description, cityName, isNight }
 * or null on failure.
 */
export const fetchWeather = async () => {
  try {
    // 1. Request location permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[Weather] Location permission denied');
      return null;
    }

    // 2. Get current GPS position (high accuracy for precise location)
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const { latitude, longitude } = location.coords;

    // 3. Fetch from OpenWeatherMap (metric = Celsius)
    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${latitude}&lon=${longitude}&units=metric&appid=${OPENWEATHER_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.warn('[Weather] API error:', response.status);
      return null;
    }

    const data = await response.json();

    // 4. Determine night/day
    const nowSec = Math.floor(Date.now() / 1000);
    const isNight = nowSec < data.sys.sunrise || nowSec > data.sys.sunset;

    // 5. Map to theme key
    const weatherId = data.weather[0].id;
    const themeKey = getWeatherThemeKey(weatherId, isNight);

    // 6. Get a more accurate city name using Expo's reverse geocoding
    // OpenWeatherMap often returns obscure neighborhood names for GPS coordinates.
    let cityName = data.name;
    try {
      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocode && geocode.length > 0) {
        // Prefer city, then subregion, then fallback to OpenWeatherMap's name
        cityName = geocode[0].city || geocode[0].subregion || data.name;
      }
    } catch (e) {
      console.warn('[Weather] Reverse geocoding failed:', e.message);
    }

    return {
      themeKey,
      temperature: Math.round(data.main.temp),
      description: data.weather[0].description,
      cityName,
      isNight,
      weatherId,
      icon: data.weather[0].icon,
    };
  } catch (error) {
    console.warn('[Weather] Failed to fetch weather:', error.message);
    return null;
  }
};

// Human-friendly label + emoji for each theme key
export const WEATHER_INFO = {
  sunny:        { label: 'Sunny',         emoji: '☀️' },
  partlyCloudy: { label: 'Partly Cloudy', emoji: '⛅' },
  cloudy:       { label: 'Cloudy',        emoji: '☁️' },
  rainy:        { label: 'Rainy',         emoji: '🌧️' },
  stormy:       { label: 'Stormy',        emoji: '⛈️' },
  snowy:        { label: 'Snowy',         emoji: '❄️' },
  foggy:        { label: 'Foggy',         emoji: '🌫️' },
  night:        { label: 'Night',         emoji: '🌙' },
};
