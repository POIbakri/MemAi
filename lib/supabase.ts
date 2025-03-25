import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { config } from './config';
import NetInfo from '@react-native-community/netinfo';

// Storage implementation for web
const webStorage = {
  getItem: (key: string) => {
    try {
      return Promise.resolve(localStorage.getItem(key));
    } catch (e) {
      return Promise.reject(e);
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  },
};

// Use appropriate storage based on platform
const storageAdapter = Platform.OS === 'web' ? webStorage : SecureStore;

// Create Supabase client with enhanced error handling
async function createSupabaseClient() {
  try {
    // Check network connectivity first
    if (Platform.OS !== 'web') {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        throw new Error('No internet connection available');
      }
    }

    // Test connection to Supabase
    const response = await fetch(config.supabase.url, {
      method: 'HEAD',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.supabase.anonKey,
      },
    });

    if (!response.ok) {
      throw new Error('Unable to connect to the server');
    }

    return createClient<Database>(config.supabase.url, config.supabase.anonKey, {
      auth: {
        storage: storageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
      global: {
        headers: {
          'X-Client-Info': `memory-assistant@${Platform.OS}`,
        },
      },
    });
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    throw new Error('Unable to connect to the server. Please check your internet connection.');
  }
}

// Initialize the Supabase client
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

export async function getSupabase() {
  if (!supabaseInstance) {
    supabaseInstance = await createSupabaseClient();
  }
  return supabaseInstance;
}

// Export a synchronous version for compatibility
export const supabase = createClient<Database>(config.supabase.url, config.supabase.anonKey, {
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});