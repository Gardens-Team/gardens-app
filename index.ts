// Import necessary polyfills and initialization
// Error handling for native modules
import { LogBox, Text } from 'react-native';

// Ignore specific expected errors
LogBox.ignoreLogs([
  'Bridgeless mode is enabled',
  'Cannot read property',
  'NativeEventEmitter',
  'EventEmitter.removeListener',
  'new NativeEventEmitter()', 
  'Module RCTDeviceEventEmitter',
  'Require cycle'
]);

// Default error handler to prevent crashes
const originalErrorHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  // Handle JSI-related errors specifically
  if (error && error.message && (
    error.message.includes('initializeJSI') || 
    error.message.includes('NativeModule') ||
    error.message.includes('null is not an object')
  )) {
    console.warn('Suppressed error related to native modules:', error);
    return;
  }
  
  // Call the original handler for other errors
  originalErrorHandler(error, isFatal);
});

import { registerRootComponent } from 'expo';
import 'expo-router/entry';

// No need to import App separately as expo-router/entry handles the routing
// The app directory is where the app entry point is now located
