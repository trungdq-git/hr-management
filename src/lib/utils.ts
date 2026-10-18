import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export const number = (value: number, digits = 2) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value);
export const date = (value: Date | string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC' }).format(new Date(value));
