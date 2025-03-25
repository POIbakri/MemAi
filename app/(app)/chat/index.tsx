import { useState, useRef, useCallback } from 'react';
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
} from 'react-native';
import { Send } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

type Message = {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  photos?: { uri: string; caption?: string }[];
};

export default function ChatScreen() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;

    try {
      setLoading(true);
      setError(null);
      const userMessage: Message = {
        id: Math.random().toString(),
        type: 'user',
        content: input.trim(),
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, userMessage]);
      setInput('');

      // Get today's data
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const today = new Date().toISOString().split('T')[0];

      // Fetch calendar events
      const { data: events, error: eventsError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', `${today}T00:00:00`)
        .lte('start_time', `${today}T23:59:59`);

      if (eventsError) throw eventsError;

      // Fetch locations
      const { data: locations, error: locationsError } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', `${today}T00:00:00`)
        .lte('timestamp', `${today}T23:59:59`);

      if (locationsError) throw locationsError;

      // Fetch photos
      const { data: photos, error: photosError } = await supabase
        .from('photo_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', `${today}T00:00:00`)
        .lte('timestamp', `${today}T23:59:59`);

      if (photosError) throw photosError;

      // TODO: Send to DeepSeek API
      // For now, return a mock response
      const mockResponse = {
        content: "Today was quite eventful! You started your day at home and spent some time at work in Dubai Marina. During the day, you had a team sync meeting at 10 AM that lasted about 30 minutes. In the evening, you captured a beautiful sunset at Kite Beach - the colors were absolutely stunning. It seems like you had a good balance of work and leisure today!",
        photos: photos?.map(photo => ({
          uri: photo.file_uri,
          caption: photo.location_label,
        })),
      };

      const assistantMessage: Message = {
        id: Math.random().toString(),
        type: 'assistant',
        content: mockResponse.content,
        timestamp: new Date(),
        photos: mockResponse.photos,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while processing your request');
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Memory Assistant</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {messages.map(message => (
          <View
            key={message.id}
            style={[
              styles.message,
              message.type === 'user' ? styles.userMessage : styles.assistantMessage,
            ]}
          >
            <Text style={[
              styles.messageText,
              message.type === 'user' ? styles.userMessageText : styles.assistantMessageText,
            ]}>
              {message.content}
            </Text>

            {message.photos && message.photos.length > 0 && (
              <View style={styles.photoGrid}>
                {message.photos.map((photo, index) => (
                  <View key={index} style={styles.photoContainer}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.photo}
                    />
                    {photo.caption && (
                      <Text style={styles.photoCaption}>{photo.caption}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.timestamp}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        ))}

        {loading && (
          <View style={[styles.message, styles.assistantMessage]}>
            <ActivityIndicator size="small" color="#666" style={styles.loader} />
            <Text style={[styles.messageText, styles.assistantMessageText]}>
              Processing your request...
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your day..."
          placeholderTextColor="#666"
          multiline
          maxLength={1000}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || loading}
        >
          <Send
            size={20}
            color={!input.trim() || loading ? '#666' : '#fff'}
          />
        </TouchableOpacity>
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
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: '#000',
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f4f4f5',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#f4f4f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  sendButton: {
    width: 40,
    height: 40,
    backgroundColor: '#000',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#f4f4f5',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  loader: {
    marginBottom: 8,
  },
});