import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
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

      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Mocked generated verification code');

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

      await new Promise(resolve => setTimeout(resolve, 500));
      const data = { next_screen: 'enter_details', role: 'undefined', session_token: 'mock_token' };
      const nextScreen = data.next_screen;
      const role = data.role;

      setInfoMessage('OTP verified successfully.');
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
      await new Promise(resolve => setTimeout(resolve, 500));
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

      await new Promise(resolve => setTimeout(resolve, 500));
      let response = { message: 'Mock details submitted' };

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
    <View>
      <StatusBar style="dark" />
      <View>
        <Text>Tanker Delivery</Text>
        <Text>{title}</Text>

        <ErrorBanner message={errorMessage} />
        {infoMessage ? <Text>{infoMessage}</Text> : null}

        {step === STEP_PHONE ? (
          <View>
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
          <View>
            <Text>OTP sent to {phone.trim()}</Text>
            <Text>
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
          <View>
            <Text>Choose role and submit details.</Text>
            <View>
              {['customer', 'supplier', 'driver'].map((role) => (
                <Pressable
                  key={role}
                  onPress={() => setSelectedRole(role)}
                >
                  <Text>{role}</Text>
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
          <View>
            <Text>Dashboard (blank)</Text>
            <Text>Role: {userRole}</Text>
            <Text>Phone: {phone.trim()}</Text>
            <AppButton title="Logout" onPress={resetFlow} />
          </View>
        ) : null}

        {loading ? (
          <View>
            <ActivityIndicator size="small" />
            <Text>Please wait...</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
