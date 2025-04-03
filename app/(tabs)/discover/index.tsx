import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE, MarkerAnimated, Region } from 'react-native-maps';
import * as GardenService from '../../../src/services/GardenService';
import { Garden } from '../../../src/models/Garden';
import { useDebounce } from '../../../src/hooks/useDebounce';
import Colors from '../../constants/Colors';
import { GardenCard } from '../../../src/components/GardenCard';
import { SearchBar } from '../../../src/components/SearchBar';
import LoadingScreen from '../../../src/components/LoadingScreen';
import { ErrorScreen } from '../../../src/components/ErrorScreen';
import { useUserStore } from '../../../app/contexts/UserStore';
import CreateGardenModal from '../../../src/components/CreateGardenModal';
import * as Location from 'expo-location';

const FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open Join' },
  { id: 'approval', label: 'Approval Needed' },
  { id: 'popular', label: 'Popular' },
  { id: 'recent', label: 'Recent' },
];

export default function DiscoverScreen() {
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const mapRef = useRef<MapView>(null);
  
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [isMapView, setIsMapView] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [animatedMarkers, setAnimatedMarkers] = useState<{
    [key: string]: Animated.Value;
  }>({});
  const [visibleGardens, setVisibleGardens] = useState<Garden[]>([]);
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(true);
  const bottomSheetHeight = useRef(new Animated.Value(200)).current;
  
  const debouncedSearchTerm = useDebounce(searchQuery, 500);
  
  useEffect(() => {
    (async () => {
      try {
        setIsLoadingLocation(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocationPermission(status === 'granted');
        
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (err) {
        console.error('Error getting location:', err);
      } finally {
        setIsLoadingLocation(false);
      }
    })();
  }, []);
  
  const loadGardens = async (search?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedGardens = await GardenService.getDiscoverGardens(search);
      setGardens(fetchedGardens);
    } catch (err) {
      setError('Failed to load gardens. Please try again.');
      console.error('Error loading gardens:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    loadGardens();
  }, []);
  
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    loadGardens(query);
  };
  
  const handleRefresh = () => {
    setRefreshing(true);
    loadGardens();
  };
  
  const handleFilterChange = (filterId: string) => {
    setActiveFilter(filterId);
    setIsLoading(true);
  };

  const handleJoinGarden = async (garden: Garden) => {
    if (!user) return;
    
    try {
      const success = await GardenService.joinGarden(
        garden.id,
        user.id,
        user.username,
        user.publicKey,
        user.profilePic
      );
      if (success) {
        if (garden.private) {
          Alert.alert('Success', 'Join request sent');
        } else {
          router.push(`/garden/${garden.id}`);
        }
      }
    } catch (error) {
      console.error('Error joining garden:', error);
      Alert.alert('Error', 'Failed to join garden');
    }
  };
  
  const handleCreateSuccess = (garden: Garden) => {
    setGardens(prev => [...prev, garden]);
    setShowCreateModal(false);
    
    if (garden.latitude && garden.longitude && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: garden.latitude,
        longitude: garden.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 1000);
    }
  };

  const handleLocationSelect = () => {
    setShowLocationPicker(true);
  };

  const handleMarkerDragEnd = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setSelectedLocation({
      latitude,
      longitude
    });
  };

  const handleLocationConfirm = () => {
    if (selectedLocation) {
      setShowCreateModal(true);
      setShowLocationPicker(false);
    }
  };

  const handleRegionChange = (region: Region) => {
    const gardensInView = gardens.filter(garden => {
      if (!garden.latitude || !garden.longitude) return false;
      
      return (
        garden.latitude >= region.latitude - region.latitudeDelta &&
        garden.latitude <= region.latitude + region.latitudeDelta &&
        garden.longitude >= region.longitude - region.longitudeDelta &&
        garden.longitude <= region.longitude + region.longitudeDelta
      );
    });
    
    setVisibleGardens(gardensInView);
  };

  const toggleBottomSheet = () => {
    Animated.timing(bottomSheetHeight, {
      toValue: isBottomSheetVisible ? 0 : 200,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setIsBottomSheetVisible(!isBottomSheetVisible);
  };

  const renderFilterChip = ({ id, label }: { id: string; label: string }) => (
    <TouchableOpacity
      key={id}
      style={[
        styles.filterChip,
        activeFilter === id && styles.activeFilterChip
      ]}
      onPress={() => handleFilterChange(id)}
    >
      <Text style={[
        styles.filterChipText,
        activeFilter === id && styles.activeFilterChipText
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderViewToggle = () => (
    <View style={styles.viewToggleContainer}>
      <TouchableOpacity
        style={[styles.viewToggleButton, !isMapView && styles.activeViewToggle]}
        onPress={() => setIsMapView(false)}
      >
        <Ionicons 
          name="list" 
          size={24} 
          color={!isMapView ? Colors.background : Colors.text} 
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.viewToggleButton, isMapView && styles.activeViewToggle]}
        onPress={() => setIsMapView(true)}
      >
        <Ionicons 
          name="map" 
          size={24} 
          color={isMapView ? Colors.background : Colors.text} 
        />
      </TouchableOpacity>
    </View>
  );
  
  const animateMarker = (markerId: string) => {
    Animated.sequence([
      Animated.timing(animatedMarkers[markerId], {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(animatedMarkers[markerId], {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const renderMarker = (garden: Garden) => {
    if (!garden.visible || !garden.latitude || !garden.longitude) return null;

    const scale = animatedMarkers[garden.id]?.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.2],
    }) || 1;

    return (
      <MarkerAnimated
        key={garden.id}
        coordinate={{
          latitude: garden.latitude,
          longitude: garden.longitude,
        }}
        onPress={() => {
          animateMarker(garden.id);
          router.push(`/garden/${garden.id}`);
        }}
        style={{ transform: [{ scale }] }}
      >
        <View style={styles.customMarker}>
          {garden.logoData ? (
            <Image 
              source={{ uri: garden.logoData }} 
              style={styles.markerLogo}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.defaultMarker}>
              <Ionicons name="leaf" size={20} color={Colors.primary} />
            </View>
          )}
        </View>
      </MarkerAnimated>
    );
  };

  const renderMap = () => {
    if (isLoadingLocation) {
      return (
        <View style={[styles.mapContainer, styles.mapLoading]}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      );
    }

    const initialRegion = userLocation ? {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    } : {
      latitude: 37.78825,
      longitude: -122.4324,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    };

    return (
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation={locationPermission}
          showsMyLocationButton={true}
          onRegionChangeComplete={handleRegionChange}
        >
          {gardens.map(renderMarker)}
        </MapView>

        <TouchableOpacity
          style={styles.addLocationButton}
          onPress={handleLocationSelect}
        >
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.addLocationButtonIcon}
          />
        </TouchableOpacity>

        <Animated.View style={[styles.bottomSheet, { height: bottomSheetHeight }]}>
          <TouchableOpacity 
            style={styles.bottomSheetHandle} 
            onPress={toggleBottomSheet}
          >
            <View style={styles.handleBar} />
          </TouchableOpacity>
          <Text style={styles.bottomSheetTitle}>
            Gardens in this area ({visibleGardens.length})
          </Text>
          <FlatList
            data={visibleGardens}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bottomSheetList}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.gardenCard}
                onPress={() => router.push(`/garden/${item.id}`)}
              >
                <Image 
                  source={{ uri: item.logoData }} 
                  style={styles.gardenCardImage}
                  defaultSource={require('../../../assets/icon.png')}
                />
                <Text style={styles.gardenCardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.gardenCardLocation} numberOfLines={1}>
                  {item.city}, {item.state}
                </Text>
              </TouchableOpacity>
            )}
            keyExtractor={item => item.id}
          />
        </Animated.View>
      </View>
    );
  };

  const LocationPickerDock = () => (
    <Modal
      visible={showLocationPicker}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowLocationPicker(false)}
    >
      <View style={styles.locationDockContainer}>
        <View style={styles.locationDockContent}>
          <View style={styles.dockHeader}>
            <View style={styles.dockHandleBar} />
            <Text style={styles.dockTitle}>Drop Pin for Garden Location</Text>
          </View>
          
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.dockMap}
            initialRegion={{
              latitude: userLocation?.latitude || 37.78825,
              longitude: userLocation?.longitude || -122.4324,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
            showsUserLocation={true}
            onPress={(e) => {
              // Allow tapping on map to move marker
              setSelectedLocation(e.nativeEvent.coordinate);
            }}
          >
            <Marker
              draggable={true}
              coordinate={selectedLocation || userLocation || {
                latitude: 37.78825,
                longitude: -122.4324,
              }}
              onDragEnd={handleMarkerDragEnd}
              pinColor={Colors.primary}
            />
          </MapView>

          <View style={styles.dockFooter}>
            <TouchableOpacity
              style={styles.dockCancelButton}
              onPress={() => {
                setShowLocationPicker(false);
                setSelectedLocation(null);
              }}
            >
              <Text style={styles.dockCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dockConfirmButton}
              onPress={handleLocationConfirm}
              disabled={!selectedLocation}
            >
              <Text style={styles.dockConfirmButtonText}>Create Garden Here</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Initialize animated values for markers when gardens change
  useEffect(() => {
    const newAnimatedMarkers: { [key: string]: Animated.Value } = {};
    gardens.forEach(garden => {
      if (!animatedMarkers[garden.id]) {
        newAnimatedMarkers[garden.id] = new Animated.Value(0);
      }
    });
    setAnimatedMarkers(prev => ({ ...prev, ...newAnimatedMarkers }));
  }, [gardens]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <ErrorScreen message={error} onRetry={() => loadGardens()} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        {renderViewToggle()}
      </View>
      
      <SearchBar
        value={searchQuery}
        onChangeText={handleSearch}
        placeholder="Search gardens..."
      />
      
      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          data={FILTER_OPTIONS}
          renderItem={({ item }) => renderFilterChip(item)}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
        />
      </View>
      
      {isMapView ? renderMap() : (
        <FlatList
          data={gardens}
          renderItem={({ item }) => <GardenCard garden={item} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.gardensList}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="leaf-outline" size={64} color={Colors.inactive} />
              <Text style={styles.emptyText}>
                {searchQuery 
                  ? `No gardens found for "${searchQuery}"`
                  : "No gardens found for selected filter"}
              </Text>
            </View>
          }
        />
      )}

      <CreateGardenModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
        creatorId={user?.id || ''}
        creatorUsername={user?.username || ''}
        creatorProfilePic={user?.profilePic || ''}
        initialLocation={selectedLocation}
      />

      <LocationPickerDock />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 4,
  },
  viewToggleButton: {
    padding: 8,
    borderRadius: 16,
  },
  activeViewToggle: {
    backgroundColor: Colors.primary,
  },
  filtersContainer: {
    paddingVertical: 5,
  },
  filtersList: {
    paddingHorizontal: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.card,
    borderRadius: 20,
    marginRight: 10,
  },
  activeFilterChip: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    color: Colors.text,
    fontSize: 14,
  },
  activeFilterChipText: {
    color: Colors.background,
    fontWeight: '600',
  },
  gardensList: {
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    marginTop: 16,
    color: Colors.inactive,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  callout: {
    padding: 10,
    minWidth: 200,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  calloutDescription: {
    fontSize: 14,
    marginBottom: 10,
  },
  calloutButton: {
    backgroundColor: Colors.primary,
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  calloutButtonText: {
    color: Colors.background,
    fontWeight: 'bold',
  },
  addLocationButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addLocationButtonIcon: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  mapLoading: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationDockContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  locationDockContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    overflow: 'hidden',
  },
  dockHeader: {
    padding: 20,
    alignItems: 'center',
  },
  dockHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: Colors.inactive,
    borderRadius: 2,
    marginBottom: 15,
  },
  dockTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  dockMap: {
    flex: 1,
  },
  dockFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.card,
  },
  dockCancelButton: {
    flex: 1,
    padding: 15,
    marginRight: 10,
    borderRadius: 8,
    backgroundColor: Colors.card,
    alignItems: 'center',
  },
  dockConfirmButton: {
    flex: 2,
    padding: 15,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  dockCancelButtonText: {
    color: Colors.text,
    fontWeight: '600',
  },
  dockConfirmButtonText: {
    color: Colors.background,
    fontWeight: 'bold',
  },
  customMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  markerLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  defaultMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  bottomSheetHandle: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: Colors.inactive,
    borderRadius: 2,
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 10,
  },
  bottomSheetList: {
    paddingVertical: 10,
  },
  gardenCard: {
    width: 150,
    marginRight: 15,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 10,
  },
  gardenCardImage: {
    width: 130,
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
  },
  gardenCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  gardenCardLocation: {
    fontSize: 12,
    color: Colors.inactive,
  },
});