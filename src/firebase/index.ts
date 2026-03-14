'use client';

// Re-export hooks and providers for easy access from other parts of the app.
export * from './provider';

// This file is now primarily for re-exporting.
// The actual initialization is handled in provider.tsx
// to ensure it runs only on the client-side and only once.
