import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import * as CalendarAPI from 'expo-calendar';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Check, X } from 'lucide-react-native';

type PermissionStatus = 'pending' | 'granted' | 'denied';

export default function OnboardingScreen() {
  const [locationPermission, setLocationPermission] = useState<PermissionStatus>('pending');
  const [photoPermission, setPhotoPermission] = useState<PermissionStatus>('pending');
  const [calendarPermission, setCalendarPermission] = useState<PermissionStatus>('pending');
  const [backgroundLogging, setBackgroundLogging] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  async function checkPermissions() {
    try {
      // Check location permission
      const { status: locationStatus } = await Location.getForegroundPermissionsAsync();
      setLocationPermission(locationStatus === 'granted' ? 'granted' : 'pending');

      // Check photo permission
      const { status: photoStatus } = await MediaLibrary.getPermissionsAsync();
      setPhotoPermission(photoStatus === 'granted' ? 'granted' : 'pending');

      // Check calendar permission
      const { status: calendarStatus } = await CalendarAPI.getCalendarPermissionsAsync();
      setCalendarPermission(calendarStatus === 'granted' ? 'granted' : 'pending');
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  }

  async function requestLocationPermission() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission('granted');
        
        // Request background permission if foreground is granted
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus === 'granted') {
          setBackgroundLogging(true);
        }
      } else {
        setLocationPermission('denied');
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setLocationPermission('denied');
    }
  }

  async function requestPhotoPermission() {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setPhotoPermission(status === 'granted' ? 'granted' : 'denied');
    } catch (error) {
      console.error('Error requesting photo permission:', error);
      setPhotoPermission('denied');
    }
  }

  async function requestCalendarPermission() {
    try {
      const { status } = await CalendarAPI.requestCalendarPermissionsAsync();
      setCalendarPermission(status === 'granted' ? 'granted' : 'denied');
    } catch (error) {
      console.error('Error requesting calendar permission:', error);
      setCalendarPermission('denied');
    }
  }

  async function handleComplete() {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update user preferences in Supabase
      const { error } = await supabase
        .from('users')
        .update({
          background_logging: backgroundLogging,
          location_enabled: locationPermission === 'granted',
          photo_sync_enabled: photoPermission === 'granted',
          calendar_sync_enabled: calendarPermission === 'granted',
          has_completed_onboarding: true,
        })
        .eq('id', user.id);

      if (error) throw error;

      // Navigate to main app
      router.replace('/(app)/chat');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      Alert.alert(
        'Error',
        'Failed to save your preferences. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Memory Assistant</Text>
        <Text style={styles.subtitle}>
          Let's set up your preferences to help you remember your day.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Required Permissions</Text>
          
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestLocationPermission}
            disabled={locationPermission === 'granted'}
          >
            <View style={styles.permissionContent}>
              <Text style={styles.permissionTitle}>Location Access</Text>
              <Text style={styles.permissionDescription}>
                Track places you visit throughout the day
              </Text>
            </View>
            {locationPermission === 'granted' ? (
              <Check size={24} color="#22c55e" />
            ) : locationPermission === 'denied' ? (
              <X size={24} color="#ef4444" />
            ) : (
              <Text style={styles.permissionStatus}>Enable</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPhotoPermission}
            disabled={photoPermission === 'granted'}
          >
            <View style={styles.permissionContent}>
              <Text style={styles.permissionTitle}>Photo Access</Text>
              <Text style={styles.permissionDescription}>
                Include photos in your daily summaries
              </Text>
            </View>
            {photoPermission === 'granted' ? (
              <Check size={24} color="#22c55e" />
            ) : photoPermission === 'denied' ? (
              <X size={24} color="#ef4444" />
            ) : (
              <Text style={styles.permissionStatus}>Enable</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestCalendarPermission}
            disabled={calendarPermission === 'granted'}
          >
            <View style={styles.permissionContent}>
              <Text style={styles.permissionTitle}>Calendar Access</Text>
              <Text style={styles.permissionDescription}>
                Include your events in daily summaries
              </Text>
            </View>
            {calendarPermission === 'granted' ? (
              <Check size={24} color="#22c55e" />
            ) : calendarPermission === 'denied' ? (
              <X size={24} color="#ef4444" />
            ) : (
              <Text style={styles.permissionStatus}>Enable</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Background Logging</Text>
          <Text style={styles.sectionDescription}>
            Choose whether to track your location and sync data in the background.
          </Text>
          
          <TouchableOpacity
            style={[
              styles.optionButton,
              backgroundLogging && styles.optionButtonSelected,
            ]}
            onPress={() => setBackgroundLogging(true)}
          >
            <Text style={[
              styles.optionTitle,
              backgroundLogging && styles.optionTitleSelected,
            ]}>
              Automatic Daily Logging
            </Text>
            <Text style={[
              styles.optionDescription,
              backgroundLogging && styles.optionDescriptionSelected,
            ]}>
              Track your location and sync data every 2 hours
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionButton,
              !backgroundLogging && styles.optionButtonSelected,
            ]}
            onPress={() => setBackgroundLogging(false)}
          >
            <Text style={[
              styles.optionTitle,
              !backgroundLogging && styles.optionTitleSelected,
            ]}>
              Manual Recall Only
            </Text>
            <Text style={[
              styles.optionDescription,
              !backgroundLogging && styles.optionDescriptionSelected,
            ]}>
              Only sync data when you open the app
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.completeButton,
            loading && styles.completeButtonDisabled,
          ]}
          onPress={handleComplete}
          disabled={loading}
        >
          <Text style={styles.completeButtonText}>
            {loading ? 'Setting up...' : 'Get Started'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
    gap: 32,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    lineHeight: 24,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    lineHeight: 20,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f4f4f5',
    borderRadius: 12,
    gap: 16,
  },
  permissionContent: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#666',
  },
  permissionStatus: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
  },
  optionButton: {
    padding: 16,
    backgroundColor: '#f4f4f5',
    borderRadius: 12,
    gap: 4,
  },
  optionButtonSelected: {
    backgroundColor: '#000',
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
  },
  optionTitleSelected: {
    color: '#fff',
  },
  optionDescription: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#666',
  },
  optionDescriptionSelected: {
    color: '#fff',
  },
  completeButton: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  completeButtonDisabled: {
    opacity: 0.5,
  },
  completeButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
});