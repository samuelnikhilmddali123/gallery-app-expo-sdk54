import React from 'react';
import { View } from 'react-native';
import { BlurView } from 'expo-blur';

/**
 * Safety fallback for environments where BlurView is not supported or native code is missing.
 * Prevents "Property 'BlurView' doesn't exist" or ReferenceErrors.
 */
const SafeBlurView = ({ children, style, intensity = 50, tint = 'dark', ...props }) => {
  if (typeof BlurView !== 'undefined' && BlurView) {
    return (
      <BlurView intensity={intensity} tint={tint} style={style} {...props}>
        {children}
      </BlurView>
    );
  }

  // Fallback to semi-transparent View
  const fallbackBg = tint === 'dark' ? 'rgba(30,30,30,0.8)' : 'rgba(255,255,255,0.8)';
  
  return (
    <View style={[style, { backgroundColor: fallbackBg }]} {...props}>
      {children}
    </View>
  );
};

export default SafeBlurView;
