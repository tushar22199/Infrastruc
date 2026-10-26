process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.GROQ_API_KEY = "test-groq-api-key";
process.env.GEMINI_API_KEY = "test-gemini-api-key";
process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/infrasight_test";