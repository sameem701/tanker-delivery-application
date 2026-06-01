import React, { useState } from 'react';
import { View, Text, Modal, ScrollView, Pressable, StyleSheet } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { colors, spacing, radius, typography, shadow } from '../../theme/tokens';

export default function AppDropdown({ label, selectedValue, onValueChange, options, placeholder }) {
    const [isOpen, setIsOpen] = useState(false);

    // If nothing is selected show placeholder; otherwise show the matching label
    const hasValue = selectedValue !== null && selectedValue !== undefined && selectedValue !== '';
    const selectedLabel = hasValue
        ? (options.find(opt => opt.value === selectedValue)?.label || String(selectedValue))
        : (placeholder || `Select ${label || 'an option'}`);

    return (
        <View style={styles.wrapper}>
            {label ? <Text style={styles.label}>{label}</Text> : null}

            <Pressable
                style={({ pressed }) => [
                    styles.button,
                    pressed && styles.buttonPressed,
                ]}
                onPress={() => setIsOpen(true)}
            >
                <Text
                    style={[
                        styles.buttonText,
                        !hasValue && styles.placeholderText,
                    ]}
                    numberOfLines={1}
                >
                    {selectedLabel}
                </Text>
                <View style={styles.chevronContainer}>
                    <ChevronDown
                        size={18}
                        color={hasValue ? colors.textPrimary : colors.textSecondary}
                    />
                </View>
            </Pressable>

            <Modal
                visible={isOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsOpen(false)}
            >
                <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
                    <Pressable style={styles.sheet} onPress={() => {}}>
                        {/* Header */}
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>{label || 'Select'}</Text>
                            <Pressable
                                style={styles.closeBtn}
                                onPress={() => setIsOpen(false)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Text style={styles.closeBtnText}>✕</Text>
                            </Pressable>
                        </View>

                        {/* Options */}
                        <ScrollView
                            style={styles.optionsList}
                            bounces={false}
                            showsVerticalScrollIndicator={false}
                        >
                            {options.map((option, index) => {
                                const isSelected = option.value === selectedValue;
                                return (
                                    <Pressable
                                        key={String(option.value)}
                                        style={({ pressed }) => [
                                            styles.option,
                                            index === options.length - 1 && styles.optionLast,
                                            isSelected && styles.optionSelected,
                                            pressed && styles.optionPressed,
                                        ]}
                                        onPress={() => {
                                            onValueChange(option.value);
                                            setIsOpen(false);
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.optionText,
                                                isSelected && styles.optionTextSelected,
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                        {isSelected && (
                                            <Check size={18} color={colors.primary} strokeWidth={2.5} />
                                        )}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: spacing.xs,
    },
    label: {
        fontSize: typography.label,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 6,
        letterSpacing: 0.2,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: radius.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: 13,
        backgroundColor: colors.surface,
    },
    buttonPressed: {
        backgroundColor: colors.primaryLight,
        borderColor: colors.primary,
    },
    buttonText: {
        fontSize: typography.body,
        color: colors.textPrimary,
        flex: 1,
        fontWeight: '500',
    },
    placeholderText: {
        color: colors.textSecondary,
        fontWeight: '400',
    },
    chevronContainer: {
        marginLeft: spacing.xs,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Modal backdrop
    backdrop: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // The card/sheet inside the modal
    sheet: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        width: '85%',
        maxWidth: 400,
        maxHeight: '70%',
        ...shadow.md,
        overflow: 'hidden',
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    },
    sheetTitle: {
        fontSize: typography.subtitle,
        fontWeight: '700',
        color: colors.textPrimary,
        flex: 1,
    },
    closeBtn: {
        padding: 4,
    },
    closeBtnText: {
        fontSize: 20,
        color: colors.textSecondary,
        fontWeight: '600',
        lineHeight: 24,
    },
    optionsList: {
        paddingVertical: 4,
    },
    option: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    optionLast: {
        borderBottomWidth: 0,
    },
    optionSelected: {
        backgroundColor: colors.primaryLight,
    },
    optionPressed: {
        backgroundColor: colors.primaryLight,
        opacity: 0.7,
    },
    optionText: {
        fontSize: typography.body,
        color: colors.textPrimary,
        flex: 1,
        fontWeight: '400',
    },
    optionTextSelected: {
        fontWeight: '700',
        color: colors.primary,
    },
});
