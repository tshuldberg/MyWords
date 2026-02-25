import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0D0D0D' },
          headerTintColor: '#F3F3F3',
          contentStyle: { backgroundColor: '#0D0D0D' },
          headerTitle: 'MyWords (Standalone)',
        }}
      />
    </>
  );
}
