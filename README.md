# Microsoft UET Conversion API Tag for Google Tag Manager Server-Side

The **Microsoft UET Conversion API Tag** for Google Tag Manager Server-Side allows you to send web events directly from your server to Microsoft Advertising. This server-to-server integration helps you track conversions more accurately and reliably, especially in environments with cookie restrictions.

The tag supports standard `Page Load` events as well as `Custom` events, and can automatically inherit and map events from a Google Analytics 4 data stream.

## How to use the Microsoft UET Conversion API Tag

1.  Add the **Microsoft UET Conversion API Tag** to your server container in GTM.
2.  Choose your **Event Type Setup Method**: either "Standard" to manually configure events or "Inherit from client" to automatically map from GA4 events.
3.  Enter your **UET Tag ID** (found under _Conversion Tracking → UET tag_ in Microsoft Ads) and **Authorization Token** (generated in Microsoft Ads or provided by your account manager).
4.  Configure the **Server Event Data**, **User Data** and **Event Data** parameters. The tag can auto-map many of these fields from your event data.
5.  Enable **Client-Side ID Sync** for improved user matching and remarketing capabilities.
6.  Add a trigger to fire the tag (e.g., on a custom event or a GA4 client claim).

## Event Type Setup

You can configure how events are sent in two ways:

- **Standard**: Manually select the event type (`Page Load` or `Custom`) and specify the event name for custom conversion goals.
- **Inherit from client**: If your server container receives GA4 events, the tag will automatically map common GA4 event names to their Microsoft UET equivalents (e.g., `page_view` → `pageLoad`, `purchase` -> `purchase`, `view_item` -> `product` etc.). Note that this auto-mapping is limited.

## Parameters

### Main Configuration

- **UET Tag ID**: Your UET Tag ID from your Microsoft Ads account.
- **Authorization Token**: The auth token generated in Microsoft Ads or provided by your account manager.
- **Enable Client-Side ID Sync**: Strongly recommended. This allows your internal IDs to be mapped to Microsoft IDs for better user matching and remarketing via a browser pixel. It requires your Microsoft Customer ID / Manager Account ID.

### Anonymous ID and Click ID Settings

The tag automatically handles the Microsoft Click ID (`msclkid`) and Anonymous ID.

- It captures the `msclkid` from the URL parameter, or `uet_msclkid` cookie from server GTM, or the `_uetmsclkid` JS script cookie.
- It sources the Anonymous ID from the `uet_vid` cookie from server GTM, or `_uetvid` JS script cookie or auto-generates one if needed.
- You can control whether the tag sets these values as cookies and configure their expiration and domain.
- Server GTM will save both into their own cookies and use a different name from the ones used by the JS script.
  - Anonymous ID: `uet_vid`
  - Click ID: `uet_msclkid`

### Server Event Data Parameters

These parameters describe the server-side context in which the event occurred.

- **Parameters**: Includes common parameters like `Event ID`, `Event Source URL`, `Event Time`, and `Page Title`, among others.
- **Auto-mapping**: If enabled, the tag automatically populates these fields from the incoming event data (e.g., `Event Source URL` is mapped from `page_location`).
- **Consent**: You can also specify if Ad Storage consent was granted for the event.

### User Data Parameters

These parameters include various user identifiers to improve event match quality.

**At least one user identifier is required.**

- **Identifiers**: Includes common identifiers like `Anonymous ID`, `Click ID`, `Email`, `Phone Number`, and `External ID` (User ID). Other identifiers like `IP Address` and mobile device IDs (`IDFA`/`GAID`) can also be sent.
- **Auto-mapping**: If enabled, the tag automatically populates these fields from common keys in the incoming event data (e.g., `Email` is mapped from `user_data.email_address`).
- **Hashing**: The tag will automatically SHA-256 hash the Email, Phone Number, and External ID if they are provided in plain text.

### Event Parameters

These parameters provide specific details about the user's action.

- **Parameters**: Includes `Page Type`, e-commerce data (like `Revenue Value`, `Currency`, and `Items`), and custom goal values (like `Event Category` and `Event Label`), among others.
- **Auto-mapping**: If enabled, the tag automatically populates many of these fields from a standard GA4 or e-commerce data structure in your event data (e.g., `Revenue Value` is mapped from `value`).
- **Page Type**: Categorizes the page where the event occurred (e.g., `product`, `cart`, `purchase`). This is auto-mapped when inheriting from a GA4 client.

## Intellisense for GTM Server-Side

To enable Intellisense and enhance your template development workflow, you can follow the instructions provided at the [Stape.io Google Tag Manager APIs Intellisense repository](https://github.com/stape-io/google-tag-manager-apis-intellisense). This will provide auto-completion and type-checking for the Sandboxed JS APIs within your code editor.

## Useful Resources:

- [Step-by-step guide on how to configure Microsoft UET Conversion API Tag](https://stape.io/blog/guide-microsoft-conversion-api-integration)

## Open Source

The **Microsoft UET Conversion API Tag for GTM Server-Side** is developed and maintained by the [Stape Team](https://stape.io/) under the Apache 2.0 license.
