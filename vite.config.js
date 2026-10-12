import { defineConfig, loadEnv } from 'vite';
import fs from 'fs';
import path from 'path';

function getLocalProperties() {
  const props = {};
  try {
    const localPropsPath = path.resolve(__dirname, 'local.properties');
    if (fs.existsSync(localPropsPath)) {
      const content = fs.readFileSync(localPropsPath, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...vals] = trimmed.split('=');
          props[key.trim()] = vals.join('=').trim();
        }
      }
    }
  } catch (e) {}
  return props;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const localProps = getLocalProperties();

  const getVal = (key) => 
    localProps[key] || 
    env[`VITE_${key}`] || 
    env[key] || 
    process.env[`VITE_${key}`] || 
    process.env[key] || 
    '';

  const firebaseConfig = {
    apiKey: getVal('FIREBASE_API_KEY'),
    authDomain: getVal('FIREBASE_AUTH_DOMAIN'),
    projectId: getVal('FIREBASE_PROJECT_ID'),
    storageBucket: getVal('FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getVal('FIREBASE_MESSAGING_SENDER_ID'),
    appId: getVal('FIREBASE_APP_ID'),
    measurementId: getVal('FIREBASE_MEASUREMENT_ID')
  };

  const mapsApiKey = getVal('MAPS_API_KEY');

  return {
    define: {
      __MAPS_API_KEY__: JSON.stringify(mapsApiKey),
      __FIREBASE_CONFIG__: JSON.stringify(firebaseConfig)
    },
    server: {
      port: 5173,
      open: true
    }
  };
});
