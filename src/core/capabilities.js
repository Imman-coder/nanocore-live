// Plain-language explanation of why a device connection may not work.
export function connectionHint({ secure, midi, bluetooth }) {
  if (!secure) return 'MIDI APIs need HTTPS or localhost. Open this app over HTTPS on your phone.';
  if (!midi && bluetooth) return 'Web MIDI is unavailable here. Choose Direct Bluetooth in the menu, then press Connect.';
  if (!midi) return 'This browser has no Web MIDI. Use Chrome on Android, or switch to a supported browser.';
  if (!bluetooth) return 'Web MIDI is available. Direct Bluetooth is not supported here.';
  return 'Web MIDI and Direct Bluetooth are available.';
}
