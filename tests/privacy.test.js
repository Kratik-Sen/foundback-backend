import { describe, expect, it } from 'vitest';
import { publicItem, publicUser } from '../utils/serializers.js';

describe('privacy-safe API serialization', () => {
  it('removes private item details and verification answers', () => {
    const item = publicItem({ title: 'Wallet', uniqueMarks: 'secret scratch', privateDetails: 'card digits', building: 'Exact block', room: 'Secret room', privacy: { hideReporter: true, hideExactLocation: true }, verificationQuestions: [{ _id: 'q1', question: 'What is inside?', answer: 'secret' }], reporter: { _id: 'u1', name: 'Student', email: 'private@college.edu', phone: '9999999999' } });
    expect(item.uniqueMarks).toBeUndefined();
    expect(item.privateDetails).toBeUndefined();
    expect(item.verificationQuestions[0].answer).toBeUndefined();
    expect(item.reporter.email).toBeUndefined();
    expect(item.reporter.phone).toBeUndefined();
    expect(item.reporter.name).toBe('Campus member');
    expect(item.reporter._id).toBeUndefined();
    expect(item.building).toBeUndefined();
    expect(item.room).toBeUndefined();
  });

  it('never serializes password or reset tokens', () => {
    expect(publicUser({ name: 'Student', password: 'hash', resetPasswordToken: 'token' })).toEqual({ name: 'Student' });
  });
});
