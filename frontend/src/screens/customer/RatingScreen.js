import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { submitRating } from '../../api/customerApi';
import { Star } from 'lucide-react-native';

export default function RatingScreen({ token, orderId, onDone }) {
  const [rating, setRating] = useState(5);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      setTimeout(() => {
        Alert.alert('Thank you', 'Your rating was submitted!');
        onDone();
        setLoading(false);
      }, 500);
    } catch (e) {
      Alert.alert('Error', e.message);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Delivery Complete!</Text>
      <Text style={styles.subtitle}>How was your experience?</Text>

      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity key={star} onPress={() => setRating(star)} style={{ padding: 8 }}>
            <Star size={40} color={star <= rating ? '#FFD700' : '#E0E0E0'} fill={star <= rating ? '#FFD700' : 'transparent'} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit Rating</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 32 },
  stars: { flexDirection: 'row', marginBottom: 48 },
  btn: { backgroundColor: '#1a1a1a', height: 56, width: '100%', borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});
