import { Request, Response } from 'express';

// GET /.well-known/apple-app-site-association and /.well-known/assetlinks.json
// Verification files for the PayPal PPCP return in the iOS (Universal Link, HC-1586) and
// Android (App Link) SDK demo apps. Both OSes need 200 + application/json with no redirect,
// and the files are served byte-for-byte as the mobile teams sent them — don't edit entries
// without telling the owning team, or the link breaks for that app on its next install.
const CACHE_CONTROL = 'public, max-age=300'; // short until the mobile teams confirm verification

const APPLE_APP_SITE_ASSOCIATION = `{
  "applinks": {
    "details": [
      {
        "appIDs": [
          "U3MS36UDEL.com.spreedly-example.sdk.SpreedlySDKExample",
          "U3MS36UDEL.com.spreedly.example.SpreedlySDKExampleObjectiveC"
        ],
        "components": [
          { "/": "/*", "comment": "All checkout return paths on this host" }
        ]
      }
    ]
  }
}
`;

const ASSET_LINKS = `[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.spreedly.app",
      "sha256_cert_fingerprints": [
        "D9:64:00:5A:0A:20:45:41:9C:18:24:46:DE:4D:DB:DB:88:8E:D6:5F:B6:1D:D6:CF:ED:2D:DC:A6:59:75:07:3C"
      ]
    }
  },
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.spreedly.app.dev",
      "sha256_cert_fingerprints": [
        "D9:64:00:5A:0A:20:45:41:9C:18:24:46:DE:4D:DB:DB:88:8E:D6:5F:B6:1D:D6:CF:ED:2D:DC:A6:59:75:07:3C"
      ]
    }
  }
]
`;

const sendJsonFile = (res: Response, body: string): void => {
  res.set('Cache-Control', CACHE_CONTROL);
  res.type('application/json').send(body);
};

export const getAppleAppSiteAssociation = (_req: Request, res: Response): void =>
  sendJsonFile(res, APPLE_APP_SITE_ASSOCIATION);

export const getAssetLinks = (_req: Request, res: Response): void =>
  sendJsonFile(res, ASSET_LINKS);
