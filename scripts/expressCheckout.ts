// declare const SpreedlyWebSDK: any;

const sdkE = new SpreedlyWebSDK({
  environment_key: "REDACTED_ENVIRONMENT_KEY",
  "nonce": "D9D0C270-3AAE-4711-9FE9-3F8CC77AFD27",
  "timestamp": "1753712209",
  "certificate_token": "REDACTED_CERTIFICATE_TOKEN",
  "signature": "QYmhA6RwedV1n5IeUUi8TTKul0lbYsoH/wXau2WE7ZTy9wuWjceBeirMPMHcsZ7Goi+P2xyf9xIF3P0SxpM1phjHQ6zOdAuSQ+f1mGOc6o33QHFNB48QbKRI/7ZboiFjaw7TnE8OYk53GP9smYTshmUxOyJVOftTZNJJr29Pk2HnkNLdLKHRW7wER6bSfIzf0+mjzI13C+7+njvprRmpoxnTwVdjiiwMWM2qHq4tyVoVsYO12tVZZgfilX/0Obw7oFrm88EqjCWYDT9ATHTyPiokG4ZfZplaWE7GyjQ/gB4laZQpK0623cDbgqHZCuexm+07Pncg5eSPK7ApTC/rbPifenjfXh/bu9o843YW4LmWh/hxHBsJCDGCGzEReDIwGdW11X5Qzp5py0Q0+SCrOPaamBOSARZxGisYkt+2k+cR9uXzxhDcWpkbP7f05BANShwDeKDomeC9fuv6Nla3sxEjJyVSbAaYhiglP0MD8heJUuj8va9m2j/o+yFDPS4q"
});

const tokenContainer = document.getElementById("token-container");
const tokenContainerError = document.getElementById("token-container-error");

document.getElementById("express-checkout")?.addEventListener("click", () => {
  sdkE.on("ready", () => {
    sdkE.addField("shipping_address1", {
      fieldName: "shipping_address1",
      label: "Shipping Address 1",
      placeholder: "Shipping Address 1",
      isRequired: false,
    });
    sdkE.setFieldConfig("shipping_address1", {
      styles: {
        backgroundColor: "cyan",
      },
    });
  });
  sdkE.on("error", (error: any) => {
    sdkE.close();
    tokenContainerError!.style.display = "block";
    tokenContainerError!.innerHTML = error;
    tokenContainer!.innerHTML = "";
    tokenContainer!.style.display = "none";
  });
  sdkE.on("tokenGenerated", (token: any) => {
    sdkE.close();
    tokenContainer!.style.display = "block";
    tokenContainer!.innerHTML = `Token: ${token.tokenResponse.token}`;
    tokenContainerError!.innerHTML = "";
    tokenContainerError!.style.display = "none";
  });
  sdkE.expressCheckout({
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
    metadata: {
      platform: "web",
    },
  });
});
