// SpreedlyACHFields options and methods. They apply to the mounted fields without a remount.

const hfPanel = {
  masked: true, // the account field mounts masked
  submitting: false,
  validRouting: false,
  validAccount: false,
  remounting: false,
  events: [],
};

const HF_CUSTOM_STYLES = { color: '#1d4ed8', fontWeight: '600' };
const HF_EVENT_LOG_SIZE = 6;

const hfChecked = id => document.getElementById(id).checked;

// Match the secure fields to the page's own inputs.
function hfBaseStyles() {
  const pageInput = getComputedStyle(document.getElementById('ach-bank-name'));
  return {
    fontFamily: pageInput.fontFamily,
    fontSize: pageInput.fontSize,
    color: pageInput.color,
    fontWeight: pageInput.fontWeight,
  };
}

function hfBasePlaceholderColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-gray-400').trim();
}

function applyHfStyles() {
  const custom = hfChecked('hf-custom-styles');
  const styles = { ...hfBaseStyles(), ...(custom ? HF_CUSTOM_STYLES : {}) };
  ach.setStyles('routing', styles);
  // Room for the Show/Hide button.
  ach.setStyles('account', { ...styles, paddingRight: '64px' });
  // setStyles can't reach ::placeholder. opacity 1 makes Firefox show the exact color.
  ach.setPlaceholderStyles({
    color: custom ? HF_CUSTOM_STYLES.color : hfBasePlaceholderColor(),
    opacity: '1',
  });
}

function applyHfPlaceholders() {
  ach.setPlaceholder('routing', document.getElementById('hf-routing-placeholder').value);
  ach.setPlaceholder('account', document.getElementById('hf-account-placeholder').value);
}

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

// The SDK doesn't disable your submit button. This page keeps it disabled until the names are
// filled and fieldStateChange reports both secure fields valid.
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

// `ready` fires on the first mount and again after reload() or a remount.
function onHfReady() {
  updateHfIsLoaded();
  hfPanel.masked = true;
  syncHfMaskControls();
  applyHfPlaceholders();
  applyHfStyles();
  updateHfSubmitEnabled();
}

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

// `validation` fires after validate() and when the SDK blocks a submit.
function onHfValidation(snapshot) {
  document.getElementById('hf-last-validation').textContent = JSON.stringify(snapshot, null, 2);
  markHfInvalid(HF_SECURE_CONTAINERS.routing, !snapshot.validRouting);
  markHfInvalid(HF_SECURE_CONTAINERS.account, !snapshot.validAccount);
}

function clearHfFieldState() {
  hfPanel.validRouting = false;
  hfPanel.validAccount = false;
  hfPanel.submitting = false;
  document
    .querySelectorAll('.hosted-field.focused, .ach-form .invalid')
    .forEach(field => field.classList.remove('focused', 'invalid'));
  elements.submitBtn().disabled = true; // until the new fields are ready
}

// reload() keeps the instance and its callbacks, and mounts new iframes.
function reloadHfFields() {
  clearHfFieldState();
  ach.reload();
  updateHfIsLoaded();
}

// removeHandlers() drops every on() callback. Only a new instance brings them back.
function removeHfHandlers() {
  ach.removeHandlers();
  document.getElementById('hf-handlers-removed').classList.remove('hidden');
}

// Ignore clicks while remounting, or two instances would mount into the same containers.
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
    updateHfIsLoaded();
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
    updateHfIsLoaded();
  });
  on('hf-reload', 'click', reloadHfFields);
  on('hf-remount', 'click', remountHfFields);
  on('hf-remove-handlers', 'click', removeHfHandlers);
}
