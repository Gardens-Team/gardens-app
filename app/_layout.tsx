import { Stack } from 'expo-router';
import { UserStoreProvider, useUserStore } from './contexts/UserStore';
import { AuthProvider } from './contexts/AuthContext';
import { PresenceProvider } from '../src/contexts/PresenceContext';
import { PresenceInitializer } from '../src/components/PresenceInitializer';

// Main layout component with providers
export default function RootLayout() {
  return (
    <UserStoreProvider>
      <AuthProvider>
        <PresenceProvider>
          <RootLayoutContent />
        </PresenceProvider>
      </AuthProvider>
    </UserStoreProvider>
  );
}

// Inner component to access user store after providers are initialized
function RootLayoutContent() {
  // Access the user to get ID for PresenceInitializer
  const user = useUserStore(state => state.user);
  
  return user ? (
    <PresenceInitializer userId={user.id}>
      <Stack screenOptions={{ headerShown: false }} />
    </PresenceInitializer>
  ) : (
    <Stack screenOptions={{ headerShown: false }} />
  );
}