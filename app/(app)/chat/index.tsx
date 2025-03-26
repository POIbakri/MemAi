import { useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Image,
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Send, AlertTriangle, Heart, ThumbsUp, ThumbsDown } from 'lucide-react-native';
import { supabase, auth } from '@/lib/supabase';
import { config } from '@/lib/config';
import NetInfo from '@react-native-community/netinfo';
import { Session } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { Camera, CameraType } from 'expo-camera';
import { Video, ResizeMode } from 'expo-av';

type MessagePhoto = {
  uri: string;
  caption?: string;
};

type Message = {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  photos?: MessagePhoto[];
  is_error?: boolean;
  user_id?: string;
  reactions?: {
    [key: string]: 'heart' | 'thumbsUp' | 'thumbsDown';
  };
  istyping?: boolean;
  topic?: string;
  extension?: string;
  payload?: any;
  event?: string;
  private?: boolean;
};

// Add these types at the top of the file with other type definitions
type CalendarEvent = {
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  description?: string;
};

type Location = {
  location_label?: string;
  timestamp: string;
  latitude: number;
  longitude: number;
};

type Photo = {
  file_uri: string;
  location_label?: string;
  timestamp: string;
  caption?: string;
  latitude?: number;
  longitude?: number;
  asset_id?: string;
};

// Cache for messages in case of app restart
const MESSAGE_CACHE_KEY = 'chat_messages_cache';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const TYPING_INDICATOR_DELAY = 1000;

export default function ChatScreen() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const retryCountRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const [selectedMedia, setSelectedMedia] = useState<{ uri: string; type: 'photo' | 'video'; caption?: string } | undefined>(undefined);

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      const { data: { session } } = await auth.getSession();
      setSession(session);
    };
    loadSession();
  }, []);

  // Load cached messages on mount
  useEffect(() => {
    loadCachedMessages();
    
    // Set up network connectivity monitoring
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
      
      // When coming back online, try to process any failed requests
      if (state.isConnected && error) {
        setError(null);
      }
    });
    
    // Set up app state monitoring
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      unsubscribe();
      subscription.remove();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Cache messages when they change
  useEffect(() => {
    if (messages.length > 0) {
      cacheChatMessages();
    }
  }, [messages]);

  // Handle app state changes (background/foreground)
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
      // App has come to the foreground
      loadCachedMessages();
      checkNetworkStatus();
    }
    appStateRef.current = nextAppState;
  };

  // Load cached messages
  const loadCachedMessages = async () => {
    try {
      const { data: { session } } = await auth.getSession();
      if (!session?.user) return;
      
      // First try to load from local storage
      try {
        const cachedData = await FileSystem.readAsStringAsync(
          `${FileSystem.cacheDirectory}${MESSAGE_CACHE_KEY}.json`
        );
        const cachedMessages = JSON.parse(cachedData);
        setMessages(cachedMessages.map((msg: Message) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          photos: msg.photos || undefined,
        })));
      } catch (e) {
        // No cached messages, that's okay
      }
      
      // Check network connectivity before attempting to load from Supabase
      const networkState = await NetInfo.fetch();
      if (!networkState.isConnected) {
        console.log('No network connection, skipping Supabase sync');
        return;
      }
      
      // Then try to load from Supabase
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', session.user.id)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      if (data) {
        const newMessages = data.map((msg: Message) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          photos: msg.photos || undefined,
        }));
        
        // Merge with existing messages, avoiding duplicates
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));
          return [...prev, ...uniqueNewMessages].sort((a, b) => 
            a.timestamp.getTime() - b.timestamp.getTime()
          );
        });
      }
    } catch (e) {
      console.error('Error in loadCachedMessages:', e);
      // Only set error state if it's not a network error
      if (!(e instanceof TypeError && e.message === 'Network request failed')) {
        setError('Failed to load messages');
      }
    }
  };

  // Cache messages to storage
  const cacheChatMessages = async () => {
    try {
      const { data: { session } } = await auth.getSession();
      if (!session?.user) return;

      // Cache to local storage first
      try {
        await FileSystem.writeAsStringAsync(
          `${FileSystem.cacheDirectory}${MESSAGE_CACHE_KEY}.json`,
          JSON.stringify(messages)
        );
      } catch (e) {
        console.warn('Failed to cache messages locally:', e);
      }

      // Check network connectivity before attempting to sync with Supabase
      const networkState = await NetInfo.fetch();
      if (!networkState.isConnected) {
        console.log('No network connection, skipping Supabase sync');
        return;
      }

      // Prepare messages for upsert
      const messagesToCache = messages.map((msg: Message) => ({
        id: msg.id,
        user_id: session.user.id,
        type: msg.type,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        photos: msg.photos || null, // Convert undefined to null for JSONB
        is_error: msg.is_error || false, // Use snake_case to match the DB
        istyping: msg.istyping || false, // Use lowercase to match the DB
        reactions: msg.reactions || {},
        // Remove updated_at and inserted_at which don't exist in schema
      }));

      // Try to upsert messages with retry logic
      let retryCount = 0;
      const maxRetries = 3;
      const retryDelay = 1000;

      while (retryCount < maxRetries) {
        try {
          const { error } = await supabase
            .from('messages')
            .upsert(messagesToCache, {
              onConflict: 'id',
              ignoreDuplicates: false,
            });

          if (error) throw error;
          break; // Success, exit retry loop
        } catch (e) {
          retryCount++;
          if (retryCount === maxRetries) {
            throw e;
          }
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, retryCount - 1)));
        }
      }
    } catch (e) {
      console.error('Error in cacheChatMessages:', e);
      // Only set error state if it's not a network error
      if (!(e instanceof TypeError && e.message === 'Network request failed')) {
        setError('Failed to save messages. They will be saved when you are back online.');
        setIsOffline(true);
      }
    }
  };

  // Check network status
  const checkNetworkStatus = async () => {
    const netInfo = await NetInfo.fetch();
    setIsOffline(!netInfo.isConnected);
  };

  // Pull-to-refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await checkNetworkStatus();
    await loadCachedMessages();
    setRefreshing(false);
  };

  // Handle message reaction
  const handleReaction = async (messageId: string, reaction: 'heart' | 'thumbsUp' | 'thumbsDown') => {
    try {
      const { data: { session } } = await auth.getSession();
      if (!session?.user) return;

      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            reactions: {
              ...msg.reactions,
              [session.user.id]: reaction,
            },
          };
        }
        return msg;
      }));

      // Update in Supabase
      const { error } = await supabase
        .from('messages')
        .update({
          reactions: {
            [session.user.id]: reaction,
          },
        })
        .eq('id', messageId);

      if (error) throw error;
    } catch (e) {
      console.error('Error updating reaction:', e);
      setError('Failed to update reaction');
    }
  };

  // Send message with retry logic
  const handleSend = useCallback(async () => {
    if (!input.trim() && !selectedMedia) return;
    
    // Check network connectivity
    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected) {
      setError('You appear to be offline. Please check your internet connection and try again.');
      setIsOffline(true);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Convert selectedMedia to photos format if it exists
      const messagePhotos = selectedMedia ? [{
        uri: selectedMedia.uri,
        caption: selectedMedia.caption || 'Photo from user'
      }] : undefined;

      // Generate a unique ID for the message
      const messageId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Create the user message
      const userMessage: Message = {
        id: messageId,
        type: 'user',
        content: input.trim() || (messagePhotos ? 'What is in this photo?' : ''),
        timestamp: new Date(),
        photos: messagePhotos,
      };

      // Add the message to the state
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setSelectedMedia(undefined);

      // Get user data
      const { data: { session } } = await auth.getSession();
      if (!session?.user) throw new Error('Not authenticated');

      // If there's a photo, analyze it with OpenAI's Vision API
      let photoAnalysis = '';
      if (messagePhotos && messagePhotos.length > 0) {
        // Show typing indicator early
        setIsTyping(true);
        
        try {
          // Create a message indicating we're analyzing the photo
          setMessages(prev => [...prev, {
            id: `system_${Date.now()}`,
            type: 'system',
            content: 'Analyzing your photo...',
            timestamp: new Date(),
          }]);
          
          // Convert image to base64
          const imageAsBase64 = await FileSystem.readAsStringAsync(messagePhotos[0].uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          // Call OpenAI's Vision API
          const visionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY || ''}`
            },
            body: JSON.stringify({
              model: "gpt-4-vision-preview",
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Describe this image in detail. What is visible in this image? Be specific and comprehensive."
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:image/jpeg;base64,${imageAsBase64}`
                      }
                    }
                  ]
                }
              ],
              max_tokens: 500
            })
          });
          
          if (!visionResponse.ok) {
            const errorText = await visionResponse.text();
            throw new Error(`Vision API request failed: ${errorText}`);
          }
          
          const visionResult = await visionResponse.json();
          photoAnalysis = visionResult.choices?.[0]?.message?.content || 
            "I can see an image, but I'm not able to analyze its contents in detail.";
          
          // Remove the analyzing message
          setMessages(prev => prev.filter(msg => msg.id !== `system_${Date.now()}`));
          
        } catch (e) {
          console.error("Error analyzing photo:", e);
          photoAnalysis = "I can see you've shared an image, but I wasn't able to analyze it in detail due to a technical error.";
        }
      }

      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();
      const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay())).toISOString();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      // Get direct client access for complex queries
      const client = await supabase;
      
      // Fetch calendar events for today, this week, and this month
      const { data: events, error: eventsError } = await client
        .from('calendar_events')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('start_time', startOfMonth)
        .lte('start_time', endOfDay)
        .order('start_time', { ascending: true });

      if (eventsError) throw eventsError;

      // Fetch locations for today, this week, and this month
      const { data: locations, error: locationsError } = await client
        .from('locations')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('timestamp', startOfMonth)
        .lte('timestamp', endOfDay)
        .order('timestamp', { ascending: true });

      if (locationsError) throw locationsError;

      // Fetch photos with more details
      const { data: photoLogs, error: photosError } = await client
        .from('photo_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('timestamp', startOfMonth)
        .lte('timestamp', endOfDay)
        .order('timestamp', { ascending: true });

      if (photosError) {
        console.error('Error fetching photos:', photosError);
        // Don't throw here, just continue with empty photos array
      }

      // Process photos to include location data and ensure valid URIs
      const processedPhotos = photoLogs?.map(photo => {
        // Ensure the file_uri is valid
        let fileUri = photo.file_uri;
        if (!fileUri.startsWith('http') && !fileUri.startsWith('file://')) {
          // If it's a relative path, make it absolute
          fileUri = `${FileSystem.documentDirectory}${photo.file_uri}`;
        }

        return {
          ...photo,
          file_uri: fileUri,
          location_label: photo.location_label || 'Unknown location',
          latitude: photo.latitude,
          longitude: photo.longitude,
        };
      }).filter(photo => {
        // Filter out photos with invalid URIs
        return photo.file_uri && (photo.file_uri.startsWith('http') || photo.file_uri.startsWith('file://'));
      }) || [];

      // Show typing indicator
      setIsTyping(true);

      // If a user sends a photo with no text, add a default query
      const effectiveQuery = userMessage.content.trim() || "What is in this photo?";

      // Call DeepSeek API with retry mechanism and pass photo analysis
      await callDeepSeekAPI({
        query: effectiveQuery,
        events: events || [],
        locations: locations || [],
        photos: processedPhotos,
        userId: session.user.id,
        startOfDay,
        endOfDay,
        startOfWeek,
        startOfMonth,
        photoAnalysis, // Pass the photo analysis
      });
      
    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while processing your request');
      
      // Add system message about the error
      setMessages(prev => [
        ...prev, 
        {
          id: Date.now().toString(),
          type: 'system',
          content: 'Sorry, there was a problem processing your request. Please try again later.',
          timestamp: new Date(),
          is_error: true,
        }
      ]);
    } finally {
      setLoading(false);
      setIsTyping(false);
      retryCountRef.current = 0; // Reset retry counter after completion
    }
  }, [input, loading, selectedMedia]);

  // DeepSeek API call with retry logic
  const callDeepSeekAPI = async (data: {
    query: string;
    events: CalendarEvent[];
    locations: Location[];
    photos: Photo[];
    userId: string;
    startOfDay: string;
    endOfDay: string;
    startOfWeek: string;
    startOfMonth: string;
    photoAnalysis?: string;
  }, retryCount = 0): Promise<void> => {
    try {
      if (retryCount > MAX_RETRIES) {
        throw new Error(`Failed after ${MAX_RETRIES} retries`);
      }

      // Helper function to format time
      const formatTime = (date: string) => {
        return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      };

      // Helper function to format date
      const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString([], { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      };

      // Get the most recent user message to check if it has photos
      const recentMessages = [...messages].reverse();
      const latestUserMessage = recentMessages.find(msg => msg.type === 'user');
      const currentPhotos = latestUserMessage?.photos || [];
      
      // Check if the current message includes photos
      let currentPhotoDescription = '';
      if (currentPhotos.length > 0) {
        if (data.photoAnalysis) {
          // If we have photo analysis, use it
          currentPhotoDescription = `
The user has just sent a photo in their current message.

PHOTO ANALYSIS FROM VISION API:
${data.photoAnalysis}

This analysis was generated by the OpenAI Vision API. Use this description to respond to the user's query about the photo. 
DO acknowledge the content of the photo based on this analysis. Treat this analysis as an accurate description of what's in the image.
`;
        } else {
          // Fallback message
          currentPhotoDescription = `
The user has just sent ${currentPhotos.length} photo(s) in their current message.
${currentPhotos.map((photo, index) => 
  `Photo ${index + 1}${photo.caption ? `: ${photo.caption}` : ' (no caption provided)'}`
).join('\n')}

Unfortunately, I wasn't able to analyze the photo content. Please apologize to the user and ask them to describe what's in the photo.
`;
        }
      }

      // Group events by date
      const eventsByDate = data.events.reduce((acc, event: CalendarEvent) => {
        const date = event.start_time.split('T')[0];
        if (!acc[date]) acc[date] = [];
        acc[date].push(event);
        return acc;
      }, {} as Record<string, CalendarEvent[]>);

      // Group locations by date
      const locationsByDate = data.locations.reduce((acc, loc: Location) => {
        const date = loc.timestamp.split('T')[0];
        if (!acc[date]) acc[date] = [];
        acc[date].push(loc);
        return acc;
      }, {} as Record<string, Location[]>);

      // Group photos by date
      const photosByDate = data.photos.reduce((acc, photo: Photo) => {
        const date = photo.timestamp.split('T')[0];
        if (!acc[date]) acc[date] = [];
        acc[date].push(photo);
        return acc;
      }, {} as Record<string, Photo[]>);

      // Format data for DeepSeek API
      const formattedData = {
        model: "deepseek-chat",
        messages: [
          {
            role: 'system',
            content: `You are a helpful AI assistant that helps users remember their day and past activities. You have access to their:
- Calendar events
- Location history
- Photos taken

Please provide detailed, contextual responses based on this data. Be conversational and engaging. When mentioning locations, include timestamps. When discussing events, include start and end times. When referencing photos, mention where they were taken and include relevant details about the location.

${currentPhotoDescription}

Here is the user's data:

Today (${formatDate(data.startOfDay)}):
Calendar Events:
${eventsByDate[data.startOfDay.split('T')[0]]?.map((event: CalendarEvent) => 
`- ${event.title} (${formatTime(event.start_time)} - ${formatTime(event.end_time)})${event.location ? ` at ${event.location}` : ''}`
).join('\n') || 'No events scheduled'}

Locations Visited:
${locationsByDate[data.startOfDay.split('T')[0]]?.map((loc: Location) => 
`- ${loc.location_label || 'Unknown location'} at ${formatTime(loc.timestamp)}`
).join('\n') || 'No location data'}

Photos Taken:
${photosByDate[data.startOfDay.split('T')[0]]?.map((photo: Photo) => 
`- Photo taken at ${formatTime(photo.timestamp)}${photo.location_label ? ` in ${photo.location_label}` : ''}${photo.caption ? ` (${photo.caption})` : ''}`
).join('\n') || 'No photos taken'}

This Week's Events:
${Object.entries(eventsByDate)
.filter(([date]) => date >= data.startOfWeek)
.map(([date, events]) => 
  `\n${formatDate(date)}:\n${events.map((event: CalendarEvent) => 
    `- ${event.title} (${formatTime(event.start_time)} - ${formatTime(event.end_time)})${event.location ? ` at ${event.location}` : ''}`
  ).join('\n')}`
).join('\n') || 'No events this week'}

Recent Locations:
${Object.entries(locationsByDate)
.filter(([date]) => date >= data.startOfWeek)
.map(([date, locations]) => 
  `\n${formatDate(date)}:\n${locations.map((loc: Location) => 
    `- ${loc.location_label || 'Unknown location'} at ${formatTime(loc.timestamp)}`
  ).join('\n')}`
).join('\n') || 'No location data this week'}

Recent Photos:
${Object.entries(photosByDate)
.filter(([date]) => date >= data.startOfWeek)
.map(([date, photos]) => 
  `\n${formatDate(date)}:\n${photos.map((photo: Photo) => 
    `- Photo taken at ${formatTime(photo.timestamp)}${photo.location_label ? ` in ${photo.location_label}` : ''}${photo.caption ? ` (${photo.caption})` : ''}`
  ).join('\n')}`
).join('\n') || 'No photos this week'}`
          },
          {
            role: 'user',
            content: data.query
          }
        ]
      };

      // Call DeepSeek API
      const response = await fetch(`${config.api.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify(formattedData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API call failed with status ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
      }

      const result = await response.json();
      
      if (!result.choices?.[0]?.message?.content) {
        throw new Error('Invalid response format from DeepSeek API');
      }

      // Get relevant photos for the response
      const relevantPhotos = data.photos.filter(photo => {
        const query = data.query.toLowerCase();
        const photoTime = new Date(photo.timestamp);
        const today = new Date(data.startOfDay);
        
        // If query mentions today, only show today's photos
        if (query.includes('today')) {
          return photoTime.toDateString() === today.toDateString();
        }
        
        // If query mentions a specific location, show photos from that location
        if (photo.location_label && query.includes(photo.location_label.toLowerCase())) {
          return true;
        }
        
        // If query mentions photos, show recent photos
        if (query.includes('photo') || query.includes('picture')) {
          return photoTime >= new Date(data.startOfWeek);
        }
        
        return false;
      });

      // Include photos from the current message in the assistant's response
      let responsePhotos = [];

      // First add current photos if the user sent any
      if (currentPhotos.length > 0) {
        responsePhotos = [...currentPhotos];
      } else {
        // Get relevant photos for the response from historical data
        responsePhotos = relevantPhotos.map(photo => ({
          uri: photo.file_uri,
          caption: photo.location_label || photo.caption,
        }));
      }

      const assistantMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: result.choices[0].message.content,
        timestamp: new Date(),
        photos: responsePhotos,
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error(`API call attempt ${retryCount + 1} failed:`, error);
      
      // Implement exponential backoff for retries
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, retryCount);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return callDeepSeekAPI(data, retryCount + 1);
      }
      
      throw error;
    }
  };

  const pickMedia = async (type: 'photo' | 'video') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: type === 'photo' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        const media = {
          uri: result.assets[0].uri,
          type: type,
        };
        return media;
      }
      return null;
    } catch (error) {
      console.error('Error picking media:', error);
      return null;
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos.');
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        return {
          uri: result.assets[0].uri,
          type: 'photo' as const,
        };
      }
      return null;
    } catch (error) {
      console.error('Error taking photo:', error);
      return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Memory Assistant</Text>
        {isOffline && (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineText}>Offline</Text>
          </View>
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#000']}
            tintColor="#000"
          />
        }
      >
        {error && (
          <View style={styles.errorContainer}>
            <AlertTriangle size={18} color="#dc2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {messages.map(message => (
          <View
            key={message.id}
            style={[
              styles.message,
              message.type === 'user' ? styles.userMessage : 
              message.type === 'assistant' ? styles.assistantMessage : 
              styles.systemMessage,
              message.is_error && styles.errorMessage,
            ]}
          >
            <Text style={[
              styles.messageText,
              message.type === 'user' ? styles.userMessageText : 
              message.type === 'assistant' ? styles.assistantMessageText : 
              styles.systemMessageText,
              message.is_error && styles.errorMessageText,
            ]}>
              {message.content}
            </Text>

            {message.photos && message.photos.length > 0 && (
              <View style={styles.photoGrid}>
                {message.photos.map((photo, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.photoContainer}
                    onPress={() => {
                      // Handle photo press - could open in full screen
                      console.log('Photo pressed:', photo.uri);
                    }}
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.photo}
                      defaultSource={require('@/assets/placeholder.png')}
                      onError={(e) => {
                        console.error('Error loading photo:', e.nativeEvent.error);
                        // Optionally handle the error, e.g., show a placeholder
                      }}
                    />
                    {photo.caption && (
                      <Text style={styles.photoCaption}>{photo.caption}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {message.type === 'assistant' && (
              <View style={styles.reactionsContainer}>
                <TouchableOpacity
                  style={[
                    styles.reactionButton,
                    message.reactions?.[session?.user?.id || ''] === 'heart' && styles.reactionButtonActive,
                  ]}
                  onPress={() => handleReaction(message.id, 'heart')}
                >
                  <Heart
                    size={16}
                    color={message.reactions?.[session?.user?.id || ''] === 'heart' ? '#dc2626' : '#666'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.reactionButton,
                    message.reactions?.[session?.user?.id || ''] === 'thumbsUp' && styles.reactionButtonActive,
                  ]}
                  onPress={() => handleReaction(message.id, 'thumbsUp')}
                >
                  <ThumbsUp
                    size={16}
                    color={message.reactions?.[session?.user?.id || ''] === 'thumbsUp' ? '#22c55e' : '#666'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.reactionButton,
                    message.reactions?.[session?.user?.id || ''] === 'thumbsDown' && styles.reactionButtonActive,
                  ]}
                  onPress={() => handleReaction(message.id, 'thumbsDown')}
                >
                  <ThumbsDown
                    size={16}
                    color={message.reactions?.[session?.user?.id || ''] === 'thumbsDown' ? '#dc2626' : '#666'}
                  />
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.timestamp}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        ))}

        {isTyping && (
          <View style={[styles.message, styles.assistantMessage]}>
            <ActivityIndicator size="small" color="#666" style={styles.loader} />
            <Text style={[styles.messageText, styles.assistantMessageText]}>
              Thinking...
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        {selectedMedia && (
          <View style={styles.selectedMediaContainer}>
            {selectedMedia.type === 'photo' ? (
              <Image source={{ uri: selectedMedia.uri }} style={styles.selectedMediaPreview} />
            ) : (
              <Video
                source={{ uri: selectedMedia.uri }}
                style={styles.selectedMediaPreview}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
              />
            )}
            <View style={styles.selectedMediaInfo}>
              <Text style={styles.selectedMediaType}>
                {selectedMedia.type === 'photo' ? 'Photo' : 'Video'} selected
              </Text>
              <TextInput
                style={[styles.input, { marginBottom: 0 }]}
                placeholder="Add a caption (optional)"
                placeholderTextColor="#666"
                value={selectedMedia.caption}
                onChangeText={(text) => setSelectedMedia(prev => prev ? { ...prev, caption: text } : undefined)}
                multiline
              />
            </View>
            <TouchableOpacity
              style={styles.removeMediaButton}
              onPress={() => setSelectedMedia(undefined)}
            >
              <Text style={styles.removeMediaButtonText}>×</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.inputActions}>
          <TouchableOpacity
            style={styles.mediaButton}
            onPress={() => {
              Alert.alert(
                'Add Media',
                'Choose media type',
                [
                  {
                    text: 'Take Photo',
                    onPress: async () => {
                      const photo = await takePhoto();
                      if (photo) setSelectedMedia(photo);
                    },
                  },
                  {
                    text: 'Choose Photo',
                    onPress: async () => {
                      const photo = await pickMedia('photo');
                      if (photo) setSelectedMedia(photo);
                    },
                  },
                  {
                    text: 'Choose Video',
                    onPress: async () => {
                      const video = await pickMedia('video');
                      if (video) setSelectedMedia(video);
                    },
                  },
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                ]
              );
            }}
          >
            <Text style={styles.mediaButtonText}>+</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={isOffline ? "You're offline" : "Ask about your day..."}
            placeholderTextColor="#666"
            multiline
            maxLength={1000}
            editable={!isOffline}
          />

          <TouchableOpacity
            style={[
              styles.sendButton, 
              (!input.trim() && !selectedMedia || loading || isOffline) && styles.sendButtonDisabled
            ]}
            onPress={handleSend}
            disabled={!input.trim() && !selectedMedia || loading || isOffline}
          >
            <Send
              size={20}
              color={!input.trim() && !selectedMedia || loading || isOffline ? '#666' : '#fff'}
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f4f4f5',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: '#000',
  },
  offlineBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  offlineText: {
    color: '#dc2626',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 16,
  },
  message: {
    maxWidth: '80%',
    padding: 16,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#000',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f4f4f5',
  },
  systemMessage: {
    alignSelf: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    maxWidth: '90%',
  },
  errorMessage: {
    backgroundColor: '#fee2e2',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
  },
  userMessageText: {
    color: '#fff',
  },
  assistantMessageText: {
    color: '#000',
  },
  systemMessageText: {
    color: '#0369a1',
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  errorMessageText: {
    color: '#dc2626',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontFamily: 'Inter_400Regular',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  photoContainer: {
    width: '48%',
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
  },
  photoCaption: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
  },
  inputContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    minHeight: 40,
  },
  mediaButton: {
    width: 40,
    height: 40,
    backgroundColor: '#f4f4f5',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  mediaButtonText: {
    fontSize: 24,
    color: '#666',
  },
  selectedMediaContainer: {
    position: 'relative',
    marginBottom: 12,
    backgroundColor: '#f4f4f5',
    borderRadius: 12,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedMediaPreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  selectedMediaInfo: {
    flex: 1,
  },
  selectedMediaType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  removeMediaButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    backgroundColor: '#dc2626',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeMediaButtonText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 20,
  },
  input: {
    flex: 1,
    backgroundColor: '#f4f4f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 40,
    color: '#000',
  },
  sendButton: {
    width: 40,
    height: 40,
    backgroundColor: '#3b82f6',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  loader: {
    marginBottom: 8,
  },
  reactionsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  reactionButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#f4f4f5',
  },
  reactionButtonActive: {
    backgroundColor: '#f0f9ff',
  },
});