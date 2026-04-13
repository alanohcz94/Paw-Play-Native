import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Props {
  label: string;
  icon: string;
  onDismiss: () => void;
}

export default function AchievementBanner({ label, icon, onDismiss }: Props) {
  const colors = useColors();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -120, duration: 400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => onDismiss());
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: colors.card, borderColor: colors.mint, transform: [{ translateY }], opacity },
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.iconCircle, { backgroundColor: colors.mintLight }]}>
        <Feather name={icon as any} size={20} color={colors.mint} />
      </View>
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: colors.mint, fontFamily: "Nunito_900Black" }]}>
          Achievement Unlocked!
        </Text>
        <Text style={[styles.label, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>
          {label}
        </Text>
      </View>
      <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Feather name="x" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: { flex: 1, gap: 2 },
  title: { fontSize: 12 },
  label: { fontSize: 15 },
});
