import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius } from '../theme';

export default function OtpInput({
  value,
  onChangeText,
  length = 6,
}: {
  value: string;
  onChangeText?: (text: string) => void;
  length?: number;
}) {
  const inputRef = useRef<TextInput>(null);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.container}>
      <View style={styles.row} accessibilityLabel={`Code entered: ${value.length} of ${length} digits`}>
        {Array.from({ length }).map((_, i) => (
          <View key={i} style={[styles.box, i === value.length && styles.active]}>
            <Text style={styles.digit}>{value[i] ?? ''}</Text>
          </View>
        ))}
      </View>
      {onChangeText && (
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={(t) => onChangeText(t.replace(/\D/g, '').slice(0, length))}
          keyboardType="number-pad"
          maxLength={length}
          autoFocus
          style={styles.hiddenInput}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  box: { width: 46, height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  active: { borderColor: colors.primary },
  digit: { fontFamily: fonts.semibold, fontSize: 20, color: colors.text },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
