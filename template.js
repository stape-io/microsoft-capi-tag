/// <reference path="./server-gtm-sandboxed-apis.d.ts" />

const BigQuery = require('BigQuery');
const encodeUriComponent = require('encodeUriComponent');
const generateRandom = require('generateRandom');
const getAllEventData = require('getAllEventData');
const getContainerVersion = require('getContainerVersion');
const getCookieValues = require('getCookieValues');
const getRequestHeader = require('getRequestHeader');
const getTimestampMillis = require('getTimestampMillis');
const getType = require('getType');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const makeInteger = require('makeInteger');
const makeNumber = require('makeNumber');
const makeString = require('makeString');
const Object = require('Object');
const parseUrl = require('parseUrl');
const sendHttpRequest = require('sendHttpRequest');
const sendPixelFromBrowser = require('sendPixelFromBrowser');
const setCookie = require('setCookie');
const sha256Sync = require('sha256Sync');

/*==============================================================================
==============================================================================*/

const traceId = getRequestHeader('trace-id');
const eventData = getAllEventData();
const useOptimisticScenario = isUIFieldTrue(data.useOptimisticScenario);

if (!isConsentGivenOrNotRequired(data, eventData)) {
  return data.gtmOnSuccess();
}

const url = eventData.page_location || getRequestHeader('referer');
if (url && url.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0) {
  return data.gtmOnSuccess();
}

const mappedData = mapEvent(data, eventData);

setClickIdCookie(data, mappedData.data[0].userData.msclkid);
setAnonymousIdCookie(data, mappedData.data[0].userData.anonymousId);
sendIdSyncFromBrowser(data, mappedData);
sendRequest(data, mappedData);

if (useOptimisticScenario) {
  return data.gtmOnSuccess();
}

/*==============================================================================
  Vendor related functions
==============================================================================*/

function parseClickIdFromUrl(eventData) {
  const url = eventData.page_location || getRequestHeader('referer');
  if (!url) return;

  const urlSearchParams = parseUrl(url).searchParams;
  return urlSearchParams.msclkid;
}

function getClickId(eventData) {
  const commonCookie = eventData.commonCookie || {};

  const clickIdFromUrl = parseClickIdFromUrl(eventData);
  if (clickIdFromUrl) return clickIdFromUrl;

  const clickIdFromServerCookie = getCookieValues('uet_msclkid')[0] || commonCookie.uet_msclkid;
  if (clickIdFromServerCookie) return clickIdFromServerCookie;

  const clickIdFromJSCookie = getCookieValues('_uetmsclkid')[0] || commonCookie._uetmsclkid;
  if (clickIdFromJSCookie) return clickIdFromJSCookie.replace('_uet', '');
}

function setClickIdCookie(data, clickId) {
  if (!isUIFieldTrue(data.setClickIdCookie) || !clickId) return;

  const cookieOptions = {
    domain: data.clickIdCookieDomain || 'auto',
    samesite: 'Lax',
    path: '/',
    secure: true,
    httpOnly: !!data.clickIdCookieHttpOnly,
    'max-age': 60 * 60 * 24 * makeInteger(data.clickIdCookieExpiration || 90)
  };

  setCookie('uet_msclkid', clickId, cookieOptions, false);
}

function getAnonymousId(eventData) {
  const commonCookie = eventData.commonCookie || {};

  const anonymousIdFromServerCookie = getCookieValues('uet_vid')[0] || commonCookie._uet_vid;
  if (anonymousIdFromServerCookie) return anonymousIdFromServerCookie;

  const anonymousIdFromJSCookie = getCookieValues('_uetvid')[0] || commonCookie._uetvid;
  if (anonymousIdFromJSCookie) return anonymousIdFromJSCookie;

  if (isUIFieldTrue(data.setAnonymousIdCookie)) return generateUUID();
}

function setAnonymousIdCookie(data, anonymousId) {
  if (!isUIFieldTrue(data.setAnonymousIdCookie) || !anonymousId) return;

  const cookieOptions = {
    domain: data.anonymousIdCookieDomain || 'auto',
    samesite: 'Lax',
    path: '/',
    secure: true,
    httpOnly: !!data.anonymousIdCookieHttpOnly,
    'max-age': 60 * 60 * 24 * makeInteger(data.anonymousIdCookieExpiration || 390)
  };

  setCookie('uet_vid', anonymousId, cookieOptions, false);
}

function addServerEventData(data, eventData, event) {
  if (isUIFieldTrue(data.autoMapServerEventDataParameters)) {
    const eventId = eventData.event_id || eventData.eventId;
    if (eventId) event.eventId = makeString(eventId);

    event.eventTime = makeInteger(getTimestampMillis() / 1000);

    if (eventData.page_location) event.eventSourceUrl = eventData.page_location;
    if (eventData.page_title) event.pageTitle = eventData.page_title;
    if (eventData.page_referrer) event.referrerUrl = eventData.page_referrer;
  }

  if (data.serverEventDataList) {
    data.serverEventDataList.forEach((d) => (event[d.name] = d.value));
  }

  if (isUIFieldFalse(data.consent)) event.adStorageConsent = 'D';
  else if (isUIFieldTrue(data.consent)) event.adStorageConsent = 'G';

  return event;
}

function addUserData(data, eventData, event) {
  const userData = {};

  if (isUIFieldTrue(data.autoMapUserDataParameters)) {
    const eventDataUserData = eventData.user_data || {};

    let email =
      eventData.email ||
      eventData.email_address ||
      eventDataUserData.email ||
      eventDataUserData.email_address ||
      eventDataUserData.sha256_email_address;
    const emailType = getType(email);
    if (emailType === 'array' || emailType === 'object') email = email[0];

    if (email) userData.em = email;

    let phone =
      eventData.phone ||
      eventData.phone_number ||
      eventDataUserData.phone ||
      eventDataUserData.phone_number ||
      eventDataUserData.sha256_phone_number;
    const phoneType = getType(phone);
    if (phoneType === 'array' || phoneType === 'object') phone = phone[0];

    if (phone) userData.ph = phone;

    if (eventData.user_id) userData.externalId = makeString(eventData.user_id);

    if (eventData.ip_override) userData.clientIpAddress = eventData.ip_override;

    if (eventData.user_agent) userData.clientUserAgent = eventData.user_agent;

    const mobileDeviceId = eventData['x-ga-resettable_device_id'];
    const platform = eventData['x-ga-platform'];
    if (mobileDeviceId) {
      if (platform === 'ios') userData.idfa = mobileDeviceId;
      else if (platform === 'android') userData.gaid = mobileDeviceId;
    }

    const clickId = getClickId(eventData);
    if (clickId) userData.msclkid = clickId;

    const anonymousId = getAnonymousId(eventData);
    if (anonymousId) userData.anonymousId = anonymousId;
  }

  if (getType(data.userDataParametersObject) === 'object') {
    mergeObj(userData, data.userDataParametersObject);
  }
  if (data.userDataParametersList) {
    data.userDataParametersList.forEach((d) => (userData[d.name] = d.value));
  }

  event.userData = userData;

  return event;
}

function addEventData(data, eventData, event) {
  const customData = {};

  if (isUIFieldTrue(data.autoMapServerEventDataParameters)) {
    let currencyFromItems;
    let valueFromItems;
    if (getType(eventData.items) === 'array' && eventData.items.length > 0) {
      customData.items = [];
      customData.itemIds = [];
      valueFromItems = 0;
      currencyFromItems = eventData.items[0].currency;
      const itemIdKey = data.itemIdKey ? data.itemIdKey : 'item_id';
      eventData.items.forEach((i) => {
        const item = {};
        if (i[itemIdKey]) item.id = makeString(i[itemIdKey]);
        if (i.item_name) item.name = makeString(i.item_name);
        if (i.quantity) item.quantity = makeInteger(i.quantity);
        if (isValidValue(i.price)) {
          item.price = makeNumber(i.price);
          valueFromItems += item.quantity ? item.quantity * item.price : item.price;
        }
        customData.items.push(item);
        customData.itemIds.push(item.id);
      });
    }

    if (isValidValue(eventData.value)) {
      const value = makeNumber(eventData.value);
      customData.value = value;
      customData.eventValue = value;
      customData.ecommTotalValue = value;
    } else if (isValidValue(valueFromItems)) {
      customData.value = valueFromItems;
      customData.eventValue = valueFromItems;
      customData.ecommTotalValue = valueFromItems;
    }

    const currency = eventData.currency || currencyFromItems;
    if (currency) customData.currency = makeString(currency);

    if (eventData.transaction_id) {
      customData.transactionId = makeString(eventData.transaction_id);
    }

    if (eventData.search_term) {
      customData.searchTerm = makeString(eventData.search_term);
    }
  }

  // Accounting for "Inherit from client" UI option
  const pageType = mapPageType(data, eventData);
  if (pageType) customData.pageType = makeString(pageType);

  if (getType(data.eventParametersObject) === 'object') {
    mergeObj(customData, data.eventParametersObject);
  }
  if (data.eventParametersList) {
    data.eventParametersList.forEach((d) => {
      const names = d.name.split('.');
      names.reduce((acc, name, index) => {
        const isLastKey = index === names.length - 1;
        if (isLastKey) acc[name] = d.value;
        else acc[name] = acc[name] || {};
        return acc[name];
      }, customData);
    });
  }

  event.customData = customData;

  return event;
}

function normalizeUserData(userData) {
  const normalizeEmail = (email) => {
    if (!email) return email;
    const emailSplit = email.split('@');
    emailSplit[0] = emailSplit[0].split('.').join('').split('+')[0];
    return emailSplit.join('@');
  };

  const normalizePhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return phoneNumber;
    return phoneNumber
      .split(' ')
      .join('')
      .split('-')
      .join('')
      .split('(')
      .join('')
      .split(')')
      .join('');
  };

  if (userData.em) userData.em = normalizeEmail(userData.em);
  if (userData.ph) userData.ph = normalizePhoneNumber(userData.ph);

  return userData;
}

function hashDataIfNeeded(event) {
  const userData = event.userData;
  const hasUserData = getType(userData) === 'object' && Object.entries(userData).length > 0;
  if (hasUserData) {
    normalizeUserData(userData);
    const userDataKeysToHash = ['em', 'ph', 'externalId'];
    userDataKeysToHash.forEach((key) => {
      const value = userData[key];
      if (!value) return;
      userData[key] = hashData(value);
    });
  }

  return event;
}

function mapEventType(data, eventData) {
  if (data.eventTypeSetupMethod === 'inherit') {
    const eventName = eventData.event_name;

    const gaToEventType = {
      page_view: 'pageLoad',
      'gtm.dom': 'pageLoad',
      search: 'custom',
      view_search_results: 'custom',
      view_item: 'custom',
      view_cart: 'custom',
      purchase: 'custom'
    };

    if (gaToEventType[eventName]) {
      return gaToEventType[eventName];
    }

    return 'custom';
  } else if (data.eventTypeSetupMethod === 'standard') {
    return data.eventType;
  }
}

function mapEventName(data, eventData) {
  if (data.eventTypeSetupMethod === 'inherit') {
    const eventName = eventData.event_name;

    const gaToEventName = {
      search: 'search',
      view_search_results: 'view_search_results',
      view_item: 'view_item',
      view_cart: 'view_cart',
      purchase: 'purchase'
    };

    if (gaToEventName[eventName]) {
      return gaToEventName[eventName];
    }
  } else if (data.eventTypeSetupMethod === 'standard') {
    return data.customEventEventName;
  }
}

function mapPageType(data, eventData) {
  if (data.pageType) return data.pageType;
  else if (data.eventTypeSetupMethod === 'inherit') {
    const eventName = eventData.event_name;

    const gaToPageType = {
      search: 'searchresults',
      view_search_results: 'searchresults',
      view_item: 'product',
      view_cart: 'cart',
      purchase: 'purchase'
    };

    if (gaToPageType[eventName]) {
      return gaToPageType[eventName];
    }
  }
}

function mapEvent(data, eventData) {
  const event = {
    eventType: mapEventType(data, eventData),
    eventName: mapEventName(data, eventData)
  };
  const mappedData = {
    data: [event]
  };

  addServerEventData(data, eventData, event);
  addUserData(data, eventData, event);
  addEventData(data, eventData, event);
  hashDataIfNeeded(event);

  return mappedData;
}

function sendIdSyncFromBrowser(data, mappedData) {
  if (!isUIFieldTrue(data.enableClientSideIdSync)) return;

  const event = mappedData.data[0];

  const accountCustomerId = data.accountCustomerId;
  const anonymousId = event.userData.anonymousId;
  if (!accountCustomerId || !anonymousId) {
    log({
      Name: 'MicrosoftUETCAPI',
      Type: 'Message',
      TraceId: traceId,
      EventName: 'Client-Side ID Sync',
      Message: 'Client-Side ID Sync request was not sent.',
      Reason: 'One or more required parameters are missing: accountCustomerId or anonymousId'
    });

    return;
  }

  let idSyncRequestUrl =
    'https://c.bing.com/c.gif?Red3=BACID_' + enc(accountCustomerId) + '&vid=' + enc(anonymousId);

  const userId = event.userData.externalId;
  if (userId) idSyncRequestUrl += '&uid=' + enc(userId);

  sendPixelFromBrowser(idSyncRequestUrl);
}

function generateRequestBaseUrl(data) {
  const version = 'v1';
  return 'https://capi.uet.microsoft.com/' + version + '/' + enc(data.uetTagId) + '/events';
}

function generateRequestOptions(data) {
  const options = {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + data.authToken,
      'Content-Type': 'application/json'
    }
  };

  return options;
}

function sendRequest(data, mappedData) {
  const requestUrl = generateRequestBaseUrl(data);
  const requestOptions = generateRequestOptions(data);

  log({
    Name: 'MicrosoftUETCAPI',
    Type: 'Request',
    TraceId: traceId,
    EventName: eventNameForLogs(mappedData),
    RequestMethod: requestOptions.method,
    RequestUrl: requestUrl,
    RequestBody: mappedData
  });

  return sendHttpRequest(
    requestUrl,
    (statusCode, headers, body) => {
      log({
        Name: 'MicrosoftUETCAPI',
        Type: 'Response',
        TraceId: traceId,
        EventName: eventNameForLogs(mappedData),
        ResponseStatusCode: statusCode,
        ResponseHeaders: headers,
        ResponseBody: body
      });

      if (!useOptimisticScenario) {
        if (statusCode >= 200 && statusCode < 400) data.gtmOnSuccess();
        else data.gtmOnFailure();
      }
    },
    requestOptions,
    JSON.stringify(mappedData)
  );
}

/*==============================================================================
  Helpers
==============================================================================*/

function mergeObj(target, source) {
  for (const key in source) {
    if (source.hasOwnProperty(key)) target[key] = source[key];
  }
  return target;
}

function isUIFieldTrue(field) {
  return [true, 'true'].indexOf(field) !== -1;
}

function isUIFieldFalse(field) {
  return [false, 'false'].indexOf(field) !== -1;
}

function isValidValue(value) {
  const valueType = getType(value);
  return valueType !== 'null' && valueType !== 'undefined' && value !== '';
}

function enc(data) {
  return encodeUriComponent(makeString(data || ''));
}

function random() {
  return generateRandom(1000000000000000, 10000000000000000) / 10000000000000000;
}

function generateUUID() {
  function s(n) {
    return h((random() * (1 << (n << 2))) ^ getTimestampMillis()).slice(-n);
  }
  function h(n) {
    return (n | 0).toString(16);
  }
  return [
    s(4) + s(4),
    s(4),
    '4' + s(3),
    h(8 | (random() * 4)) + s(3),
    getTimestampMillis().toString(16).slice(-10) + s(2)
  ].join('');
}

function isHashed(value) {
  if (!value) return false;
  return makeString(value).match('^[A-Fa-f0-9]{64}$') !== null;
}

function hashData(value) {
  if (!value) return value;

  const type = getType(value);

  if (value === 'undefined' || value === 'null') return undefined;

  if (type === 'array') {
    return value.map((val) => hashData(val));
  }

  if (type === 'object') {
    return Object.keys(value).reduce((acc, val) => {
      acc[val] = hashData(value[val]);
      return acc;
    }, {});
  }

  if (isHashed(value)) return value;

  return sha256Sync(makeString(value).trim().toLowerCase(), {
    outputEncoding: 'hex'
  });
}

function isConsentGivenOrNotRequired(data, eventData) {
  if (data.adStorageConsent !== 'required') return true;
  if (eventData.consent_state) return !!eventData.consent_state.ad_storage;
  const xGaGcs = eventData['x-ga-gcs'] || ''; // x-ga-gcs is a string like "G110"
  return xGaGcs[2] === '1';
}

function eventNameForLogs(mappedData) {
  const event = mappedData.data[0];
  return event.eventType + (event.eventName ? ':' + event.eventName : '');
}

function log(rawDataToLog) {
  const logDestinationsHandlers = {};
  if (determinateIsLoggingEnabled()) logDestinationsHandlers.console = logConsole;
  if (determinateIsLoggingEnabledForBigQuery()) logDestinationsHandlers.bigQuery = logToBigQuery;

  const keyMappings = {
    // No transformation for Console is needed.
    bigQuery: {
      Name: 'tag_name',
      Type: 'type',
      TraceId: 'trace_id',
      EventName: 'event_name',
      RequestMethod: 'request_method',
      RequestUrl: 'request_url',
      RequestBody: 'request_body',
      ResponseStatusCode: 'response_status_code',
      ResponseHeaders: 'response_headers',
      ResponseBody: 'response_body'
    }
  };

  for (const logDestination in logDestinationsHandlers) {
    const handler = logDestinationsHandlers[logDestination];
    if (!handler) continue;

    const mapping = keyMappings[logDestination];
    const dataToLog = mapping ? {} : rawDataToLog;

    if (mapping) {
      for (const key in rawDataToLog) {
        const mappedKey = mapping[key] || key;
        dataToLog[mappedKey] = rawDataToLog[key];
      }
    }

    handler(dataToLog);
  }
}

function logConsole(dataToLog) {
  logToConsole(JSON.stringify(dataToLog));
}

function logToBigQuery(dataToLog) {
  const connectionInfo = {
    projectId: data.logBigQueryProjectId,
    datasetId: data.logBigQueryDatasetId,
    tableId: data.logBigQueryTableId
  };

  dataToLog.timestamp = getTimestampMillis();

  ['request_body', 'response_headers', 'response_body'].forEach((p) => {
    dataToLog[p] = JSON.stringify(dataToLog[p]);
  });

  const bigquery =
    getType(BigQuery) === 'function' ? BigQuery() /* Only during Unit Tests */ : BigQuery;
  bigquery.insert(connectionInfo, [dataToLog], { ignoreUnknownValues: true });
}

function determinateIsLoggingEnabled() {
  const containerVersion = getContainerVersion();
  const isDebug = !!(
    containerVersion &&
    (containerVersion.debugMode || containerVersion.previewMode)
  );

  if (!data.logType) {
    return isDebug;
  }

  if (data.logType === 'no') {
    return false;
  }

  if (data.logType === 'debug') {
    return isDebug;
  }

  return data.logType === 'always';
}

function determinateIsLoggingEnabledForBigQuery() {
  if (data.bigQueryLogType === 'no') return false;
  return data.bigQueryLogType === 'always';
}
