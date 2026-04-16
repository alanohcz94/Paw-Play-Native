import React, { memo, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useApp, type Dog } from "@/context/AppContext";

interface DogItemProps {
  dog: Dog;
  isActive: boolean;
  onPress: (id: string) => void;
}

const DogItem = memo(function DogItem({ dog: d, isActive, onPress }: DogItemProps) {
  const colors = useColors();
  const handlePress = useCallback(() => onPress(d.id), [d.id, onPress]);

  return (
    <TouchableOpacity
      style={[
        styles.dogCircle,
        { borderColor: isActive ? colors.peach : colors.border, borderWidth: isActive ? 3 : 1.5 },
      ]}
      onPress={handlePress}
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
          { color: isActive ? colors.peach : colors.mutedForeground, fontFamily: isActive ? "Nunito_900Black" : "Nunito_700Bold" },
        ]}
        numberOfLines={1}
      >
        {d.name}
      </Text>
    </TouchableOpacity>
  );
});

const AddButton = memo(function AddButton() {
  const colors = useColors();
  const handlePress = useCallback(() => router.push("/add-dog"), []);
  return (
    <TouchableOpacity
      style={[styles.addCircle, { borderColor: colors.border }]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Feather name="plus" size={22} color={colors.mutedForeground} />
      <Text style={[styles.dogName, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>
        Add
      </Text>
    </TouchableOpacity>
  );
});

function DogPicker() {
  const { dogs, activeDogId, setActiveDogId } = useApp();

  if (dogs.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {dogs.map((d) => {
          const isActive = d.id === activeDogId || (!activeDogId && d.id === dogs[0]?.id);
          return (
            <DogItem
              key={d.id}
              dog={d}
              isActive={isActive}
              onPress={setActiveDogId}
            />
          );
        })}
        <AddButton />
      </ScrollView>
    </View>
  );
}

export default memo(DogPicker);

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  scroll: { gap: 12, paddingHorizontal: 4 },
  dogCircle: { alignItems: "center", gap: 4, width: 64, borderRadius: 32 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarEmoji: { fontSize: 22 },
  dogName: { fontSize: 11, textAlign: "center", marginBottom: 10 },
  addCircle: { alignItems: "center", justifyContent: "center", gap: 3, width: 64, borderRadius: 32, borderWidth: 1.5, borderStyle: "dashed" },
});
