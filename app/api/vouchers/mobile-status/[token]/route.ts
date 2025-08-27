import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import crypto from 'crypto';

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Session store (in production, use database)
const sessionStore = new Map<string, { ip: string; userAgent: string; createdAt: number }>();

// Rate limiter function
function checkRateLimit(token: string): boolean {
  const now = Date.now();
  const limit = rateLimitStore.get(token);
  
  if (!limit || limit.resetAt < now) {
    rateLimitStore.set(token, { count: 1, resetAt: now + 60000 }); // 1 minute window
    return true;
  }
  
  if (limit.count >= 30) { // 30 requests per minute
    return false;
  }
  
  limit.count++;
  return true;
}

// Generate ETag from voucher data
function generateETag(voucher: any): string {
  const data = `${voucher.status}-${voucher.version || 0}-${voucher.used_at || ''}`;
  return crypto.createHash('md5').update(data).digest('hex');
}

// Create or validate session
function validateSession(token: string, ip: string, userAgent: string, sessionId?: string): string | null {
  if (sessionId) {
    const session = sessionStore.get(sessionId);
    if (session) {
      // Check for suspicious activity (different IP or UA)
      if (session.ip !== ip || session.userAgent !== userAgent) {
        console.warn('Suspicious session access:', { token, sessionId, ip, userAgent });
        return null;
      }
      return sessionId;
    }
  }
  
  // Create new session
  const newSessionId = crypto.randomUUID();
  sessionStore.set(newSessionId, { ip, userAgent, createdAt: Date.now() });
  return newSessionId;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    
    // Extract client info
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const sessionId = request.headers.get('x-session-id') || undefined;
    const ifNoneMatch = request.headers.get('if-none-match');
    
    // Rate limiting
    if (!checkRateLimit(token)) {
      return new NextResponse('Too Many Requests', { 
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(Date.now() + 60000).toISOString()
        }
      });
    }
    
    // Session validation
    const validSessionId = validateSession(token, ip, userAgent, sessionId);
    if (!validSessionId && sessionId) {
      // Session validation failed
      return new NextResponse('Unauthorized', { status: 401 });
    }
    
    // Database query
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Get voucher with mobile link token
    const { data: voucher, error } = await supabase
      .from('vouchers')
      .select('id, status, version, used_at, usage_location, mobile_link_token, link_expires_at')
      .eq('mobile_link_token', token)
      .single();
    
    if (error || !voucher) {
      // Log suspicious 404s
      console.warn('Mobile voucher not found:', { token, ip, userAgent });
      return new NextResponse('Not Found', { status: 404 });
    }
    
    // Check token expiration
    if (voucher.link_expires_at && new Date(voucher.link_expires_at) < new Date()) {
      return new NextResponse('Token Expired', { status: 410 });
    }
    
    // Generate ETag
    const etag = generateETag(voucher);
    
    // Check if content hasn't changed
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { 
        status: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Session-ID': validSessionId
        }
      });
    }
    
    // Prepare minimal response
    const response = {
      status: voucher.status,
      status_changed: false,
      timestamp: new Date().toISOString()
    };
    
    // Only include additional info if status is 'used'
    if (voucher.status === 'used') {
      response.status_changed = true;
      Object.assign(response, {
        used_at: voucher.used_at,
        usage_location: voucher.usage_location
      });
    }
    
    // Security headers
    const headers = new Headers({
      'Content-Type': 'application/json',
      'ETag': etag,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-Session-ID': validSessionId,
      'Content-Security-Policy': "default-src 'self'",
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    
    // Log access for monitoring
    await supabase
      .from('mobile_voucher_access_logs')
      .insert({
        token,
        ip_address: ip,
        user_agent: userAgent,
        session_id: validSessionId,
        status_checked: voucher.status,
        accessed_at: new Date().toISOString()
      })
      .select()
      .single()
      .catch(err => console.error('Failed to log access:', err));
    
    return NextResponse.json(response, { headers });
    
  } catch (error) {
    console.error('Mobile status check error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}