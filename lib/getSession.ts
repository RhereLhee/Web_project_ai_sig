// lib/getSession.ts
// Re-export for backward compatibility

export { getCurrentUser } from './jwt'
export { 
  getUserWithSubscription, 
  hasActivePartner,
  hasActiveSubscription,
  hasSignalAccess,
  requireAuth,
  requireAdmin,
  requirePartner,
  requireSignalAccess,
  type UserWithSub 
} from './auth'