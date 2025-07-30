import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const CameraEntry = () => {
  const router = useRouter();
  const { path, type, size } = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  console.log('Camera mediaPath1:', path, type, size);

  const handleOpenCamera = async () => {
    // Check camera permission first
    if (!permission?.granted) {
      const cameraResult = await requestPermission();
      if (!cameraResult.granted) {
        return; // Exit if camera permission denied
      }
    }

    // Check microphone permission
    if (!micPermission?.granted) {
      const micResult = await requestMicPermission();
      if (!micResult.granted) {
        return; // Exit if microphone permission denied
      }
    }

    // Both permissions granted, navigate to camera
    router.push('/camera');
  };

  return (
    <View style={styles.container}>
      {path && (
        <View style={styles.pathBox}>
          <Text style={styles.pathLabel}>File Path:</Text>
          <Text style={styles.pathText}>{path}</Text>
          <Text style={styles.pathLabel}>File Type:</Text>
          <Text style={styles.pathText}>{type}</Text>
          <Text style={styles.pathLabel}>File Size:</Text>
          <Text style={styles.pathText}>{(Number(size) / (1024 * 1024)).toFixed(2)} MB</Text>
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={handleOpenCamera}>
        <Text style={styles.buttonText}>Open Camera</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, marginBottom: 20, color: 'white' },
  button: { backgroundColor: '#2196F3', padding: 15, borderRadius: 8, marginTop: 30 },
  buttonText: { color: 'white', fontSize: 16 },
  pathBox: { marginTop: 20, backgroundColor: '#1e1e1e', padding: 10, borderRadius: 8 },
  pathLabel: { color: '#ccc', fontSize: 14, marginBottom: 5 },
  pathText: { color: 'white', fontSize: 12, maxWidth: 300 },
});

export default CameraEntry;