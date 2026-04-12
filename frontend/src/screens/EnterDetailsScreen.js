import { useState } from 'react';
import { ActivityIndicator, Text, View, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { submitCustomerDetails, submitDriverDetails, submitSupplierDetails } from '../api/authApi';
import BasicButton from '../components/ui/BasicButton';

function getErrorMessage(error) {
    return error?.message || 'Something went wrong. Please try again.';
}

export default function EnterDetailsScreen({ route, navigation }) {
    const { sessionToken, phone } = route.params;
    const [selectedRole, setSelectedRole] = useState('customer');
    const [name, setName] = useState('');
    const [homeAddress, setHomeAddress] = useState('');
    const [yardLocation, setYardLocation] = useState('');
    const [businessContact, setBusinessContact] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const canSubmitDetails = name.trim().length > 0;

    async function handleSubmitDetails() {
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

            if (selectedRole === 'customer') {
                await submitCustomerDetails(sessionToken, { name: name.trim(), home_address: homeAddress.trim() || null });
            } else if (selectedRole === 'driver') {
                await submitDriverDetails(sessionToken, { name: name.trim() });
            } else {
                await submitSupplierDetails(sessionToken, { name: name.trim(), yard_location: yardLocation.trim(), business_contact: businessContact.trim() });
            }

            navigation.navigate('Dashboard', { phone, role: selectedRole, sessionToken });
        } catch (error) {
            const message = getErrorMessage(error);
            if (error?.status === 401 && error?.payload?.data?.next_screen === 'enter_number') {
                navigation.navigate('EnterPhone');
                return;
            }
            setErrorMessage(message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: '90%', maxWidth: 420 }}>
                <Text>Tanker Delivery</Text>
                <Text>Enter Details</Text>

                {errorMessage ? <Text>{errorMessage}</Text> : null}

                <View>
                    <Text>Choose role and submit details.</Text>
                    <Picker selectedValue={selectedRole} onValueChange={setSelectedRole}>
                        <Picker.Item label="customer" value="customer" />
                        <Picker.Item label="supplier" value="supplier" />
                        <Picker.Item label="driver" value="driver" />
                    </Picker>

                    <Text>Name</Text>
                    <TextInput placeholder="Enter your name" value={name} onChangeText={setName} style={{ borderWidth: 1 }} />

                    {selectedRole === 'customer' ? (
                        <View>
                            <Text>Home Address (optional)</Text>
                            <TextInput placeholder="Enter home address" value={homeAddress} onChangeText={setHomeAddress} style={{ borderWidth: 1 }} />
                        </View>
                    ) : null}

                    {selectedRole === 'supplier' ? (
                        <View>
                            <Text>Yard Location</Text>
                            <TextInput placeholder="Enter yard location" value={yardLocation} onChangeText={setYardLocation} style={{ borderWidth: 1 }} />
                            <Text>Business Contact</Text>
                            <TextInput placeholder="Enter business contact" value={businessContact} onChangeText={setBusinessContact} style={{ borderWidth: 1 }} />
                        </View>
                    ) : null}

                    <View>
                        <BasicButton title="Submit Details" onPress={handleSubmitDetails} disabled={loading || !canSubmitDetails} />
                    </View>
                </View>

                {loading && (
                    <View>
                        <ActivityIndicator size="small" />
                        <Text>Please wait...</Text>
                    </View>
                )}
            </View>
        </View>
    );
}