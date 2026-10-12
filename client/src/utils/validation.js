export function validateLogin(formData) {
    if (!formData.email || !/^\S+@\S+\.\S+$/.test(formData.email)) {
        return 'Enter a valid email address.';
    }
    if (!formData.password) return 'Password is required.';
    return '';
}

export function validateRegistration(formData) {
    if (!formData.fullName || formData.fullName.trim().length < 2) return 'Please enter your full name.';
    if (!formData.email || !/^\S+@\S+\.\S+$/.test(formData.email)) return 'Enter a valid email address.';
    if (!formData.phone || formData.phone.trim().length < 8) return 'Enter a valid phone number.';
    if (!formData.neighborhood || formData.neighborhood.trim().length < 2) return 'Tell us your neighborhood.';
    if (!formData.password || formData.password.length < 8) return 'Use at least 8 password characters.';
    if (formData.password !== formData.confirmPassword) return 'Passwords do not match.';
    return '';
}
