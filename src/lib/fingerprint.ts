import { createHash } from 'crypto';

export function generateFingerprint(data: {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: Date | string | null;
}): string | null {
  const nameParts = data.fullName.trim().toLowerCase().split(/\s+/);
  if (nameParts.length < 2) return null; // Need at least first + last name
  
  const firstName = nameParts[0].replace(/[^a-z]/g, '');
  const lastName = nameParts[nameParts.length - 1].replace(/[^a-z]/g, '');
  
  const email = data.email?.toLowerCase().trim() || '';
  const phone = data.phone?.replace(/\D/g, '') || '';
  const dob = data.dateOfBirth 
    ? (data.dateOfBirth instanceof Date 
        ? data.dateOfBirth.toISOString().split('T')[0] 
        : new Date(data.dateOfBirth).toISOString().split('T')[0])
    : '';
  
  // Must have at least email OR phone
  if (!email && !phone) return null;
  
  const parts = [firstName, lastName, email || phone, dob].filter(Boolean);
  const combined = parts.join('|');
  
  return createHash('sha256').update(combined).digest('hex').slice(0, 16);
}
