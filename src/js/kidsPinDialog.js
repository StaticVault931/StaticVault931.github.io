let activeDialog = null;

const esc = value => String(value || '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function closeDialog(result = null) {
  if (!activeDialog) return;
  const { overlay, previousFocus, resolve } = activeDialog;
  activeDialog = null;
  overlay.remove();
  previousFocus?.focus?.();
  resolve(result);
}

function mountDialog({ title, description, body, submitLabel = 'Continue', icon = 'lock' }) {
  if (activeDialog) closeDialog(null);
  const previousFocus = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'kids-pin-overlay';
  overlay.setAttribute('role', 'presentation');
  overlay.innerHTML = `
    <form class="kids-pin-dialog" role="dialog" aria-modal="true" aria-labelledby="kids-pin-title" aria-describedby="kids-pin-description">
      <div class="kids-pin-heading">
        <span class="material-icons-round" aria-hidden="true">${esc(icon)}</span>
        <div><h2 id="kids-pin-title">${esc(title)}</h2><p id="kids-pin-description">${esc(description)}</p></div>
        <button type="button" class="kids-pin-close" aria-label="Cancel"><span class="material-icons-round">close</span></button>
      </div>
      <div class="kids-pin-body">${body}</div>
      <p class="kids-pin-error" role="alert" aria-live="assertive"></p>
      <div class="kids-pin-actions">
        <button type="button" class="kids-pin-cancel">Cancel</button>
        <button type="submit" class="kids-pin-submit">${esc(submitLabel)}</button>
      </div>
    </form>`;
  document.body.appendChild(overlay);
  const form = overlay.querySelector('form');
  const promise = new Promise(resolve => { activeDialog = { overlay, previousFocus, resolve }; });
  const cancel = () => closeDialog(null);
  overlay.addEventListener('pointerdown', event => { if (event.target === overlay) cancel(); });
  overlay.querySelector('.kids-pin-close').addEventListener('click', cancel);
  overlay.querySelector('.kids-pin-cancel').addEventListener('click', cancel);
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); cancel(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...overlay.querySelectorAll('button,input,[tabindex]:not([tabindex="-1"])')]
      .filter(element => !element.disabled);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  requestAnimationFrame(() => overlay.querySelector('input,button')?.focus());
  return { overlay, form, promise, setError(message) { overlay.querySelector('.kids-pin-error').textContent = message || ''; } };
}

export function requestPinUnlock(reason = 'continue') {
  const dialog = mountDialog({
    title: 'Kid-Guided protection',
    description: `Enter this profile's PIN or recovery code to ${reason}.`,
    submitLabel: 'Unlock',
    body: `<label class="kids-pin-field"><span>PIN or recovery code</span><input name="secret" type="password" inputmode="text" autocomplete="one-time-code" required aria-describedby="kids-pin-device-note"></label>
      <p class="kids-pin-note" id="kids-pin-device-note">This is device-level protection. Your secret never leaves this browser.</p>`,
  });
  dialog.form.addEventListener('submit', event => {
    event.preventDefault();
    const value = new FormData(dialog.form).get('secret')?.toString().trim();
    if (!value) { dialog.setError('Enter a PIN or recovery code.'); return; }
    closeDialog(value);
  });
  return dialog.promise;
}

export function requestNewPin() {
  const dialog = mountDialog({
    title: 'Create a Kid-Guided PIN',
    description: 'Use 4 to 8 digits. This protects profile controls on this device only.',
    submitLabel: 'Create PIN',
    icon: 'enhanced_encryption',
    body: `<div class="kids-pin-grid">
        <label class="kids-pin-field"><span>New PIN</span><input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" minlength="4" maxlength="8" autocomplete="new-password" required></label>
        <label class="kids-pin-field"><span>Confirm PIN</span><input name="confirm" type="password" inputmode="numeric" pattern="[0-9]{4,8}" minlength="4" maxlength="8" autocomplete="new-password" required></label>
      </div>
      <p class="kids-pin-note">If both the PIN and recovery code are lost, recovery requires clearing this site's local data or restoring a backup.</p>`,
  });
  dialog.form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(dialog.form);
    const pin = data.get('pin')?.toString().trim() || '';
    const confirmation = data.get('confirm')?.toString().trim() || '';
    if (!/^\d{4,8}$/.test(pin)) { dialog.setError('PIN must contain 4 to 8 digits.'); return; }
    if (pin !== confirmation) { dialog.setError('The PINs do not match.'); return; }
    closeDialog(pin);
  });
  return dialog.promise;
}

export function showRecoveryCode(code) {
  const dialog = mountDialog({
    title: 'Save your recovery code',
    description: 'This code is shown once. Keep it somewhere private before continuing.',
    submitLabel: 'I saved it',
    icon: 'key',
    body: `<output class="kids-pin-recovery" aria-label="Recovery code">${esc(code)}</output>
      <label class="kids-pin-confirm"><input type="checkbox" name="saved"> <span>I saved this recovery code somewhere private.</span></label>`,
  });
  dialog.form.addEventListener('submit', event => {
    event.preventDefault();
    if (!dialog.form.elements.saved.checked) { dialog.setError('Confirm that you saved the recovery code.'); return; }
    closeDialog(true);
  });
  return dialog.promise;
}
