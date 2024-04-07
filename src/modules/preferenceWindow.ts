import { config, homepage } from "../../package.json";
import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";

export function registerPrefsWindow() {
  Zotero.PreferencePanes.register({
    pluginID: config.addonID,
    src: rootURI + "chrome/content/preferences.xhtml",
    label: getString("pref-title"),
    image: `chrome://${config.addonRef}/content/icons/favicon.png`,
    helpURL: homepage,
  });
}

export async function registerPrefsScripts(_window: Window) {
  // This function is called when the prefs window is opened
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
      columns: [],
      rows: [],
    };
  } else {
    addon.data.prefs.window = _window;
  }
  updatePrefsUI();
  bindPrefEvents();
}

async function updatePrefsUI() {
  disablePrefs();
}

function bindPrefEvents() {
  const doc = addon.data.prefs!.window?.document;
  if (!doc) {
    return;
  }
  ztoolkit.UI.replaceElement(
    {
      tag: "menulist",
      attributes: {
        value: getPref("schema") as string,
        native: "true",
      },
      listeners: [
        {
          type: "command",
          listener: (e: Event) => {
            if (e.target) {
              const target = e.target as HTMLInputElement;
              setPref("schema", target.value);
              ztoolkit.log(target.value);
            }
          },
        },
      ],
      children: [
        {
          tag: "menupopup",
          children: [
            {
              tag: "menuitem",
              attributes: {
                label: getString("schema-saveItem"),
                value: "save",
              },
            },
            {
              tag: "menuitem",
              attributes: {
                label: getString("schema-updateItem"),
                value: "update",
              },
            },
          ],
        },
      ],
    },
    doc.querySelector(`#${makeId("select-schema")}`) as HTMLElement,
  );
}
function disablePrefs() {
  const state = getPref("saveAttachments");
  addon.data.prefs?.window.document
    .getElementById(`${config.addonRef}-saveAttachments`)
    ?.setAttribute("disabled", String(!state));
}

function makeId(type: string) {
  return `${config.addonRef}-${type}`;
}
