import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useDataCollection } from '@/hooks/useDataCollection';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { usePhotoSync } from '@/hooks/usePhotoSync';
import { useCalendarSync } from '@/hooks/useCalendarSync';

export default function SettingsScreen() {
  const [loading, setLoading] = useState(false);
  const [backgroundLogging, setBackgroundLogging] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [photoSyncEnabled, setPhotoSyncEnabled] = useState(false);
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);
  const router = useRouter();
  const { enabled: dataCollectionEnabled, error: dataCollectionError } = useDataCollection();
  const { error: locationError } = useLocationTracking(locationEnabled);
  const { error: photoSyncError } = usePhotoSync(photoSyncEnabled);
  const { error: calendarSyncError } = useCalendarSync(calendarSyncEnabled);

  useEffect(() => {
    loadUserSettings();
  }, []);

  const loadUserSettings = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('users')
        .select('background_logging, location_enabled, photo_sync_enabled, calendar_sync_enabled')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // User data doesn't exist yet, create it
          const { error: insertError } = await supabase
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
          
          setBackgroundLogging(false);
          setLocationEnabled(false);
          setPhotoSyncEnabled(false);
          setCalendarSyncEnabled(false);
        } else {
          throw error;
        }
      } else {
        setBackgroundLogging(data.background_logging);
        setLocationEnabled(data.location_enabled);
        setPhotoSyncEnabled(data.photo_sync_enabled);
        setCalendarSyncEnabled(data.calendar_sync_enabled);
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (setting: string, value: boolean) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('users')
        .update({ [setting]: value })
        .eq('id', user.id);

      if (error) throw error;

      switch (setting) {
        case 'background_logging':
          setBackgroundLogging(value);
          break;
        case 'location_enabled':
          setLocationEnabled(value);
          break;
        case 'photo_sync_enabled':
          setPhotoSyncEnabled(value);
          break;
        case 'calendar_sync_enabled':
          setCalendarSyncEnabled(value);
          break;
      }
    } catch (error) {
      console.error('Error updating setting:', error);
      Alert.alert('Error', 'Failed to update setting');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      router.replace('/(auth)/sign-in');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Collection</Text>
        <View style={styles.setting}>
          <Text style={styles.settingLabel}>Background Logging</Text>
          <Switch
            value={backgroundLogging}
            onValueChange={(value) => updateSetting('background_logging', value)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Permissions</Text>
        <View style={styles.setting}>
          <Text style={styles.settingLabel}>Location Tracking</Text>
          <Switch
            value={locationEnabled}
            onValueChange={(value) => updateSetting('location_enabled', value)}
          />
        </View>
        <View style={styles.setting}>
          <Text style={styles.settingLabel}>Photo Sync</Text>
          <Switch
            value={photoSyncEnabled}
            onValueChange={(value) => updateSetting('photo_sync_enabled', value)}
          />
        </View>
        <View style={styles.setting}>
          <Text style={styles.settingLabel}>Calendar Sync</Text>
          <Switch
            value={calendarSyncEnabled}
            onValueChange={(value) => updateSetting('calendar_sync_enabled', value)}
          />
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  setting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 16,
  },
  signOutButton: {
    margin: 16,
    padding: 16,
    backgroundColor: '#ff3b30',
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});