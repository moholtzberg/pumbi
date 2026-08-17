import { SvelteKitAuth } from "@auth/sveltekit";
import { ZodError } from "zod";
import Credentials from "@auth/sveltekit/providers/credentials";
import { signInSchema } from "$lib/zod";
import { db } from "$lib/db.js";
import { comparePassword } from "$lib/utils/password.js";
import { recordLoginSecurityEvent } from "$lib/server/loginSecurity.js";

async function getUserFromDB(email, password) {
  // Get user from local database
  const user = await db.users.getByEmail(email);
  
  if (!user) {
    throw new Error("Invalid credentials.");
  }
  
  // Check if user has a password set
  if (!user.password) {
    throw new Error("Password not set. Please set your password first or use password reset.");
  }
  
  // Verify password
  const isValidPassword = await comparePassword(password, user.password);
  if (!isValidPassword) {
    throw new Error("Invalid credentials.");
  }
  
  // Return user data
  return {
    id: user.id,
    email: user.email,
    name: user.name || user.email.split('@')[0],
    first_name: user.firstName || null,
    last_name: user.lastName || null,
    role: user.role || 'BUYER'
  };
}

const providers = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "text", placeholder: "Email" },
      password: { label: "Password", type: "password", placeholder: "Password" },
    },
    authorize: async (credentials, request) => {
      const attemptedEmail = typeof credentials?.email === 'string' ? credentials.email : null;
      try {
        const { email, password } = await signInSchema.parseAsync(credentials);

        const user = await getUserFromDB(email, password);
        if (!user || !user.email) {
          throw new Error("Invalid credentials.");
        }

        const userData = {
          id: user.id,
          email: user.email,
          name: user.name || user.email.split('@')[0],
          first_name: user.first_name || null,
          last_name: user.last_name || null,
          role: user.role || 'BUYER'
        };

        await recordLoginSecurityEvent({
          request,
          userId: user.id,
          attemptedEmail: user.email,
          outcome: 'SUCCESS'
        });

        return userData;

      } catch (error) {
        await recordLoginSecurityEvent({ request, attemptedEmail, outcome: 'FAILURE' });
        if (error instanceof ZodError) {
          return null;
        }
        console.error("Error in authorize:", error);
        return null;
      }
    },
  }),
];

export const { handle, signIn, signOut } = SvelteKitAuth({
  providers,
  session: {
    strategy: "jwt",
    // set the maxAge max of 30 minutes
    maxAge: 1800
  },
  pages: {
    signIn: "/auth/login",
  },
  trustHost: true,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.first_name = user.first_name;
        token.last_name = user.last_name;
        token.role = user.role;
      }
      
      return token;
    },
    async session({ session, token }) {      
      if (token) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.first_name = token.first_name;
        session.user.last_name = token.last_name;
        session.user.role = token.role;
        
        // Default session expiry
        session.maxAge = 1800; // 30 minutes
        session.expires = new Date(Date.now() + 1800 * 1000).toISOString();
      }
      
      return session;
    },
  },    
});
