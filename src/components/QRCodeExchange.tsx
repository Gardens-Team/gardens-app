// In a new file like components/PublicKeyExchange.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, CameraType, BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { getPublicKeyForSharing, importPublicKey } from '../utils/encryption';

export default function PublicKeyExchange() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  
  useEffect(() => {
    // Load the user's public key
    const loadKey = async () => {
      const key = await getPublicKeyForSharing();
      setPublicKey(key);
    };
    
    loadKey();
  }, []);
  
  const startScanning = async () => {
    await requestPermission();
    if (permission?.granted) {
      setScanning(true);
    }
  };
  
  const handleBarCodeScanned = ({ data }: BarcodeScanningResult) => {
    try {
      // Assume the QR code contains just the public key
      importPublicKey(data);
      alert('Contact added successfully!');
      setScanning(false);
    } catch (error) {
      alert('Invalid QR code');
    }
  };
  
  if (!publicKey) {
    return <Text>Loading...</Text>;
  }
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Public Key</Text>
      <View style={styles.qrContainer}>
        <QRCode value={publicKey} size={200} />
      </View>
      <Text style={styles.instruction}>
        Let your contacts scan this QR code to chat with you securely
      </Text>
      
      <Button title="Scan Contact's QR Code" onPress={startScanning} />
      
      {scanning && permission?.granted && (
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={handleBarCodeScanned}
          />
          <Button title="Cancel" onPress={() => setScanning(false)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  qrContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  instruction: {
    textAlign: 'center',
    marginBottom: 30,
  },
  scannerContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 20,
  },
});