import React, { useEffect, useState } from 'react';
import { getFirestore, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getApps, initializeApp } from 'firebase/app';
import { Server } from 'lucide-react';
import { firebaseConfig } from './App';

const appId = 'notification-receiver';

export default function Home() {
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setWeatherError('Geolocation not supported');
      setWeatherLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&temperature_unit=fahrenheit&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
        const res = await fetch(url);
        const data = await res.json();
        let temp = data.current_weather?.temperature;
        let high = data.daily?.temperature_2m_max?.[0];
        let low = data.daily?.temperature_2m_min?.[0];
        setWeather({
          temp,
          high,
          low,
          code: data.current_weather?.weathercode
        });
      } catch (e) {
        setWeatherError('Failed to fetch weather');
      } finally {
        setWeatherLoading(false);
      }
    }, (err) => {
      setWeatherError('Location permission denied');
      setWeatherLoading(false);
    });
  }, []);

  // Weather code to description mapping (Open-Meteo)
  const weatherDescriptions = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Freezing drizzle',
    61: 'Slight rain',
    63: 'Rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Freezing rain',
    71: 'Slight snow fall',
    73: 'Snow fall',
    75: 'Heavy snow fall',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };

  // Weather code to emoji mapping
  const weatherIcons = {
    0: '☀️',
    1: '🌤️',
    2: '⛅',
    3: '☁️',
    45: '🌫️',
    48: '🌫️',
    51: '🌦️',
    53: '🌦️',
    55: '🌦️',
    56: '🌧️',
    57: '🌧️',
    61: '🌦️',
    63: '🌧️',
    65: '🌧️',
    66: '🌧️',
    67: '🌧️',
    71: '🌨️',
    73: '🌨️',
    75: '❄️',
    77: '❄️',
    80: '🌦️',
    81: '🌧️',
    82: '⛈️',
    85: '🌨️',
    86: '❄️',
    95: '⛈️',
    96: '⛈️',
    99: '⛈️',
  };

  let weatherMsg = 'Loading weather...';
  if (weatherError) weatherMsg = weatherError;
  else if (weather) {
    const desc = weatherDescriptions[weather.code] || 'Unknown';
    const icon = weatherIcons[weather.code] || '';
    const temp = typeof weather.temp === 'number' ? Math.round(weather.temp) : '--';
    const high = typeof weather.high === 'number' ? Math.round(weather.high) : '--';
    const low = typeof weather.low === 'number' ? Math.round(weather.low) : '--';
    weatherMsg = `${icon} Currently ${temp}°F, high ${high}°F, low ${low}°F. ${desc}.`;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-gray-100 relative">
      <div className="w-full flex flex-col items-center mb-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold mb-2">Welcome Home</h1>
          <p className="text-lg text-gray-400">{weatherMsg}</p>
        </header>
      </div>
      <NewestNotificationsWidget />
    </div>
  );
}

function NewestNotificationsWidget() {
  const [notifications, setNotifications] = useState([]);
  const [userId, setUserId] = useState(null);
  const [db, setDb] = useState(null);

  useEffect(() => {
    if (!getApps().length) {
      initializeApp(firebaseConfig);
    }
    const dbInstance = getFirestore();
    setDb(dbInstance);
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        await signInAnonymously(auth);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!db || !userId) return;
    const collectionPath = `/artifacts/${appId}/users/${userId}/notifications`;
    const q = query(collection(db, collectionPath), orderBy('timestamp', 'desc'), limit(2));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const notifs = [];
      querySnapshot.forEach((doc) => {
        notifs.push({ id: doc.id, ...doc.data() });
      });
      setNotifications(notifs);
    });
    return () => unsubscribe();
  }, [db, userId]);

  if (!userId) return null;

  return (
    <div className="w-full flex justify-start items-end min-h-[200px]">
      <div className="bg-gray-800/90 border border-gray-700 rounded-xl shadow-2xl p-4 w-[25rem] mb-8 ml-12 backdrop-blur-md">
        <h3 className="text-lg font-semibold text-cyan-300 mb-2 flex items-center gap-2">
          <Server size={18} /> Latest Notifications
        </h3>
        {notifications.length === 0 ? (
          <div className="text-gray-400 text-sm">No notifications yet.</div>
        ) : (
          <ul className="space-y-4">
            {notifications.map(n => (
              <li key={n.id} className="bg-gray-900/70 rounded p-3 text-sm flex flex-col items-start">
                {/* File Name at the top */}
                {n.fileName && (
                  <div className="font-bold text-cyan-200 text-base mb-2 w-full truncate" title={n.fileName}>{n.fileName}</div>
                )}
                {/* Image if present */}
                {n.imageUrl && n.imageUrl !== 'No image found' && (
                  <img src={n.imageUrl} alt="Notification visual" className="rounded mb-2 w-full object-cover max-h-40 border border-gray-700" />
                )}
                {/* Notes below image */}
                {n.notes && (
                  <div className="text-gray-100 bg-gray-800/80 rounded p-2 w-full mb-1">
                    <span className="font-semibold text-gray-400">Notes:</span> {n.notes}
                  </div>
                )}
                {/* Timestamp at the bottom right */}
                <div className="text-xs text-gray-500 mt-2 self-end">
                  {n.timestamp?.toDate ? n.timestamp.toDate().toLocaleString() : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
} 