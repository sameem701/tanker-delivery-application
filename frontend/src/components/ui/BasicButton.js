import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius, typography } from '../../theme/tokens';

export default function BasicButton({ title, onPress, disabled = false, style, textStyle, selected = false }) {
    return (
        <Pressable
            onPress={disabled ? undefined : onPress}
            android_ripple={{ color: colors.primaryDark }}
            style={[
                styles.button,
                selected ? styles.selected : null,
                style,
                disabled ? styles.disabled : null,
            ]}
        >
            <Text style={[styles.text, textStyle]}>{title}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        backgroundColor: colors.primary,
        paddingVertical: 11,
        paddingHorizontal: 16,
        borderRadius: radius.sm,
        marginTop: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selected: {
        backgroundColor: colors.primaryDark,
    },
    disabled: {
        opacity: 0.45,
    },
    text: {
        color: colors.textOnPrimary,
        fontSize: typography.label,
        fontWeight: '600',
    },
});
