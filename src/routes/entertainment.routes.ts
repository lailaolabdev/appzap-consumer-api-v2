import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import SongRequest from '../models/SongRequest';
import User from '../models/User';
import { authenticate } from '../middleware/auth.middleware';
import logger from '../utils/logger';

/**
 * Entertainment Routes — Feature 16: Live Song Requests & Band Tipping
 *
 * PUBLIC:
 *   GET  /api/v1/entertainment/:restaurantId/queue   — Live song queue for a restaurant
 *
 * AUTHENTICATED:
 *   POST /api/v1/entertainment/:restaurantId/request  — Submit a song request (optional tip)
 *   GET  /api/v1/entertainment/my-requests            — User's own requests
 *
 * INTERNAL/WEBHOOK (called by POS band tablet — uses X-Internal-Key header):
 *   PATCH /api/v1/entertainment/:restaurantId/request/:id/accept   — Band accepts song
 *   PATCH /api/v1/entertainment/:restaurantId/request/:id/reject   — Band rejects song
 */

const router = Router();
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'appzap_internal_key';

/** Validate internal service header — used for POS band tablet webhooks */
const internalAuth = (req: Request, res: Response, next: NextFunction) => {
    const key = req.headers['x-internal-key'];
    if (key !== INTERNAL_KEY) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    return next();
};

// ── Public: Queue Feed ─────────────────────────────────────────────────────────

/**
 * GET /api/v1/entertainment/:restaurantId/queue
 * Returns the live song request queue for the current session.
 */
router.get('/:restaurantId/queue', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { restaurantId } = req.params;
        const queue = await SongRequest.find({
            restaurantId,
            status: 'QUEUED',
        })
            .sort({ tipAmount: -1, createdAt: 1 }) // Highest tip first, then FIFO
            .limit(50)
            .select('-userId -userPhone')          // Never expose phone in public feed
            .lean();

        const playing = await SongRequest.findOne({
            restaurantId,
            status: 'PLAYING',
        })
            .sort({ resolvedAt: -1 })
            .select('-userId -userPhone')
            .lean();

        return res.json({
            success: true,
            nowPlaying: playing ?? null,
            queue,
            queueLength: queue.length,
        });
    } catch (error) {
        return next(error);
    }
});

// ── Authenticated: Submit Request ─────────────────────────────────────────────

/**
 * POST /api/v1/entertainment/:restaurantId/request
 * Body: { songTitle, artist?, tipAmount?, senderNote? }
 *
 * If tipAmount > 0:
 *   - Locks funds from user's wallet into escrow via atomic $inc
 *   - Returns error if wallet balance is insufficient
 */
router.post('/:restaurantId/request', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const user = req.user as any;
            const { restaurantId } = req.params;
            const { songTitle, artist, tipAmount = 0, senderNote } = req.body;

            if (!songTitle || typeof songTitle !== 'string' || !songTitle.trim()) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'MISSING_SONG_TITLE', message: 'songTitle is required' },
                });
            }

            const tip = Math.max(0, Number(tipAmount) || 0);

            // Wallet check & escrow (atomic)
            let tipInEscrow = false;
            if (tip > 0) {
                const dbUser = await User.findById(user._id).session(session);
                if (!dbUser) {
                    return res.status(404).json({ success: false, error: 'User not found' });
                }

                const walletBalance = (dbUser as any).wallet?.balance ?? 0;
                if (walletBalance < tip) {
                    return res.status(400).json({
                        success: false,
                        error: {
                            code: 'INSUFFICIENT_WALLET',
                            message: `Insufficient wallet balance. You have ${walletBalance} LAK but the tip requires ${tip} LAK.`,
                        },
                    });
                }

                // Deduct from wallet → escrow
                await User.updateOne(
                    { _id: user._id },
                    { $inc: { 'wallet.balance': -tip, 'wallet.escrowBalance': tip } },
                    { session }
                );
                tipInEscrow = true;
            }

            const songReq = await SongRequest.create(
                [{
                    restaurantId,
                    userId: user._id.toString(),
                    userPhone: user.phone,
                    userNickname: user.nickname || user.fullName,
                    songTitle: songTitle.trim(),
                    artist: artist?.trim(),
                    tipAmount: tip,
                    tipInEscrow,
                    senderNote: senderNote?.trim(),
                    status: 'QUEUED',
                }],
                { session }
            );

            logger.info(`[SongReq] ${user.phone} requested "${songTitle}" at ${restaurantId} (tip: ${tip} LAK)`);

            return res.status(201).json({
                success: true,
                message: 'Song request submitted!',
                data: {
                    requestId: songReq[0]._id,
                    songTitle: songReq[0].songTitle,
                    artist: songReq[0].artist,
                    tipAmount: tip,
                    tipInEscrow,
                    status: 'QUEUED',
                },
            });
        });
    } catch (error) {
        return next(error);
    } finally {
        session.endSession();
    }
});

// ── My Requests ───────────────────────────────────────────────────────────────

router.get('/my-requests', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as any;
        const requests = await SongRequest.find({ userId: user._id.toString() })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        return res.json({ success: true, data: requests });
    } catch (error) {
        return next(error);
    }
});

// ── POS Band Tablet: Accept / Reject ─────────────────────────────────────────

/**
 * PATCH /api/v1/entertainment/:restaurantId/request/:id/accept
 * Called by the band's iPad (POS internal webhook).
 * Transfers escrowed tip to the restaurant ledger.
 */
router.patch('/:restaurantId/request/:id/accept', internalAuth, async (req: Request, res: Response, next: NextFunction) => {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const { id } = req.params;
            const songReq = await SongRequest.findById(id).session(session);
            if (!songReq) {
                return res.status(404).json({ success: false, error: 'Request not found' });
            }
            if (songReq.status !== 'QUEUED') {
                return res.status(400).json({ success: false, error: 'Request is no longer in queue' });
            }

            // Transfer tip from escrow to restaurant (stub — restaurant ledger integration is Phase 2)
            if (songReq.tipInEscrow && songReq.tipAmount > 0) {
                await User.updateOne(
                    { _id: songReq.userId },
                    { $inc: { 'wallet.escrowBalance': -songReq.tipAmount } },
                    { session }
                );
                // TODO Phase 2: credit restaurant wallet
            }

            songReq.status = 'PLAYING';
            songReq.resolvedAt = new Date();
            songReq.tipInEscrow = false;
            await songReq.save({ session });

            return res.json({ success: true, message: 'Song accepted — now playing', data: { requestId: id } });
        });
    } catch (error) {
        return next(error);
    } finally {
        session.endSession();
    }
});

/**
 * PATCH /api/v1/entertainment/:restaurantId/request/:id/reject
 * Refunds escrowed tip to the requesting user's wallet.
 */
router.patch('/:restaurantId/request/:id/reject', internalAuth, async (req: Request, res: Response, next: NextFunction) => {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const { id } = req.params;
            const { rejectReason } = req.body;
            const songReq = await SongRequest.findById(id).session(session);
            if (!songReq) {
                return res.status(404).json({ success: false, error: 'Request not found' });
            }
            if (songReq.status !== 'QUEUED') {
                return res.status(400).json({ success: false, error: 'Request already resolved' });
            }

            // Refund escrow → wallet
            if (songReq.tipInEscrow && songReq.tipAmount > 0) {
                await User.updateOne(
                    { _id: songReq.userId },
                    {
                        $inc: {
                            'wallet.balance': songReq.tipAmount,
                            'wallet.escrowBalance': -songReq.tipAmount,
                        },
                    },
                    { session }
                );
            }

            songReq.status = 'REJECTED';
            songReq.resolvedAt = new Date();
            songReq.tipInEscrow = false;
            songReq.rejectReason = rejectReason || 'Not available';
            await songReq.save({ session });

            return res.json({ success: true, message: 'Song rejected — tip refunded', data: { requestId: id } });
        });
    } catch (error) {
        return next(error);
    } finally {
        session.endSession();
    }
});

export default router;
