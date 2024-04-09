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
    ztoolkit.log(err);
    progressWindow(
      `${getString("message-getMeta-error")}, ${err}`,
      "error",
    ).startCloseTimer(10000);
    return;
  }
}

function getSettings(): {
  saveAttachments: boolean;
  libraryID: boolean | null;
  collections?: string[];
} {
  const coll = ZoteroPane.getSelectedCollection()?.id;
  const options = getPref("schema");

  // 创建返回对象的基本结构
  const settings: {
    saveAttachments: boolean;
    libraryID: boolean | null;
    collections?: string[];
  } = {
    saveAttachments: getPref("saveAttachments") as boolean,
    libraryID: options === "save" ? null : false,
  };

  // 如果 coll 存在，才添加到 settings 中
  if (typeof coll === "string") {
    settings.collections = [coll];
  }

  return settings;
}

async function translateDocument(doc: Document) {
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
    ztoolkit.log(err);
  }
  return [];
}

async function translateURL(url: string) {
  let key = url;
  try {
    const uri = Services.io.newURI(url);
    key = uri.host;
  } catch (e) {
    ztoolkit.log(e);
  }
  // Limit to two requests per second per host
  const caller = _getConcurrentCaller(key, 500);
  return caller.start(() => _translateURLNow(url));
}

const _concurrentCallers = new Map();

function _getConcurrentCaller(key: string, interval: number) {
  if (_concurrentCallers.has(key)) {
    return _concurrentCallers.get(key);
  }

  const { ConcurrentCaller } = Components.utils.import(
    "resource://zotero/concurrentCaller.js",
  );

  const caller = new ConcurrentCaller({
    numConcurrent: 1,
    interval,
    onError: (e: any) => ztoolkit.log(e),
  });
  _concurrentCallers.set(key, caller);
  return caller;
}

async function _translateURLNow(url: string | string[]) {
  const doc = (await Zotero.HTTP.processDocuments(url, (doc) => doc))[0];
  const newItems = await translateDocument(doc);
  if (!newItems.length) {
    return null;
  }
  return newItems[0];
}

function _itemToAPIJSON(item: {
  [x: string]: any;
  tags: Array<{
    name: string;
    tag: string;
    type: number;
  } | null>;
}) {
  const newItem: {
    key: string;
    version: number;
    tags: Array<{ tag: string; type: number } | null>;
    [x: string]: any; // Index signature to allow for arbitrary properties
  } = {
    key: Zotero.Utilities.generateObjectKey(),
    version: 0,
    tags: item.tags.map((tag) =>
      tag ? { tag: tag.tag, type: tag.type } : null,
    ),
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
          if (tag === null) {
            return null;
          }

          const tagValue = typeof tag === "object" ? tag.tag || tag.name : tag;
          if (tagValue === "") {
            return null;
          }

          return { tag: tagValue.toString(), type: 1 }; // automatic
        })
        .filter(Boolean) as Array<{ tag: string; type: number } | null>;

      continue;
    }

    newItem[field] = item[field];
  }

  return newItem;
}

async function updateItem(newItem: Zotero.Item, oldItem: Zotero.Item) {
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
