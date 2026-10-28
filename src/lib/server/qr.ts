import 'server-only';
import QRCode from 'qrcode';

/**
 * The QR code for an otpauth:// link, as a grid of dark modules the page draws as SVG (no image, so the Content
 * Security Policy needs nothing new). Medium error correction, like most authenticator setups.
 */
export function qrModules(text: string): boolean[][] {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  return Array.from({ length: modules.size }, (_, y) => Array.from({ length: modules.size }, (_, x) => !!modules.get(y, x)));
}
