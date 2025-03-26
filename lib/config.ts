import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Helper to safely get environment variables with fallbacks
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[`EXPO_PUBLIC_${key}`] || 
                Constants.expoConfig?.extra?.[key] || 
                defaultValue;
  
  if (!value) {
    // Don't crash in development, but log an error
    if (__DEV__) {
      console.error(`Missing environment variable: EXPO_PUBLIC_${key}`);
      return `MISSING_${key}`;
    }
    throw new Error(`Missing required environment variable: EXPO_PUBLIC_${key}. Please check your .env file.`);
  }
  
  // Log the value in development to help with debugging
  if (__DEV__) {
    // Mask sensitive values like keys
    if (key.includes('KEY') || key.includes('SECRET')) {
      console.log(`ENV: ${key}=${value.substring(0, 5)}...${value.substring(value.length - 5)}`);
    } else {
      console.log(`ENV: ${key}=${value}`);
    }
  }
  
  return value;
}

// Configuration object with type safety
export const config = {
  supabase: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  },
  api: {
    timeout: 30000, // 30 seconds
    retries: 3,
    baseUrl: 'https://api.deepseek.com/v1',
  },
  features: {
    backgroundSync: true,
    offlineMode: true,
    dataRetention: 7, // Days to keep data
  },
  cache: {
    messages: {
      key: 'chat_messages_cache',
      ttl: 24 * 60 * 60 * 1000, // 24 hours
    },
    locations: {
      key: 'locations_cache',
      ttl: 60 * 60 * 1000, // 1 hour
    },
    photos: {
      key: 'photos_cache',
      ttl: 60 * 60 * 1000, // 1 hour
    },
    events: {
      key: 'events_cache',
      ttl: 60 * 60 * 1000, // 1 hour
    },
  },
  DEEPSEEK_API_KEY: process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY!,
} as const;

// Validate configuration at startup
export function validateConfig() {
  // Check for mandatory config
  const missingVars = [];
  
  if (!config.supabase.url || config.supabase.url === 'MISSING_SUPABASE_URL') {
    missingVars.push('SUPABASE_URL');
  }
  
  if (!config.supabase.anonKey || config.supabase.anonKey === 'MISSING_SUPABASE_ANON_KEY') {
    missingVars.push('SUPABASE_ANON_KEY');
  }
  
  if (missingVars.length > 0) {
    console.warn(
      `⚠️ Missing environment variables: ${missingVars.join(', ')}.\n` +
      `Please check your .env file or app.config.js.\n` +
      `The app may not function correctly.`
    );
    return false;
  }
  
  return true;
}