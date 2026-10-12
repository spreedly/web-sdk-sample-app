/**
 * ACH Payments Flow — Express Checkout mode (`?sdk=express-checkout`)
 *
 * Uses SpreedlyACHForm, the prebuilt bank account form. The whole form — name,
 * routing and account numbers, account type — lives in one Spreedly-hosted
 * iframe with its own submit button, so this page collects nothing itself.
 *
 * 1. Load the Express Checkout SDK bundle and fetch auth params from the backend
 * 2. new SpreedlyACHForm(auth) → mount({ containerId, uiConfig })
 * 3. The buyer fills in the form and clicks its submit button
 * 4. Listen for `tokenGenerated` ({ tokenResponse, shouldRetain }). If shouldRetain is true,
 *    retain the payment method from the backend (PUT /api/v1/payment_methods/:token/retain),
 *    then POST to /api/v1/ach-purchase (runPurchase, shared with ach-payments.js)
 *
 * The SDK Configuration panel (display mode, optional fields, retaining, text, button case,
 * custom labels and placeholders, custom theme) builds the mount() options, and its event log
 * lists the form's events; any change remounts the form, or applies the next time
 * the dialog opens. The SDK never retains anything itself — this page does, from its backend.
 */

let achForm = null;

function loadExpressCheckoutSDK() {
  return new Promise((resolve, reject) => {
    const src =
      window.location.hostname === 'localhost'
        ? 'http://localhost:5173/express-checkout.js'
        : 'https://core-test.spreedly.com/checkout/elements/rc/express-checkout.js';
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load SDK from ${src}`));
    document.body.appendChild(script);
  });
}

async function initACHForm() {
  // Swap the page to the prebuilt form: hide the Hosted Fields card and copy, show the
  // bordered form container and the Express Checkout copy.
  document.querySelectorAll('.hf-only').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.ec-only').forEach(el => el.classList.remove('hidden'));

  await loadExpressCheckoutSDK();

  if (typeof window.SpreedlyACHForm !== 'function') {
    hideLoading();
    elements.paymentSection().classList.remove('hidden');
    showError(
      'SpreedlyACHForm is not available in the loaded SDK bundle. The rc channel only ' +
        'carries it once the Express Checkout ACH form is merged to the SDK’s main. ' +
        'Run the SDK locally (npm run dev) to try it now.'
    );
    return;
  }

  const authParams = await SpreedlyUtils.fetchAuthParams();
  achForm = new window.SpreedlyACHForm({
    environment_key: authParams.environmentKey,
    nonce: authParams.nonce,
    timestamp: authParams.timestamp,
    certificate_token: authParams.certificateToken,
    signature: authParams.signature,
  });

  achForm.on('ready', payload => {
    logECEvent('ready', payload);
    hideLoading();
    elements.paymentSection().classList.remove('hidden');
  });

  achForm.on('tokenGenerated', async ({ tokenResponse, shouldRetain }) => {
    const { token, account_number_display_digits: last4 } = tokenResponse.payment_method;
    console.log('ACH payment method created:', { token, last4, shouldRetain });
    // The log shows a summary: tokenResponse is the whole Spreedly transaction.
    logECEvent('tokenGenerated', {
      'tokenResponse.payment_method.token': token,
      storage_state: tokenResponse.payment_method.storage_state,
      shouldRetain,
    });
    let storageState = tokenResponse.payment_method.storage_state;
    if (shouldRetain) {
      try {
        const retained = await SpreedlyUtils.retainPaymentMethod(token);
        storageState = retained?.transaction?.payment_method?.storage_state || storageState;
      } catch (error) {
        console.error('Retain failed:', error);
        storageState = `${storageState} (retain failed)`;
      }
    }
    await runPurchase(token, last4, storageState);
    achForm.close();
  });

  achForm.on('error', error => {
    logECEvent('error', error);
    console.error('ACH form error:', error);
    renderError(error?.errors?.[0]?.message || error?.message || String(error) || 'ACH failed.');
  });

  achForm.on('close', payload => logECEvent('close', payload));

  // Every config control is a mount() setting: any change remounts the form (embedded), or
  // applies the next time the dialog opens. Text inputs apply on `change` (blur / Enter).
  document.querySelectorAll('.ach-config').forEach(control => {
    control.addEventListener('change', applyACHFormConfig);
  });
  document.getElementById('open-ach-dialog-btn').addEventListener('click', () => {
    achForm.close();
    achForm.mount(buildMountOptions());
  });

  applyACHFormConfig();
}

const ACH_OPTIONAL_FIELDS = ['bank_name', 'bank_account_type', 'bank_account_holder_type'];

/** "Custom labels & placeholders": sample text for every field (the dropdowns take no placeholder). */
const ACH_CUSTOM_FIELD_TEXT = {
  full_name: { label: 'Name on the account', placeholder: 'Jane Doe' },
  bank_name: { label: 'Bank', placeholder: 'e.g. Chase' },
  bank_routing_number: { label: 'ABA routing number', placeholder: '9 digits' },
  bank_account_number: { label: 'Account no.', placeholder: '4–17 digits' },
  bank_account_type: { label: 'Checking or savings' },
  bank_account_holder_type: { label: 'Personal or business' },
};

/** "Custom theme": a sample blue theme. Same uiConfig.styles shape as the card form. */
const ACH_CUSTOM_THEME = {
  textfield: {
    borderColor: '#93c5fd',
    hover: { borderColor: '#3b82f6' },
    active: { borderColor: '#1d4ed8' },
    placeholder: { color: '#60a5fa' },
  },
  button: { backgroundColor: '#1d4ed8', hover: { backgroundColor: '#1e40af' } },
  checkbox: { color: '#1d4ed8' },
  paper: { backgroundColor: '#f8fafc' },
};

const EC_EVENT_LOG_SIZE = 6;
const ecEvents = [];

function logECEvent(event, payload) {
  ecEvents.unshift(`${event} ${JSON.stringify(payload ?? null)}`);
  ecEvents.length = Math.min(ecEvents.length, EC_EVENT_LOG_SIZE);
  document.getElementById('ec-event-log').textContent = ecEvents.join('\n');
}

/** Reads the config panel into SpreedlyACHForm mount() options. */
function buildMountOptions() {
  const value = id => document.getElementById(id).value;
  const checked = id => document.getElementById(id).checked;
  const achFormFields = {
    bank_routing_number: { placeholder: '021000021' },
    bank_account_number: { placeholder: '9876543210' },
    full_name: { placeholder: 'Bob Smith' },
  };
  ACH_OPTIONAL_FIELDS.forEach(field => {
    const mode = value(`config-field-${field}`); // hidden | optional | required
    achFormFields[field] = { isHidden: mode === 'hidden', isRequired: mode === 'required' };
  });
  if (checked('config-custom-labels')) {
    Object.entries(ACH_CUSTOM_FIELD_TEXT).forEach(([field, text]) => {
      achFormFields[field] = { ...achFormFields[field], ...text };
    });
  }
  const theme = checked('config-custom-theme') ? ACH_CUSTOM_THEME : {};

  return {
    ...(displayMode() === 'embedded' && { containerId: 'ach-form-container' }),
    uiConfig: {
      textConfig: {
        title: value('config-text-title'),
        submitBtnText: value('config-text-submit'),
        footerText: value('config-text-footer'),
        processingText: value('config-text-processing'),
      },
      // Same button styling as the Express Checkout card demo (tokenize.js), unless the
      // custom theme replaces it.
      styles: {
        ...theme,
        button: {
          backgroundColor: '#0a0a0a',
          borderRadius: '8px',
          hover: {
            backgroundColor: '#262626',
          },
          ...theme.button,
          textTransform: value('config-button-case'),
        },
      },
      achFormFields,
      showSaveAccountCheckbox: checked('config-allow-retain'),
      saveAccountCheckboxLabel: value('config-text-save-label'),
    },
  };
}

function displayMode() {
  return document.querySelector('input[name="ach-display-mode"]:checked').value;
}

/**
 * The form fills its container and doesn't size itself, so size the container to fit the
 * fields that are shown (measured in Chromium): a fixed part for the title, button and footer,
 * one row per line of fields, and the save checkbox.
 */
const ACH_FORM_FIXED_HEIGHT = 207;
const ACH_FORM_ROW_HEIGHT = 72;
const ACH_FORM_SAVE_CHECKBOX_HEIGHT = 58;

function fittedFormHeight() {
  const shown = field => document.getElementById(`config-field-${field}`).value !== 'hidden';
  const rows =
    1 + // account holder name
    (shown('bank_name') ? 1 : 0) +
    1 + // routing number + account number
    (shown('bank_account_type') || shown('bank_account_holder_type') ? 1 : 0);
  const checkbox = document.getElementById('config-allow-retain').checked;
  return (
    ACH_FORM_FIXED_HEIGHT +
    rows * ACH_FORM_ROW_HEIGHT +
    (checkbox ? ACH_FORM_SAVE_CHECKBOX_HEIGHT : 0) +
    5 // a little room so nothing scrolls
  );
}

function applyACHFormConfig() {
  achForm.close();
  const embedded = displayMode() === 'embedded';
  document.getElementById('ach-embedded-box').classList.toggle('hidden', !embedded);
  document.getElementById('ach-dialog-box').classList.toggle('hidden', embedded);
  if (embedded) {
    document.getElementById('ach-form-container').style.height = `${fittedFormHeight()}px`;
    achForm.mount(buildMountOptions());
  } else {
    // Dialog mode has nothing to wait for on the page.
    hideLoading();
    elements.paymentSection().classList.remove('hidden');
  }
}
