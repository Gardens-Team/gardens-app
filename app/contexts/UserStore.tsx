import { create } from 'zustand';
import { createContext, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';

// User type definition
export interface User {
  id: string;
  username: string;
  profilePic?: string;
  visible: boolean;
  publicKey: string;
  createdAt?: Date;
  updatedAt?: Date;
  bio?: string;
  email?: string;
  phone?: string;
}

// User store state interface
interface UserState {
  user: User | null;
  setUser: (user: User | null) => void;
  updateProfile: (updates: Partial<User>) => void;
  logout: () => void;
}

// Create the user store with persistence
const useUserStoreBase = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      updateProfile: (updates) => 
        set((state) => ({ 
          user: state.user ? { ...state.user, ...updates } : null 
        })),
      logout: () => set({ user: null }),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Create React context for the store
const UserStoreContext = createContext<typeof useUserStoreBase | null>(null);

// Provider component
export const UserStoreProvider = ({ children }: { children: ReactNode }) => {
  return (
    <UserStoreContext.Provider value={useUserStoreBase}>
      {children}
    </UserStoreContext.Provider>
  );
};

// Hook for components to use the store
export const useUserStore = <T,>(selector: (state: UserState) => T): T => {
  const store = useContext(UserStoreContext);
  if (!store) throw new Error('useUserStore must be used within UserStoreProvider');
  return store(selector);
};

// Default export for the provider
export default UserStoreProvider; 