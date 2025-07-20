// src/utils/responsive.ts - NEW FILE

import { Dimensions, Platform, StatusBar } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Device size categories
export const isSmallDevice = screenWidth < 375;
export const isMediumDevice = screenWidth >= 375 && screenWidth < 414;
export const isLargeDevice = screenWidth >= 414;
export const isTablet = screenWidth >= 768;

// Common device breakpoints
export const DeviceBreakpoints = {
  small: 375,
  medium: 414,
  large: 768,
  xlarge: 1024,
};

// Get responsive font size
export const responsiveFontSize = (baseSize: number): number => {
  if (isSmallDevice) {
    return baseSize * 0.9;
  } else if (isTablet) {
    return baseSize * 1.2;
  }
  return baseSize;
};

// Get responsive spacing
export const responsiveSpacing = (baseSpacing: number): number => {
  if (isSmallDevice) {
    return baseSpacing * 0.85;
  } else if (isTablet) {
    return baseSpacing * 1.5;
  }
  return baseSpacing;
};

// Get number of columns for grid layouts
export const getGridColumns = (defaultColumns: number = 3): number => {
  if (isSmallDevice) {
    return Math.max(2, defaultColumns - 1);
  } else if (isTablet) {
    return defaultColumns + 2;
  }
  return defaultColumns;
};

// Get card dimensions for grid layouts
export const getCardDimensions = (columns: number, containerPadding: number = 16, cardSpacing: number = 8): number => {
  const totalSpacing = containerPadding * 2 + (cardSpacing * (columns - 1));
  const availableWidth = screenWidth - totalSpacing;
  return availableWidth / columns;
};

// Platform-specific adjustments
export const getPlatformAdjustments = () => {
  return {
    // Extra padding for iOS devices with notches
    topPadding: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight || 0,
    // Bottom padding for Android navigation bar
    bottomPadding: Platform.OS === 'android' ? 20 : 0,
  };
};

// Get safe content height (accounting for system UI)
export const getSafeContentHeight = (insets: { top: number; bottom: number }): number => {
  const platformAdjustments = getPlatformAdjustments();
  return screenHeight - insets.top - insets.bottom - platformAdjustments.topPadding - platformAdjustments.bottomPadding;
};

// Responsive styles helper
export const responsiveStyles = {
  padding: (base: number) => ({
    paddingHorizontal: responsiveSpacing(base),
    paddingVertical: responsiveSpacing(base),
  }),
  
  margin: (base: number) => ({
    marginHorizontal: responsiveSpacing(base),
    marginVertical: responsiveSpacing(base),
  }),
  
  text: (base: number) => ({
    fontSize: responsiveFontSize(base),
    lineHeight: responsiveFontSize(base) * 1.4,
  }),
};

// Screen dimensions with safe areas
export const ScreenDimensions = {
  width: screenWidth,
  height: screenHeight,
  isSmall: isSmallDevice,
  isMedium: isMediumDevice,
  isLarge: isLargeDevice,
  isTablet,
};