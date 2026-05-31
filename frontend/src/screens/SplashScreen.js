import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { colors } from '../theme/tokens';

const { width } = Dimensions.get('window');

// ── tune these two values ──────────────────────────
const INITIAL_SIZE = width * 0.35;  // starting size
const FINAL_SIZE   = width * 0.85;  // final size
// ──────────────────────────────────────────────────

export default function SplashScreen() {
  const size = useRef(new Animated.Value(INITIAL_SIZE)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(size, {
          toValue: FINAL_SIZE,
          duration: 3000,
          useNativeDriver: false, // must be false for width/height
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: false,
        }),
      ]),
      Animated.delay(2000),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require('../../assets/logo.png')}
        style={{ width: size, height: size, opacity }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});