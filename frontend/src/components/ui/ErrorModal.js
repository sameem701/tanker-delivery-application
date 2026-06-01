import React from 'react';
import { View, Text, Modal, StyleSheet } from 'react-native';
import BasicButton from './BasicButton';
import { colors, spacing, radius, typography, shadow } from '../../theme/tokens';

export default function ErrorModal({ visible, title, message, onDismiss, buttons }) {
    // Default single OK button if none provided
    const defaultButtons = [
        { label: 'OK', onPress: onDismiss }
    ];

    const displayButtons = buttons || defaultButtons;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onDismiss}
        >
            <View style={styles.overlay}>
                <View style={styles.modalBox}>
                    {title && <Text style={styles.title}>{title}</Text>}
                    {message && <Text style={styles.message}>{message}</Text>}

                    <View style={styles.buttonRow}>
                        {displayButtons.map((btn, idx) => (
                            <BasicButton
                                key={idx}
                                title={btn.label}
                                onPress={btn.onPress}
                                style={[
                                    styles.button,
                                    { flex: 1 },
                                    displayButtons.length > 1 && idx < displayButtons.length - 1 && styles.buttonWithMargin,
                                    btn.danger && styles.dangerButton,
                                ]}
                            />
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBox: {
        width: '85%',
        maxWidth: 380,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.lg,
        ...shadow.lg,
    },
    title: {
        fontSize: typography.subtitle,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: spacing.sm,
    },
    message: {
        fontSize: typography.body,
        color: colors.textSecondary,
        marginBottom: spacing.lg,
        lineHeight: 22,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    button: {
        marginTop: 0,
    },
    buttonWithMargin: {
        marginRight: spacing.xs,
    },
    dangerButton: {
        backgroundColor: colors.danger,
    },
});
