import type { NextRequest } from 'next/server';
import { handlers } from '@/lib/server/auth';
import { authMode } from '@/lib/server/config';

// Auth.js endpoints (sign-in, callbacks, session, sign-out). They exist only in accounts mode.
const notFound = () => new Response(null, { status: 404 });

export const GET = (req: NextRequest) => (authMode() === 'accounts' ? handlers.GET(req) : notFound());
export const POST = (req: NextRequest) => (authMode() === 'accounts' ? handlers.POST(req) : notFound());
