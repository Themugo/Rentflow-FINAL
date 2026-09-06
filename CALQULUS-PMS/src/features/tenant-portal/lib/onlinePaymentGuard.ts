/**
 * Financial actions must never appear successful while the device is offline.
 * Call this before initiating STK / card / transfer payments.
 */
export function canInitiateOnlinePayment(isOnline: boolean = navigator.onLine): {
  allowed: boolean;
  message: string | null;
} {
  if (isOnline) {
    return { allowed: true, message: null };
  }
  return {
    allowed: false,
    message: 'Connect to the internet to pay. This payment was not sent.',
  };
}
