import { useEffect, useState, useRef } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { supabase, getSupabaseClient } from '@/lib/supabase';
import * as TaskManager from 'expo-task-manager';
import NetInfo from '@react-native-community/netinfo';

const LOCATION_INTERVAL = 1000 * 60 * 60 * 2; // 2 hours
const LOCATION_TASK_NAME = 'background-location-task';

// Register background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }
  
  if (!data) return;
  
  // @ts-ignore: data is not typed correctly in TaskManager
  const { locations } = data;
  const location = locations[0];
  
  // Check network connectivity
  const networkState = await NetInfo.fetch();
  if (!networkState.isConnected) {
    // Store locally for later sync when online
    console.log('No network connection, skipping location sync');
    return;
  }
  
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
    
    // Get client for complex operations
    const client = await getSupabaseClient();
    
    // Save location to Supabase
    await client.from('locations').insert({
      user_id: user.id,
      timestamp: new Date().toISOString(),
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      location_label: placeName,
      place_name: placeName,
    });
  } catch (error) {
    console.error('Error in background location task:', error);
  }
});

export function useLocationTracking(enabled: boolean) {
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  
  // Handle unmounting
  useEffect(() => {
    return () => {
      isMounted.current = false;
      
      // Clean up location subscription
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      
      // If app is uninstalled or module is unmounted completely,
      // we should clean up the background task
      if (!enabled) {
        Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME)
          .catch(err => console.log('Failed to stop background location updates:', err));
      }
    };
  }, []);

  useEffect(() => {
    async function startLocationTracking() {
      try {
        if (Platform.OS === 'web') {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          if (result.state === 'denied') {
            if (isMounted.current) setError('Permission to access location was denied');
            return;
          }
        } else {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            if (isMounted.current) setError('Permission to access location was denied');
            return;
          }

          const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
          if (backgroundStatus.status !== 'granted') {
            console.warn('Background location access not granted');
          } else {
            // Start background location updates if permission granted
            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: LOCATION_INTERVAL,
              distanceInterval: 100, // meters
              showsBackgroundLocationIndicator: true,
              foregroundService: {
                notificationTitle: 'Memory Assistant',
                notificationBody: 'Tracking your location in the background',
              },
            });
          }
        }

        // Start foreground location updates
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: LOCATION_INTERVAL / 2, // More frequent in foreground
            distanceInterval: 50, // meters
          },
          async (location) => {
            if (!isMounted.current) return;
            
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
                
              // Get client for direct operations
              const client = await getSupabaseClient();  

              // Save location to Supabase
              await client.from('locations').insert({
                user_id: user.id,
                timestamp: new Date().toISOString(),
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                location_label: placeName,
                place_name: placeName,
              });
            } catch (error) {
              console.error('Error saving location:', error);
              if (isMounted.current) setError('Failed to save location data');
            }
          }
        );
        
        // Save subscription for cleanup
        locationSubscription.current = subscription;
      } catch (error) {
        console.error('Location tracking error:', error);
        if (isMounted.current) {
          setError(error instanceof Error ? error.message : 'Failed to start location tracking');
        }
      }
    }

    async function stopLocationTracking() {
      try {
        // Clean up subscription
        if (locationSubscription.current) {
          locationSubscription.current.remove();
          locationSubscription.current = null;
        }
        
        // Stop background location updates
        if (Platform.OS !== 'web') {
          const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
          if (isRegistered) {
            await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
          }
        }
        
        // Clear any errors when disabling
        if (isMounted.current) setError(null);
      } catch (error) {
        console.error('Error stopping location tracking:', error);
      }
    }

    if (enabled) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }

  }, [enabled]);

  return { error };
}