
import BackButton from "../components/BackButton";

export default function Settings() {
  return (
    <div id="main-content" className="py-24 px-6 flex flex-col items-center w-full min-h-screen relative">
      <BackButton className="absolute top-4 left-4" />
      <h1 className="text-center text-4xl font-bold mb-8">Settings</h1>
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
        <form aria-labelledby="settings-form">
          <fieldset className="space-y-6">
            <legend id="settings-form" className="text-lg font-semibold mb-4">App Preferences</legend>
            
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="sound" className="text-base font-medium">Sound Effects</label>
              <input
                type="checkbox"
                id="sound"
                name="sound"
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
                className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                aria-describedby="vibration-desc"
              />
            </div>
            <p id="vibration-desc" className="text-sm text-gray-600">Use device vibration for feedback.</p>

            <div className="mt-6 ">
              <label htmlFor="volume" className="block text-base font-medium mb-2">Volume Level</label>
              <input
                type="range"
                id="volume"
                name="volume"
                min="0"
                max="100"
                defaultValue="50"
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
                defaultValue="en"
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
