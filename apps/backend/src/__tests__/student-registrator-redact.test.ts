import { describe, expect, it } from 'vitest';
import { redactSensitiveData, redactSensitiveString } from '../../apps/student-registrator/src/utils/redact';

describe('student-registrator redaction', () => {
  it('masks bearer token and query secrets', () => {
    const input = 'Authorization: Bearer abc.def.ghi https://x.test?a=1&token=abcd&secret=qwerty';
    const output = redactSensitiveString(input);
    expect(output).toContain('Bearer ***');
    expect(output).toContain('token=***');
    expect(output).toContain('secret=***');
  });

  it('masks nested sensitive keys', () => {
    const payload = {
      password: '123456',
      nested: { accessToken: 'token-value', query: '/path?api_key=abc123' },
      items: [{ secret: 'a' }, { ok: true }],
    };
    const redacted = redactSensitiveData(payload);
    expect(redacted.password).toBe('***');
    expect(redacted.nested.accessToken).toBe('***');
    expect(redacted.nested.query).toContain('api_key=***');
    expect(redacted.items[0].secret).toBe('***');
  });
});
