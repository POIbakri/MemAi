import { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Switch, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { LogOut, Bell, MapPin, Calendar, Camera } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const [loading, setLoading] = useState(false);
  const [backgroundLogging, setBackgroundLogging] = useState(true);

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      router.replace('/sign-in');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBackgroundLogging = async (value: boolean) => {
    try {
      setBackgroundLogging(value);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase
        .from('users')
        .update({ background_logging: value })
        .eq('id', user.id);
    } catch (error) {
      console.error('Error updating background logging:', error);
      setBackgroundLogging(!value); // Revert on error
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        
        <View style={styles.setting}>
          <View style={styles.settingIcon}>
            <Bell size={24} color="#000" />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Background Logging</Text>
            <Text style={styles.settingDescription}>
              Automatically track your day in the background
            </Text>
          </View>
          <Switch
            value={backgroundLogging}
            onValueChange={toggleBackgroundLogging}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Permissions</Text>
        
        <TouchableOpacity style={styles.setting}>
          <View style={styles.settingIcon}>
            <MapPin size={24} color="#000" />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Location Access</Text>
            <Text style={styles.settingDescription}>
              Manage location tracking permissions
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.setting}>
          <View style={styles.settingIcon}>
            <Calendar size={24} color="#000" />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Calendar Access</Text>
            <Text style={styles.settingDescription}>
              Manage calendar integration permissions
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.setting}>
          <View style={styles.settingIcon}>
            <Camera size={24} color="#000" />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Photos Access</Text>
            <Text style={styles.settingDescription}>
              Manage photo library permissions
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.signOutButton, loading && styles.signOutButtonDisabled]}
        onPress={handleSignOut}
        disabled={loading}
      >
        <LogOut size={20} color="#dc2626" />
        <Text style={styles.signOutButtonText}>
          {loading ? 'Signing out...' : 'Sign Out'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: '#000',
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f4f4f5',
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#666',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  setting: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  settingIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#f4f4f5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#666',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 24,
    marginTop: 32,
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
  },
  signOutButtonDisabled: {
    opacity: 0.5,
  },
  signOutButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#dc2626',
  },
});