import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import BackButton from '../components/BackButton';

export default function ConnectCane() {
  const { caneDevice, caneStatus, connectCane, sendCaneCredentials, disconnectCane } = useAuth();
  const [wifiSSID, setWifiSSID] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');

  const handleSend = () => {
    sendCaneCredentials(wifiSSID, wifiPassword);
  };

  return (
    <div id="main-content" className="py-24 px-6 flex flex-col items-center w-full min-h-screen relative">
      <BackButton className="absolute top-4 left-4" />
      <h1 className="text-center text-4xl font-bold mb-8">Connect Your Cane</h1>
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6 text-center">
        <p className="text-lg mb-4" role="status" aria-live="polite">Status: <span className="font-semibold">{caneStatus}</span></p>

        {!caneDevice ? (
          <button
            onClick={connectCane}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
          >
            1. Find and Connect to Cane
          </button>
        ) : (
          <div className="space-y-4">
            {caneStatus !== 'Cane Ready' && (
              <>
                <div>
                  <label htmlFor="wifi-ssid" className="block text-base font-medium mb-2 text-left">Wi-Fi Name (SSID)</label>
                  <input
                    type="text"
                    id="wifi-ssid"
                    value={wifiSSID}
                    onChange={(e) => setWifiSSID(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your home Wi-Fi name"
                  />
                </div>
                <div>
                  <label htmlFor="wifi-password" className="block text-base font-medium mb-2 text-left">Wi-Fi Password</label>
                  <input
                    type="password"
                    id="wifi-password"
                    value={wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your Wi-Fi password"
                  />
                </div>
                <button
                  onClick={handleSend}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 font-medium"
                >
                  2. Send Wi-Fi Credentials to Cane
                </button>
              </>
            )}
            <button
              onClick={disconnectCane}
              className="w-full px-4 py-3 bg-red-600 text-white rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 font-medium mt-4"
            >
              Disconnect Cane
            </button>
          </div>
        )}
        <p className="text-sm text-gray-600 mt-4">
          Make sure your cane is powered on and in pairing mode.
        </p>
      </div>
    </div>
  );
}