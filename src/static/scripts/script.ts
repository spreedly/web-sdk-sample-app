interface AuthParams {
  'env-key': string;
  nonce: string;
  timestamp: string;
  signature: string;
  token: string;
}

let allowBlankNameChecked = false;
let allowExpiryDateChecked = false;
let openInEmbeddedModeChecked = false;

function syncCheckboxStates(): void {
  const allowBlankNameEl = document.getElementById(
    'allow_blank_name'
  ) as HTMLInputElement | null;
  const allowExpiryDateEl = document.getElementById(
    'allow_expired_date'
  ) as HTMLInputElement | null;
  const openInEmbeddedModeEl = document.getElementById(
    'open_in_embedded_mode'
  ) as HTMLInputElement | null;

  if (allowBlankNameEl) allowBlankNameChecked = allowBlankNameEl.checked;
  if (allowExpiryDateEl) allowExpiryDateChecked = allowExpiryDateEl.checked;
  if (openInEmbeddedModeEl)
    openInEmbeddedModeChecked = openInEmbeddedModeEl.checked;
}

function attachCheckboxListeners(): void {
  const allowBlankNameEl = document.getElementById(
    'allow_blank_name'
  ) as HTMLInputElement | null;
  const allowExpiryDateEl = document.getElementById(
    'allow_expiry_date'
  ) as HTMLInputElement | null;
  const openInEmbeddedModeEl = document.getElementById(
    'open_in_embedded_mode'
  ) as HTMLInputElement | null;

  const handler = () => syncCheckboxStates();

  allowBlankNameEl?.addEventListener('change', handler);
  allowExpiryDateEl?.addEventListener('change', handler);
  openInEmbeddedModeEl?.addEventListener('change', handler);

  // Initialize state once on attach
  syncCheckboxStates();
}

attachCheckboxListeners();

function handleHostedFieldsClick(): void {
  const authParams: AuthParams = captureAuthParams();

  disableCheckboxes();
  disableButtons();

  window.sessionStorage.setItem('authParams', JSON.stringify(authParams));
  window.location.href = '/hostedFields.html';
}

// ------------------------------------------------------------
// Spreedly Web SDK Functions
// ------------------------------------------------------------

function captureAuthParams(): AuthParams {
  const authParams: AuthParams = {
    'env-key':
      (document.getElementById('env-key') as HTMLInputElement)?.value || '',
    nonce: (document.getElementById('nonce') as HTMLInputElement)?.value || '',
    timestamp:
      (document.getElementById('timestamp') as HTMLInputElement)?.value || '',
    signature:
      (document.getElementById('signature') as HTMLInputElement)?.value || '',
    token: (document.getElementById('token') as HTMLInputElement)?.value || '',
  };

  return authParams;
}

function disableCheckboxes(): void {
  const allowBlankNameEl = document.getElementById(
    'allow_blank_name'
  ) as HTMLInputElement | null;
  const allowExpiryDateEl = document.getElementById(
    'allow_expired_date'
  ) as HTMLInputElement | null;
  const twoDigitExpiryEl = document.getElementById(
    'two_digit_expiry'
  ) as HTMLInputElement | null;
  const openInEmbeddedModeEl = document.getElementById(
    'open_in_embedded_mode'
  ) as HTMLInputElement | null;

  if (allowBlankNameEl) allowBlankNameEl.disabled = true;
  if (allowExpiryDateEl) allowExpiryDateEl.disabled = true;
  if (openInEmbeddedModeEl) openInEmbeddedModeEl.disabled = true;
  if (twoDigitExpiryEl) twoDigitExpiryEl.disabled = true;
}

function enableCheckboxes(): void {
  const allowBlankNameEl = document.getElementById(
    'allow_blank_name'
  ) as HTMLInputElement | null;
  const allowExpiryDateEl = document.getElementById(
    'allow_expired_date'
  ) as HTMLInputElement | null;
  const openInEmbeddedModeEl = document.getElementById(
    'open_in_embedded_mode'
  ) as HTMLInputElement | null;

  if (allowBlankNameEl) allowBlankNameEl.disabled = false;
  if (allowExpiryDateEl) allowExpiryDateEl.disabled = false;
  if (openInEmbeddedModeEl) openInEmbeddedModeEl.disabled = false;
}

function disableButtons(): void {
  const expressBtn = document.getElementById(
    'express-btn'
  ) as HTMLButtonElement | null;
  const hostedFieldsBtn = document.getElementById(
    'hosted-fields-btn'
  ) as HTMLButtonElement | null;
  const restartBtn = document.getElementById(
    'restart-btn'
  ) as HTMLButtonElement | null;

  if (expressBtn) expressBtn.disabled = true;
  if (hostedFieldsBtn) hostedFieldsBtn.disabled = true;
  if (restartBtn) restartBtn.disabled = false; // Keep restart button enabled
}

function enableButtons(): void {
  const expressBtn = document.getElementById(
    'express-btn'
  ) as HTMLButtonElement | null;
  const hostedFieldsBtn = document.getElementById(
    'hosted-fields-btn'
  ) as HTMLButtonElement | null;
  const restartBtn = document.getElementById(
    'restart-btn'
  ) as HTMLButtonElement | null;

  if (expressBtn) expressBtn.disabled = false;
  if (hostedFieldsBtn) hostedFieldsBtn.disabled = false;
  if (restartBtn) restartBtn.disabled = false;
}

function handleRestartClick(): void {
  window.location.reload();
}

function handleExpressClick(): void {
  const authParams: AuthParams = captureAuthParams();
  const tokenContainer = document.getElementById('token-container-message');
  if (
    authParams['env-key'] === '' ||
    authParams.nonce === '' ||
    authParams.timestamp === '' ||
    authParams.token === '' ||
    authParams.signature === ''
  ) {
    alert('Please fill all auth fields');
    return;
  }

  disableCheckboxes();
  disableButtons();
  const sdkExpressCheckout = new SpreedlyWebSDK({
    environment_key: authParams['env-key'],
    nonce: authParams.nonce,
    timestamp: authParams.timestamp,
    certificate_token: authParams.token,
    signature: authParams.signature,
  });
  sdkExpressCheckout.on('ready', () => {
    sdkExpressCheckout.setFieldConfig('phone_number', {
      styles: {
        backgroundColor: 'cyan',
      },
    });
  });
  sdkExpressCheckout.on('error', (error: any) => {
    // sdkExpressCheckout.close();
    if (typeof error === 'string') {
      tokenContainer!.textContent = error;
    } else {
      tokenContainer!.textContent = error.error;
    }
  });
  sdkExpressCheckout.on('tokenGenerated', (token: any) => {
    // sdkExpressCheckout.close();
    tokenContainer!.textContent = `Token: ${token.tokenResponse.token}`;
  });
  console.log({
    openInEmbeddedModeChecked,
    allowExpiryDateChecked,
    allowBlankNameChecked,
  });

  sdkExpressCheckout.expressCheckout({
    className:
      (document.getElementById('two_digit_expiry') as HTMLInputElement)
        ?.checked || false
        ? 'checkout-plugin-small'
        : 'checkout-plugin',
    ...(openInEmbeddedModeChecked
      ? { parentContainerId: 'checkout-plugin-container' }
      : {}),
    submitParams: {
      allow_expired_date:
        (document.getElementById('allow_expired_date') as HTMLInputElement)
          ?.checked || false,
      allow_blank_name:
        (document.getElementById('allow_blank_name') as HTMLInputElement)
          ?.checked || false,
    },
    uiConfig: {
      twoDigitExpiry:
        (document.getElementById('two_digit_expiry') as HTMLInputElement)
          ?.checked || false,
      textConfig: {
        title: 'Pay with Card',
        submitBtnText: 'Pay',
        processingText: 'Processing...',
      },
      styles: {
        button: {
          backgroundColor: '#000',
          hover: {
            backgroundColor: '#000',
          },
          borderColor: 'red',
        },
      },
    },
  });
}
