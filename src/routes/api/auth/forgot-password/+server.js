import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import prisma from '$lib/prisma.js';
import crypto from 'crypto';
import { deliverPasswordReset } from '$lib/server/email.js';

export async function POST({ request, url }) {
  try {
    const data = await request.json();
    const { email } = data;
    
    if (typeof email !== 'string' || !email.trim() || email.length > 320) {
      throw error(400, 'Email is required');
    }
    
    // Check if user exists
    const user = await db.users.getByEmail(email.trim());
    
    // Don't reveal if email exists or not for security
    // Always return success message
    if (user) {
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now
      
      // Update user with reset token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: resetToken,
          resetPasswordExpires: resetExpires
        }
      });
      
      await deliverPasswordReset({
        email: user.email,
        firstName: user.firstName,
        token: resetToken,
        origin: url.origin
      });
    }
    
    // Always return success message (security best practice)
    return json({
      message: 'If an account with that email exists, a password reset link has been sent. Please check your email.'
    });
    
  } catch (err) {
    // Do not expose tokens, recipients, or whether an account exists.
    console.error('Password reset request failed', { status: err.status || 500 });
    if (err.status === 400) {
      throw err;
    }
    // Still return success message even on error (security best practice)
    return json({
      message: 'If an account with that email exists, a password reset link has been sent. Please check your email.'
    });
  }
}

