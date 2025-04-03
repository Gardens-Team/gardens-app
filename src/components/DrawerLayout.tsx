// src/components/DrawerLayout.tsx
import React, { useRef, useState } from 'react';
import { View, StyleSheet, Animated, PanResponder, Dimensions } from 'react-native';
import GardenDock from '../components/GardenDock';
import { useGardens } from '../hooks/useGardens';

const DRAWER_WIDTH = 280;

export default function DrawerLayout({ children }: { children: React.ReactNode }) {
  const { width } = Dimensions.get('window');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const { gardens } = useGardens();
  
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        const { dx } = gestureState;
        if ((drawerOpen && dx < 0) || (!drawerOpen && dx > 0)) {
          translateX.setValue(drawerOpen ? DRAWER_WIDTH + dx : dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, vx } = gestureState;
        if (drawerOpen) {
          if (dx < -DRAWER_WIDTH / 3 || vx < -0.5) {
            closeDrawer();
          } else {
            openDrawer();
          }
        } else {
          if (dx > DRAWER_WIDTH / 3 || vx > 0.5) {
            openDrawer();
          } else {
            closeDrawer();
          }
        }
      },
    })
  ).current;

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.spring(translateX, {
      toValue: DRAWER_WIDTH,
      useNativeDriver: true,
    }).start();
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Animated.View
        style={[
          styles.contentContainer,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        {children}
      </Animated.View>
      
      <View style={styles.dockContainer}>
        <GardenDock gardens={gardens} onCreateGarden={() => {}} onToggleMessages={() => {}} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    contentContainer: {
      flex: 1,
      backgroundColor: '#fff',
    },
    dockContainer: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
    },
  });