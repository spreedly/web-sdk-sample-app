// Apple Pay test page: plain Apple Pay JS, no SDK. Checks the Apple Pay setup end to end:
// merchant validation, the Apple Pay sheet, and tokenization of the payment at Spreedly.
(function () {
  const CORE_PAYMENT_METHODS_URL =
    'https://core.spreedly.com/v1/payment_methods.json';
  const BILLING_FIELDS = [
    'address1',
    'address2',
    'city',
    'state',
    'zip',
    'country',
    'phone_number',
  ];

  const $ = id => document.getElementById(id);
  const logEl = $('log');

  const log = (label, value) => {
    const time = new Date().toISOString().slice(11, 23);
    const text =
      value === undefined ? '' : `\n${JSON.stringify(value, null, 2)}`;
    logEl.textContent += `[${time}] ${label}${text}\n\n`;
    logEl.scrollTop = logEl.scrollHeight;
  };

  const addCheck = (name, value) => {
    const row = document.createElement('tr');
    row.innerHTML = '<td></td><td></td>';
    row.children[0].textContent = name;
    row.children[1].textContent = String(value);
    $('checks').appendChild(row);
  };

  const options = () => {
    const [failCode, failField] = ($('fail-contact').value || '|').split('|');
    return {
      merchantId: $('merchant-id').value.trim(),
      amount: $('amount').value.trim(),
      apiVersion: Number($('api-version').value),
      recurring: $('recurring').checked,
      requireBilling: $('require-billing').checked,
      requireShipping: $('require-shipping').checked,
      testCard: $('test-card').value.trim(),
      sendBilling: $('send-billing').checked,
      failCode,
      failField,
    };
  };

  // Built synchronously from the form: nothing may be awaited before begin().
  const buildRequest = opts => {
    const request = {
      countryCode: 'US',
      currencyCode: 'USD',
      total: { label: 'Spreedly Apple Pay test', amount: opts.amount },
      supportedNetworks: ['amex', 'discover', 'jcb', 'masterCard', 'visa'],
      merchantCapabilities: ['supports3DS'],
    };
    if (opts.requireBilling)
      request.requiredBillingContactFields = ['postalAddress', 'name'];
    if (opts.requireShipping) {
      request.requiredShippingContactFields = [
        'postalAddress',
        'email',
        'phone',
      ];
    }
    if (opts.recurring) {
      request.recurringPaymentRequest = {
        paymentDescription: 'Test monthly plan',
        regularBilling: {
          label: 'Monthly plan',
          amount: opts.amount,
          paymentTiming: 'recurring',
          recurringPaymentIntervalUnit: 'month',
          recurringPaymentIntervalCount: 1,
        },
        managementURL: `${window.location.origin}/`,
      };
    }
    return request;
  };

  const getAuthDetails = async () => {
    const res = await fetch('/api/v1/auth/params');
    if (!res.ok) throw new Error(`auth/params ${res.status}`);
    const p = await res.json();
    return {
      environment_key: p.environmentKey,
      certificate_token: p.certificateToken,
      nonce: p.nonce,
      signature: p.signature,
      timestamp: String(p.timestamp),
    };
  };

  const describeContact = contact =>
    contact
      ? {
          givenName: contact.givenName,
          familyName: contact.familyName,
          addressLines: contact.addressLines,
          locality: contact.locality,
          administrativeArea: contact.administrativeArea,
          postalCode: contact.postalCode,
          countryCode: contact.countryCode,
          emailAddress: contact.emailAddress,
          phoneNumber: contact.phoneNumber,
        }
      : undefined;

  const tokenizeAtSpreedly = async (payment, opts) => {
    const auth = await getAuthDetails();
    const billing = payment.billingContact || {};
    const shipping = payment.shippingContact || {};
    const paymentMethod = {
      apple_pay: {
        payment_data: payment.token.paymentData,
        ...(opts.testCard ? { test_card_number: opts.testCard } : {}),
      },
      first_name: billing.givenName,
      last_name: billing.familyName,
      email: shipping.emailAddress,
    };
    if (opts.sendBilling) {
      const lines = billing.addressLines || [];
      Object.assign(paymentMethod, {
        address1: lines[0],
        address2: lines[1],
        city: billing.locality,
        state: billing.administrativeArea,
        zip: billing.postalCode,
        country: billing.countryCode,
        phone_number: shipping.phoneNumber,
      });
    }
    log('POST payment_methods.json', {
      payment_data_bytes: JSON.stringify(payment.token.paymentData).length,
      fields: Object.keys(paymentMethod),
      test_card_number: Boolean(opts.testCard),
    });
    const res = await fetch(CORE_PAYMENT_METHODS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'spreedly-environment-key': auth.environment_key,
      },
      body: JSON.stringify({ ...auth, payment_method: paymentMethod }),
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  };

  const recordCoreResult = (result, payment, opts) => {
    log(`Core responded ${result.status}`, result.body);
    const pm =
      result.body &&
      result.body.transaction &&
      result.body.transaction.payment_method;
    if (result.status >= 200 && result.status < 300 && pm) {
      $('a-tokenized').textContent =
        `Yes: ${result.status}, token ${pm.token}, card_type ${pm.card_type}`;
      $('a-last4').textContent =
        `Core last_four_digits=${pm.last_four_digits}, first_six_digits=${pm.first_six_digits}; ` +
        `Apple displayName="${(payment.token.paymentMethod || {}).displayName}". ` +
        'Compare with the card number shown in Wallet.';
      if (opts.sendBilling) {
        const kept = BILLING_FIELDS.filter(field => pm[field]);
        $('a-billing').textContent = kept.length
          ? `Kept: ${kept.join(', ')}`
          : 'Kept none';
      }
    } else {
      const errors = (result.body && result.body.errors) || [];
      $('a-tokenized').textContent =
        `No: ${result.status} ${errors.map(e => e.key).join(', ')}`;
    }
  };

  let contactFailed = false;

  const onTap = () => {
    const opts = options();
    const request = buildRequest(opts);
    let session;
    try {
      session = new ApplePaySession(
        opts.recurring ? 14 : opts.apiVersion,
        request
      );
    } catch (error) {
      log('ApplePaySession constructor threw', {
        name: error.name,
        message: error.message,
      });
      return;
    }
    contactFailed = false;

    session.onvalidatemerchant = async event => {
      log('onvalidatemerchant', { validationURL: event.validationURL });
      try {
        const res = await fetch('/api/v1/apple-pay/validate', {
          method: 'POST',
        });
        if (!res.ok)
          throw new Error(`validate ${res.status} ${await res.text()}`);
        session.completeMerchantValidation(await res.json());
        log('merchant session passed to Apple');
      } catch (error) {
        log('merchant validation failed', { message: error.message });
        session.abort();
      }
    };

    session.onpaymentauthorized = async event => {
      const { payment } = event;
      log('onpaymentauthorized', {
        paymentMethod: payment.token.paymentMethod,
        billingContact: describeContact(payment.billingContact),
        shippingContact: describeContact(payment.shippingContact),
      });

      if (opts.failCode && !contactFailed) {
        contactFailed = true;
        const errors = window.ApplePayError
          ? [
              new ApplePayError(
                opts.failCode,
                opts.failField,
                'Test: please choose another address'
              ),
            ]
          : [];
        session.completePayment({
          status: ApplePaySession.STATUS_FAILURE,
          errors,
        });
        $('a-contact-fix').textContent =
          `Failed with ${opts.failCode}. If the shopper can change the contact and approve again, ` +
          'a second onpaymentauthorized appears in the log with the new contact.';
        log('completePayment(FAILURE) with', {
          code: opts.failCode,
          field: opts.failField,
        });
        return;
      }
      if (contactFailed) {
        $('a-contact-fix').textContent =
          'Yes: a second approval arrived after the flagged contact (see log).';
      }

      try {
        const result = await tokenizeAtSpreedly(payment, opts);
        recordCoreResult(result, payment, opts);
        const ok = result.status >= 200 && result.status < 300;
        session.completePayment({
          status: ok
            ? ApplePaySession.STATUS_SUCCESS
            : ApplePaySession.STATUS_FAILURE,
        });
      } catch (error) {
        log('tokenization threw', { message: error.message });
        session.completePayment({ status: ApplePaySession.STATUS_FAILURE });
      }
    };

    session.oncancel = () => log('oncancel');
    session.begin();
    log('session.begin()', {
      version: opts.recurring ? 14 : opts.apiVersion,
      request,
    });
  };

  const runChecks = async () => {
    if (
      window.ApplePayWebOptions &&
      typeof window.ApplePayWebOptions.set === 'function'
    ) {
      window.ApplePayWebOptions.set({ environment: 'sandbox' });
    }
    addCheck('isSecureContext', window.isSecureContext);
    addCheck('window.ApplePaySession', typeof window.ApplePaySession);
    addCheck(
      '<apple-pay-button> registered',
      Boolean(customElements.get('apple-pay-button'))
    );
    if (!window.ApplePaySession) {
      log(
        "ApplePaySession missing: Apple's script did not load, or this browser can't use it"
      );
      return;
    }
    addCheck('canMakePayments()', ApplePaySession.canMakePayments());
    addCheck('supportsVersion(14)', ApplePaySession.supportsVersion(14));
    addCheck('supportsVersion(3)', ApplePaySession.supportsVersion(3));
    const merchantId = $('merchant-id').value.trim();
    if (
      merchantId &&
      typeof ApplePaySession.applePayCapabilities === 'function'
    ) {
      try {
        const caps = await ApplePaySession.applePayCapabilities(merchantId);
        addCheck('applePayCapabilities', caps && caps.paymentCredentialStatus);
      } catch (error) {
        addCheck('applePayCapabilities', `threw: ${error.message}`);
      }
    }

    await customElements.whenDefined('apple-pay-button');
    const button = document.createElement('apple-pay-button');
    button.setAttribute('buttonstyle', 'black');
    button.setAttribute('type', 'buy');
    button.setAttribute('locale', 'en-US');
    button.addEventListener('click', onTap);
    $('button-slot').appendChild(button);
    log('button drawn');
  };

  $('merchant-id').addEventListener('change', () => {
    $('checks').innerHTML = '';
    $('button-slot').innerHTML = '';
    runChecks();
  });
  runChecks();
})();
