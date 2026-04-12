import { Pressable, Text } from 'react-native';

export default function BasicButton({ title, onPress, disabled = false, style, textStyle }) {
    return (
        <Pressable
            onPress={disabled ? undefined : onPress}
            style={[
                {
                    borderWidth: 1,
                    borderColor: '#000',
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 4,
                    marginTop: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                },
                style,
                disabled ? { opacity: 0.5 } : null,
            ]}
        >
            <Text style={textStyle}>{title}</Text>
        </Pressable>
    );
}
