declare const SpreedlyWebSDK: any;

const sdk = new SpreedlyWebSDK({
  environment_key: 'REDACTED_ENVIRONMENT_KEY',
  nonce: '4262DA86-A525-4E50-BC03-0D6A951BD3D5',
  timestamp: '1753712520',
  certificate_token: 'REDACTED_CERTIFICATE_TOKEN',
  signature:
    'gk5S0220SSv2Li6nQ6QUUGHQRfFqriXmlYOIfYj/MtlpzXsFcSfgaU/BjkSH/too5zBEGGAyh07g2xPHTmvwxTqj6oXiqzHvOHdExAYPI20FQussSbvRLgHyTmGsEOaGTFGgTBks21SvPX8Z06EIKhTL9CoCZhgxNEUR6rTmHrYE7oreJrTwtcclNjfAzJiXCguDlWlRVTDplwb0X6RQy7bDZMpKJaW/4/4H3JybTT0jOdi3m/zfN3AayMXVk88a3Z7syhRD0gwIqfwZKSOHgCaznjVKCa7UBC3li3x39wC5csNg14LeXD4aa3xBSC1Vcsi3UWZK34VCwAPtJIbIEaOUuiOrbrLQIaiCJPCmzJkG6YfEHGH2cwMbKgxyZgkgG/jyrgPXPFgoSFwICcVtjhw4a59DSspvPuc0hg8ducMkVHkassgNiP/I3SlAPDWzhdg0FjqKSeZ1bUbNbp4GYmEkci+gEBRrX7WJaH0J9bbkONEjUqRN70zmwWsjNJvQ',
});

sdk.on('ready', () => {
  console.log('in app elements ready');
  sdk.setPlaceholder('cvv', '***');
  sdk.setStyles('number', {
    borderRadius: '5px',
    paddingLeft: '8px',
    paddingRight: '8px',
    fontSize: '18px',
  });
  sdk.setStyles('cvv', {
    borderRadius: '5px',
    paddingLeft: '8px',
    paddingRight: '8px',
    fontSize: '18px',
  });
});

sdk.on('error', (error: any) => {
  tokenContainerError!.style.display = 'block';
  tokenContainerError!.innerHTML = error;
  tokenContainer!.innerHTML = '';
  tokenContainer!.style.display = 'none';
});
sdk.on('tokenGenerated', (token: any) => {
  tokenContainer!.style.display = 'block';
  tokenContainer!.innerHTML = `Token: ${token.tokenResponse.token}`;
  tokenContainerError!.innerHTML = '';
  tokenContainerError!.style.display = 'none';
});
sdk.inAppElements({
  number: {
    containerId: 'spreedly-number-input-container',
  },
  cvv: {
    containerId: 'spreedly-cvv-input-container',
  },
});

function handlePaymentFormSubmit(event: Event) {
  event.preventDefault();
  console.log('submit11', sdk.submit);
  sdk.submit(
    {
      month: (document.getElementById('expiry-month') as HTMLInputElement)
        .value,
      year: (document.getElementById('expiry-year') as HTMLInputElement).value,
      first_name: (document.getElementById('first-name') as HTMLInputElement)
        .value,
      last_name: (document.getElementById('last-name') as HTMLInputElement)
        .value,
      shipping_address1: (
        document.getElementById('shipping-address1') as HTMLInputElement
      ).value,
    },
    {
      platform: 'web',
    }
  );
}
