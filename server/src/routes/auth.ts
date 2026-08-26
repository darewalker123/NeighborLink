import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute, ApiError, ok } from '../utils/api.js';
import { hashToken, signAccessToken, signRefreshToken, tokensMatch, verifyRefreshToken } from '../utils/auth.js';
import { loginSchema, registerSchema } from '../validators/index.js';

const router = Router();
const publicUser = { id: true, fullName: true, email: true, phone: true, role: true, neighborhood: true, city: true, avatarUrl: true, status: true, providerProfile: { select: { id: true, verificationStatus: true, averageRating: true } } } as const;
const sendSession = async (user: { id: string; role: Role; email: string }, res: any, message: string) => {
  const payload = { id: user.id, role: user.role, email: user.email };
  const accessToken = signAccessToken(payload); const refreshToken = signRefreshToken(payload);
  await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: await hashToken(refreshToken) } });
  res.cookie('neighborlink_refresh', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000, path: '/api/auth' });
  return ok(res, { accessToken, user: await prisma.user.findUnique({ where: { id: user.id }, select: publicUser }) }, message);
};
router.post('/register', asyncRoute(async (req, res) => {
  const body = registerSchema.parse(req.body); const { password, ...registration } = body; const email = registration.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw new ApiError(409, 'An account with this email already exists.', 'EMAIL_TAKEN');
  const user = await prisma.user.create({ data: { ...registration, email, passwordHash: await bcrypt.hash(password, 12) } });
  return sendSession(user, res, 'Welcome to NeighborLink! Your account is ready.');
}));
router.post('/login', asyncRoute(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body); const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new ApiError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS');
  if (user.status === 'SUSPENDED') throw new ApiError(403, 'This account has been suspended. Contact support.', 'ACCOUNT_SUSPENDED');
  return sendSession(user, res, `Welcome back, ${user.fullName.split(' ')[0]}!`);
}));
router.post('/refresh', asyncRoute(async (req, res) => {
  const token = req.cookies?.neighborlink_refresh; if (!token) throw new ApiError(401, 'Refresh session not found.', 'UNAUTHENTICATED');
  const payload = verifyRefreshToken(token); const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user || !(await tokensMatch(token, user.refreshTokenHash))) throw new ApiError(401, 'Session is no longer valid.', 'INVALID_TOKEN');
  return sendSession(user, res, 'Session refreshed.');
}));
router.post('/logout', requireAuth, asyncRoute(async (req, res) => { await prisma.user.update({ where: { id: req.auth!.id }, data: { refreshTokenHash: null } }); res.clearCookie('neighborlink_refresh', { path: '/api/auth' }); return ok(res, null, 'You have been signed out.'); }));
router.get('/me', requireAuth, asyncRoute(async (req, res) => ok(res, await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.id }, select: publicUser }))));
router.post('/forgot-password', asyncRoute(async (_req, res) => ok(res, null, 'If an account exists, password reset instructions have been queued.')));
router.post('/reset-password', asyncRoute(async (_req, res) => ok(res, null, 'Password reset flow is ready to be connected to your email provider.')));
export default router;
