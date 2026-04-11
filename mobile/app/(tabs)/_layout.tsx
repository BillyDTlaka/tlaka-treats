import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BRAND } from '../../lib/theme';
import { Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';

type IoniconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, focused }: { name: IoniconName; focused: boolean }) {
  return <Ionicons name={focused ? name : `${name}-outline` as IoniconName} size={24} color={focused ? BRAND : COLORS.gray400} />;
}

// Permission helpers
function can(user: any, action: string, subject: string): boolean {
  const roles: string[] = user?.roles ?? [];
  if (roles.includes('ADMIN')) return true;
  const perms: string[] = user?.permissions ?? [];
  return perms.includes(`${action}:${subject}`) || perms.includes(`manage:${subject}`);
}

export default function TabsLayout() {
  const { user } = useAuth();
  const isAdmin = (user?.roles ?? []).includes('ADMIN');

  const canOrders    = isAdmin || can(user, 'manage', 'order')    || can(user, 'read', 'order');
  const canInventory = isAdmin || can(user, 'manage', 'inventory') || can(user, 'read', 'inventory');
  const canPeople    = isAdmin || can(user, 'manage', 'employee')  || can(user, 'read', 'employee');

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
      {/* Dashboard — admin only */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
          href: isAdmin ? undefined : null, // hide for non-admin staff
        }}
      />

      {/* Orders — visible to anyone with order permission */}
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ focused }) => <TabIcon name="bag" focused={focused} />,
          href: canOrders ? undefined : null,
        }}
      />

      {/* Stock — inventory permission */}
      <Tabs.Screen
        name="stock"
        options={{
          title: 'Stock',
          tabBarIcon: ({ focused }) => <TabIcon name="cube" focused={focused} />,
          href: canInventory ? undefined : null,
        }}
      />

      {/* People — employee permission */}
      <Tabs.Screen
        name="people"
        options={{
          title: 'People',
          tabBarIcon: ({ focused }) => <TabIcon name="people" focused={focused} />,
          href: canPeople ? undefined : null,
        }}
      />

      {/* Bohlale AI — admin only */}
      <Tabs.Screen
        name="bohlale"
        options={{
          title: 'Bohlale',
          tabBarIcon: ({ focused }) => <TabIcon name="sparkles" focused={focused} />,
          href: isAdmin ? undefined : null,
        }}
      />
    </Tabs>
  );
}
