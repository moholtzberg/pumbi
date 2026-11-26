import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import { User } from '$lib/models/index.js';
import { countryCode, normalizeRegionalPhone, normalizeLocale } from '$lib/utils/region.js';
import { hashPassword } from '$lib/utils/password.js';

export async function POST({ request, locals }) {
  try {
    const data = await request.json();
    const { email, password, firstName, lastName, phone, address, requestVerification } = data;
    
    if (!email) {
      throw error(400, 'Email is required');
    }
    
    if (!password) {
      throw error(400, 'Password is required for new registrations');
    }
    
    const country = countryCode(data.country || 'US');
    if (!country) throw error(400, 'Choose a two-letter country code');
    let normalizedPhone;
    try { normalizedPhone = normalizeRegionalPhone(phone, country); } catch (err) { throw error(400, err.message); }
    // Check if user already exists
    const existingUser = await db.users.getByEmail(email);
    if (existingUser) {
      throw error(400, 'User with this email already exists');
    }
    
    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Create user profile
    const userData = {
      email,
      password: hashedPassword,
      firstName: firstName || null,
      lastName: lastName || null,
      name: firstName && lastName ? `${firstName} ${lastName}`.trim() : firstName || lastName || email,
      phone: normalizedPhone,
      country,
      preferredLocale: normalizeLocale(data.preferredLocale || locals?.locale),
      address: address || null,
      isVerifiedBuyer: false, // Will be set to true after verification
      isVerifiedBidder: false, // Will be set to true after verification
      role: 'BUYER'
    };
    
    const user = await User.create(userData);
    
    // If verification was requested, we could send a notification here
    // For now, we just store the request in the user record
    
    return json({
      message: 'User profile created successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerifiedBuyer: user.isVerifiedBuyer,
        isVerifiedBidder: user.isVerifiedBidder,
        requestVerification
      }
    }, { status: 201 });
  } catch (err) {
    console.error('Error creating user profile:', err);
    if (err.status) {
      throw err;
    }
    throw error(500, err.message || 'Failed to create user profile');
  }
}

