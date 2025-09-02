interface AuthParams {
  "env-key": string;
  nonce: string;
  timestamp: string;
  signature: string;
  token: string;
}

interface JsonAuthParams {
  envKey: string;
  nonce: string;
  timestamp: string;
  certificate_token: string;
  signature: string;
}

// Loading overlay utility functions
function showLoadingOverlay(
  message: string = "Processing...",
  subMessage: string = "Please wait while we process your request"
): void {
  const overlay = document.getElementById("loading-overlay");
  const textElement = document.querySelector(
    '[data-testid="loading-spinner-text"]'
  ) as HTMLElement;
  const subTextElement = document.querySelector(
    '[data-testid="loading-spinner-subtext"]'
  ) as HTMLElement;

  if (overlay && textElement && subTextElement) {
    textElement.textContent = message;
    subTextElement.textContent = subMessage;
    overlay.classList.add("show");
  }
}

function hideLoadingOverlay(): void {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) {
    overlay.classList.remove("show");
  }
}

// Form state utility functions
function disableForm(): void {
  const inputs = document.querySelectorAll(
    ".auth-input, .json-textarea"
  ) as NodeListOf<HTMLInputElement | HTMLTextAreaElement>;
  const buttons = document.querySelectorAll(
    ".btn"
  ) as NodeListOf<HTMLButtonElement>;

  inputs.forEach((input) => {
    input.disabled = true;
  });

  buttons.forEach((button) => {
    button.disabled = true;
  });
}

function enableForm(): void {
  const inputs = document.querySelectorAll(
    ".auth-input, .json-textarea"
  ) as NodeListOf<HTMLInputElement | HTMLTextAreaElement>;
  const buttons = document.querySelectorAll(
    ".btn"
  ) as NodeListOf<HTMLButtonElement>;

  inputs.forEach((input) => {
    input.disabled = false;
  });

  buttons.forEach((button) => {
    button.disabled = false;
  });
}

function parseAuthParams(): void {
  const jsonInput = (
    document.getElementById("json-input") as HTMLTextAreaElement
  )?.value;

  if (!jsonInput || jsonInput.trim() === "") {
    alert("Please enter JSON data");
    return;
  }

  try {
    const parsedData: JsonAuthParams = JSON.parse(jsonInput);

    const fieldMappings = {
      "env-key": parsedData.envKey,
      nonce: parsedData.nonce,
      timestamp: parsedData.timestamp,
      signature: parsedData.signature,
      token: parsedData.certificate_token,
    };

    Object.entries(fieldMappings).forEach(([fieldId, value]) => {
      const inputElement = document.getElementById(fieldId) as HTMLInputElement;
      if (inputElement && value) {
        inputElement.value = value;
      }
    });
  } catch (error) {
    alert("Invalid JSON format. Please check your input.");
    console.error("JSON parsing error:", error);
  }
}

function captureAuthParams(): AuthParams {
  const authParams: AuthParams = {
    "env-key":
      (document.getElementById("env-key") as HTMLInputElement)?.value || "",
    nonce: (document.getElementById("nonce") as HTMLInputElement)?.value || "",
    timestamp:
      (document.getElementById("timestamp") as HTMLInputElement)?.value || "",
    signature:
      (document.getElementById("signature") as HTMLInputElement)?.value || "",
    token: (document.getElementById("token") as HTMLInputElement)?.value || "",
  };

  return authParams;
}

function handleExpressClick(): void {
  const authParams: AuthParams = captureAuthParams();
  const tokenContainer = document.getElementById("token-container-message");
  if (
    authParams["env-key"] === "" ||
    authParams.nonce === "" ||
    authParams.timestamp === "" ||
    authParams.token === "" ||
    authParams.signature === ""
  ) {
    alert("Please fill all auth fields");
    return;
  }
  const sdkExpressCheckout = new SpreedlyWebSDK({
    environment_key: authParams["env-key"],
    nonce: authParams.nonce,
    timestamp: authParams.timestamp,
    certificate_token: authParams.token,
    signature: authParams.signature,
  });
  sdkExpressCheckout.on("ready", () => {
    sdkExpressCheckout.setFieldConfig("phone_number", {
      styles: {
        backgroundColor: "cyan",
      },
    });
  });
  sdkExpressCheckout.on("error", (error: any) => {
    sdkExpressCheckout.close();
    tokenContainer!.textContent = error;
  });
  sdkExpressCheckout.on("tokenGenerated", (token: any) => {
    sdkExpressCheckout.close();
    tokenContainer!.textContent = `Token: ${token.tokenResponse.token}`;
  });

  sdkExpressCheckout.expressCheckout({
    className: "checkout-plugin",
    uiConfig: {
      cardPaymentFormFields: {
        phone_number: {
          isRequired: true,
          label: "Phone Number (required)",
          placeholder: "Phone Number Dynamically added label",
        },
      },
      textConfig: {
        title: "Pay with Card",
        submitBtnText: "Pay",
        processingText: "Processing...",
      },
      styles: {
        button: {
          backgroundColor: "#000",
          hover: {
            backgroundColor: "#000",
          },
          borderColor: "red",
        },
      },
    },
  });
}

function handleHostedFieldsClick(): void {
  const authParams: AuthParams = captureAuthParams();
  window.sessionStorage.setItem("authParams", JSON.stringify(authParams));
  window.location.href = "/hostedFields.html";
}