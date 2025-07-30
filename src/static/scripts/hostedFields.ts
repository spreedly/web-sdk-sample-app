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

console.log(sdk);

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
  tokenContainer2!.textContent = error;
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

function handlePaymentFormSubmit(event: Event) {
  event.preventDefault();
  sdk.submit(
    {
      month: (document.getElementById("expiry-month") as HTMLInputElement)
        .value,
      year: (document.getElementById("expiry-year") as HTMLInputElement).value,
      first_name: (document.getElementById("first-name") as HTMLInputElement)
        .value,
      last_name: (document.getElementById("last-name") as HTMLInputElement)
        .value,
      shipping_address1: (
        document.getElementById("shipping-address1") as HTMLInputElement
      ).value,
    },
    {
      platform: "web",
    }
  );
}
