/**
 * Tokenize Flow - Creates a payment method token from card details
 * Supports both Hosted Fields and Express Checkout SDKs
 */

// State
let sdk = null;
let isReady = false;
let sdkType = null; // Set after determining SDK type
let storedAuthParams = null; // Store auth params for deferred initialization

// Configuration state (only used for Hosted Fields)
const config = {
  allowBlankName: false,
  allowExpiredDate: false,
  allowBlankDate: false,
  twoDigitExpiryYear: false,
  eligibleForCardUpdater: false,
  showCardTypeIcon: true,
  ecExtraFields: [],
  ecExtraFieldsRequired: false,
  hostedCatalogueFields: [],
  hostedCatalogueRequired: false,
  hostedSubmitButton: false,
};

/**
 * The composable catalogue fields `inAppElements` can mount, in the order they are rendered. The
 * payment form is built from the merchant's selection: alongside the mandatory number and cvv
 * fields it shows exactly the ticked fields and nothing else, each as its own Spreedly-hosted
 * iframe whose value is read from inside that iframe at `submit()`. `wide` fields span both
 * columns of the form grid.
 */
const HOSTED_FIELD_CATALOGUE = Object.freeze([
  { type: 'expiry', label: 'Expiration date', group: 'Expiration date' },
  { type: 'month', label: 'Expiration month', group: 'Expiration date' },
  { type: 'year', label: 'Expiration year', group: 'Expiration date' },
  { type: 'first_name', label: 'First name', group: 'Cardholder' },
  { type: 'last_name', label: 'Last name', group: 'Cardholder' },
  { type: 'full_name', label: 'Name on card', group: 'Cardholder', wide: true },
  { type: 'email', label: 'Email', group: 'Cardholder', wide: true },
  { type: 'company', label: 'Company', group: 'Cardholder', wide: true },
  { type: 'address1', label: 'Address line 1', group: 'Billing address', wide: true },
  { type: 'address2', label: 'Address line 2', group: 'Billing address', wide: true },
  { type: 'city', label: 'City', group: 'Billing address' },
  { type: 'state', label: 'State', group: 'Billing address' },
  { type: 'zip', label: 'ZIP / Postal code', group: 'Billing address' },
  { type: 'country', label: 'Country', group: 'Billing address' },
  { type: 'phone_number', label: 'Phone', group: 'Billing address', wide: true },
  { type: 'house_number_or_name', label: 'House number or name', group: 'Billing address' },
  { type: 'street', label: 'Street', group: 'Billing address', wide: true },
  { type: 'street_line2', label: 'Street line 2', group: 'Billing address', wide: true },
  { type: 'phone_number_country_code', label: 'Phone country code', group: 'Billing address' },
  { type: 'phone_number_area_code', label: 'Phone area code', group: 'Billing address' },
  { type: 'shipping_address1', label: 'Address line 1', group: 'Shipping address', wide: true },
  { type: 'shipping_address2', label: 'Address line 2', group: 'Shipping address', wide: true },
  { type: 'shipping_city', label: 'City', group: 'Shipping address' },
  { type: 'shipping_state', label: 'State', group: 'Shipping address' },
  { type: 'shipping_zip', label: 'ZIP / Postal code', group: 'Shipping address' },
  { type: 'shipping_country', label: 'Country', group: 'Shipping address' },
  { type: 'shipping_phone_number', label: 'Phone', group: 'Shipping address', wide: true },
  { type: 'shipping_house_number_or_name', label: 'House number or name', group: 'Shipping address' },
  { type: 'shipping_street', label: 'Street', group: 'Shipping address', wide: true },
  { type: 'shipping_street_line2', label: 'Street line 2', group: 'Shipping address', wide: true },
  { type: 'shipping_phone_number_country_code', label: 'Phone country code', group: 'Shipping address' },
  { type: 'shipping_phone_number_area_code', label: 'Phone area code', group: 'Shipping address' },
]);

/** Catalogue field types actually mounted by the current `inAppElements` call. */
let mountedCatalogueFields = [];

/** Styles pushed into each catalogue iframe's input so it matches the demo's plain inputs. */
const HOSTED_INPUT_STYLE = {
  fontSize: '1rem',
  color: '#0a0a0a',
  padding: '0 1rem',
  height: '100%',
  width: '100%',
};

const EC_EXTRA_FIELD_KEYS = Object.freeze([
  'full_name',
  'email',
  'company',
  'phone_number',
  'address1',
  'address2',
  'city',
  'state',
  'zip',
  'country',
  'house_number_or_name',
  'street',
  'street_line2',
  'phone_number_country_code',
  'phone_number_area_code',
  'shipping_address1',
  'shipping_address2',
  'shipping_city',
  'shipping_state',
  'shipping_zip',
  'shipping_country',
  'shipping_phone_number',
  'shipping_house_number_or_name',
  'shipping_street',
  'shipping_street_line2',
  'shipping_phone_number_country_code',
  'shipping_phone_number_area_code',
]);

/** SDK instance that already has `validation` / `fieldStateChange` listeners registered. */
let hostedFieldsSdkDemoEventHandlersWiredFor = null;

/** SDK instance that already has SDK Configuration panel controls wired. */
let hostedFieldsConfigPanelWiredFor = null;

/** Tracks mask visibility state for the demo checkbox. */
let hostedFieldsMaskEnabled = false;

/** Tracks browser autocomplete state for the demo checkbox. */
let hostedFieldsAutocompleteEnabled = false;

const HOSTED_FIELDS_PLACEHOLDER_STYLES = {
  default: { color: '#9ca3af', fontWeight: '400', opacity: '1' },
  styled: { color: 'red', fontWeight: '400', opacity: '1' },
};

// DOM Elements
const elements = {
  sdkBadge: () => document.getElementById('sdk-badge'),
  loadingState: () => document.getElementById('loading-state'),
  hostedFieldsOpenSection: () => document.getElementById('hosted-fields-open-section'),
  hostedFieldsForm: () => document.getElementById('hosted-fields-form'),
  openHostedFieldsBtn: () => document.getElementById('open-hosted-fields-btn'),
  expressCheckoutOpenSection: () => document.getElementById('express-checkout-open-section'),
  expressCheckoutForm: () => document.getElementById('express-checkout-form'),
  openPaymentFormBtn: () => document.getElementById('open-payment-form-btn'),
  configPanel: () => document.getElementById('config-panel'),
  paymentForm: () => document.getElementById('payment-form'),
  submitBtn: () => document.getElementById('submit-btn'),
  statusMessage: () => document.getElementById('status-message'),
  resultSection: () => document.getElementById('result-section'),
  resultCard: () => document.getElementById('result-card'),
  resultIcon: () => document.getElementById('result-icon'),
  resultIconSuccess: () => document.getElementById('result-icon-success'),
  resultIconError: () => document.getElementById('result-icon-error'),
  resultTitle: () => document.getElementById('result-title'),
  resultDetails: () => document.getElementById('result-details'),
};

// Initialization
async function init() {
  // DEBUG: capture the SDK's window message listener so we can call it directly.
  window.__capturedMessageListeners = [];
  const __origAdd = window.addEventListener.bind(window);
  window.addEventListener = function (type, listener, opts) {
    if (type === 'message') {
      window.__capturedMessageListeners.push({ listener, opts });
    }
    return __origAdd(type, listener, opts);
  };

  sdkType = SpreedlyUtils.getSDKType();

  elements.sdkBadge().textContent = SpreedlyUtils.getSDKDisplayName();

  updateConfigPanelForSdkType();

  // Build the catalogue checkboxes before wiring listeners — they are generated from
  // HOSTED_FIELD_CATALOGUE rather than hand-written into the page.
  renderHostedCatalogueCheckboxes();
  updateHostedCatalogueSummary();

  // Set up config checkbox listeners on page load (so they work before SDK is ready)
  setupConfigCheckboxListeners();

  try {
    await loadAndInitializeSDK();
  } catch (error) {
    console.error('Failed to initialize:', error);
    showError('Failed to initialize SDK. Please refresh the page.');
  }
}

/** Shows hosted-fields config/debug or express-checkout display mode based on SDK type. */
function updateConfigPanelForSdkType() {
  const displayModeConfig = document.getElementById('config-display-mode');
  const hostedFieldsOnlyPanel = document.getElementById('hosted-fields-only-panel');
  const expressCheckoutOnlyPanel = document.getElementById('express-checkout-only-panel');

  if (sdkType === 'express-checkout') {
    displayModeConfig?.classList.remove('hidden');
    hostedFieldsOnlyPanel?.classList.add('hidden');
    expressCheckoutOnlyPanel?.classList.remove('hidden');
    return;
  }

  displayModeConfig?.classList.add('hidden');
  hostedFieldsOnlyPanel?.classList.remove('hidden');
  expressCheckoutOnlyPanel?.classList.add('hidden');
}

// Set up config checkbox listeners (called on page load)
function setupConfigCheckboxListeners() {
  // Express Checkout renders its own expiry input; Hosted Fields gets a combined MM/YY input by
  // mounting the `expiry` catalogue field instead.
  document.getElementById('config-two-digit-expiry')?.addEventListener('change', function () {
    config.twoDigitExpiryYear = this.checked;
  });

  // The allow_* flags are read at submit(), so they can be toggled while the form is open.
  document.getElementById('config-allow-blank-name')?.addEventListener('change', function () {
    config.allowBlankName = this.checked;
  });

  document.getElementById('config-allow-blank-date')?.addEventListener('change', function () {
    config.allowBlankDate = this.checked;
  });

  document.getElementById('config-allow-expired-date')?.addEventListener('change', function () {
    config.allowExpiredDate = this.checked;
  });

  document.getElementById('config-eligible-for-card-updater')?.addEventListener('change', function () {
    config.eligibleForCardUpdater = this.checked;
  });

  // Express Checkout: card-type badge is a launch-time uiConfig flag.
  document.getElementById('ec-demo-card-type-icon')?.addEventListener('change', function () {
    config.showCardTypeIcon = this.checked;
  });

  document.querySelectorAll('input[data-ec-field]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      syncEcExtraFieldsFromCheckboxes();
    });
  });

  // Hosted catalogue fields are mounted by inAppElements, so the selection is only read when the
  // form is opened — the summary keeps the current choice visible until then.
  document.querySelectorAll('input[data-hosted-field]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      enforceExpiryCheckboxExclusivity();
      syncHostedCatalogueFromCheckboxes();
      updateHostedCatalogueSummary();
    });
  });

  document.getElementById('hf-catalogue-required')?.addEventListener('change', function () {
    config.hostedCatalogueRequired = this.checked;
  });

  // Express Checkout twin of the Hosted Fields toggle above — same `isRequired` flag name.
  document.getElementById('ec-fields-required')?.addEventListener('change', function () {
    config.ecExtraFieldsRequired = this.checked;
  });

  document.getElementById('hf-catalogue-select-all')?.addEventListener('click', () => {
    setAllHostedCatalogueCheckboxes(true);
  });

  document.getElementById('hf-catalogue-clear')?.addEventListener('click', () => {
    setAllHostedCatalogueCheckboxes(false);
  });
}

/** Ticks or clears every catalogue checkbox at once (`month`/`year` lose to the combined expiry). */
function setAllHostedCatalogueCheckboxes(checked) {
  document.querySelectorAll('input[data-hosted-field]').forEach((checkbox) => {
    const type = checkbox.dataset.hostedField;
    checkbox.checked = checked && type !== 'month' && type !== 'year';
  });
  enforceExpiryCheckboxExclusivity();
  syncHostedCatalogueFromCheckboxes();
  updateHostedCatalogueSummary();
}

/**
 * Mirrors the SDK's expiry exclusivity in the panel: the combined `expiry` field and the separate
 * `month` / `year` fields own the same params, so ticking `expiry` disables the other two.
 */
function enforceExpiryCheckboxExclusivity() {
  const combinedChecked = document.getElementById('hf-catalogue-expiry')?.checked || false;
  ['month', 'year'].forEach((type) => {
    const checkbox = document.getElementById(`hf-catalogue-${type}`);
    if (!checkbox) return;
    checkbox.disabled = combinedChecked;
    if (combinedChecked) checkbox.checked = false;
  });
}

/**
 * Reads which of the legacy `setParam` parity fields are ticked in the Express
 * Checkout config panel. Each ticked entry corresponds to a key on
 * `uiConfig.cardPaymentFormFields`; the iframe will render an input for that field.
 */
function syncEcExtraFieldsFromCheckboxes() {
  config.ecExtraFields = EC_EXTRA_FIELD_KEYS.filter(
    (key) => document.getElementById(`ec-field-${key}`)?.checked
  );
  config.ecExtraFieldsRequired = document.getElementById('ec-fields-required')?.checked || false;
}

/**
 * Default labels/placeholders for the legacy `setParam` parity fields, used to build
 * `uiConfig.cardPaymentFormFields` entries when the merchant ticks a field in the
 * Express Checkout config panel. Mirrors the SDK's own DEFAULT_LABELS / DEFAULT_PLACEHOLDERS.
 */
const EC_EXTRA_FIELD_DEFAULTS = Object.freeze({
  full_name:               { label: 'Full Name',           placeholder: 'Joe Jones' },
  email:                   { label: 'Email',               placeholder: 'joe@example.com' },
  company:                 { label: 'Company',             placeholder: 'Acme Inc' },
  phone_number:            { label: 'Phone',               placeholder: '5551234567' },
  address1:                { label: 'Address 1',           placeholder: '123 Main St' },
  address2:                { label: 'Address 2',           placeholder: 'Apt 4' },
  city:                    { label: 'City',                placeholder: 'New York' },
  state:                   { label: 'State',               placeholder: 'NY' },
  zip:                     { label: 'Zip',                 placeholder: '10001' },
  country:                 { label: 'Country',             placeholder: 'US' },
  house_number_or_name:    { label: 'House Number or Name', placeholder: '123' },
  street:                  { label: 'Street',              placeholder: 'Main St' },
  street_line2:            { label: 'Street Line 2',       placeholder: 'Apt 1' },
  phone_number_country_code: { label: 'Phone Country Code', placeholder: '1' },
  phone_number_area_code:  { label: 'Phone Area Code',     placeholder: '415' },
  shipping_address1:       { label: 'Shipping Address 1',  placeholder: '456 Park Ave' },
  shipping_address2:       { label: 'Shipping Address 2',  placeholder: 'Suite 9' },
  shipping_city:           { label: 'Shipping City',       placeholder: 'Boston' },
  shipping_state:          { label: 'Shipping State',      placeholder: 'MA' },
  shipping_zip:            { label: 'Shipping Zip',        placeholder: '02101' },
  shipping_country:        { label: 'Shipping Country',    placeholder: 'US' },
  shipping_phone_number:   { label: 'Shipping Phone',      placeholder: '5559876543' },
  shipping_house_number_or_name: { label: 'Shipping House Number or Name', placeholder: '123' },
  shipping_street:         { label: 'Shipping Street',     placeholder: 'Main St' },
  shipping_street_line2:   { label: 'Shipping Street Line 2', placeholder: 'Apt 1' },
  shipping_phone_number_country_code: { label: 'Shipping Phone Country Code', placeholder: '1' },
  shipping_phone_number_area_code: { label: 'Shipping Phone Area Code', placeholder: '415' },
});

/**
 * Builds `uiConfig.cardPaymentFormFields` entries for the ticked Express Checkout fields.
 * `isRequired` is the same flag Hosted Fields takes on `inAppElements()`: it gates every
 * additional field, including `full_name` (only `first_name` / `last_name` and the date fields
 * are required by default in either product).
 */
function buildEcExtraFieldsConfig(fieldKeys) {
  const out = {};
  fieldKeys.forEach((fieldName) => {
    const defaults = EC_EXTRA_FIELD_DEFAULTS[fieldName];
    if (!defaults) return;
    out[fieldName] = {
      fieldName,
      isRequired: config.ecExtraFieldsRequired,
      label: defaults.label,
      placeholder: defaults.placeholder,
      size: 6,
      isMasked: false,
      styles: {},
    };
  });
  return out;
}

function hostedCatalogueEntry(type) {
  return HOSTED_FIELD_CATALOGUE.find((entry) => entry.type === type);
}

/** Element id of the container a catalogue field's iframe is mounted into. */
function hostedCatalogueContainerId(type) {
  return `hosted-field-${type}`;
}

/** Element id of the inline error label under a catalogue field. */
function hostedCatalogueErrorId(type) {
  return `hosted-field-${type}-error`;
}

/** Renders one checkbox per catalogue field into the SDK Configuration panel, grouped by section. */
function renderHostedCatalogueCheckboxes() {
  const list = document.getElementById('hf-catalogue-field-list');
  if (!list) return;

  list.innerHTML = '';
  let currentGroup = null;
  let currentRow = null;

  HOSTED_FIELD_CATALOGUE.forEach((entry) => {
    if (entry.group !== currentGroup) {
      currentGroup = entry.group;
      const title = document.createElement('h4');
      title.className = 'hf-catalogue-group-title';
      title.textContent = currentGroup;
      list.appendChild(title);
      currentRow = null;
    }

    if (!currentRow || currentRow.childElementCount >= 2) {
      currentRow = document.createElement('div');
      currentRow.className = 'config-option-row';
      list.appendChild(currentRow);
    }

    const option = document.createElement('div');
    option.className = 'config-option';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'config-checkbox';
    checkbox.id = `hf-catalogue-${entry.type}`;
    checkbox.dataset.hostedField = entry.type;

    const content = document.createElement('div');
    content.className = 'config-option-content';
    const label = document.createElement('label');
    label.className = 'config-option-label';
    label.setAttribute('for', checkbox.id);
    const code = document.createElement('code');
    code.textContent = entry.type;
    label.appendChild(code);
    content.appendChild(label);

    option.append(checkbox, content);
    currentRow.appendChild(option);
  });
}

/** Reads the ticked catalogue checkboxes into `config.hostedCatalogueFields` (catalogue order). */
function syncHostedCatalogueFromCheckboxes() {
  config.hostedCatalogueFields = HOSTED_FIELD_CATALOGUE.filter(
    (entry) => document.getElementById(`hf-catalogue-${entry.type}`)?.checked
  ).map((entry) => entry.type);
  config.hostedCatalogueRequired =
    document.getElementById('hf-catalogue-required')?.checked || false;
}

/**
 * Applies the SDK's expiry exclusivity rule to the ticked selection: the combined `expiry` field
 * and the separate `month`/`year` fields own the same params, so `expiry` wins and the separate
 * fields are dropped (the SDK does the same, with a warning).
 */
function resolveHostedCatalogueSelection(selected) {
  if (!selected.includes('expiry')) return selected;
  return selected.filter((type) => type !== 'month' && type !== 'year');
}

/** Describes the current selection above the Open Payment Form button. */
function updateHostedCatalogueSummary() {
  const summary = document.getElementById('hosted-catalogue-summary');
  if (!summary) return;

  const selected = resolveHostedCatalogueSelection(config.hostedCatalogueFields);
  summary.textContent = selected.length
    ? `The form will show: number, cvv, ${selected.join(', ')}`
    : 'The form will show: number, cvv — tick fields in the SDK Configuration panel to add more.';
}

/**
 * Rebuilds the selected part of the payment form: a labelled container per selected catalogue
 * field, grouped under its section heading, for the hosted iframes to be appended into. Fields
 * arrive in catalogue order, so each group is contiguous.
 */
function renderHostedFieldContainers(types) {
  const host = document.getElementById('hosted-catalogue-fields');
  if (!host) return;

  host.innerHTML = '';
  host.classList.toggle('hidden', types.length === 0);
  if (!types.length) return;

  const grid = document.createElement('div');
  grid.className = 'hf-catalogue-grid';
  let currentGroup = null;

  types.forEach((type) => {
    const entry = hostedCatalogueEntry(type);
    if (!entry) return;

    if (entry.group !== currentGroup) {
      currentGroup = entry.group;
      const heading = document.createElement('div');
      heading.className = 'hf-catalogue-heading';
      heading.textContent = currentGroup;
      grid.appendChild(heading);
    }

    const group = document.createElement('div');
    group.className = entry.wide ? 'form-group hf-catalogue-wide' : 'form-group';

    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = `${entry.label} `;
    const badge = document.createElement('span');
    badge.className = 'hf-hosted-badge';
    badge.textContent = 'hosted';
    label.appendChild(badge);

    const container = document.createElement('div');
    container.className = 'hosted-field-container';
    container.id = hostedCatalogueContainerId(type);

    const errorEl = document.createElement('div');
    errorEl.id = hostedCatalogueErrorId(type);
    errorEl.className = 'hf-field-error';
    errorEl.setAttribute('role', 'alert');
    errorEl.setAttribute('aria-live', 'polite');

    group.append(label, container, errorEl);
    grid.appendChild(group);
  });

  host.appendChild(grid);
}

// Sync config state from checkbox values (called when SDK becomes ready)
function syncConfigFromCheckboxes() {
  config.twoDigitExpiryYear = document.getElementById('config-two-digit-expiry')?.checked || false;
  config.allowBlankName = document.getElementById('config-allow-blank-name')?.checked || false;
  config.allowBlankDate = document.getElementById('config-allow-blank-date')?.checked || false;
  config.allowExpiredDate = document.getElementById('config-allow-expired-date')?.checked || false;
  config.eligibleForCardUpdater = document.getElementById('config-eligible-for-card-updater')?.checked || false;
  const ecCardTypeIcon = document.getElementById('ec-demo-card-type-icon');
  config.showCardTypeIcon = ecCardTypeIcon ? ecCardTypeIcon.checked : true;
  syncEcExtraFieldsFromCheckboxes();
  syncHostedCatalogueFromCheckboxes();
  config.hostedSubmitButton = document.getElementById('hf-hosted-submit')?.checked || false;
}

/** Clears demo panel output and resets SDK Configuration controls to defaults. */
function clearHostedFieldsDemoPanelUi() {
  const autocomplete = document.getElementById('hf-demo-autocomplete');
  const iin = document.getElementById('hf-demo-include-iin');
  const maskVisible = document.getElementById('hf-demo-mask-visible');
  const numberFormat = document.getElementById('hf-demo-number-format');
  const pre = document.getElementById('hf-demo-last-validation');
  const stylePlaceholders = document.getElementById('hf-demo-style-placeholders');

  if (pre) pre.textContent = '—';
  if (iin) iin.checked = false;
  if (maskVisible) maskVisible.checked = false;
  if (autocomplete) autocomplete.checked = false;
  if (numberFormat) numberFormat.value = 'prettyFormat';
  if (stylePlaceholders) stylePlaceholders.checked = false;
  hostedFieldsMaskEnabled = false;
  hostedFieldsAutocompleteEnabled = false;
  clearHostedFieldsValidationErrors();
}

/** Clears number, CVV, and mounted catalogue-field inline error labels. */
function clearHostedFieldsValidationErrors() {
  setHostedFieldError('card-number-field', 'card-number-error', '');
  setHostedFieldError('cvv-field', 'cvv-error', '');
  mountedCatalogueFields.forEach((type) => {
    setHostedFieldError(hostedCatalogueContainerId(type), hostedCatalogueErrorId(type), '');
  });
}

/** Shows/clears an inline error label under a hosted field and flags the container. */
function setHostedFieldError(containerId, errorId, message) {
  const container = document.getElementById(containerId);
  const errorEl = document.getElementById(errorId);
  if (errorEl) {
    errorEl.textContent = message || '';
    errorEl.classList.toggle('visible', Boolean(message));
  }
  if (container) {
    container.classList.toggle('has-error', Boolean(message));
  }
}

/** Marks the number/cvv hosted fields with inline error labels from a `validation` payload. */
function updateHostedFieldsDemoLastValidation(payload) {
  let numberError = '';
  if (payload?.validNumber === false) {
    numberError = 'Card number is invalid';
  } else if (payload?.luhnValid === false) {
    numberError = 'Card number failed the Luhn check';
  }
  const cvvError = payload?.validCvv === false ? 'CVV is invalid' : '';

  setHostedFieldError('card-number-field', 'card-number-error', numberError);
  setHostedFieldError('cvv-field', 'cvv-error', cvvError);
  updateHostedCatalogueValidationErrors(payload?.formFields);

  const pre = document.getElementById('hf-demo-last-validation');
  if (!pre) return;
  pre.textContent = JSON.stringify(payload, null, 2);
}

/**
 * Applies `payload.formFields[<type>]` to each mounted catalogue field. Uses the SDK error
 * string when `valid` is false; clears the label when the field is valid or missing.
 */
function updateHostedCatalogueValidationErrors(formFields) {
  mountedCatalogueFields.forEach((type) => {
    const result = formFields?.[type];
    const message = result && result.valid === false ? result.error || 'Invalid' : '';
    setHostedFieldError(hostedCatalogueContainerId(type), hostedCatalogueErrorId(type), message);
  });
}

/** Writes the latest `consoleError` event payload as formatted JSON into the demo panel. */
function updateHostedFieldsDemoLastConsoleError(payload) {
  const pre = document.getElementById('hf-demo-last-console-error');
  if (!pre) return;
  pre.textContent = JSON.stringify(payload, null, 2);
}

/**
 * Registers `validation` / `fieldStateChange` / `consoleError` once per SDK instance and binds demo panel controls.
 */
function setupHostedFieldsSdkDemoPanel(sdkInstance) {
  const includeIin = document.getElementById('hf-demo-include-iin');
  const validateBtn = document.getElementById('hf-demo-validate-btn');

  if (hostedFieldsSdkDemoEventHandlersWiredFor !== sdkInstance) {
    hostedFieldsSdkDemoEventHandlersWiredFor = sdkInstance;
    sdkInstance.on('validation', updateHostedFieldsDemoLastValidation);
    sdkInstance.on('fieldStateChange', console.log);
    sdkInstance.on('consoleError', (payload) => {
      console.warn('Hosted Fields consoleError:', payload);
      updateHostedFieldsDemoLastConsoleError(payload);
    });
    sdkInstance.setFieldStateReporting({ includeIin: false });
    if (includeIin) {
      includeIin.checked = false;
    }
  }

  if (validateBtn) {
    validateBtn.onclick = function handleHostedFieldsDemoValidateClick() {
      if (!sdk || sdk !== sdkInstance) return;
      syncConfigFromCheckboxes();
      sdkInstance.validate({
        allow_blank_name: config.allowBlankName,
        allow_expired_date: config.allowExpiredDate,
        allow_blank_date: config.allowBlankDate,
      });
    };
  }

  if (includeIin) {
    includeIin.onchange = function handleHostedFieldsDemoIncludeIinChange() {
      if (!sdk || sdk !== sdkInstance) return;
      sdkInstance.setFieldStateReporting({ includeIin: this.checked });
    };
  }

  setupHostedFieldsConfigPanel(sdkInstance);
}

/** Configures hosted field display defaults when fields are ready. */
function configureHostedFieldsOnReady(sdkInstance) {
  sdkInstance.setTitle('number', 'Credit card number');
  sdkInstance.setTitle('cvv', 'Security code');
  sdkInstance.setStyles('cvv', HOSTED_INPUT_STYLE);
  sdkInstance.setPlaceholderStyles(HOSTED_FIELDS_PLACEHOLDER_STYLES.default);
  sdkInstance.setNumberFormat('prettyFormat');
  applyHostedCatalogueStyles(sdkInstance);
  // Respect the card-type-icon checkbox even if toggled before the form was opened.
  const cardTypeIcon = document.getElementById('hf-demo-card-type-icon');
  sdkInstance.setShowCardTypeIcon(cardTypeIcon ? cardTypeIcon.checked : true);
}

/**
 * Catalogue iframes render an unstyled input, so push the demo's styles in to match the plain
 * inputs. `ready` tracks the number/cvv handshake and field messages are not queued, so a
 * catalogue frame still loading at that point would drop the message — re-apply once it loads.
 */
function applyHostedCatalogueStyles(sdkInstance) {
  mountedCatalogueFields.forEach((type) => {
    if (type === 'full_name') return;
    sdkInstance.setStyles(type, HOSTED_INPUT_STYLE);
    const iframe = document.querySelector(`#${hostedCatalogueContainerId(type)} iframe`);
    iframe?.addEventListener(
      'load',
      () => sdkInstance.setStyles(type, HOSTED_INPUT_STYLE),
      { once: true }
    );
  });
}

/** Wires SDK Configuration panel controls to hosted fields SDK methods. */
function setupHostedFieldsConfigPanel(sdkInstance) {
  if (hostedFieldsConfigPanelWiredFor === sdkInstance) {
    return;
  }
  hostedFieldsConfigPanelWiredFor = sdkInstance;

  const autocompleteCheckbox = document.getElementById('hf-demo-autocomplete');
  const destroyBtn = document.getElementById('hf-demo-destroy');
  const maskVisibleCheckbox = document.getElementById('hf-demo-mask-visible');
  const numberFormat = document.getElementById('hf-demo-number-format');
  const removeHandlersBtn = document.getElementById('hf-demo-remove-handlers');
  const stylePlaceholders = document.getElementById('hf-demo-style-placeholders');

  if (numberFormat) {
    numberFormat.onchange = function handleHostedFieldsNumberFormatChange() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      sdkInstance.setNumberFormat(this.value);
    };
  }

  if (maskVisibleCheckbox) {
    maskVisibleCheckbox.onchange = function handleHostedFieldsMaskVisibleChange() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      if (this.checked === hostedFieldsMaskEnabled) return;
      sdkInstance.toggleMask();
      hostedFieldsMaskEnabled = this.checked;
    };
  }

  if (stylePlaceholders) {
    stylePlaceholders.onchange = function handleHostedFieldsStylePlaceholdersChange() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      const styles = this.checked
        ? HOSTED_FIELDS_PLACEHOLDER_STYLES.styled
        : HOSTED_FIELDS_PLACEHOLDER_STYLES.default;
      sdkInstance.setPlaceholderStyles(styles);
    };
  }

  if (autocompleteCheckbox) {
    autocompleteCheckbox.onchange = function handleHostedFieldsAutocompleteChange() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      if (this.checked === hostedFieldsAutocompleteEnabled) return;
      sdkInstance.toggleAutoComplete();
      hostedFieldsAutocompleteEnabled = this.checked;
    };
  }

  if (removeHandlersBtn) {
    removeHandlersBtn.onclick = function handleHostedFieldsRemoveHandlersClick() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      sdkInstance.removeHandlers();
      showStatus(
        'Event handlers removed. Use Tokenize Another Card or Destroy SDK to start a new session.',
        'info',
      );
    };
  }

  if (destroyBtn) {
    destroyBtn.onclick = function handleHostedFieldsDestroyClick() {
      if (!sdk || sdk !== sdkInstance) return;
      destroyHostedFieldsInstance();
      elements.hostedFieldsForm().classList.add('hidden');
      elements.hostedFieldsOpenSection().classList.remove('hidden');
      hideStatus();
      showGlobalStatus('SDK destroyed. Open the payment form again to continue.', 'info');
    };
  }

  const inputModeSelect = document.getElementById('hf-demo-input-mode');
  if (inputModeSelect) {
    inputModeSelect.onchange = function handleHostedFieldsInputModeChange() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      const value = this.value;
      if (!value) return;
      sdkInstance.setInputMode('number', value);
      sdkInstance.setInputMode('cvv', value);
    };
  }

  const requiredCheckbox = document.getElementById('hf-demo-required');
  if (requiredCheckbox) {
    requiredCheckbox.onchange = function handleHostedFieldsRequiredChange() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      sdkInstance.setRequiredAttribute('number', this.checked);
      sdkInstance.setRequiredAttribute('cvv', this.checked);
    };
  }

  const cardTypeIconCheckbox = document.getElementById('hf-demo-card-type-icon');
  if (cardTypeIconCheckbox) {
    cardTypeIconCheckbox.onchange = function handleHostedFieldsCardTypeIconChange() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      sdkInstance.setShowCardTypeIcon(this.checked);
    };
  }

  const resetFieldsBtn = document.getElementById('hf-demo-reset-fields');
  if (resetFieldsBtn) {
    resetFieldsBtn.onclick = function handleHostedFieldsResetFieldsClick() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      sdkInstance.resetFields();
      clearHostedFieldsValidationErrors();
      showStatus('Fields reset.', 'info');
    };
  }

  const reloadBtn = document.getElementById('hf-demo-reload');
  if (reloadBtn) {
    reloadBtn.onclick = function handleHostedFieldsReloadClick() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      sdkInstance.reload();
      showStatus('Reloading hosted field iframes…', 'info');
    };
  }

  const focusIframeBtn = document.getElementById('hf-demo-focus-iframe');
  if (focusIframeBtn) {
    focusIframeBtn.onclick = function handleHostedFieldsFocusIframeClick() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      sdkInstance.transferFocus('iframe');
    };
  }

  const isLoadedBtn = document.getElementById('hf-demo-is-loaded');
  const isLoadedResult = document.getElementById('hf-demo-is-loaded-result');
  if (isLoadedBtn && isLoadedResult) {
    isLoadedBtn.onclick = function handleHostedFieldsIsLoadedClick() {
      // Probe the SDK instance this panel was wired against — even after destroy.
      // (We intentionally do NOT short-circuit on `sdk` being null, so merchants can see
      // isLoaded() flip to false post-destroy.)
      if (!sdkInstance || typeof sdkInstance.isLoaded !== 'function') {
        isLoadedResult.textContent = 'isLoaded() → SDK instance unavailable';
        return;
      }
      const loaded = Boolean(sdkInstance.isLoaded());
      isLoadedResult.textContent = `isLoaded() → ${loaded}`;
    };
  }
}

/** Registers core hosted fields SDK event handlers on a new instance. */
function registerHostedFieldsSdkHandlers(sdkInstance) {
  sdkInstance.on('close', (payload) => {
    console.log('SDK closed:', payload);
  });

  sdkInstance.on('ready', () => {
    isReady = true;

    sdkInstance.setLabel('number', 'Card Number');
    sdkInstance.setLabel('cvv', 'CVV');
    configureHostedFieldsOnReady(sdkInstance);

    const numberFormatSelect = document.getElementById('hf-demo-number-format');
    if (numberFormatSelect) numberFormatSelect.value = 'prettyFormat';

    setupHostedFieldsSdkDemoPanel(sdkInstance);
    setupHostedFieldsEventListeners();
    // Nothing on this form is validated by the page — the hosted fields gate tokenization.
    elements.submitBtn().disabled = false;
    hideStatus();
    SpreedlyUtils.setButtonLoading('open-hosted-fields-btn', false);
    elements.hostedFieldsOpenSection().classList.add('hidden');
    elements.hostedFieldsForm().classList.remove('hidden');
    console.log('Hosted fields ready');
  });

  sdkInstance.on('tokenGenerated', (response) => {
    console.log('Token generated:', response);
    if (config.hostedSubmitButton) {
      sdkInstance.setDisable('submit', false);
      sdkInstance.setText('submit', 'Pay');
    }
    handleTokenSuccess({
      ...response,
      shouldRetain: document.getElementById('retain-payment-method')?.checked || false,
    });
  });

  sdkInstance.on('error', (error) => {
    console.error('SDK error:', error);
    if (config.hostedSubmitButton) {
      sdkInstance.setDisable('submit', false);
      sdkInstance.setText('submit', 'Pay');
    }
    SpreedlyUtils.setButtonLoading('open-hosted-fields-btn', false);
    handleTokenError(error);
  });
}

/** Creates a SpreedlyHostedFields instance and registers its event handlers. */
function createHostedFieldsSdk(authParams) {
  const sdkInstance = new SpreedlyHostedFields({
    certificate_token: authParams.certificateToken,
    environment_key: authParams.environmentKey,
    nonce: authParams.nonce,
    signature: authParams.signature,
    timestamp: authParams.timestamp,
  });

  hostedFieldsConfigPanelWiredFor = null;
  hostedFieldsSdkDemoEventHandlersWiredFor = null;
  registerHostedFieldsSdkHandlers(sdkInstance);

  return sdkInstance;
}

/** Removes handlers, destroys the SDK instance, and resets demo UI state. */
function destroyHostedFieldsInstance() {
  if (!sdk) {
    return;
  }

  sdk.removeHandlers();
  sdk.destroy();
  sdk = null;
  isReady = false;
  hostedFieldsConfigPanelWiredFor = null;
  hostedFieldsSdkDemoEventHandlersWiredFor = null;
  clearHostedFieldsDemoPanelUi();

  // The catalogue iframes are gone with the instance — drop their containers so the next
  // Open Payment Form rebuilds the form from the current selection.
  mountedCatalogueFields = [];
  renderHostedFieldContainers([]);
}

async function loadAndInitializeSDK() {


  await new Promise((resolve, reject) => {
    SpreedlyUtils.loadSDKScript((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const authParams = await SpreedlyUtils.fetchAuthParams();

  if (sdkType === 'express-checkout') {
    await initializeExpressCheckout(authParams);
  } else {
    await initializeHostedFields(authParams);
  }
}

// Hosted Fields Initialization
async function initializeHostedFields(authParams) {
  storedAuthParams = authParams;
  sdk = createHostedFieldsSdk(authParams);

  hideLoading();
  elements.hostedFieldsOpenSection().classList.remove('hidden');
  console.log('Hosted Fields SDK initialized, waiting for user to open form');
}

// Open Hosted Fields Form (called when button is clicked)
window.openHostedFieldsForm = function () {
  hideStatus();

  if (!storedAuthParams) {
    showError('SDK not initialized. Please refresh the page.');
    return;
  }

  if (!sdk) {
    sdk = createHostedFieldsSdk(storedAuthParams);
  }

  syncConfigFromCheckboxes();
  mountedCatalogueFields = resolveHostedCatalogueSelection(config.hostedCatalogueFields);

  // Containers must exist in the DOM before inAppElements runs or the field is skipped.
  renderHostedFieldContainers(mountedCatalogueFields);

  const merchantSubmit = document.getElementById('submit-btn');
  const hostedSubmit = document.getElementById('hosted-submit-button-field');
  if (config.hostedSubmitButton) {
    merchantSubmit?.classList.add('hidden');
    hostedSubmit?.classList.remove('hidden');
  } else {
    merchantSubmit?.classList.remove('hidden');
    hostedSubmit?.classList.add('hidden');
  }

  SpreedlyUtils.setButtonLoading('open-hosted-fields-btn', true, 'Loading...');

  const inAppElementsConfig = buildHostedFieldsElementsConfig();
  console.log('inAppElementsConfig', inAppElementsConfig);

  if (config.hostedSubmitButton) {
    sdk.on('submitClick', (formFields) => {
      console.log('submitClick catalogue values:', formFields);
      sdk.setDisable('submit', true);
      sdk.setText('submit', 'Please wait...');
      sdk.submit(
        {},
        {
          metadata: {
            source: 'tokenize-flow-demo',
            timestamp: new Date().toISOString(),
            hostedSubmitButton: true,
          },
          allow_blank_date: config.allowBlankDate,
          allow_expired_date: config.allowExpiredDate,
          allow_blank_name: config.allowBlankName,
          ...(config.eligibleForCardUpdater ? { eligible_for_card_updater: true } : {}),
        }
      );
    });
  }

  sdk.inAppElements(inAppElementsConfig);
}

/**
 * Builds the `inAppElements` config: the mandatory number and cvv fields plus one entry per
 * catalogue field ticked in the SDK Configuration panel. `isRequired` gates every field except
 * first_name / last_name and the date fields, which are required by default whenever mounted.
 */
function buildHostedFieldsElementsConfig() {
  const elementsConfig = {
    cvv: { containerId: 'cvv-field' },
    number: { containerId: 'card-number-field', styles: HOSTED_INPUT_STYLE },
  };
  mountedCatalogueFields.forEach((type) => {
    elementsConfig[type] = {
      containerId: hostedCatalogueContainerId(type),
      ...(config.hostedCatalogueRequired ? { isRequired: true } : {}),
      ...(type === 'full_name' ? { styles: HOSTED_INPUT_STYLE } : {}),
    };
  });
  if (config.hostedSubmitButton) {
    elementsConfig.submit = {
      containerId: 'hosted-submit-button-field',
      text: 'Pay',
      styles: {
        backgroundColor: '#0a0a0a',
        color: '#fff',
        fontSize: '16px',
        fontWeight: '600',
        borderRadius: '6px',
      },
    };
  }
  return elementsConfig;
}

// Express Checkout Initialization
async function initializeExpressCheckout(authParams) {
  storedAuthParams = authParams;

  sdk = new SpreedlyExpressCheckout({
    environment_key: authParams.environmentKey,
    nonce: authParams.nonce,
    timestamp: authParams.timestamp,
    certificate_token: authParams.certificateToken,
    signature: authParams.signature,
  });

  hideLoading();
  elements.expressCheckoutOpenSection().classList.remove('hidden');
  console.log('Express checkout SDK initialized, waiting for user to open form');
}

// Open Express Checkout Form (called when button is clicked)
window.openExpressCheckoutForm = function () {
  if (!sdk || !storedAuthParams) {
    showError('SDK not initialized. Please refresh the page.');
    return;
  }

  // Sync config state from checkboxes before building checkout config
  syncConfigFromCheckboxes();

  const displayMode = document.querySelector('input[name="display-mode"]:checked')?.value || 'embedded';

  SpreedlyUtils.setButtonLoading('open-payment-form-btn', true, 'Loading...');

  sdk.on('ready', () => {
    isReady = true;
    SpreedlyUtils.setButtonLoading('open-payment-form-btn', false);
    elements.expressCheckoutOpenSection().classList.add('hidden');
    elements.expressCheckoutForm().classList.remove('hidden');
    console.log('Express checkout ready');
  });

  sdk.on('tokenGenerated', (response) => {
    console.log('Token generated:', response);
    handleTokenSuccess(response);
  });

  sdk.on('error', (error) => {
    console.error('SDK error:', error);
    SpreedlyUtils.setButtonLoading('open-payment-form-btn', false);
    handleTokenError(error);
  });

  sdk.on('close', () => {
    console.log('Express checkout closed');
    if (displayMode === 'dialog') {
      elements.expressCheckoutForm().classList.add('hidden');
      elements.expressCheckoutOpenSection().classList.remove('hidden');
      showStatus('Checkout closed', 'info');
    }
  });

  const checkoutConfig = {
    uiConfig: {
      twoDigitExpiry: config.twoDigitExpiryYear,
      showSaveCardCheckbox: true,
      showCardTypeIcon: config.showCardTypeIcon,
      textConfig: {
        title: 'Payment Details',
        submitBtnText: 'Create Payment Method',
        processingText: 'Processing...',
      },
      styles: {
        button: {
          backgroundColor: '#0a0a0a',
          borderRadius: '8px',
          hover: {
            backgroundColor: '#262626',
          },
        },
      },
      ...(config.ecExtraFields.length > 0
        ? { cardPaymentFormFields: buildEcExtraFieldsConfig(config.ecExtraFields) }
        : {}),
    },
    submitParams: {
      metadata: {
        source: 'tokenize-flow-demo',
        timestamp: new Date().toISOString(),
      },
      allow_blank_date: config.allowBlankDate,
      allow_expired_date: config.allowExpiredDate,
      allow_blank_name: config.allowBlankName,
      ...(config.eligibleForCardUpdater ? { eligible_for_card_updater: true } : {}),
    }
  };

  if (displayMode === 'embedded') {
    checkoutConfig.parentContainerId = 'express-checkout-container';
  }

  sdk.expressCheckout(checkoutConfig);
}

// Event Listeners (Hosted Fields Only)
function setupHostedFieldsEventListeners() {
  const form = elements.paymentForm();
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  const hostedCardNumberLabel = document.getElementById('hosted-field-label-card-number');
  if (hostedCardNumberLabel && sdk) {
    hostedCardNumberLabel.addEventListener('click', () => {
      sdk.transferFocus('number');
    });
    hostedCardNumberLabel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        sdk.transferFocus('number');
      }
    });
  }

  const hostedCvvLabel = document.getElementById('hosted-field-label-cvv');
  if (hostedCvvLabel && sdk) {
    hostedCvvLabel.addEventListener('click', () => {
      sdk.transferFocus('cvv');
    });
    hostedCvvLabel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        sdk.transferFocus('cvv');
      }
    });
  }

  // Sync config state from checkboxes (in case user checked them before SDK was ready)
  syncConfigFromCheckboxes();
}

// Form Handling (Hosted Fields Only)
function handleFormSubmit(e) {
  e.preventDefault();

  // This is only called for Hosted Fields flow
  if (!isReady || elements.submitBtn().disabled) return;

  setLoading(true);
  showStatus('Creating payment method...', 'info');

  // Every value on this form lives in a hosted iframe, so `submit()` carries no form data — the
  // number frame reads each mounted field, validates, and tokenizes.
  sdk.submit(
    {},
    {
      metadata: {
        source: 'tokenize-flow-demo',
        timestamp: new Date().toISOString(),
      },
      allow_blank_date: config.allowBlankDate,
      allow_expired_date: config.allowExpiredDate,
      allow_blank_name: config.allowBlankName,
      ...(config.eligibleForCardUpdater ? { eligible_for_card_updater: true } : {}),
    }
  );
}

// Response Handlers
async function handleTokenSuccess(response) {
  let retainedPaymentMethod
  if (response.shouldRetain) {
    retainedPaymentMethod = await SpreedlyUtils.retainPaymentMethod(response.tokenResponse.payment_method.token);
  }

  setLoading(false);
  hideStatus();

  const paymentMethod = retainedPaymentMethod?.transaction?.payment_method || response?.tokenResponse?.payment_method || {};
  const token = paymentMethod.token || 'Unknown';

  // Hide form, show result
  elements.hostedFieldsOpenSection()?.classList.add('hidden');
  elements.hostedFieldsForm()?.classList.add('hidden');
  elements.expressCheckoutOpenSection()?.classList.add('hidden');
  elements.expressCheckoutForm()?.classList.add('hidden');
  elements.resultSection().classList.remove('hidden');

  // Style result card
  elements.resultCard().classList.add('success');
  elements.resultCard().classList.remove('error');
  elements.resultIcon().classList.add('success');
  elements.resultIcon().classList.remove('error');
  elements.resultIconSuccess().classList.remove('hidden');
  elements.resultIconError().classList.add('hidden');
  elements.resultTitle().textContent = 'Payment Method Created';

  // All values below are interpolated into innerHTML and may originate from
  // API responses; HTML-escape every value to prevent XSS.
  const details = `
    <div class="result-row">
      <span class="result-label">Token</span>
      <span class="result-value">${SpreedlyUtils.escapeHtml(token)}</span>
    </div>
    <div class="result-row">
      <span class="result-label">Card Type</span>
      <span class="result-value">${SpreedlyUtils.escapeHtml(SpreedlyUtils.capitalizeFirst(paymentMethod.card_type) || '—')}</span>
    </div>
    <div class="result-row">
      <span class="result-label">Last Four</span>
      <span class="result-value">${SpreedlyUtils.escapeHtml(paymentMethod.last_four_digits || '—')}</span>
    </div>
    <div class="result-row">
      <span class="result-label">First Six</span>
      <span class="result-value">${SpreedlyUtils.escapeHtml(paymentMethod.first_six_digits || '—')}</span>
    </div>
    <div class="result-row">
      <span class="result-label">Expiry</span>
      <span class="result-value">${SpreedlyUtils.escapeHtml(SpreedlyUtils.formatExpiry(paymentMethod.month, paymentMethod.year))}</span>
    </div>
    <div class="result-row">
      <span class="result-label">Storage State</span>
      <span class="result-value">${SpreedlyUtils.escapeHtml(paymentMethod.storage_state || '—')}</span>
    </div>
  `;

  elements.resultDetails().innerHTML = details;

  console.log('Payment method created:', paymentMethod);
}

function handleTokenError(error) {
  setLoading(false);

  // Client-side validation / guard failures arrive as a bare string; API failures are objects.
  const message =
    typeof error === 'string' && error.trim()
      ? error
      : error?.message || error?.errors?.[0]?.message || 'Tokenization failed. Please try again.';
  showStatus(message, 'error');

  console.error('Token error:', error);
}

// Reset Form
window.resetForm = function () {
  // Hide result, show appropriate form based on SDK type
  elements.resultSection().classList.add('hidden');

  if (sdkType === 'express-checkout') {
    // For Express Checkout, show the "Open Payment Form" section again
    elements.expressCheckoutForm().classList.add('hidden');
    elements.expressCheckoutOpenSection().classList.remove('hidden');

    // Re-create SDK instance for a fresh form
    if (storedAuthParams) {
      sdk = new SpreedlyExpressCheckout({
        environment_key: storedAuthParams.environmentKey,
        nonce: storedAuthParams.nonce,
        timestamp: storedAuthParams.timestamp,
        certificate_token: storedAuthParams.certificateToken,
        signature: storedAuthParams.signature,
      });
      isReady = false;
    }
  } else {
    // For Hosted Fields, show the "Open Payment Form" section again
    elements.hostedFieldsForm().classList.add('hidden');
    elements.hostedFieldsOpenSection().classList.remove('hidden');

    destroyHostedFieldsInstance();

    if (storedAuthParams) {
      sdk = createHostedFieldsSdk(storedAuthParams);
    }
  }

  hideStatus();
}

// UI Helpers
function hideLoading() {
  elements.loadingState().classList.add('hidden');
}

function setLoading(loading) {
  // Only applies to Hosted Fields - Express Checkout has no external submit button
  if (sdkType === 'hosted-fields') {
    SpreedlyUtils.setButtonLoading('submit-btn', loading);
  }
}

function showStatus(message, type) {
  const statusEl = sdkType === 'hosted-fields'
    ? elements.statusMessage()
    : document.getElementById('global-status-message');
  setStatusElement(statusEl, message, type);
}

/** Shows a status message outside the payment form (e.g. after SDK destroy). */
function showGlobalStatus(message, type) {
  setStatusElement(document.getElementById('global-status-message'), message, type);
}

/** Applies message and visibility classes to a status element. */
function setStatusElement(statusEl, message, type) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `status-message visible ${type}`;
}

function hideStatus() {
  clearStatusElement(elements.statusMessage());
  clearStatusElement(document.getElementById('global-status-message'));
}

/** Hides a status element and clears any previous message. */
function clearStatusElement(statusEl) {
  if (!statusEl) return;
  statusEl.textContent = '';
  statusEl.className = 'status-message';
}

function showError(message) {
  hideLoading();

  // Show error using global status (visible before forms are shown)
  const globalStatus = document.getElementById('global-status-message');
  if (globalStatus) {
    globalStatus.textContent = message;
    globalStatus.className = 'status-message visible error';
  }
}

// Start
document.addEventListener('DOMContentLoaded', init);

