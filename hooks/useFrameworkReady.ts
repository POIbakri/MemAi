import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { validateConfig } from '@/lib/config';
import { Platform } from 'react-native';

declare global {
  interface Window {
    frameworkReady?: () => void;
  }
}

export function useFrameworkReady() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize Supabase on app startup
    const initializeServices = async () => {
      try {
        console.log('Validating app configuration...');
        const configValid = validateConfig();
        if (!configValid) {
          throw new Error('App configuration is invalid. Some features may not work.');
        }
        
        console.log('Initializing Supabase client...');
        // Pre-initialize the Supabase client to check for connectivity
        await getSupabaseClient();
        console.log('Supabase client initialized successfully');
        setReady(true);
      } catch (error) {
        console.error('Error initializing services:', error);
        setError(error instanceof Error ? error.message : 'Failed to initialize services');
      }
    };

    initializeServices();

    // For web compatibility
    if (Platform.OS === 'web') {
      window.frameworkReady?.();
    }
  }, []);

  return { ready, error };
}
