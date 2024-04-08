import { getPref } from "../utils/prefs";
import { progressWindow } from "./message";
import { getString } from "../utils/locale";
import { config } from "../../package.json";

export async function getMeta() {
  const item = ZoteroPane.getSelectedItems()[0];
  try {
    const newItem = await translateURL(item.getField("url"));
    if (getPref("schema") === "save") {
      progressWindow(
        getString("message-saveItem-success"),
        "success",
      ).startCloseTimer(100000);
      return newItem;
    } else {
      progressWindow(
        getString("message-updateItem-success"),
        "success",
      ).startCloseTimer(100000);
      return updateItem(newItem, item);
    }
  } catch (err) {
    Zotero.logError(err);
    progressWindow(
      `${getString("message-getMeta-error")}, ${err}`,
      "error",
    ).startCloseTimer(10000);
    return;
  }
}

function getSettings() {
  const coll = ZoteroPane.getSelectedCollection().id;
  const options = getPref("schema");
  if (options === "save") {
    return {
      libraryID: null,
      saveAttachments: true,
      collections: [coll],
    };
  } else {
    return {
      libraryID: false,
      saveAttachments: true,
      collections: [coll],
    };
  }
}

async function translateDocument(doc) {
  const translate = new Zotero.Translate.Web();
  translate.setDocument(doc);
  const translators = await translate.getTranslators();
  // TEMP: Until there's a generic webpage translator
  if (!translators.length) {
    return [];
  }
  translate.setTranslator(translators[0]);

  const options = getSettings();
  try {
    return await translate.translate(options);
  } catch (err) {
    Zotero.logError(err);
  }
  return [];
}

async function translateURL(url) {
  let key = url;
  try {
    const uri = Services.io.newURI(url);
    key = uri.host;
  } catch (e) {
    Zotero.logError(e);
  }
  // Limit to two requests per second per host
  const caller = _getConcurrentCaller(key, 500);
  return caller.start(() => _translateURLNow(url));
}

const _concurrentCallers = new Map();

function _getConcurrentCaller(key, interval) {
  if (_concurrentCallers.has(key)) {
    return _concurrentCallers.get(key);
  }

  const { ConcurrentCaller } = Cu.import(
    "resource://zotero/concurrentCaller.js",
  );
  const caller = new ConcurrentCaller({
    numConcurrent: 1,
    interval,
    onError: (e) => Zotero.logError(e),
  });
  _concurrentCallers.set(key, caller);
  return caller;
}

async function _translateURLNow(url) {
  const doc = (await Zotero.HTTP.processDocuments(url, (doc) => doc))[0];
  const newItems = await translateDocument(doc);
  if (!newItems.length) {
    return null;
  }
  return newItems[0];
}

function _itemToAPIJSON(item) {
  const newItem = {
    key: Zotero.Utilities.generateObjectKey(),
    version: 0,
  };
  for (const field in item) {
    if (
      field === "complete" ||
      field === "itemID" ||
      field === "attachments" ||
      field === "seeAlso" ||
      field === "notes"
    ) {
      continue;
    }

    if (field === "tags") {
      newItem.tags = item.tags
        .map((tag) => {
          if (typeof tag === "object") {
            if (tag.tag) {
              tag = tag.tag;
            } else if (tag.name) {
              tag = tag.name;
            } else {
              Zotero.debug("_itemToAPIJSON: Discarded invalid tag");
              return null;
            }
          } else if (tag === "") {
            return null;
          }

          return { tag: tag.toString(), type: 1 }; // automatic
        })
        .filter(Boolean);

      continue;
    }

    newItem[field] = item[field];
  }

  return newItem;
}

async function updateItem(newItem, oldItem) {
  if (newItem instanceof Zotero.Item) {
    ztoolkit.log("newitem is Zotero.Item");
  } else {
    // Convert `newItem` to Zotero.Item through API JSON format
    ztoolkit.log("newitem  not is Zotero.Item");
    const tmpItem = new Zotero.Item();
    tmpItem.fromJSON(_itemToAPIJSON(newItem));
    newItem = tmpItem;
  }
  if (newItem instanceof Zotero.Item) {
    ztoolkit.log("newitem is Zotero.Item", newItem);
  }

  let allFields = Zotero.ItemFields.getItemTypeFields(newItem.itemTypeID);
  allFields = [...new Set(allFields)].map((x) => Zotero.ItemFields.getName(x));
  ztoolkit.log("allFields03", allFields);
  for (const fieldName of allFields) {
    ztoolkit.log("fieldName", fieldName);
    const oldValue = oldItem.getField(fieldName) || "";
    const newValue = newItem.getField(fieldName) || "";
    oldItem.setField(fieldName, newValue);
  }

  const oldCreators = oldItem.getCreators();
  const newCreators = newItem.getCreators();

  oldItem.setCreators(newCreators);
  ztoolkit.log("update meta");
  oldItem.save();
  return oldItem;
}
