import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Helper to safely get environment variables
function getEnvVar(key: string): string {
  const value = process.env[`EXPO_PUBLIC_${key}`];
  if (!value) {
    throw new Error(`Missing required environment variable: EXPO_PUBLIC_${key}`);
  }
  return value;
}

// Configuration object with type safety
export const config = {
  supabase: {
    url: getEnvVar('SUPABASE_URL'),
    anonKey: getEnvVar('SUPABASE_ANON_KEY'),
  },
  api: {
    timeout: 30000, // 30 seconds
    retries: 3,
  },
} as const;