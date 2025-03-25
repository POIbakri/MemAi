import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationTracking } from './useLocationTracking';
import { usePhotoSync } from './usePhotoSync';
import { useCalendarSync } from './useCalendarSync';

export function useDataCollection() {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationTracking = useLocationTracking(enabled);
  const photoSync = usePhotoSync(enabled);
  const calendarSync = useCalendarSync(enabled);

  useEffect(() => {
    async function checkBackgroundLogging() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
          .from('users')
          .select('background_logging')
          .eq('id', user.id)
          .single();

        setEnabled(userData?.background_logging ?? false);
      } catch (error) {
        console.error('Error checking background logging:', error);
        setError(error instanceof Error ? error.message : 'Failed to check background logging status');
      }
    }

    checkBackgroundLogging();
  }, []);

  // Combine errors from all services
  useEffect(() => {
    const errors = [
      locationTracking.error,
      photoSync.error,
      calendarSync.error,
      error,
    ].filter(Boolean);

    if (errors.length > 0) {
      setError(errors.join(', '));
    } else {
      setError(null);
    }
  }, [locationTracking.error, photoSync.error, calendarSync.error, error]);

  return { enabled, error };
}