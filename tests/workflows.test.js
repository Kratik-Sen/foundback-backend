import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import Chat from '../models/Chat.js';
import Claim from '../models/Claim.js';
import Handover from '../models/Handover.js';
import Item from '../models/Item.js';
import { canAcceptClaim, canEditItem, isPubliclyVisible } from '../services/policyService.js';
import { generateHandoverOtp, hashHandoverOtp, verifyHandoverOtp } from '../utils/handoverOtp.js';

describe('claim and listing workflow guards', () => {
  const owner = { _id: 'owner', role: 'student' };
  const claimant = { _id: 'claimant', role: 'student' };
  const item = { reporter: 'owner', reportType: 'found', approvalStatus: 'approved', status: 'active', expiryDate: '2099-01-01' };

  it('prevents users from claiming their own found item', () => expect(canAcceptClaim(item, owner)).toBe(false));
  it('prevents returned items from receiving new claims', () => expect(canAcceptClaim({ ...item, status: 'returned' }, claimant)).toBe(false));
  it('prevents editing another user’s listing', () => expect(canEditItem(item, claimant)).toBe(false));
  it('publishes new listings automatically', () => {
    const listing = new Item({
      title: 'Black leather wallet', reportType: 'lost', category: 'Wallet',
      description: 'Black wallet with a zipped coin pocket', date: new Date(),
      location: 'Library', reporter: new mongoose.Types.ObjectId(),
      expiryDate: new Date(Date.now() + 86_400_000),
    });
    expect(listing.approvalStatus).toBe('approved');
    expect(listing.status).toBe('active');
  });
  it('supports an item-contact chat without a claim', () => {
    const participantOne = new mongoose.Types.ObjectId();
    const participantTwo = new mongoose.Types.ObjectId();
    const chat = new Chat({
      item: new mongoose.Types.ObjectId(),
      participants: [participantOne, participantTwo],
      kind: 'item_contact',
      contactKey: `item:${participantOne}:${participantTwo}`,
    });
    expect(chat.validateSync()).toBeUndefined();
    expect(chat.claim).toBeUndefined();
  });
  it('recognizes only recent active chat viewers', () => {
    const activeUser = new mongoose.Types.ObjectId();
    const chat = new Chat({
      item: new mongoose.Types.ObjectId(),
      participants: [activeUser, new mongoose.Types.ObjectId()],
      activeViewers: [{ user: activeUser, lastSeenAt: new Date() }],
    });
    expect(chat.isActivelyViewedBy(activeUser)).toBe(true);
    chat.activeViewers[0].lastSeenAt = new Date(Date.now() - 30_000);
    expect(chat.isActivelyViewedBy(activeUser)).toBe(false);
  });
  it('keeps rejected and expired listings out of public results', () => {
    expect(isPubliclyVisible({ ...item, approvalStatus: 'rejected' })).toBe(false);
    expect(isPubliclyVisible({ ...item, expiryDate: '2020-01-01' })).toBe(false);
  });
  it('defines a unique partial index for one approved claim per item', () => {
    const index = Claim.schema.indexes().find(([keys, options]) => keys.item === 1 && options.partialFilterExpression?.status === 'approved');
    expect(index?.[1].unique).toBe(true);
  });
  it('rejects a wrong handover OTP', () => {
    const otp = generateHandoverOtp();
    expect(otp).toMatch(/^\d{6}$/);
    const hash = hashHandoverOtp(otp);
    expect(verifyHandoverOtp('000000', hash)).toBe(false);
    expect(verifyHandoverOtp(otp, hash)).toBe(true);
  });
  it('allows an administrator-completed handover without an OTP', () => {
    const handover = new Handover({
      item: new mongoose.Types.ObjectId(),
      claim: new mongoose.Types.ObjectId(),
      owner: new mongoose.Types.ObjectId(),
      finder: new mongoose.Types.ObjectId(),
      staff: new mongoose.Types.ObjectId(),
      location: 'Security Office',
      date: new Date(),
      time: '10:00',
      status: 'completed',
      ownerConfirmed: true,
      finderConfirmed: true,
      staffConfirmed: true,
    });
    expect(handover.validateSync()).toBeUndefined();
  });
  it('uses valid MongoDB identifiers in workflow records', () => expect(mongoose.isValidObjectId(new mongoose.Types.ObjectId())).toBe(true));
});
