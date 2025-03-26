import { useState, useEffect, useRef } from 'react';
import { supabase, getSupabaseClient } from '@/lib/supabase';
import { useLocationTracking } from './useLocationTracking';
import { usePhotoSync } from './usePhotoSync';
import { useCalendarSync } from './useCalendarSync';

export function useDataCollection() {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const locationTracking = useLocationTracking(enabled);
  const photoSync = usePhotoSync(enabled);
  const calendarSync = useCalendarSync(enabled);

  useEffect(() => {
    // Set up cleanup function
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    async function checkBackgroundLogging() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !isMounted.current) return;

        // Get direct client for complex queries
        const client = await getSupabaseClient();
        
        const { data: userData, error: userError } = await client
          .from('users')
          .select('background_logging, location_enabled, photo_sync_enabled, calendar_sync_enabled')
          .eq('id', user.id)
          .single();
          
        if (userError) {
          if (userError.code === 'PGRST116') {
            // User data doesn't exist yet, create it
            const { error: insertError } = await client
              .from('users')
              .insert({
                id: user.id,
                email: user.email,
                background_logging: false,
                location_enabled: false,
                photo_sync_enabled: false,
                calendar_sync_enabled: false,
                notification_preferences: {},
              });
            
            if (insertError) throw insertError;
            
            if (isMounted.current) {
              setEnabled(false);
            }
          } else {
            throw userError;
          }
        } else {
          // Only update state if component is still mounted
          if (isMounted.current) {
            setEnabled(userData?.background_logging ?? false);
          }
        }
      } catch (error) {
        console.error('Error checking background logging:', error);
        if (isMounted.current) {
          setError(error instanceof Error ? error.message : 'Failed to check background logging status');
        }
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

    if (errors.length > 0 && isMounted.current) {
      setError(errors.join(', '));
    } else if (isMounted.current) {
      setError(null);
    }
  }, [locationTracking.error, photoSync.error, calendarSync.error, error]);

  return { enabled, error };
}