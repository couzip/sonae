import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSerial(scnNumber: number, date = new Date()): string {
  const iso = date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const padded = String(scnNumber).padStart(2, '0');
  return `SONAE / SCN-${padded} / ${iso}`;
}
