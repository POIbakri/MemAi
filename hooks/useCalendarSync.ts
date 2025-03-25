import { useEffect, useState } from 'react';
import * as CalendarAPI from 'expo-calendar';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const SYNC_INTERVAL = 1000 * 60 * 30; // 30 minutes

export function useCalendarSync(enabled: boolean) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let syncInterval: NodeJS.Timeout;

    async function syncCalendar() {
      try {
        if (Platform.OS === 'web') {
          // Web platform doesn't support calendar integration
          return;
        }

        const { status } = await CalendarAPI.requestCalendarPermissionsAsync();
        if (status !== 'granted') {
          setError('Permission to access calendar was denied');
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get calendars
        const calendars = await CalendarAPI.getCalendarsAsync(CalendarAPI.EntityTypes.EVENT);
        const defaultCalendars = calendars.filter(cal => cal.allowsModifications);

        // Get today's events
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        for (const cal of defaultCalendars) {
          const events = await CalendarAPI.getEventsAsync(
            [cal.id],
            startDate,
            endDate
          );

          // Save events to Supabase
          for (const event of events) {
            const { data: existingEvent, error: queryError } = await supabase
              .from('calendar_events')
              .select('id')
              .eq('title', event.title)
              .eq('start_time', event.startDate)
              .eq('end_time', event.endDate)
              .single();

            if (queryError && queryError.code !== 'PGRST116') {
              throw queryError;
            }

            if (!existingEvent) {
              const { error: insertError } = await supabase
                .from('calendar_events')
                .insert({
                  user_id: user.id,
                  title: event.title,
                  start_time: event.startDate,
                  end_time: event.endDate,
                  notes: event.notes || null,
                });

              if (insertError) throw insertError;
            }
          }
        }
      } catch (error) {
        console.error('Error syncing calendar:', error);
        setError(error instanceof Error ? error.message : 'Failed to sync calendar');
      }
    }

    if (enabled) {
      syncCalendar(); // Initial sync
      syncInterval = setInterval(syncCalendar, SYNC_INTERVAL);
    }

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [enabled]);

  return { error };
}