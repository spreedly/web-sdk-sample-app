declare const SpreedlyWebSDK: any;

const nonceParams = JSON.parse(
  window.sessionStorage.getItem("authParams") || "{}"
);
const sdk = new SpreedlyWebSDK({
  environment_key: nonceParams["env-key"],
  nonce: nonceParams.nonce,
  timestamp: nonceParams.timestamp,
  certificate_token: nonceParams.token,
  signature: nonceParams.signature,
});

let allowBlankNameCheckedHF = false;
let allowExpiredDateCheckedHF = false;
let twoDigitExpiryCheckedHF = false;

function syncHostedFieldCheckboxState(): void {
  const allowBlankNameEl = document.getElementById("allow_blank_name") as HTMLInputElement | null;
  const allowExpiredDateEl = document.getElementById("allow_expired_date") as HTMLInputElement | null;
  const twoDigitExpiryEl = document.getElementById("two_digit_expiry") as HTMLInputElement | null;

  allowBlankNameCheckedHF = !!allowBlankNameEl?.checked;
  allowExpiredDateCheckedHF = !!allowExpiredDateEl?.checked;
  twoDigitExpiryCheckedHF = !!twoDigitExpiryEl?.checked;
}

function formatMmYyInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function toggleExpiryInputs(): void {
  const twoDigitExpiryEl = document.getElementById("two_digit_expiry") as HTMLInputElement | null;
  const expiryFields = document.querySelector(".expiry-fields") as HTMLElement | null;
  const expirySingle = document.getElementById("expiry-single") as HTMLElement | null;
  const mmInput = document.getElementById("expiry-month") as HTMLInputElement | null;
  const yyyyInput = document.getElementById("expiry-year") as HTMLInputElement | null;
  const mmYyInput = document.getElementById("expiry-mm-yy") as HTMLInputElement | null;

  const useSingle = !!twoDigitExpiryEl?.checked;

  if (expiryFields && expirySingle) {
    if (useSingle) {
      // Prefill single input from split fields if available
      const mm = (mmInput?.value || '').slice(0, 2);
      const yy = (yyyyInput?.value || '').slice(-2);
      if (mmYyInput) mmYyInput.value = formatMmYyInput(`${mm}${yy}`);

      // Switch visibility
      expiryFields.style.display = "none";
      expirySingle.style.display = "block";

      // Update validation/interaction attributes
      mmInput?.removeAttribute("required");
      yyyyInput?.removeAttribute("required");
      mmInput?.setAttribute("disabled", "");
      yyyyInput?.setAttribute("disabled", "");

      if (mmYyInput) {
        mmYyInput.removeAttribute("disabled");
        mmYyInput.setAttribute("required", "");
      }
    } else {
      // Prefill split fields from single input if available
      const val = mmYyInput?.value || '';
      const parts = val.split('/');
      if (mmInput && parts[0]) mmInput.value = parts[0].slice(0, 2);
      if (yyyyInput && parts[1]) yyyyInput.value = `20${parts[1].slice(0, 2)}`;

      // Switch visibility
      expiryFields.style.display = "flex";
      expirySingle.style.display = "none";

      // Update validation/interaction attributes
      mmInput?.setAttribute("required", "");
      yyyyInput?.setAttribute("required", "");
      mmInput?.removeAttribute("disabled");
      yyyyInput?.removeAttribute("disabled");

      if (mmYyInput) {
        mmYyInput.setAttribute("disabled", "");
        mmYyInput.removeAttribute("required");
      }
    }
  }
}

function attachUIListeners(): void {
  const allowBlankNameEl = document.getElementById("allow_blank_name") as HTMLInputElement | null;
  const allowExpiredDateEl = document.getElementById("allow_expired_date") as HTMLInputElement | null;
  const twoDigitExpiryEl = document.getElementById("two_digit_expiry") as HTMLInputElement | null;
  const restartBtn = document.getElementById("restart-btn") as HTMLButtonElement | null;
  const mmYyInput = document.getElementById("expiry-mm-yy") as HTMLInputElement | null;

  const changeHandler = () => {
    syncHostedFieldCheckboxState();
    toggleExpiryInputs();
  };

  allowBlankNameEl?.addEventListener("change", changeHandler);
  allowExpiredDateEl?.addEventListener("change", changeHandler);
  twoDigitExpiryEl?.addEventListener("change", changeHandler);

  mmYyInput?.addEventListener('input', () => {
    mmYyInput.value = formatMmYyInput(mmYyInput.value);
  });

  restartBtn?.addEventListener("click", () => {
    window.location.href = "/";
  });

  changeHandler();
}

sdk.on("ready", () => {
  sdk.setPlaceholder("cvv", "***");
  sdk.setStyles("number", {
    borderRadius: "5px",
    paddingLeft: "8px",
    paddingRight: "8px",
    fontSize: "18px",
  });
  sdk.setStyles("cvv", {
    borderRadius: "5px",
    paddingLeft: "8px",
    paddingRight: "8px",
    fontSize: "18px",
  });
});

const tokenContainer2 = document.getElementById("token-container-message");

sdk.on("error", (error: any) => {
  sdk.close();
  tokenContainer2!.textContent = error.error;
});
sdk.on("tokenGenerated", (token: any) => {
  sdk.close();
  tokenContainer2!.textContent = `Token: ${token.tokenResponse.token}`;
});
sdk.inAppElements({
  number: {
    containerId: "spreedly-number-input-container",
  },
  cvv: {
    containerId: "spreedly-cvv-input-container",
  },
});

function getExpiryValues(): { month: string; year: string } {
  if (twoDigitExpiryCheckedHF) {
    const mmYYInput = document.getElementById("expiry-mm-yy") as HTMLInputElement | null;
    const value = (mmYYInput?.value || "").trim();
    const [mmRaw, yyRaw] = value.split("/");
    const mm = (mmRaw || "").slice(0, 2);
    const yy = (yyRaw || "").slice(0, 2);
    const yyyy = yy.length === 2 ? `20${yy}` : yy;
    return { month: mm, year: yyyy };
  }
  const month = (document.getElementById("expiry-month") as HTMLInputElement)?.value || "";
  const year = (document.getElementById("expiry-year") as HTMLInputElement)?.value || "";
  return { month, year };
}

function handlePaymentFormSubmit(event: Event) {
  console.log("handlePaymentFormSubmit");
  event.preventDefault();
  syncHostedFieldCheckboxState();

  const { month, year } = getExpiryValues();
  const firstName = (document.getElementById("first-name") as HTMLInputElement)?.value;
  const lastName = (document.getElementById("last-name") as HTMLInputElement)?.value;
  const shippingAddress1 = (document.getElementById("shipping-address1") as HTMLInputElement)?.value;

  sdk.submit(
    {
      month,
      year,
      first_name: firstName,
      last_name: lastName,
      shipping_address1: shippingAddress1,
    },
    {
      metadata: {
        custom_field: "custom_value",
      },
      allow_expired_date: allowExpiredDateCheckedHF,
      allow_blank_name: allowBlankNameCheckedHF,
    }
  );
}

attachUIListeners();
