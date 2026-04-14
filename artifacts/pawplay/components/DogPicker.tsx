import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useApp, type Dog } from "@/context/AppContext";

export default function DogPicker() {
  const colors = useColors();
  const { dogs, activeDogId, setActiveDogId } = useApp();

  if (dogs.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {dogs.map((d) => {
          const isActive = d.id === activeDogId || (!activeDogId && d.id === dogs[0]?.id);
          return (
            <TouchableOpacity
              key={d.id}
              style={[
                styles.dogCircle,
                {
                  borderColor: isActive ? colors.peach : colors.border,
                  borderWidth: isActive ? 3 : 1.5,
                },
              ]}
              onPress={() => setActiveDogId(d.id)}
              activeOpacity={0.8}
            >
              {d.avatarUrl ? (
                <Image source={{ uri: d.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.peachLight }]}>
                  <Text style={styles.avatarEmoji}>🐾</Text>
                </View>
              )}
              <Text
                style={[
                  styles.dogName,
                  {
                    color: isActive ? colors.peach : colors.mutedForeground,
                    fontFamily: isActive ? "Nunito_900Black" : "Nunito_700Bold",
                  },
                ]}
                numberOfLines={1}
              >
                {d.name}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.addCircle, { borderColor: colors.border }]}
          onPress={() => router.push("/add-dog")}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={22} color={colors.mutedForeground} />
          <Text style={[styles.dogName, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Add</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  scroll: { gap: 12, paddingHorizontal: 4 },
  dogCircle: {
    alignItems: "center",
    gap: 4,
    width: 64,
    borderRadius: 32,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: { fontSize: 22 },
  dogName: { fontSize: 11, textAlign: "center" },
  addCircle: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    width: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
});
