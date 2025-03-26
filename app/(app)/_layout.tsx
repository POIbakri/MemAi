import { Tabs } from 'expo-router';
import { MessageSquare, Settings } from 'lucide-react-native';
import { useDataCollection } from '@/hooks/useDataCollection';

export default function AppLayout() {
  // Initialize data collection
  useDataCollection();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: '#666',
      }}
    >
      <Tabs.Screen
        name="(app)/chat"
        options={{
          title: 'Memory',
          tabBarIcon: ({ color, size }) => (
            <MessageSquare size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(app)/settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}