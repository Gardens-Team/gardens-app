// src/hooks/useGardens.ts
import { useState, useEffect } from 'react';
import * as GardenService from '../services/GardenService';
import { Garden } from '../models/Garden';
import { useUserStore } from '../../app/contexts/UserStore';

export function useGardens() {
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useUserStore(state => state.user);

  useEffect(() => {
    if (!user) return;

    const loadGardens = async () => {
      try {
        setLoading(true);
        const userGardens = await GardenService.getUserGardens(user.id);
        setGardens(userGardens);
        setError(null);
      } catch (err) {
        console.error('Error loading gardens:', err);
        setError('Failed to load gardens');
      } finally {
        setLoading(false);
      }
    };

    loadGardens();
  }, [user]);

  return { gardens, loading, error };
}