import { router } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

export default function HomeScreen() {
  useEffect(() => {
    // Navigate to camera screen immediately for testing
    router.replace({
      pathname: '/camera',
      params: {
        mode: 'photo',
        defaultQuality: 0.6,
        defaultMaxSizePx: 1024
      }
    });
  }, []);

  return (
    <View>
      <Text>Redirecting to camera...</Text>
    </View>
  );
}
