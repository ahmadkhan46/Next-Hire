import validator from 'validator';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export interface EnrichedData {
  email?: {
    value: string;
    isValid: boolean;
    domain: string;
    isDisposable: boolean;
  };
  phone?: {
    value: string;
    isValid: boolean;
    normalized: string;
    country?: string;
    type?: string;
  };
  name?: {
    firstName: string;
    lastName: string;
    fullName: string;
  };
  confidence: number;
}

// Validate and enrich email
export function enrichEmail(email: string): EnrichedData['email'] {
  if (!email) return undefined;

  const trimmed = email.trim().toLowerCase();
  const isValid = validator.isEmail(trimmed);
  const domain = trimmed.split('@')[1] || '';

  // Common disposable email domains
  const disposableDomains = [
    'tempmail.com',
    'guerrillamail.com',
    '10minutemail.com',
    'throwaway.email',
    'mailinator.com',
  ];

  return {
    value: trimmed,
    isValid,
    domain,
    isDisposable: disposableDomains.includes(domain),
  };
}

// Validate and normalize phone
export function enrichPhone(phone: string, defaultCountry: string = 'US'): EnrichedData['phone'] {
  if (!phone) return undefined;

  try {
    const isValid = isValidPhoneNumber(phone, defaultCountry as any);

    if (isValid) {
      const parsed = parsePhoneNumber(phone, defaultCountry as any);
      return {
        value: phone,
        isValid: true,
        normalized: parsed.formatInternational(),
        country: parsed.country,
        type: parsed.getType(),
      };
    }

    return {
      value: phone,
      isValid: false,
      normalized: phone.replace(/\D/g, ''),
    };
  } catch {
    return {
      value: phone,
      isValid: false,
      normalized: phone.replace(/\D/g, ''),
    };
  }
}

// Parse and enrich name
export function enrichName(fullName: string): EnrichedData['name'] {
  if (!fullName) return undefined;

  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: '',
      fullName: trimmed,
    };
  }

  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');

  return {
    firstName,
    lastName,
    fullName: trimmed,
  };
}

// Enrich candidate data
export function enrichCandidateData(candidate: {
  fullName: string;
  email?: string;
  phone?: string;
}): EnrichedData {
  const email = candidate.email ? enrichEmail(candidate.email) : undefined;
  const phone = candidate.phone ? enrichPhone(candidate.phone) : undefined;
  const name = enrichName(candidate.fullName);

  // Calculate confidence score
  let confidence = 0;
  if (name) confidence += 0.3;
  if (email?.isValid) confidence += 0.35;
  if (phone?.isValid) confidence += 0.35;

  return {
    email,
    phone,
    name,
    confidence,
  };
}

// Validate candidate data quality
export function validateCandidateQuality(candidate: {
  fullName: string;
  email?: string;
  phone?: string;
}): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  // Name validation
  if (!candidate.fullName || candidate.fullName.length < 2) {
    errors.push('Name is too short');
    score -= 30;
  }

  if (candidate.fullName && candidate.fullName.length > 100) {
    warnings.push('Name is unusually long');
    score -= 5;
  }

  // Email validation
  if (candidate.email) {
    const emailData = enrichEmail(candidate.email);
    if (!emailData?.isValid) {
      errors.push('Invalid email format');
      score -= 25;
    }
    if (emailData?.isDisposable) {
      warnings.push('Disposable email detected');
      score -= 10;
    }
  } else {
    warnings.push('No email provided');
    score -= 15;
  }

  // Phone validation
  if (candidate.phone) {
    const phoneData = enrichPhone(candidate.phone);
    if (!phoneData?.isValid) {
      warnings.push('Invalid phone format');
      score -= 10;
    }
  } else {
    warnings.push('No phone provided');
    score -= 10;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score: Math.max(0, score),
  };
}
