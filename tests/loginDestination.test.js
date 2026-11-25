import test from 'node:test';
import assert from 'node:assert/strict';
import { loginDestination } from '../src/lib/utils/loginDestination.js';

test('sign-in preserves an invoice destination with query and fragment', () => {
  assert.equal(loginDestination('/dashboard/invoices/invoice-42?checkout=return#payment', 'https://pumbi.example'), '/dashboard/invoices/invoice-42?checkout=return#payment');
  assert.equal(loginDestination('https://pumbi.example/dashboard/invoices/invoice-42', 'https://pumbi.example'), '/dashboard/invoices/invoice-42');
});

test('sign-in return destinations cannot redirect buyers to another origin', () => {
  for (const value of [null, '', 'https://evil.example/invoice', '//evil.example/invoice', '/\\evil.example/invoice', 'javascript:alert(1)', 'https://[']) {
    assert.equal(loginDestination(value, 'https://pumbi.example'), '/dashboard');
  }
});
