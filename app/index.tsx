import { useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const CameraEntry = () => {
  const router = useRouter();
  const { path, type, size } = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  console.log("Camera mediaPath1:", path, type, size);

  const [imageResolution, setImageResolution] = useState<{
    width: number;
    height: number;
  } | null>(null);

   const appVersion =   Constants.expoConfig?.version || "1.0.0";

  useEffect(() => {
    if (path) {
      Image.getSize(
        String(path),
        (width, height) => setImageResolution({ width, height }),
        () => setImageResolution(null)
      );
    } else {
      setImageResolution(null);
    }
  }, [path, type]);

  const handleOpenCamera = async () => {
    console.log("opening camera");
    if (!permission?.granted) {
      const cameraResult = await requestPermission();
      if (!cameraResult.granted) {
        return;
      }
    }

    if (!micPermission?.granted) {
      const micResult = await requestMicPermission();
      if (!micResult.granted) {
        return;
      }
    }

    router.push("/camera");
  };

  return (
    <View style={styles.container}>
      {/* Add version text at the top */}
      <Text style={styles.versionText}>App Version: {appVersion}</Text>

      {path && (
        <View style={styles.pathBox}>
          <Text style={styles.pathLabel}>File Path:</Text>
          <Text style={styles.pathText}>{path}</Text>
          <Text style={styles.pathLabel}>File Type:</Text>
          <Text style={styles.pathText}>{type}</Text>
          <Text style={styles.pathLabel}>File Size:</Text>
          <Text style={styles.pathText}>
            {(Number(size) / (1024 * 1024)).toFixed(2)} MB
          </Text>
          <Text style={styles.pathLabel}>Resolution:</Text>
          <Text style={styles.pathText}>
            {imageResolution?.width} * {imageResolution?.height}
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={handleOpenCamera}>
        <Text style={styles.buttonText}>Open Camera</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  versionText: {
    position: 'absolute',
    top: Constants.statusBarHeight + 20, // Below status bar
    right: 20,
    color: '#888',
    fontSize: 12,
  },
  title: { fontSize: 24, marginBottom: 20, color: "white" },
  button: {
    backgroundColor: "#2196F3",
    padding: 15,
    borderRadius: 8,
    marginTop: 30,
  },
  buttonText: { color: "white", fontSize: 16 },
  pathBox: {
    marginTop: 20,
    backgroundColor: "#1e1e1e",
    padding: 10,
    borderRadius: 8,
  },
  pathLabel: { color: "#ccc", fontSize: 14, marginBottom: 5 },
  pathText: { color: "white", fontSize: 12, maxWidth: 300 },
});

export default CameraEntry;