import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SplashScreen } from 'expo-router';
import { AuthProvider, useAuth } from '@/lib/auth';
import { View, ActivityIndicator, Text } from 'react-native';
import { supabase } from '@/lib/supabase';

function RootLayoutNav() {
  const { session, loading: authLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Only initialize framework after fonts are loaded
  const { ready: frameworkReady, error: frameworkError } = useFrameworkReady();
  const loading = authLoading || !fontsLoaded || !frameworkReady;

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[1] === 'onboarding';

    if (!session && !inAuthGroup) {
      // Redirect to sign-in if not authenticated
      router.replace('/(auth)/sign-in');
    } else if (session) {
      // Check if user has completed onboarding
      const checkOnboarding = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: userData } = await supabase
            .from('users')
            .select('has_completed_onboarding')
            .eq('id', user.id)
            .single();

          if (!userData?.has_completed_onboarding && !inOnboarding) {
            // Redirect to onboarding if not completed
            router.replace('/(auth)/onboarding');
          } else if (userData?.has_completed_onboarding && inOnboarding) {
            // Redirect to chat if onboarding is completed
            router.replace('/(app)/chat');
          } else if (inAuthGroup && !inOnboarding) {
            // Redirect to chat if in auth group but not onboarding
            router.replace('/(app)/chat');
          }
        } catch (error) {
          console.error('Error checking onboarding status:', error);
        }
      };

      checkOnboarding();
    }
  }, [session, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (frameworkError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Text style={{ color: 'red', marginBottom: 10 }}>Error initializing app</Text>
        <Text style={{ color: 'gray' }}>{frameworkError}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}