import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { validate } from '../middleware/validationMiddleware.js';
import { errorHandler } from '../middleware/errorMiddleware.js';
import { registerValidator } from '../validators/authValidators.js';
import { itemValidator } from '../validators/itemValidators.js';
import { claimValidator } from '../validators/claimValidators.js';

function validatorApp(path, validators) {
  const app = express();
  app.use(express.json());
  app.post(path, validators, validate, (_req, res) => res.status(201).json({ success: true }));
  app.use(errorHandler);
  return app;
}

describe('input validation', () => {
  it('rejects weak registration credentials and mismatched passwords', async () => {
    const response = await request(validatorApp('/register', registerValidator)).post('/register').send({ name: 'A', email: 'invalid', enrollmentNumber: '', password: 'short', confirmPassword: 'different' }).expect(422);
    expect(response.body.errors.length).toBeGreaterThan(2);
  });

  it('rejects future item dates and short descriptions', async () => {
    const response = await request(validatorApp('/items', itemValidator)).post('/items').send({ reportType: 'lost', title: 'ID', category: 'ID Card', description: 'short', date: '2099-01-01', location: 'Library' }).expect(422);
    expect(response.body.errors.map((error) => error.path)).toEqual(expect.arrayContaining(['title', 'description', 'date']));
  });

  it('accepts JSON-stringified verification arrays from multipart forms', async () => {
    await request(validatorApp('/items', itemValidator)).post('/items').send({
      reportType: 'found', title: 'Blue ID card', category: 'ID Card',
      description: 'A blue student identity card in a holder', date: '2026-01-01', location: 'Library',
      verificationQuestions: JSON.stringify([{ question: 'What is the ID suffix?', answer: '42' }]),
    }).expect(201);
    await request(validatorApp('/claims', claimValidator)).post('/claims').send({
      reason: 'This matches the item that I reported earlier', uniqueIdentificationAnswer: 'Hidden scratch',
      locationAnswer: 'Library desk', dateAnswer: '2026-01-01',
      verificationAnswers: JSON.stringify([{ questionId: 'q1', answer: '42' }]),
    }).expect(201);
  });
});
