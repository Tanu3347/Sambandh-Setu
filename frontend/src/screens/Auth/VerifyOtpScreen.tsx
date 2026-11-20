import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/Button';
import Keypad from '../../components/Keypad';
import OtpInput from '../../components/OtpInput';
import { useAuth } from '../../context/AuthContext';
import { sendOtp, verifyOtp } from '../../services/api';
import { colors, fonts, radius, spacing } from '../../theme';

const RESEND_SECONDS = 30;
const MAX_ATTEMPTS = 5;

export default function VerifyOtpScreen({ navigation, route }: any) {
  const identifier: string = route.params?.identifier ?? route.params?.phone ?? '';
  const password = route.params?.password;
  const purpose = route.params?.purpose || 'signup';
  const isEmail = identifier.includes('@');
  const targetDisplay = isEmail ? identifier : `+91 xxxxx xx${identifier.slice(-3)}`;
  // Demo code is strictly for phone verification where no SMS gateway exists yet
  const [demoCode, setDemoCode] = useState<string | undefined>(!isEmail ? route.params?.demoCode : undefined);
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();
  const locked = attempts >= MAX_ATTEMPTS;

  // 30-second resend countdown
  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const verify = async () => {
    setLoading(true);
    setError('');
    try {
      const session = await verifyOtp(identifier, code, password, purpose);
      if (session) {
        setLoading(false);
        if ((session as any).user?.onboardingCompleted || purpose === 'login') {
          await signIn(session);
        } else {
          navigation.navigate('OnboardingBasics', { session }); // sign-in happens at the end of onboarding
        }
        return;
      }
    } catch (err: any) {
      const used = attempts + 1;
      setAttempts(used);
      setCode('');
      setError(
        used >= MAX_ATTEMPTS
          ? 'Too many wrong tries. Please request a new code.'
          : err?.error?.message || err?.message || `Incorrect code. ${MAX_ATTEMPTS - used} tries left.`
      );
    }
    setLoading(false);
  };

  const resend = async () => {
    setError('');
    setCode('');
    setAttempts(0);
    try {
      const r = await sendOtp(identifier, purpose);
      if (!isEmail) setDemoCode(r.demoCode);
      setSeconds(RESEND_SECONDS);
    } catch (err: any) {
      setError(err?.error?.message || err?.message || "Couldn't send a new code. Try again.");
    }
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </Pressable>

      <Text style={styles.title}>{isEmail ? 'Verify your email' : 'Verify your number'}</Text>
      <Text style={styles.sub}>{isEmail ? "We've sent a 6-digit verification code to your email inbox:" : "We've sent a 6-digit code to"}</Text>
      <Text style={styles.phone}>{targetDisplay}</Text>

      {/* Demo code is only shown for phone numbers because SMS gateway is not yet configured */}
      {!isEmail && !!demoCode && (
        <View style={styles.demo}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.demoText}>
            Demo code (SMS pending): <Text style={styles.demoCode}>{demoCode}</Text>
          </Text>
        </View>
      )}

      {isEmail && (
        <Text style={styles.emailNote}>
          Please check your inbox (and spam folder) for the code.
        </Text>
      )}

      <View style={{ marginTop: spacing.xl }}>
        <OtpInput value={code} onChangeText={setCode} />
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.resend}>
        Didn't receive the code?{' '}
        {seconds > 0 && !locked ? (
          <Text style={styles.bold}>
            Resend <Text style={styles.timer}>({mm}:{ss})</Text>
          </Text>
        ) : (
          <Text style={[styles.bold, { color: colors.primary }]} onPress={resend} accessibilityRole="button">
            Resend
          </Text>
        )}
      </Text>

      <View style={{ flex: 1 }} />

      <Keypad
        onDigit={(d) => !locked && setCode((c) => (c.length < 6 ? c + d : c))}
        onDelete={() => setCode((c) => c.slice(0, -1))}
      />
      <Button
        title="Continue"
        arrow
        loading={loading}
        disabled={code.length !== 6 || locked}
        onPress={verify}
        style={{ marginTop: spacing.lg }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 44, height: 44, justifyContent: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 24, textAlign: 'center', color: colors.text, marginTop: spacing.lg },
  sub: { fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', color: colors.muted, marginTop: spacing.sm },
  phone: { fontFamily: fonts.semibold, fontSize: 15, textAlign: 'center', color: colors.text, marginTop: 2 },
  demo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
    backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: spacing.lg,
    minHeight: 36, marginTop: spacing.md,
  },
  demoText: { fontFamily: fonts.regular, fontSize: 12, color: colors.primaryDark, marginLeft: 6 },
  demoCode: { fontFamily: fonts.bold, fontSize: 14, letterSpacing: 2 },
  error: { fontFamily: fonts.regular, fontSize: 13, color: colors.danger, textAlign: 'center', marginTop: spacing.md },
  resend: { fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', color: colors.muted, marginTop: spacing.lg },
  emailNote: { fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', color: colors.muted, marginTop: spacing.sm, paddingHorizontal: spacing.lg },
  bold: { fontFamily: fonts.bold, color: colors.text },
  timer: { fontFamily: fonts.regular, color: colors.muted },
});