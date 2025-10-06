import { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider, db, rtdb } from '../firebase';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { ref, onValue, set } from "firebase/database";
import { doc, getDoc } from 'firebase/firestore';
import { createUser, updateUser } from '../database';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [rawFirebaseUser, setRawFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cane State
  const [caneDevice, setCaneDevice] = useState(null);
  const [caneStatus, setCaneStatus] = useState("Disconnected");
  const [isTtsEnabled, setIsTtsEnabled] = useState(false);
  const [bleCharacteristics, setBleCharacteristics] = useState(null);
  const [lastCaneMessage, setLastCaneMessage] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const isGoogleUser = firebaseUser?.providerData.some(
        (provider) => provider.providerId === 'google.com'
      );

      if (firebaseUser && (firebaseUser.emailVerified || isGoogleUser)) {
        const userRef = doc(db, "users", firebaseUser.uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
          setUser({ id: firebaseUser.uid, ...docSnap.data() });
        } else {
          const newUser = {
            name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            email: firebaseUser.email,
            bio: '',
            photoURL: firebaseUser.photoURL,
          };
          await createUser(firebaseUser.uid, newUser);
          setUser({ id: firebaseUser.uid, ...newUser });
        }
      } else {
        setUser(null);
      }
      setRawFirebaseUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (email, password) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateProfile = async (updatedData) => {
    if (!user) return;
    await updateUser(user.id, updatedData);
    const updatedUser = { ...user, profile: { ...user.profile, ...updatedData } };
    setUser(updatedUser);
  };

  // --- Cane Functions ---

  const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
  const WIFI_SSID_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
  const WIFI_PASS_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';
  const USER_UID_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26ab';
  const CANE_STATUS_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26ad';

  const handleStatusNotification = (event) => {
    const value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const status = decoder.decode(value);
    setCaneStatus(status);
  };

  const connectCane = async () => {
    try {
      const bleDevice = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID]
      });

      setCaneDevice(bleDevice);
      setCaneStatus(`Found device: ${bleDevice.name}. Connecting...`);

      const server = await bleDevice.gatt.connect();
      setCaneStatus('Connected. Fetching service...');

      const service = await server.getPrimaryService(SERVICE_UUID);
      setCaneStatus('Service fetched. Getting characteristics...');

      const [
        wifiSsid,
        wifiPass,
        userUid,
        caneStatus
      ] = await Promise.all([
        service.getCharacteristic(WIFI_SSID_CHAR_UUID),
        service.getCharacteristic(WIFI_PASS_CHAR_UUID),
        service.getCharacteristic(USER_UID_CHAR_UUID),
        service.getCharacteristic(CANE_STATUS_CHAR_UUID)
      ]);

      setBleCharacteristics({
        wifiSsid,
        wifiPass,
        userUid,
        caneStatus
      });

      await caneStatus.startNotifications();
      caneStatus.addEventListener('characteristicvaluechanged', handleStatusNotification);

      setCaneStatus('Ready to send credentials.');

    } catch (error) {
      console.error('Web Bluetooth API Error:', error);
      setCaneStatus(`Error: ${error.message}`);
    }
  };

  const disconnectCane = () => {
    if (caneDevice) {
      caneDevice.gatt.disconnect();
      setCaneDevice(null);
      setBleCharacteristics(null);
      setCaneStatus("Disconnected");
    }
  };

  const sendCaneCredentials = async (wifiSSID, wifiPassword) => {
    if (!caneDevice || !bleCharacteristics) {
      setCaneStatus('Error: No device or characteristics found.');
      return;
    }
    if (!wifiSSID || !wifiPassword) {
      setCaneStatus('Error: Please enter your Wi-Fi SSID and password.');
      return;
    }
    if (!rawFirebaseUser) {
        setCaneStatus('Error: User not logged in.');
        return;
    }

    setCaneStatus('Sending credentials to cane...');

    try {
      const encoder = new TextEncoder();

      await bleCharacteristics.wifiSsid.writeValue(encoder.encode(wifiSSID));
      await bleCharacteristics.userUid.writeValue(encoder.encode(rawFirebaseUser.uid));
      await bleCharacteristics.wifiPass.writeValue(encoder.encode(wifiPassword));

      setCaneStatus('Credentials sent. Waiting for status from cane...');

    } catch (error) {
      console.error('Error sending credentials:', error);
      setCaneStatus(`Error: ${error.message}`);
    }
  };

  const enableTts = () => {
    if (user) {
      const confirmation = new SpeechSynthesisUtterance("Verbal warnings enabled.");
      speechSynthesis.speak(confirmation);
      setIsTtsEnabled(true);

      const statusRef = ref(rtdb, `/canes/${user.id}/status`);
      const messageMap = {
        0: "Atas ",
        1: "Depan Atas ",
        2: "Depan ",
        3: "Depan Bawah ",
        4: "Bawah ",
        5: "Turunan Dalam ",
        6: "Turunan "
      };

      onValue(statusRef, (snapshot) => {
        const status_codes = snapshot.val();
        let message = "";

        if (status_codes && Array.isArray(status_codes)) {
          for (let i = 0; i < status_codes.length && i < 3; i++) {
            const code = status_codes[i];
            if (messageMap[code]) {
              message += messageMap[code];
            }
          }
        } else {
          console.log("Received null status, clearing message.");
        }
        
        setLastCaneMessage(message);
        console.log("Received status codes from Firebase:", status_codes);
        console.log("Translated message:", message);

        // Always cancel previous speech to avoid queueing and overlaps
        speechSynthesis.cancel();

        if (message.trim() !== '') {
          const utterance = new SpeechSynthesisUtterance(message);
          speechSynthesis.speak(utterance);
        }
      });

      // --- Web App RTDB Connectivity Test ---
      const testPath = `/canes/${user.id}/webapp_status`;
      set(ref(rtdb, testPath), "Web app connected at " + new Date().toLocaleString())
        .then(() => {
          console.log("Web app RTDB test write SUCCESS to:", testPath);
        })
        .catch((error) => {
          console.error("Web app RTDB test write FAILED to:", testPath, error);
        });
      // --- End Web App RTDB Connectivity Test ---
    }
  };

  const value = {
    rawFirebaseUser,
    user,
    login,
    loginWithGoogle,
    logout,
    register,
    updateProfile,
    isAuthenticated: !!rawFirebaseUser,
    loading,

    // Cane State and Functions
    caneDevice,
    caneStatus,
    isTtsEnabled,
    connectCane,
    disconnectCane,
    sendCaneCredentials,
    enableTts,
    lastCaneMessage,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};