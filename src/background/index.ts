import { createGist, getGist } from './syncService';
import { localStoragePromise, syncStoragePromise } from '../utils';
import {
  STORAGE_TOKEN,
  STORAGE_GIST_ID,
  STORAGE_GIST_UPDATE_TIME,
  STORAGE_TAGS,
  STORAGE_REPO,
  IS_UPDATE_LOCAL,
  STORAGE_SETTINGS,
  IMessageAction,
  ERROR_MSG,
  IResponseMsg,
} from '../typings';
import {
  updateGistDebounce,
  ISyncInfo,
  checkSync,
  updateGist,
  updateLocal,
  initEnv,
} from './utils';

// record tab id
window.tabId = null;

window.REMU_GIST_ID = '';
window.REMU_TOKEN = '';
window.REMU_GIST_UPDATE_AT = '';

chrome.browserAction.onClicked.addListener(function() {
  const index = chrome.extension.getURL('view-tab.html');

  if (window.tabId) {
    chrome.tabs.update(window.tabId, { selected: true });
  } else {
    chrome.tabs.create({ url: index }, function(tab) {
      window.tabId = tab.id;
    });
  }
});

// remove tab
chrome.tabs.onRemoved.addListener(function(tabId) {
  if (tabId === window.tabId) {
    window.tabId = null;
  }
});

chrome.storage.onChanged.addListener(function(changes, areaName) {
  if (areaName === 'sync') {
    // only add token
    if (changes[STORAGE_TOKEN] && !window.REMU_GIST_ID) {
      const token = changes[STORAGE_TOKEN].newValue;
      createGist('create gist', token).then(({ data }) => {
        const gistId = data.id;
        const updateTime = data.updated_at;
        return syncStoragePromise
          .set({
            [STORAGE_GIST_ID]: gistId,
            [STORAGE_GIST_UPDATE_TIME]: updateTime,
          })
          .then(() => {
            window.REMU_GIST_ID = gistId;
            window.REMU_TOKEN = token;
            window.REMU_GIST_UPDATE_AT = updateTime;
          });
      });
    }
  }

  if (areaName === 'local') {
    if (changes[STORAGE_REPO] && !changes[IS_UPDATE_LOCAL]) {
      if (window.REMU_GIST_ID) {
        const info: ISyncInfo = {
          token: window.REMU_TOKEN,
          gistId: window.REMU_GIST_ID,
        };
        if (window.timeoutId) {
          clearTimeout(window.timeoutId);
        }
        window.timeoutId = window.setTimeout(() => {
          updateGist(info);
        }, window.REMU_SYNC_DELAY);
      }
    }
  }
});

initEnv().then(checkSync);

chrome.runtime.onMessage.addListener(function(
  request: IMessageAction,
  sender,
  sendResponse,
) {
  const { type, payload } = request;
  let message: IResponseMsg;
  if (type === 'refresh') {
    initEnv().then(() => {
      message = { status: 'success' };
      sendResponse(message);
    });
  } else if (window.REMU_GIST_ID) {
    if (type === 'updateGist') {
      initEnv()
        .then(updateGist)
        .then(() => {
          message = { status: 'success' };
          sendResponse(message);
        })
        .catch(() => {
          message = { status: 'error' };
          sendResponse(message);
        });
    } else if (type === 'updateLocal') {
      initEnv()
        .then(getGist)
        .then(({ data }) => {
          return updateLocal(data).then(() => {
            message = { status: 'success' };
            sendResponse(message);
          });
        })
        .catch(() => {
          message = { status: 'error' };
          sendResponse(message);
        });
    }
  } else {
    message = {
      status: 'error',
    };

    sendResponse(message);
  }
});
