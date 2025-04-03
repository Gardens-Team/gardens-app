// src/components/CreateGardenModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Switch, TouchableOpacity, StyleSheet, Modal, Image, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { TagInput } from '../components/TagInput';
import Colors from '../../app/constants/Colors';
import * as GardenService from '../services/GardenService';
import { Garden } from '../models/Garden';

type CreateGardenModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: (garden: Garden) => void;
  creatorId: string;
  creatorUsername: string;
  creatorProfilePic: string;
  initialLocation?: {
    latitude: number;
    longitude: number;
  } | null;
};

export default function CreateGardenModal({ 
  visible, 
  onClose, 
  onSuccess, 
  creatorId,
  creatorUsername,
  creatorProfilePic,
  initialLocation
}: CreateGardenModalProps) {
  const mapRef = useRef<MapView>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isApprovalRequired, setIsApprovalRequired] = useState(false);
  const [enableCustomOAuth, setEnableCustomOAuth] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [logoData, setLogoData] = useState<string | undefined>(undefined);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [coordinates, setCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const userLoc = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setUserLocation(userLoc);
        if (!coordinates) {
          setCoordinates(userLoc);
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (initialLocation) {
      setCoordinates(initialLocation);
    }
  }, [initialLocation]);

  const pickImage = async () => {
    // Request permissions if not on web
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera roll permissions to upload a logo');
        return;
      }
    }
    
    // Launch image picker
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1], // Square aspect ratio for logo
      quality: 0.8,
      // Limit size to 1MB
      exif: false,
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setLogoData(result.assets[0].uri);
    }
  };
  
  const handleLocationSelect = () => {
    setShowLocationPicker(true);
  };

  const handleMarkerDragEnd = (e: any) => {
    setCoordinates({
      latitude: e.nativeEvent.coordinate.latitude,
      longitude: e.nativeEvent.coordinate.longitude,
    });
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    
    setLoading(true);
    try {
      const garden = await GardenService.createGarden({
        name,
        description,
        city,
        state,
        latitude: coordinates?.latitude,
        longitude: coordinates?.longitude,
        private: isPrivate,
        oauthEnabled: enableCustomOAuth,
        oauthProviderId: 'custom',
        oauthClientId: 'custom',
        oauthClientSecret: 'custom',
        tags: tags.slice(0, 7),
        visible: !isPrivate, // Only visible if not private
        creator: creatorId,
        creatorUsername: creatorUsername,
        creatorProfilePic: creatorProfilePic,
        logoData: logoData,
      });
      
      onSuccess(garden);
      resetForm();
    } catch (error) {
      console.error('Error creating garden:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setName('');
    setDescription('');
    setCity('');
    setState('');
    setIsPrivate(false);
    setIsApprovalRequired(false);
    setEnableCustomOAuth(false);
    setTags([]);
    setLogoData(undefined);
    setCoordinates(null);
    setShowLocationPicker(false);
  };
  
  const LocationPickerModal = () => (
    <Modal
      visible={showLocationPicker}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowLocationPicker(false)}
    >
      <View style={styles.locationModalContainer}>
        <View style={styles.locationModalContent}>
          <View style={styles.locationModalHeader}>
            <Text style={styles.locationModalTitle}>Select Garden Location</Text>
            <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.locationMap}
            initialRegion={{
              latitude: coordinates?.latitude || userLocation?.latitude || 37.78825,
              longitude: coordinates?.longitude || userLocation?.longitude || -122.4324,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
            showsUserLocation={true}
          >
            {(coordinates || userLocation) && (
              <Marker
                draggable
                coordinate={{
                  latitude: coordinates?.latitude || userLocation!.latitude,
                  longitude: coordinates?.longitude || userLocation!.longitude,
                }}
                onDragEnd={handleMarkerDragEnd}
              />
            )}
          </MapView>

          <TouchableOpacity
            style={styles.confirmLocationButton}
            onPress={() => setShowLocationPicker(false)}
          >
            <Text style={styles.confirmLocationButtonText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Create New Garden</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          
          {/* Logo Picker */}
          <View style={styles.logoContainer}>
            <TouchableOpacity style={styles.logoPicker} onPress={pickImage}>
              {logoData ? (
                <Image source={{ uri: logoData }} style={styles.logoPreview} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="image-outline" size={40} color={Colors.text} />
                  <Text style={styles.logoText}>Upload Logo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          
          <TextInput
            style={styles.input}
            placeholder="Garden Name"
            value={name}
            onChangeText={setName}
          />
          
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
          
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="City"
              value={city}
              onChangeText={setCity}
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="State"
              value={state}
              onChangeText={setState}
            />
          </View>
          
          <TagInput
            tags={tags}
            onChange={setTags}
            placeholder="Add tags (up to 7)"
            maxTags={7}
          />
          
          <View style={styles.locationRow}>
            <TouchableOpacity
              style={[styles.locationButton, coordinates && styles.locationSelectedButton]}
              onPress={handleLocationSelect}
            >
              <Ionicons
                name={coordinates ? "location" : "location-outline"}
                size={24}
                color={coordinates ? Colors.primary : Colors.text}
              />
              <Text style={[styles.locationButtonText, coordinates && styles.locationSelectedText]}>
                {coordinates ? "Location Selected" : "Set Garden Location"}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Private Garden</Text>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: Colors.inactive, true: Colors.primary }}
            />
          </View>
          
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Require Approval to Join</Text>
            <Switch
              value={isApprovalRequired}
              onValueChange={setIsApprovalRequired}
              trackColor={{ false: Colors.inactive, true: Colors.primary }}
            />
          </View>
          
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Custom OAuth (Premium)</Text>
            <Switch
              value={enableCustomOAuth}
              onValueChange={setEnableCustomOAuth}
              trackColor={{ false: Colors.inactive, true: Colors.primary }}
            />
          </View>
          
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.loadingButton]}
            onPress={handleSubmit}
            disabled={loading || !name.trim()}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Creating...' : 'Create Garden'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <LocationPickerModal />
    </Modal>
  );
}

const styles = StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: 20,
    },
    modalContent: {
      backgroundColor: Colors.background,
      borderRadius: 12,
      padding: 20,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 18,
      fontWeight: 'bold',
      color: Colors.text,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 20,
    },
    logoPicker: {
      width: 100,
      height: 100,
      borderRadius: 50,
      overflow: 'hidden',
      backgroundColor: Colors.card,
    },
    logoPlaceholder: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoPreview: {
      width: '100%',
      height: '100%',
    },
    logoText: {
      marginTop: 5,
      fontSize: 12,
      color: Colors.text,
    },
    input: {
      backgroundColor: Colors.card,
      borderRadius: 8,
      padding: 12,
      marginBottom: 15,
      color: Colors.text,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 15,
    },
    halfInput: {
      width: '48%',
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 15,
    },
    switchLabel: {
      fontSize: 16,
      color: Colors.text,
    },
    submitButton: {
      backgroundColor: Colors.primary,
      padding: 15,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 10,
    },
    loadingButton: {
      opacity: 0.7,
    },
    submitButtonText: {
      color: Colors.text,
      fontWeight: 'bold',
      fontSize: 16,
    },
    locationModalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    locationModalContent: {
      backgroundColor: Colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      height: '80%',
      padding: 20,
    },
    locationModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    locationModalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: Colors.text,
    },
    locationMap: {
      width: '100%',
      height: '80%',
      borderRadius: 12,
      marginBottom: 20,
    },
    locationRow: {
      marginBottom: 15,
    },
    locationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.card,
      padding: 12,
      borderRadius: 8,
      justifyContent: 'center',
    },
    locationSelectedButton: {
      backgroundColor: Colors.card,
      borderColor: Colors.primary,
      borderWidth: 1,
    },
    locationButtonText: {
      marginLeft: 8,
      fontSize: 16,
      color: Colors.text,
    },
    locationSelectedText: {
      color: Colors.primary,
    },
    confirmLocationButton: {
      backgroundColor: Colors.primary,
      padding: 15,
      borderRadius: 8,
      alignItems: 'center',
    },
    confirmLocationButtonText: {
      color: Colors.background,
      fontWeight: 'bold',
      fontSize: 16,
    },
  });