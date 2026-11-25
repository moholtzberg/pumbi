import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export default {
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL
  }
};

