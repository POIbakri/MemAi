export default {
  name: 'Memory Assistant',
  slug: 'memory-assistant',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'memoryassistant',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/images/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.memoryassistant.app',
    buildNumber: '1',
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'We need your location to track places you visit',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'We need background location access to track places you visit throughout the day',
      NSCalendarsUsageDescription: 'We need access to your calendar to include events in your daily summaries',
      NSPhotoLibraryUsageDescription: 'We need access to your photos to include them in your daily summaries',
      UIBackgroundModes: ['location', 'fetch'],
    },
  },
  android: {
    package: 'com.memoryassistant.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'READ_CALENDAR',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'CAMERA',
      'NOTIFICATIONS',
      'WAKE_LOCK',
    ],
  },
  plugins: [
    'expo-router',
    'expo-location',
    'expo-calendar',
    'expo-media-library',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow Memory Assistant to use your location to track places you visit.',
      },
    ],
  ],
  extra: {
    SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: 'your-project-id', // Replace with your EAS project ID
    },
  },
  experiments: {
    typedRoutes: true,
  },
  updates: {
    fallbackToCacheTimeout: 0,
    url: 'https://u.expo.dev/your-project-id', // Replace with your project's update URL
  },
  runtimeVersion: {
    policy: 'sdkVersion',
  },
};