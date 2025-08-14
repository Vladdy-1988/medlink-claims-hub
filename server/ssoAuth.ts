import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { storage } from './storage';
import { z } from 'zod';

const ssoTokenSchema = z.object({
  token: z.string(),
  next: z.string().optional(),
});

const ssoJwtPayloadSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  name: z.string(),
  orgId: z.string(),
  role: z.string(),
  exp: z.number(),
});

interface SSOJwtPayload {
  sub: string;
  email: string;
  name: string;
  orgId: string;
  role: string;
  exp: number;
}

function isAllowedOrigin(origin: string): boolean {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  
  return allowedOrigins.some(allowedOrigin => {
    // Exact match
    if (allowedOrigin === origin) {
      return true;
    }
    
    // Wildcard subdomain match (e.g., *.replit.dev)
    if (allowedOrigin.startsWith('*.')) {
      const domain = allowedOrigin.slice(2);
      return origin.endsWith(`.${domain}`) || origin === domain;
    }
    
    return false;
  });
}

export async function handleSSOLogin(req: Request, res: Response) {
  try {
    // Validate request body
    const { token, next } = ssoTokenSchema.parse(req.body);
    
    // Check SSO secret is configured
    const ssoSecret = process.env.SSO_SHARED_SECRET;
    if (!ssoSecret) {
      return res.status(500).json({ 
        ok: false, 
        error: 'SSO not configured' 
      });
    }

    // Verify and decode JWT
    let payload: SSOJwtPayload;
    try {
      payload = jwt.verify(token, ssoSecret, { algorithms: ['HS256'] }) as SSOJwtPayload;
      ssoJwtPayloadSchema.parse(payload);
    } catch (error) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Invalid token' 
      });
    }

    // Check token expiration
    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Token expired' 
      });
    }

    // Upsert organization
    let organization = await storage.getOrganizationById(payload.orgId);
    if (!organization) {
      organization = await storage.createOrganization({
        name: `Organization ${payload.orgId}`, // Default name, can be updated later
      });
    }

    // Upsert user
    const [firstName, ...lastNameParts] = payload.name.split(' ');
    const lastName = lastNameParts.join(' ') || '';

    let user = await storage.getUserByEmail(payload.email);
    if (!user) {
      user = await storage.createUser({
        email: payload.email,
        firstName,
        lastName,
        role: payload.role,
        orgId: organization.id,
      });
    } else {
      // Update existing user with latest info
      const updatedUser = await storage.updateUser(user.id, {
        firstName,
        lastName,
        role: payload.role,
        orgId: organization.id,
      });
      if (updatedUser) {
        user = updatedUser;
      }
    }

    if (!user) {
      return res.status(500).json({ 
        ok: false, 
        error: 'User creation failed' 
      });
    }

    // Create audit event for SSO login
    await storage.createAuditEvent({
      orgId: organization.id,
      actorUserId: user.id,
      type: 'sso_login',
      details: {
        email: payload.email,
        role: payload.role,
        source: 'marketplace'
      },
      ip: req.ip || '',
      userAgent: req.get('User-Agent') || '',
    });

    // Create session (similar to Replit Auth)
    const sessionUser = {
      claims: {
        sub: user.id,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        profile_image_url: user.profileImageUrl,
      },
      expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    };

    // Store user in session
    (req as any).login(sessionUser, (err: any) => {
      if (err) {
        console.error('Session login error:', err);
        return res.status(500).json({ 
          ok: false, 
          error: 'Session creation failed' 
        });
      }

      res.json({ 
        ok: true, 
        redirect: next || '/' 
      });
    });

  } catch (error) {
    console.error('SSO login error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Internal server error' 
    });
  }
}

export function configureCORS() {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  
  return {
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      // Allow localhost and replit domains for development
      if (origin.includes('localhost') || origin.includes('replit.dev') || origin.includes('replit.app')) {
        return callback(null, true);
      }
      
      // Check configured allowed origins
      if (allowedOrigins.length > 0 && isAllowedOrigin(origin)) {
        callback(null, true);
      } else if (allowedOrigins.length === 0) {
        // If no origins configured, allow all for development
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}