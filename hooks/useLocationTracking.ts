import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const LOCATION_INTERVAL = 1000 * 60 * 60 * 2; // 2 hours

export function useLocationTracking(enabled: boolean) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    async function startLocationTracking() {
      try {
        if (Platform.OS === 'web') {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          if (result.state === 'denied') {
            setError('Permission to access location was denied');
            return;
          }
        } else {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            setError('Permission to access location was denied');
            return;
          }

          const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
          if (backgroundStatus.status !== 'granted') {
            console.warn('Background location access not granted');
          }
        }

        // Start location updates
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: LOCATION_INTERVAL,
            distanceInterval: 100, // meters
          },
          async (location) => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              // Get place name using reverse geocoding
              const [place] = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });

              const placeName = place
                ? `${place.name}${place.street ? `, ${place.street}` : ''}`
                : 'Unknown location';

              // Save location to Supabase
              await supabase.from('locations').insert({
                user_id: user.id,
                timestamp: new Date().toISOString(),
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                place_name: placeName,
              });
            } catch (error) {
              console.error('Error saving location:', error);
            }
          }
        );
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to start location tracking');
      }
    }

    if (enabled) {
      startLocationTracking();
    }

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [enabled]);

  return { error };
}