import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AppInput from '../../components/AppInput';
import Button from '../../components/Button';
import PhoneInput from '../../components/PhoneInput';
import { useAuth } from '../../context/AuthContext';
import { devLogin, sendOtp } from '../../services/api';
import { getGoogleProfile, googleLogin } from '../../services/googleAuth';
import { colors, fonts, radius, spacing } from '../../theme';

export default function CreateAccountScreen({ navigation, route }: any) {
  const isSignup = (route.params?.mode ?? 'signup') === 'signup';
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isPhoneValid = phone.length === 10;
  const isPasswordValid = isSignup ? password.length >= 8 : true;
  const valid = (method === 'email' ? isEmailValid : isPhoneValid) && isPasswordValid;
  const target = method === 'email' ? email.trim() : phone.trim();

  const onContinue = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await sendOtp(target);
      navigation.navigate('VerifyOtp', {
        identifier: target,
        phone: method === 'phone' ? target : undefined,
        demoCode: r.demoCode,
        password: isSignup ? password : undefined,
      });
    } catch (err: any) {
      setError(err?.error?.message || err?.message || "Couldn't send the code. Check your connection and try again.");
    }
    setLoading(false);
  };

  const onQuickLogin = async (username = 'aanya') => {
    setDevLoading(true);
    setError('');
    try {
      const session = await devLogin(username);
      await signIn(session);
    } catch {
      setError('Dev login failed. Check backend server.');
    }
    setDevLoading(false);
  };

  const onGoogle = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setError('');
    try {
      const g = await getGoogleProfile();
      if (g) {
        const session = await googleLogin(g);
        await signIn(session);
      }
    } catch (e: any) {
      if (e?.code === 'GOOGLE_UNAVAILABLE') {
        if (__DEV__) {
          await signIn(await googleLogin({ idToken: 'dev', name: 'Karan', email: 'karan@example.com' }));
        } else {
          setError('Google sign-in is not available right now. Use email instead.');
        }
      } else {
        setError("Couldn't sign in with Google. Try again.");
      }
    }
    setGoogleLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>

          <Text style={styles.brand}>Sambandh Setu</Text>
          <Text style={styles.title}>{isSignup ? 'Create your account' : 'Log in with OTP'}</Text>
          <Text style={styles.sub}>
            {isSignup
              ? 'Enter your details and create a password to get started.'
              : 'Enter your email or phone to receive a quick verification code.'}
          </Text>

          {/* Method toggle: Email vs Phone */}
          <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggleBtn, method === 'email' && styles.toggleBtnActive]}
              onPress={() => { setMethod('email'); setError(''); }}
            >
              <Text style={[styles.toggleText, method === 'email' && styles.toggleTextActive]}>Email (Brevo)</Text>
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, method === 'phone' && styles.toggleBtnActive]}
              onPress={() => { setMethod('phone'); setError(''); }}
            >
              <Text style={[styles.toggleText, method === 'phone' && styles.toggleTextActive]}>Mobile Number</Text>
            </Pressable>
          </View>

          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.label}>{method === 'email' ? 'Email address' : 'Mobile number'}</Text>
            {method === 'email' ? (
              <AppInput
                value={email}
                onChangeText={(t) => { setEmail(t); setError(''); }}
                placeholder="Enter your email (e.g. name@domain.com)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            ) : (
              <PhoneInput value={phone} onChangeText={(t) => { setPhone(t); setError(''); }} />
            )}

            {isSignup && (
              <>
                <Text style={styles.label}>Password</Text>
                <View>
                  <AppInput
                    value={password}
                    onChangeText={(t) => { setPassword(t); setError(''); }}
                    placeholder="Create a password (min. 8 characters)"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ paddingRight: 48 }}
                    accessibilityLabel="Password"
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
                {password.length > 0 && password.length < 8 && (
                  <Text style={styles.warnText}>Password must contain at least 8 characters</Text>
                )}
              </>
            )}

            {!!error && <Text style={styles.error}>{error}</Text>}
            <Button
              title="Continue"
              disabled={!valid}
              loading={loading}
              style={{ marginTop: spacing.lg }}
              onPress={onContinue}
            />

            <View style={styles.loginRow}>
              <Text style={styles.loginPrompt}>
                {isSignup ? 'Already have an account? ' : 'Prefer your password? '}
              </Text>
              <Pressable onPress={() => navigation.navigate('Login')}>
                <Text style={styles.link}>{isSignup ? 'Log in' : 'Log in with password'}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.orRow}>
            <View style={styles.line} /><Text style={styles.or}>or</Text><View style={styles.line} />
          </View>

          {/* Quick dev login button */}
          <Button
            title="Quick Login as Aanya (Dev Bypass)"
            loading={devLoading}
            onPress={() => onQuickLogin('aanya')}
            style={{ marginBottom: spacing.sm, backgroundColor: '#059669' }}
          />

          <Button variant="outline" title="Continue with Google" loading={googleLoading} onPress={onGoogle} style={styles.social} />
          <Button variant="outline" title="Continue with Apple" onPress={() => signIn()} style={[styles.social, { marginTop: spacing.sm }]} />

          <Text style={styles.terms}>
            By continuing, you agree to our <Text style={styles.link}>Terms of Service</Text> and <Text style={styles.link}>Privacy Policy</Text>.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  back: { marginTop: spacing.xs, alignSelf: 'flex-start' },
  brand: { fontFamily: fonts.display, fontSize: 16, color: colors.text, marginTop: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: 26, textAlign: 'center', color: colors.text, marginTop: spacing.sm },
  sub: { fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', color: colors.muted, marginTop: spacing.xs },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: radius.md,
    padding: 3,
    marginTop: spacing.md,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.md - 2,
  },
  toggleBtnActive: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  toggleText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.muted,
  },
  toggleTextActive: {
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: 4,
  },
  eye: {
    position: 'absolute',
    right: 14,
    top: 14,
    padding: 4,
  },
  warnText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
  },
  error: { fontFamily: fonts.regular, fontSize: 13, color: colors.danger, textAlign: 'center', marginTop: spacing.md },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  loginPrompt: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
  },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { marginHorizontal: 12, fontFamily: fonts.regular, color: colors.muted },
  social: { borderColor: colors.border },
  terms: { textAlign: 'center', fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: spacing.lg },
  link: { color: colors.primary, fontFamily: fonts.semibold },
});
