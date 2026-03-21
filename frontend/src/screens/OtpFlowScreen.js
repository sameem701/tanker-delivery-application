import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  enterNumber,
  storeOtp,
  submitCustomerDetails,
  submitDriverDetails,
  submitSupplierDetails,
  verifyOtp,
} from '../api/authApi';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import ErrorBanner from '../components/ui/ErrorBanner';
import { colors, radius, spacing, typography } from '../theme/tokens';

const STEP_PHONE = 'phone';
const STEP_OTP = 'otp';
const STEP_ENTER_DETAILS = 'enter_details';
const STEP_DASHBOARD = 'dashboard';
const RESEND_COOLDOWN_SECONDS = 60;

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getErrorMessage(error) {
  if (error?.payload?.retry_after_seconds) {
    return `${error.message} Retry in ${error.payload.retry_after_seconds} seconds.`;
  }

  return error?.message || 'Something went wrong. Please try again.';
}

export default function OtpFlowScreen() {
  const [step, setStep] = useState(STEP_PHONE);
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [userRole, setUserRole] = useState('undefined');
  const [selectedRole, setSelectedRole] = useState('customer');
  const [name, setName] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [yardLocation, setYardLocation] = useState('');
  const [businessContact, setBusinessContact] = useState('');
  const [verifyLocked, setVerifyLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const title = useMemo(() => {
    if (step === STEP_PHONE) return 'Enter Phone Number';
    if (step === STEP_OTP) return 'Enter Verification Code';
    if (step === STEP_ENTER_DETAILS) return 'Enter Details';
    return 'Dashboard';
  }, [step]);

  const canSendOtp = phone.trim().length > 0;
  const canVerifyOtp = otpCode.trim().length > 0 && !verifyLocked;
  const canResendOtp = cooldownSeconds === 0;
  const canSubmitDetails = name.trim().length > 0;

  useEffect(() => {
    if (step !== STEP_OTP || cooldownSeconds <= 0) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [step, cooldownSeconds]);

  async function handleSendOtp() {
    if (!phone.trim()) {
      setErrorMessage('Phone number is required.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      setInfoMessage('');

      // Keep backend flow aligned with onboarding contract.
      await enterNumber(phone.trim());
      const generatedOtp = generateOtp();
      console.log('Generated verification code:', generatedOtp);
      await storeOtp(phone.trim(), generatedOtp);

      setInfoMessage('OTP sent');
      setOtpCode('');
      setVerifyLocked(false);
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
      setStep(STEP_OTP);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otpCode.trim()) {
      setErrorMessage('Verification code is required.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      setInfoMessage('');

      // Temporary debug visibility requested during development.
      console.log('Entered verification code:', otpCode.trim());
      const response = await verifyOtp(phone.trim(), otpCode.trim());
      const data = response?.data || {};
      const nextScreen = data.next_screen || 'enter_number';
      const role = data.role || 'undefined';

      setInfoMessage(response?.message || 'OTP verified successfully.');
      setSessionToken(data.session_token || '');
      setUserRole(role);

      if (nextScreen === 'enter_details') {
        setStep(STEP_ENTER_DETAILS);
      } else {
        setStep(STEP_DASHBOARD);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      if (
        message.includes('Maximum OTP attempts reached') ||
        message.includes('OTP expired')
      ) {
        setVerifyLocked(true);
      }
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (!canResendOtp) {
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      const generatedOtp = generateOtp();
      console.log('Generated verification code (resend):', generatedOtp);
      await storeOtp(phone.trim(), generatedOtp);
      setInfoMessage('OTP sent');
      setVerifyLocked(false);
      setOtpCode('');
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitDetails() {
    if (!sessionToken) {
      setErrorMessage('Missing session token. Please verify OTP again.');
      setStep(STEP_PHONE);
      return;
    }

    if (!name.trim()) {
      setErrorMessage('Name is required.');
      return;
    }

    if (selectedRole === 'supplier' && (!yardLocation.trim() || !businessContact.trim())) {
      setErrorMessage('Yard location and business contact are required for supplier.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');

      let response;

      if (selectedRole === 'customer') {
        response = await submitCustomerDetails(sessionToken, {
          name: name.trim(),
          home_address: homeAddress.trim() || null,
        });
      } else if (selectedRole === 'driver') {
        response = await submitDriverDetails(sessionToken, {
          name: name.trim(),
        });
      } else {
        response = await submitSupplierDetails(sessionToken, {
          name: name.trim(),
          yard_location: yardLocation.trim(),
          business_contact: businessContact.trim(),
        });
      }

      setUserRole(selectedRole);
      setInfoMessage(response?.message || 'Details saved successfully.');
      setStep(STEP_DASHBOARD);
    } catch (error) {
      const message = getErrorMessage(error);
      if (error?.status === 401 && error?.payload?.data?.next_screen === 'enter_number') {
        resetFlow();
        setErrorMessage(message);
        return;
      }
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  function resetFlow() {
    setStep(STEP_PHONE);
    setPhone('');
    setOtpCode('');
    setSessionToken('');
    setUserRole('undefined');
    setSelectedRole('customer');
    setName('');
    setHomeAddress('');
    setYardLocation('');
    setBusinessContact('');
    setVerifyLocked(false);
    setErrorMessage('');
    setInfoMessage('');
    setCooldownSeconds(0);
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.card}>
        <Text style={styles.title}>Tanker Delivery</Text>
        <Text style={styles.subtitle}>{title}</Text>

        <ErrorBanner message={errorMessage} />
        {infoMessage ? <Text style={styles.infoText}>{infoMessage}</Text> : null}

        {step === STEP_PHONE ? (
          <View style={styles.section}>
            <AppInput
              label="Phone Number"
              placeholder="+91 9876543210"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <AppButton title="Send OTP" onPress={handleSendOtp} disabled={loading || !canSendOtp} />
          </View>
        ) : null}

        {step === STEP_OTP ? (
          <View style={styles.section}>
            <Text style={styles.helperText}>OTP sent to {phone.trim()}</Text>
            <Text style={styles.helperText}>
              {cooldownSeconds > 0
                ? `Request new OTP in ${cooldownSeconds}s`
                : 'You can request a new OTP now.'}
            </Text>
            <AppInput
              label="Verification Code"
              placeholder="Enter OTP"
              keyboardType="number-pad"
              value={otpCode}
              onChangeText={setOtpCode}
              maxLength={6}
            />
            <AppButton title="Verify OTP" onPress={handleVerifyOtp} disabled={loading || !canVerifyOtp} />
            <AppButton title="Request New OTP" onPress={handleResendOtp} disabled={loading || !canResendOtp} />
          </View>
        ) : null}

        {step === STEP_ENTER_DETAILS ? (
          <View style={styles.section}>
            <Text style={styles.successText}>Choose role and submit details.</Text>
            <View style={styles.roleRow}>
              {['customer', 'supplier', 'driver'].map((role) => (
                <Pressable
                  key={role}
                  onPress={() => setSelectedRole(role)}
                  style={[
                    styles.roleChip,
                    selectedRole === role ? styles.roleChipActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      selectedRole === role ? styles.roleChipTextActive : null,
                    ]}
                  >
                    {role}
                  </Text>
                </Pressable>
              ))}
            </View>

            <AppInput
              label="Name"
              placeholder="Enter your name"
              value={name}
              onChangeText={setName}
            />

            {selectedRole === 'customer' ? (
              <AppInput
                label="Home Address (optional)"
                placeholder="Enter home address"
                value={homeAddress}
                onChangeText={setHomeAddress}
              />
            ) : null}

            {selectedRole === 'supplier' ? (
              <>
                <AppInput
                  label="Yard Location"
                  placeholder="Enter yard location"
                  value={yardLocation}
                  onChangeText={setYardLocation}
                />
                <AppInput
                  label="Business Contact"
                  placeholder="Enter business contact"
                  value={businessContact}
                  onChangeText={setBusinessContact}
                />
              </>
            ) : null}

            <AppButton
              title="Submit Details"
              onPress={handleSubmitDetails}
              disabled={loading || !canSubmitDetails}
            />
          </View>
        ) : null}

        {step === STEP_DASHBOARD ? (
          <View style={styles.section}>
            <Text style={styles.successText}>Dashboard (blank)</Text>
            <Text style={styles.metaText}>Role: {userRole}</Text>
            <Text style={styles.metaText}>Phone: {phone.trim()}</Text>
            <AppButton title="Logout" onPress={resetFlow} />
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loaderText}>Please wait...</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.title,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
  section: {
    gap: spacing.md,
  },
  infoText: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '500',
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: typography.label,
  },
  roleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  roleChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  roleChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#e7f1fb',
  },
  roleChipText: {
    color: colors.textSecondary,
    fontSize: typography.label,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  roleChipTextActive: {
    color: colors.primary,
  },
  successText: {
    color: colors.success,
    fontSize: typography.subtitle,
    fontWeight: '700',
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: typography.label,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loaderText: {
    color: colors.textSecondary,
    fontSize: typography.label,
  },
});
