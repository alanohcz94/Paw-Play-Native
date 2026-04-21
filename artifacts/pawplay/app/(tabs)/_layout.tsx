import { Tabs, router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Platform, View, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { BlurView } from "expo-blur";
import { useAuth } from "@/lib/auth";

export default function TabLayout() {
  const colors = useColors();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.peach,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.OS === "ios" ? "transparent" : colors.card,
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === "web" ? 84 : 70,
          paddingBottom: Platform.OS === "web" ? 34 : 10,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="games"
        options={{
          title: "Games",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="gamepad-variant-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Feather name="settings" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
