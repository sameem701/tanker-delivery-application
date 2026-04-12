import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';

export default function AppButton({ title, onPress, disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        styles.shadow,
      ]}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    marginVertical: spacing.sm,
    minWidth: 180,
  },
  pressed: {
    backgroundColor: colors.primaryPressed,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: colors.surface,
    fontSize: typography.subtitle,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  shadow: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
});
