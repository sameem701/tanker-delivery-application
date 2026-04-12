import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../../theme/tokens';

export default function AppLoader() {
  return (
    <View style={styles.container}>
      <View style={styles.loaderBox}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loaderBox: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 32,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
});
