import test from 'node:test';
import assert from 'node:assert/strict';
import { offerServicePath } from '../src/utils/navigation.js';

test('offer-service links route each session to the correct destination', () => {
    assert.equal(offerServicePath(null), '/register');
    assert.equal(offerServicePath({ role: 'customer' }), '/become-provider');
    assert.equal(offerServicePath({ role: 'provider' }), '/dashboard');
    assert.equal(offerServicePath({ role: 'admin' }), '/admin');
});
