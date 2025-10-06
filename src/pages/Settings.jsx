
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import BackButton from "../components/BackButton";
import { rtdb } from '../firebase';
import { ref, set } from 'firebase/database';

export default function Settings() {
  const { user, updateProfile } = useAuth();
  const [settings, setSettings] = useState({
    sound: true,
    vibration: true,
    volume: 50,
    language: 'en',
  });
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    // Check for settings nested inside the user object, or fall back to root level for backward compatibility
    const userSettings = user?.settings || {
      sound: user?.sound,
      vibration: user?.vibration,
      volume: user?.volume,
      language: user?.language,
    };

    if (user) {
      setSettings({
        sound: userSettings.sound ?? true,
        vibration: userSettings.vibration ?? true,
        volume: userSettings.volume ?? 50,
        language: userSettings.language ?? 'en',
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    // Convert volume to a number
    const val = name === 'volume' ? Number(value) : value;
    setSettings((prevSettings) => ({
      ...prevSettings,
      [name]: type === 'checkbox' ? checked : val,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage('');
    try {
      // 1. Save all settings to Firestore for persistence via the AuthContext
      await updateProfile({ settings });

      // 2. Save hardware-specific settings to Realtime Database for the cane
      if (user) {
        const caneSettingsRef = ref(rtdb, `canes/${user.id}/settings`);
        await set(caneSettingsRef, {
          enableSound: settings.sound,
          enableVibration: settings.vibration,
        });
      }

      setStatusMessage('Settings saved successfully!');
    } catch (error) {
      setStatusMessage('Failed to save settings.');
      console.error('Failed to save settings:', error);
    }
  };

  return (
    <div id="main-content" className="py-24 px-6 flex flex-col items-center w-full min-h-screen relative">
      <BackButton className="absolute top-4 left-4" />
      <h1 className="text-center text-4xl font-bold mb-8">Settings</h1>
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
        <form aria-labelledby="settings-form" onSubmit={handleSubmit}>
          <fieldset className="space-y-6">
            <legend id="settings-form" className="text-lg font-semibold mb-4">App Preferences</legend>
            
            {statusMessage && (
              <div className={`text-center p-2 rounded ${statusMessage.includes('Failed') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`} role="status">
                {statusMessage}
              </div>
            )}

            <div className="flex items-center justify-between mb-2">
              <label htmlFor="sound" className="text-base font-medium">Sound Effects</label>
              <input
                type="checkbox"
                id="sound"
                name="sound"
                checked={settings.sound}
                onChange={handleChange}
                className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                aria-describedby="sound-desc"
              />
            </div>
            <p id="sound-desc" className="text-sm text-gray-600">Play audio cues for warning.</p>

            <div className="flex items-center justify-between mb-2">
              <label htmlFor="vibration" className="text-base font-medium">Vibration</label>
              <input
                type="checkbox"
                id="vibration"
                name="vibration"
                checked={settings.vibration}
                onChange={handleChange}
                className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                aria-describedby="vibration-desc"
              />
            </div>
            <p id="vibration-desc" className="text-sm text-gray-600">Use device vibration for feedback.</p>

            <div className="mt-6 ">
              <label htmlFor="volume" className="block text-base font-medium mb-2">Volume Level: {settings.volume}</label>
              <input
                type="range"
                id="volume"
                name="volume"
                min="0"
                max="100"
                value={settings.volume}
                onChange={handleChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-describedby="volume-desc"
              />
              <p id="volume-desc" className="text-sm text-gray-600 mt-1">Adjust the audio volume from 0 to 100.</p>
            </div>

            <div className="mt-6">
              <label htmlFor="language" className="block text-base font-medium mb-2">Language</label>
              <select
                id="language"
                name="language"
                value={settings.language}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-describedby="language-desc"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="zh">中文</option>
              </select>
              <p id="language-desc" className="text-sm text-gray-600 mt-1">Select your preferred language for the app interface.</p>
            </div>

            <button
              type="submit"
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
              aria-describedby="save-desc"
            >
              Save Settings
            </button>
            <p id="save-desc" className="text-sm text-gray-600 text-center">Click to apply your changes.</p>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
