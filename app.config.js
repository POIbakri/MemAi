export default {
  name: 'MemAi',
  slug: 'memai',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  assetBundlePatterns: [
    '**/*'
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.memai.app',
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'MemAi needs your location to help you remember where you were throughout your day.',
      NSLocationAlwaysAndWhenInUseUsageDescription: 'MemAi needs your location to help you remember where you were throughout your day, even when the app is in the background.',
      NSLocationAlwaysUsageDescription: 'MemAi needs your location to help you remember where you were throughout your day, even when the app is in the background.',
      NSPhotoLibraryUsageDescription: 'MemAi needs access to your photos to help you remember moments from your day.',
      NSCalendarsUsageDescription: 'MemAi needs access to your calendar to help you remember your events and schedule.',
      NSCalendarsFullAccessUsageDescription: 'MemAi needs full access to your calendar to help you remember your events and schedule.',
      NSLocationTemporaryUsageDescriptionDictionary: {
        "BackgroundLocation": "MemAi needs your location to help you remember where you were throughout your day, even when the app is in the background."
      },
      NSCameraUsageDescription: "We need access to your camera to take photos for analysis.",
      NSPhotoLibraryAddUsageDescription: "We need access to save photos to your library.",
      NSMicrophoneUsageDescription: "We need access to your microphone for video recording.",
      NSLocationUsageDescription: "We need your location to provide context about where your photos were taken.",
    }
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff'
    },
    package: 'com.memai.app',
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'READ_CALENDAR',
      'WRITE_CALENDAR',
      'CAMERA',
    ]
  },
  plugins: [
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission: 'Allow MemAi to use your location to help you remember where you were throughout your day.',
        locationAlwaysPermission: 'Allow MemAi to use your location to help you remember where you were throughout your day.',
        locationWhenInUsePermission: 'Allow MemAi to use your location to help you remember where you were throughout your day.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
      },
    ],
    [
      'expo-media-library',
      {
        photosPermission: 'Allow MemAi to access your photos to help you remember moments from your day.',
        savePhotosPermission: 'Allow MemAi to save photos to help you remember moments from your day.',
        isAccessMediaLocationEnabled: true,
      },
    ],
    [
      'expo-calendar',
      {
        calendarPermission: 'Allow MemAi to access your calendar to help you remember your events and schedule.',
      },
    ],
    'expo-camera',
    'expo-image-picker',
    'expo-av',
  ],
  extra: {
    eas: {
      projectId: 'your-project-id'
    }
  }
};