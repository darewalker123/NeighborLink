import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLogin, validateRegistration } from '../src/utils/validation.js';

test('login validation requires an email and password', () => {
    assert.equal(validateLogin({ email: 'wrong', password: '' }), 'Enter a valid email address.');
    assert.equal(validateLogin({ email: 'user@example.com', password: 'secret' }), '');
});

test('registration validation detects mismatched passwords', () => {
    const form = {
        fullName: 'Kiran Kumar', email: 'kiran@example.com', phone: '9876543210',
        neighborhood: 'Central Area', password: 'password1', confirmPassword: 'password2'
    };
    assert.equal(validateRegistration(form), 'Passwords do not match.');
});
