import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BRAND } from '../../lib/theme';
import { Platform } from 'react-native';

type IoniconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, focused }: { name: IoniconName; focused: boolean }) {
  return <Ionicons name={focused ? name : `${name}-outline` as IoniconName} size={24} color={focused ? BRAND : COLORS.gray400} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BRAND,
        tabBarInactiveTintColor: COLORS.gray400,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: COLORS.gray100,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          height: Platform.OS === 'ios' ? 84 : 64,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Dashboard', tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} /> }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: 'Orders', tabBarIcon: ({ focused }) => <TabIcon name="bag" focused={focused} /> }}
      />
      <Tabs.Screen
        name="stock"
        options={{ title: 'Stock', tabBarIcon: ({ focused }) => <TabIcon name="cube" focused={focused} /> }}
      />
      <Tabs.Screen
        name="people"
        options={{ title: 'People', tabBarIcon: ({ focused }) => <TabIcon name="people" focused={focused} /> }}
      />
      <Tabs.Screen
        name="bohlale"
        options={{ title: 'Bohlale', tabBarIcon: ({ focused }) => <TabIcon name="sparkles" focused={focused} /> }}
      />
    </Tabs>
  );
}
