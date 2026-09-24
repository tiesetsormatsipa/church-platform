import { inject } from 'vitest';

// Point the application at this run's database before any module reads the environment.
process.env.DATABASE_URL = inject('databaseUrl');
