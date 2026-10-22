/**
 * ACH Payments Flow — Hosted Fields mode: SDK Configuration panel (SpreedlyACHFields).
 *
 * Hosted fields have runtime methods, so every option applies straight away — no remount:
 * placeholders (setPlaceholder), custom styles (setStyles + setPlaceholderStyles), mask
 * (toggleMask, kept in sync with the field's Show/Hide button), validate(),
 * transferFocus(), resetFields(), reload(), destroy() + remount, removeHandlers(), an isLoaded()
 * status line and a fieldStateChange log.
 *
 * Uses `ach`, `elements` and `createAchInstanceAndMountFields` from ach-payments.js.
 */

const hfPanel = {
  masked: true, // the account field mounts masked
  submitting: false,
  validRouting: false,
  validAccount: false,
  remounting: false,
  events: [],
};

/** "Custom field styles": a visible sample on top of the page-matching style. */
const HF_CUSTOM_STYLES = { color: '#1d4ed8', fontWeight: '600' };
const HF_EVENT_LOG_SIZE = 6;

const hfChecked = id => document.getElementById(id).checked;

/** The page's own input style, so the secure fields match the other inputs. */
function hfBaseStyles() {
  const pageInput = getComputedStyle(document.getElementById('ach-bank-name'));
  return {
    fontFamily: pageInput.fontFamily,
    fontSize: pageInput.fontSize,
    color: pageInput.color,
    fontWeight: pageInput.fontWeight,
  };
}

/** The page inputs' placeholder gray (`.form-input::placeholder` in shared/styles.css). */
function hfBasePlaceholderColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-gray-400').trim();
}

function applyHfStyles() {
  const custom = hfChecked('hf-custom-styles');
  // Turning custom styles off re-applies the base color/weight, which overrides the sample.
  const styles = { ...hfBaseStyles(), ...(custom ? HF_CUSTOM_STYLES : {}) };
  ach.setStyles('routing', styles);
  // Leave room on the right for the Show/Hide button.
  ach.setStyles('account', { ...styles, paddingRight: '64px' });
  // Placeholder text is a ::placeholder rule, which setStyles can't reach. opacity 1 so
  // Firefox shows the exact color.
  ach.setPlaceholderStyles({
    color: custom ? HF_CUSTOM_STYLES.color : hfBasePlaceholderColor(),
    opacity: '1',
  });
}

function applyHfPlaceholders() {
  ach.setPlaceholder('routing', document.getElementById('hf-routing-placeholder').value);
  ach.setPlaceholder('account', document.getElementById('hf-account-placeholder').value);
}

/** Show/Hide button label and the "Mask account number" checkbox follow the same state. */
function syncHfMaskControls() {
  const button = elements.toggleAccountVisibility();
  if (button) button.textContent = hfPanel.masked ? 'Show' : 'Hide';
  document.getElementById('hf-masked').checked = hfPanel.masked;
}

function setHfMasked(masked) {
  if (masked !== hfPanel.masked) {
    ach.toggleMask();
    hfPanel.masked = masked;
  }
  syncHfMaskControls();
}

const hfFilled = id => document.getElementById(id).value.trim() !== '';

const HF_REQUIRED_INPUTS = ['ach-first-name', 'ach-last-name'];
const HF_SECURE_CONTAINERS = { routing: 'ach-routing-field', account: 'ach-account-field' };

const markHfInvalid = (id, invalid) =>
  document.getElementById(id).classList.toggle('invalid', invalid);

function validateHfForm() {
  HF_REQUIRED_INPUTS.forEach(id => markHfInvalid(id, !hfFilled(id)));
  ach.validate();
}

function clearHfInvalidWhenReady() {
  HF_REQUIRED_INPUTS.forEach(id => hfFilled(id) && markHfInvalid(id, false));
  if (hfPanel.validRouting) markHfInvalid(HF_SECURE_CONTAINERS.routing, false);
  if (hfPanel.validAccount) markHfInvalid(HF_SECURE_CONTAINERS.account, false);
}

/**
 * Submit stays disabled while submitting, and until the first and last name are filled and
 * `fieldStateChange` reports both secure fields valid. This is page code — the SDK doesn't gate.
 */
function updateHfSubmitEnabled() {
  const ready =
    hfFilled('ach-first-name') &&
    hfFilled('ach-last-name') &&
    hfPanel.validRouting &&
    hfPanel.validAccount;
  elements.submitBtn().disabled = hfPanel.submitting || !ready;
}

function updateHfIsLoaded() {
  document.getElementById('hf-is-loaded').textContent = String(ach.isLoaded());
}

/** Called on every `ready` (first mount and after a remount). */
function onHfReady() {
  updateHfIsLoaded();
  hfPanel.masked = true; // a fresh instance always starts masked
  syncHfMaskControls();
  applyHfPlaceholders();
  applyHfStyles();
  updateHfSubmitEnabled();
}

/** Called on every `fieldStateChange` — lengths and validity only, never the values. */
function onHfFieldState({ field, action, focused, validRouting, validAccount }) {
  hfPanel.validRouting = validRouting;
  hfPanel.validAccount = validAccount;
  hfPanel.events.unshift({ field, action, focused, validRouting, validAccount });
  hfPanel.events.length = Math.min(hfPanel.events.length, HF_EVENT_LOG_SIZE);
  document.getElementById('hf-event-log').textContent = hfPanel.events
    .map(event => JSON.stringify(event))
    .join('\n');
  updateHfSubmitEnabled();
  clearHfInvalidWhenReady();
}

/** Called on `validation`: after Validate, or when the SDK blocks a submit. */
function onHfValidation(snapshot) {
  document.getElementById('hf-last-validation').textContent = JSON.stringify(snapshot, null, 2);
  markHfInvalid(HF_SECURE_CONTAINERS.routing, !snapshot.validRouting);
  markHfInvalid(HF_SECURE_CONTAINERS.account, !snapshot.validAccount);
}

/** New iframes start empty: forget the old field state until the new ones report in. */
function clearHfFieldState() {
  hfPanel.validRouting = false;
  hfPanel.validAccount = false;
  hfPanel.submitting = false;
  document
    .querySelectorAll('.hosted-field.focused, .ach-form .invalid')
    .forEach(field => field.classList.remove('focused', 'invalid'));
  elements.submitBtn().disabled = true; // until the new fields are ready
}

/** reload(): same instance and callbacks, new iframes. `ready` re-applies the panel settings. */
function reloadHfFields() {
  clearHfFieldState();
  ach.reload();
  updateHfIsLoaded(); // true again straight away: the new iframes are already in the page
}

/**
 * removeHandlers(): every on() callback is gone, so this page stops hearing from the fields
 * (no ready, fieldStateChange or tokenGenerated). A new instance (Destroy & remount) brings
 * them back; reload() would not, since it keeps this instance with no callbacks.
 */
function removeHfHandlers() {
  ach.removeHandlers();
  document.getElementById('hf-handlers-removed').classList.remove('hidden');
}

/**
 * Destroy & remount waits on the auth call before creating the new instance. Clicks during
 * that wait are ignored: otherwise each one would create its own instance, and both would
 * mount iframes into the same containers.
 */
async function remountHfFields() {
  if (hfPanel.remounting) return;
  hfPanel.remounting = true;
  const button = document.getElementById('hf-remount');
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Remounting…';
  document.getElementById('hf-handlers-removed').classList.add('hidden');
  try {
    ach.destroy();
    updateHfIsLoaded(); // false until the new instance mounts (it waits on the auth call)
    clearHfFieldState();
    await createAchInstanceAndMountFields();
    updateHfIsLoaded();
  } catch (error) {
    console.error('Remount failed:', error);
    showError(`Couldn't remount the fields: ${error?.message || error}`);
  } finally {
    hfPanel.remounting = false;
    button.disabled = false;
    button.textContent = label;
  }
}

function setupFieldsPanel() {
  const on = (id, event, handler) => document.getElementById(id).addEventListener(event, handler);
  // Text inputs apply on `change` (blur / Enter), not on every keystroke.
  on('hf-routing-placeholder', 'change', applyHfPlaceholders);
  on('hf-account-placeholder', 'change', applyHfPlaceholders);
  on('hf-custom-styles', 'change', applyHfStyles);
  on('hf-masked', 'change', event => setHfMasked(event.target.checked));
  HF_REQUIRED_INPUTS.forEach(id =>
    on(id, 'input', () => {
      updateHfSubmitEnabled();
      clearHfInvalidWhenReady();
    })
  );
  on('hf-validate', 'click', validateHfForm);
  on('hf-focus-routing', 'click', () => ach.transferFocus('routing'));
  on('hf-focus-account', 'click', () => ach.transferFocus('account'));
  on('hf-reset', 'click', () => {
    ach.resetFields();
    ['routing', 'account'].forEach(field => markHfInvalid(HF_SECURE_CONTAINERS[field], false));
    updateHfIsLoaded(); // still true: reset clears the values, the fields stay mounted
  });
  on('hf-reload', 'click', reloadHfFields);
  on('hf-remount', 'click', remountHfFields);
  on('hf-remove-handlers', 'click', removeHfHandlers);
}
