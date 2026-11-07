/**
 * Utility functions for masking and unmasking strings.
 */

/**
 * Formats a string to the Brazilian phone format: (##) #####-####
 * @param value String containing digits
 * @returns Formatted phone number
 */
export const formatPhoneBR = (value: string): string => {
  if (!value) return "";
  
  // Remove all non-digits
  const digits = value.replace(/\D/g, "");
  
  // Limit to 11 digits
  const limited = digits.slice(0, 11);
  
  // Apply mask
  if (limited.length <= 2) {
    return limited.length > 0 ? `(${limited}` : "";
  }
  if (limited.length <= 7) {
    return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
  }
  return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
};

/**
 * Removes all non-digit characters from a string.
 * @param value String to unmask
 * @returns String containing only digits
 */
export const unmaskPhone = (value: string): string => {
  return value.replace(/\D/g, "");
};
