/**
 * Safely creates a Date object in the local timezone from date and time strings.
 * This avoids the common issue where 'YYYY-MM-DDTHH:mm' is interpreted as UTC in some environments.
 * 
 * @param dateStr Format: 'YYYY-MM-DD'
 * @param timeStr Format: 'HH:mm'
 * @returns Date object in local time
 */
export const createLocalDate = (dateStr: string, timeStr: string): Date => {
  if (!dateStr || !timeStr) return new Date();
  
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  
  // Using the constructor with individual components always uses local time
  return new Date(year, month - 1, day, hour, minute);
};
