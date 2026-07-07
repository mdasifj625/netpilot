import React from "react";
import { View, Text, Animated } from "react-native";
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

const getTargetMax = (currentSpeed: number) => {
  let max = 100;
  while (currentSpeed >= max * 0.9 && max < 1000) {
    max += 100;
  }
  return max;
};

export const Speedometer = ({ speed }: { speed: number }) => {
  const startAngle = 135;
  const sweepAngle = 270;
  const r = 95;
  const cx = 120;
  const cy = 120;

  const animatedSpeed = React.useRef(new Animated.Value(0)).current;
  const [displaySpeed, setDisplaySpeed] = React.useState(0);
  const rippleAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const listenerId = animatedSpeed.addListener(({ value }) => {
      setDisplaySpeed(value);
    });

    Animated.timing(animatedSpeed, {
      toValue: speed,
      duration: 250,
      useNativeDriver: false,
    }).start();

    return () => {
      animatedSpeed.removeListener(listenerId);
    };
  }, [speed, animatedSpeed]);

  const isMoving = speed > 0.5;
  React.useEffect(() => {
    if (isMoving) {
      rippleAnim.setValue(0);
      Animated.loop(
        Animated.timing(rippleAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: false,
        })
      ).start();
    } else {
      rippleAnim.setValue(0);
      rippleAnim.stopAnimation();
    }
  }, [isMoving, rippleAnim]);

  const targetMax = getTargetMax(speed > 0 ? speed : displaySpeed);

  React.useEffect(() => {
    if (targetMax > 100) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [targetMax]);

  const animatedMax = React.useRef(new Animated.Value(100)).current;
  const [displayMax, setDisplayMax] = React.useState(100);

  React.useEffect(() => {
    const listenerId = animatedMax.addListener(({ value }) => {
      setDisplayMax(value);
    });

    Animated.timing(animatedMax, {
      toValue: targetMax,
      duration: 600,
      useNativeDriver: false,
    }).start();

    return () => {
      animatedMax.removeListener(listenerId);
    };
  }, [targetMax, animatedMax]);

  const getScaleElements = (max: number) => {
    const ticksCount = 10;
    const ticks: number[] = [];
    for (let i = 0; i <= ticksCount; i++) {
      ticks.push(Math.round((max / ticksCount) * i));
    }

    const labelTicks: number[] = [];
    const labelsCount = 5;
    for (let i = 0; i <= labelsCount; i++) {
      labelTicks.push(Math.round((max / labelsCount) * i));
    }

    return { ticks, labelTicks };
  };

  const { ticks, labelTicks } = getScaleElements(targetMax);

  const startRad = (startAngle * Math.PI) / 180;
  const endRad = ((startAngle + sweepAngle) * Math.PI) / 180;
  const trackStartX = cx + r * Math.cos(startRad);
  const trackStartY = cy + r * Math.sin(startRad);
  const trackEndX = cx + r * Math.cos(endRad);
  const trackEndY = cy + r * Math.sin(endRad);

  const trackD = `M ${trackStartX.toFixed(2)} ${trackStartY.toFixed(2)} A ${r} ${r} 0 1 1 ${trackEndX.toFixed(2)} ${trackEndY.toFixed(2)}`;

  const currentSweep = Math.min(1, displaySpeed / displayMax) * sweepAngle;
  const activeEndRad = ((startAngle + currentSweep) * Math.PI) / 180;
  const activeEndX = cx + r * Math.cos(activeEndRad);
  const activeEndY = cy + r * Math.sin(activeEndRad);
  const largeArcFlag = currentSweep > 180 ? 1 : 0;

  const activeD =
    displaySpeed > 0.1
      ? `M ${trackStartX.toFixed(2)} ${trackStartY.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 1 ${activeEndX.toFixed(2)} ${activeEndY.toFixed(2)}`
      : "";

  const innerR = 78;
  const innerStartX = cx + innerR * Math.cos(startRad);
  const innerStartY = cy + innerR * Math.sin(startRad);
  const innerEndX = cx + innerR * Math.cos(endRad);
  const innerEndY = cy + innerR * Math.sin(endRad);
  const innerD = `M ${innerStartX.toFixed(2)} ${innerStartY.toFixed(2)} A ${innerR} ${innerR} 0 1 1 ${innerEndX.toFixed(2)} ${innerEndY.toFixed(2)}`;

  const needleAngle = -135 + Math.min(1, displaySpeed / displayMax) * sweepAngle;

  const getTickCoords = (value: number, tickRadius: number) => {
    const tickAngle = -135 + (value / displayMax) * sweepAngle;
    const angleRad = ((tickAngle - 90) * Math.PI) / 180;
    return {
      x: cx + tickRadius * Math.cos(angleRad),
      y: cy + tickRadius * Math.sin(angleRad),
    };
  };

  const getElementOpacity = (value: number) => {
    if (value <= displayMax) return 1;
    const diff = value - displayMax;
    const threshold = targetMax * 0.15;
    return Math.max(0, 1 - diff / threshold);
  };

  const rippleR1 = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 76],
  });

  const rippleO1 = rippleAnim.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [0.55, 0.25, 0],
  });

  const rippleR2 = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 48],
  });

  const rippleO2 = rippleAnim.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [0.35, 0.15, 0],
  });

  return (
    <View className="items-center justify-center relative my-4">
      <Svg width="240" height="240" viewBox="0 0 240 240">
        <Defs>
          <LinearGradient id="speedGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#0ea5e9" />
            <Stop offset="50%" stopColor="#818cf8" />
            <Stop offset="100%" stopColor="#ec4899" />
          </LinearGradient>
          <LinearGradient id="trackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#1e293b" stopOpacity={0.8} />
            <Stop offset="100%" stopColor="#0f172a" stopOpacity={0.8} />
          </LinearGradient>
        </Defs>

        {speed > 0.5 && (
          <>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <AnimatedLine
                key={`hyper-${angle}`}
                x1="120"
                y1="120"
                x2="120"
                y2="10"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="10 120"
                strokeDashoffset={rippleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [120, -10],
                })}
                opacity={rippleO2}
                transform={`rotate(${angle} 120 120)`}
              />
            ))}
            <AnimatedCircle cx="120" cy="120" r={rippleR1} fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity={rippleO1} />
            <AnimatedCircle cx="120" cy="120" r={rippleR2} fill="none" stroke="#ec4899" strokeWidth="1" opacity={rippleO2} />
          </>
        )}

        <Path d={trackD} stroke="url(#trackGrad)" strokeWidth="12" fill="none" strokeLinecap="round" />

        {activeD !== "" && (
          <Path d={activeD} stroke="url(#speedGrad)" strokeWidth="12" fill="none" strokeLinecap="round" />
        )}

        <Path d={innerD} stroke="#1e293b" strokeWidth="1" fill="none" />

        {ticks.map((val) => {
          const startCoords = getTickCoords(val, 84);
          const endCoords = getTickCoords(val, 91);
          const isActive = displaySpeed >= val && displaySpeed > 0;
          return (
            <Line
              key={val}
              x1={startCoords.x.toString()}
              y1={startCoords.y.toString()}
              x2={endCoords.x.toString()}
              y2={endCoords.y.toString()}
              stroke={isActive ? "#38bdf8" : "#334155"}
              strokeWidth={isActive ? "2.5" : "1.5"}
              opacity={getElementOpacity(val)}
            />
          );
        })}

        {labelTicks.map((val) => {
          const coords = getTickCoords(val, 64);
          const isActive = displaySpeed >= val && displaySpeed > 0;
          return (
            <SvgText
              key={val}
              x={coords.x.toString()}
              y={(coords.y + 3.5).toString()}
              fill={isActive ? "#f8fafc" : "#475569"}
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
              opacity={getElementOpacity(val)}
            >
              {val}
            </SvgText>
          );
        })}

        <Path
          d="M 116 120 L 120 32 L 124 120 Z"
          fill="#38bdf8"
          transform={`rotate(${needleAngle}, 120, 120)`}
          stroke="#0284c7"
          strokeWidth="0.5"
        />

        <Circle cx="120" cy="120" r="14" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
        <Circle cx="120" cy="120" r="4" fill="#38bdf8" />
      </Svg>

      <View className="absolute bottom-8 items-center">
        <Text className="text-3xl font-black text-slate-50">{displaySpeed.toFixed(1)}</Text>
        <Text className="text-slate-500 font-bold text-[9px] uppercase tracking-widest mt-0.5">Mbps</Text>
        <View className="bg-slate-950/80 border border-slate-800/80 rounded-full px-2 py-0.5 mt-1.5">
          <Text className="text-slate-400 font-mono text-[7px] uppercase tracking-wider font-extrabold">
            Max {targetMax}M
          </Text>
        </View>
      </View>
    </View>
  );
};
