import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppInput from '../../components/AppInput';
import { changePasswordApi } from '../../services/api';
import { S, SettingsScreenLayout } from '../../components/settings/SettingsUI';

export default function ChangePasswordScreen({ navigation }: any) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const tooShort = next.length > 0 && next.length < 8;
  const mismatch = confirm.length > 0 && confirm !== next;
  const valid = current.length > 0 && next.length >= 8 && confirm === next;

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await changePasswordApi(current, next);
      setDone(true);
    } catch (err: any) {
      setError(err?.error?.message || err?.message || 'Failed to update password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsScreenLayout
      title="Change Password"
      subtitle="Use a strong password you don't use anywhere else."
      bg="#EEF3FF"
      onBack={() => navigation.goBack()}
    >
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}>
        <Text style={styles.label}>Current password</Text>
        <AppInput value={current} onChangeText={setCurrent} secureTextEntry placeholder="Enter current password" />

        <Text style={styles.label}>New password</Text>
        <AppInput value={next} onChangeText={setNext} secureTextEntry placeholder="At least 8 characters" />
        {tooShort && <Text style={styles.error}>Use at least 8 characters</Text>}

        <Text style={styles.label}>Confirm new password</Text>
        <AppInput value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Re-enter new password" />
        {mismatch && <Text style={styles.error}>Passwords don't match</Text>}

        {done && <Text style={styles.success}>Password updated.</Text>}
        {!!error && <Text style={[styles.error, { marginTop: 12 }]}>{error}</Text>}

        <Pressable style={[styles.btn, (!valid || busy) && styles.btnOff]} disabled={!valid || busy} onPress={submit}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Update password</Text>}
        </Pressable>
      </ScrollView>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: S.text, marginTop: 18, marginBottom: 8 },
  error: { fontSize: 12, color: S.danger, marginTop: 6 },
  success: { fontSize: 13, color: '#16A34A', marginTop: 16, fontWeight: '600' },
  btn: { marginTop: 28, height: 52, borderRadius: 26, backgroundColor: S.primary, alignItems: 'center', justifyContent: 'center' },
  btnOff: { backgroundColor: '#CBD5E1' },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});