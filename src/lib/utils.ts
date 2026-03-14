import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO, isValid, isBefore, addDays, addMonths } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "₹0.00";
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "N/A";
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return "Invalid Date";
  return format(d, "dd MMM yyyy");
}

export function isExpiringSoon(dateString: string | null | undefined, days: number = 90): boolean {
  if (!dateString) return false;
  try {
    const expiryDate = parseISO(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thresholdDate = addDays(today, days);
    return isBefore(expiryDate, thresholdDate) && !isBefore(expiryDate, today);
  } catch (e) {
    return false;
  }
}

export async function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (document.querySelector(`script[src="${src}"]`)) return resolve(true);
    
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export { addDays, isBefore, parseISO, isValid, addMonths };