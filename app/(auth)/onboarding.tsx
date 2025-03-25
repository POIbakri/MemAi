import { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import { Camera, Calendar as CalendarIcon, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';
import * as CalendarAPI from 'expo-calendar';
import * as MediaLibrary from 'expo-media-library';
import { supabase } from '@/lib/supabase';

type Permission = 'location' | 'calendar' | 'photos';

export default function Onboarding() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<Permission, boolean>>({
    location: false,
    calendar: false,
    photos: false,
  });

  async function requestPermission(type: Permission) {
    try {
      let granted = false;

      switch (type) {
        case 'location':
          if (Platform.OS === 'web') {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            granted = result.state === 'granted' || result.state === 'prompt';
          } else {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
              const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
              granted = backgroundStatus.status === 'granted';
            }
          }
          break;

        case 'calendar':
          if (Platform.OS === 'web') {
            granted = true; // Web uses file picker instead
          } else {
            const calendarStatus = await CalendarAPI.requestCalendarPermissionsAsync();
            granted = calendarStatus.status === 'granted';
          }
          break;

        case 'photos':
          if (Platform.OS === 'web') {
            granted = true; // Web uses file picker instead
          } else {
            const photosStatus = await MediaLibrary.requestPermissionsAsync();
            granted = photosStatus.status === 'granted';
          }
          break;
      }

      setPermissions(prev => ({
        ...prev,
        [type]: granted,
      }));
    } catch (e) {
      setError('Failed to request permissions');
    }
  }

  async function handleComplete() {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error: updateError } = await supabase
        .from('users')
        .update({
          background_logging: true,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      router.replace('/(app)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete setup');
    } finally {
      setLoading(false);
    }
  }

  const allPermissionsGranted = Object.values(permissions).every(Boolean);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Setup Required</Text>
        <Text style={styles.subtitle}>
          Grant permissions to enable memory tracking
        </Text>
      </View>

      {error && (
        <Text style={styles.error}>{error}</Text>
      )}

      <View style={styles.permissions}>
        <TouchableOpacity
          style={[styles.permission, permissions.location && styles.permissionGranted]}
          onPress={() => requestPermission('location')}
        >
          <MapPin size={24} color={permissions.location ? '#fff' : '#000'} />
          <View style={styles.permissionText}>
            <Text style={[styles.permissionTitle, permissions.location && styles.permissionTitleGranted]}>
              Location Access
            </Text>
            <Text style={[styles.permissionDescription, permissions.location && styles.permissionDescriptionGranted]}>
              Track places you visit
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.permission, permissions.calendar && styles.permissionGranted]}
          onPress={() => requestPermission('calendar')}
        >
          <CalendarIcon size={24} color={permissions.calendar ? '#fff' : '#000'} />
          <View style={styles.permissionText}>
            <Text style={[styles.permissionTitle, permissions.calendar && styles.permissionTitleGranted]}>
              Calendar Access
            </Text>
            <Text style={[styles.permissionDescription, permissions.calendar && styles.permissionDescriptionGranted]}>
              Include your events
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.permission, permissions.photos && styles.permissionGranted]}
          onPress={() => requestPermission('photos')}
        >
          <Camera size={24} color={permissions.photos ? '#fff' : '#000'} />
          <View style={styles.permissionText}>
            <Text style={[styles.permissionTitle, permissions.photos && styles.permissionTitleGranted]}>
              Photos Access
            </Text>
            <Text style={[styles.permissionDescription, permissions.photos && styles.permissionDescriptionGranted]}>
              Include photos in summaries
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, (!allPermissionsGranted || loading) && styles.buttonDisabled]}
          onPress={handleComplete}
          disabled={!allPermissionsGranted || loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Completing Setup...' : 'Complete Setup'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
  },
  header: {
    marginTop: Platform.OS === 'ios' ? 60 : 40,
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'Inter_400Regular',
  },
  permissions: {
    gap: 16,
  },
  permission: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f4f4f5',
    borderRadius: 12,
    gap: 16,
  },
  permissionGranted: {
    backgroundColor: '#000',
  },
  permissionText: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
    marginBottom: 4,
  },
  permissionTitleGranted: {
    color: '#fff',
  },
  permissionDescription: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Inter_400Regular',
  },
  permissionDescriptionGranted: {
    color: '#fff',
    opacity: 0.8,
  },
  footer: {
    marginTop: 'auto',
  },
  button: {
    height: 48,
    backgroundColor: '#000',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
  },
});