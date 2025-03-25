import { useEffect, useState } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const SYNC_INTERVAL = 1000 * 60 * 30; // 30 minutes

export function usePhotoSync(enabled: boolean) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let syncInterval: NodeJS.Timeout;

    async function syncPhotos() {
      try {
        if (Platform.OS === 'web') {
          // Web platform uses file picker instead of MediaLibrary
          return;
        }

        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          setError('Permission to access photos was denied');
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get today's photos
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { assets } = await MediaLibrary.getAssetsAsync({
          mediaType: 'photo',
          createdAfter: today.getTime(),
          first: 50, // Limit to 50 photos per sync
        });

        // Save new photos to Supabase
        for (const asset of assets) {
          const { data: existingPhoto, error: queryError } = await supabase
            .from('photo_logs')
            .select('id')
            .eq('file_uri', asset.uri)
            .single();

          if (queryError && queryError.code !== 'PGRST116') {
            throw queryError;
          }

          if (!existingPhoto) {
            let locationLabel = null;

            // Get location if available
            if (asset.location) {
              const { latitude, longitude } = asset.location;
              const [place] = await MediaLibrary.getLocationAsync(asset);
              
              if (place) {
                locationLabel = `${place.city || ''}, ${place.country || ''}`.trim() || null;
              }
            }

            const { error: insertError } = await supabase
              .from('photo_logs')
              .insert({
                user_id: user.id,
                file_uri: asset.uri,
                timestamp: new Date(asset.creationTime).toISOString(),
                location_label: locationLabel,
              });

            if (insertError) throw insertError;
          }
        }
      } catch (error) {
        console.error('Error syncing photos:', error);
        setError(error instanceof Error ? error.message : 'Failed to sync photos');
      }
    }

    if (enabled) {
      syncPhotos(); // Initial sync
      syncInterval = setInterval(syncPhotos, SYNC_INTERVAL);
    }

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [enabled]);

  return { error };
}