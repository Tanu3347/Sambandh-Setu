import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AppInput from '../../components/AppInput';
import Button from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { forgotPasswordApi, resetPasswordApi } from '../../services/api';
import { colors, fonts, radius, spacing } from '../../theme';

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isPhone = (v: string) => /^\d{10}$/.test(v.replace(/[\s+-]|^91/g, ''));

export default function ForgotPasswordScreen({ navigation }: any) {
  const [id, setId] = useState('');
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [demoCode, setDemoCode] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { signIn } = useAuth();

  const idValid = isEmail(id) || isPhone(id);
  const resetValid = code.trim().length === 6 && newPassword.length >= 8;

  const onRequestCode = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await forgotPasswordApi(id.trim());
      setDemoCode(res.demoCode);
      setStep('reset');
      setSuccess('Verification code sent! Please check your email inbox.');
    } catch (err: any) {
      setError(err?.error?.message || err?.message || 'Could not send reset code. Please check your email address.');
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async () => {
    setError('');
    setLoading(true);
    try {
      const session = await resetPasswordApi(id.trim(), code.trim(), newPassword);
      setSuccess('Password reset successfully! Logging you in...');
      setTimeout(() => {
        signIn(session);
      }, 1000);
    } catch (err: any) {
      setError(err?.error?.message || err?.message || 'Invalid or expired code. Please try again.');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>

          <Text style={styles.title}>Forgot password?</Text>
          <Text style={styles.sub}>
            {step === 'request'
              ? "Enter your email or phone number and we'll send a code to reset your password."
              : 'Enter the 6-digit code sent to your email and your new password.'}
          </Text>

          {step === 'request' ? (
            <>
              <Text style={styles.label}>Email or phone number</Text>
              <AppInput
                value={id}
                onChangeText={(t) => { setId(t); setError(''); }}
                placeholder="name@example.com or 10-digit number"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />

              {!!error && <Text style={styles.error}>{error}</Text>}

              <Button
                title="Send reset code"
                disabled={!idValid || loading}
                loading={loading}
                style={{ marginTop: spacing.xl }}
                onPress={onRequestCode}
              />
            </>
          ) : (
            <>
              {!!demoCode && (
                <View style={styles.demo}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                  <Text style={styles.demoText}>
                    Code: <Text style={styles.demoCode}>{demoCode}</Text> (also sent to email inbox & CLI)
                  </Text>
                </View>
              )}

              {!!success && <Text style={styles.success}>{success}</Text>}

              <Text style={styles.label}>6-Digit verification code</Text>
              <AppInput
                value={code}
                onChangeText={(t) => { setCode(t); setError(''); }}
                placeholder="Enter 6-digit code"
                keyboardType="number-pad"
                maxLength={6}
              />

              <Text style={styles.label}>New password</Text>
              <View>
                <AppInput
                  value={newPassword}
                  onChangeText={(t) => { setNewPassword(t); setError(''); }}
                  placeholder="At least 8 characters"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{ paddingRight: 48 }}
                />
                <Pressable
                  onPress={() => setShowPassword((s) => !s)}
                  hitSlop={10}
                  style={styles.eye}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
                </Pressable>
              </View>

              {newPassword.length > 0 && newPassword.length < 8 && (
                <Text style={styles.warnText}>Password must contain at least 8 characters</Text>
              )}

              {!!error && <Text style={styles.error}>{error}</Text>}

              <Button
                title="Reset password & log in"
                disabled={!resetValid || loading}
                loading={loading}
                style={{ marginTop: spacing.xl }}
                onPress={onResetPassword}
              />

              <Pressable onPress={() => setStep('request')} style={styles.resendBtn}>
                <Text style={styles.resendText}>Request a new code</Text>
              </Pressable>
            </>
          )}

          <Pressable onPress={() => navigation.navigate('Login')} style={styles.backLink}>
            <Text style={styles.backText}>Back to log in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  back: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.text, marginTop: spacing.lg },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: spacing.xs, lineHeight: 20 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.xs },
  eye: { position: 'absolute', right: 14, top: 14, padding: 4 },
  warnText: { fontFamily: fonts.regular, fontSize: 12, color: colors.danger, marginTop: 4 },
  error: { fontFamily: fonts.regular, fontSize: 13, color: colors.danger, marginTop: spacing.md, textAlign: 'center' },
  success: { fontFamily: fonts.semibold, fontSize: 13, color: '#16A34A', marginTop: spacing.md, textAlign: 'center' },
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginTop: spacing.md,
  },
  demoText: { fontFamily: fonts.regular, fontSize: 12, color: colors.primaryDark, marginLeft: 6 },
  demoCode: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1 },
  resendBtn: { alignItems: 'center', marginTop: spacing.md },
  resendText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  backLink: { alignItems: 'center', paddingVertical: spacing.lg },
  backText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
});
