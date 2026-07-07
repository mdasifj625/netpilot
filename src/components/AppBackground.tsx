import React from "react";
import { View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import Animated, { useSharedValue, withRepeat, withTiming, withSequence, Easing } from "react-native-reanimated";

export function AppBackground() {
  const opacity = useSharedValue(0.4);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 8000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [opacity]);

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#020617" }}>
      <Animated.View style={{ flex: 1, opacity }}>
        <Svg height="100%" width="100%">
          <Defs>
            <RadialGradient id="grad" cx="50%" cy="30%" rx="100%" ry="100%">
              <Stop offset="0%" stopColor="#0284c7" stopOpacity="0.5" />
              <Stop offset="50%" stopColor="#0f172a" stopOpacity="0.8" />
              <Stop offset="100%" stopColor="#020617" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#grad)" />
        </Svg>
      </Animated.View>
    </View>
  );
}
