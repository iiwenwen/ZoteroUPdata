import { getPref } from "../utils/prefs";
import { progressWindow } from "./message";
import { getString } from "../utils/locale";

export async function getMeta() {
  const item = ZoteroPane.getSelectedItems()[0];
  try {
    const newItem = await translateURL(item.getField("url"));
    if (getPref("schema") === "save") {
      progressWindow(
        getString("message-saveItem-success"),
        "success",
      ).startCloseTimer(3000);
      return newItem;
    } else {
      progressWindow(
        getString("message-updateItem-success"),
        "success",
      ).startCloseTimer(3000);
      return updateItem(newItem, item);
    }
  } catch (err) {
    ztoolkit.log(err);
    progressWindow(
      `${getString("message-getMeta-error")}, ${err}`,
      "error",
    ).startCloseTimer(3000);
    return;
  }
}

function getSettings(): {
  saveAttachments: boolean;
  libraryID: boolean | null;
  collections?: number[];
} {
  const coll = ZoteroPane.getSelectedCollection()?.id;
  const options = getPref("schema");

  // 创建返回对象的基本结构
  const settings: {
    saveAttachments: boolean;
    libraryID: boolean | null;
    collections?: number[];
  } = {
    saveAttachments: getPref("saveAttachments") as boolean,
    libraryID: options === "save" ? null : false,
  };

  // 如果 coll 存在，才添加到 settings 中
  if (typeof coll === "number") {
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

async function saveNote(newItem: any, oldItem: Zotero.Item) {
  const note = new Zotero.Item("note");
  note.setNote(newItem["notes"].join(""));
  note.parentID = oldItem.id;
  await note.saveTx();
  ztoolkit.log("save Note successful");
}

async function saveAttachments(newItem: any, oldItem: Zotero.Item) {
  const options = {
    url: newItem["attachments"][0]["url"],
    contentType: newItem["attachments"][0]["mimeType"],
    title: newItem["attachments"][0]["title"],
    parentItemID: oldItem.id,
    libraryID: Zotero.Libraries.userLibraryID,
    fileBaseName: `${newItem.creators[0].lastName} - ${newItem.date.slice(0, 4)} - ${newItem.title}`,
  };
  Zotero.Attachments.importFromURL(options);
  ztoolkit.log("save Attachments successful");
}

async function updateItem(newItem: any, oldItem: Zotero.Item) {
  for (const field of Object.keys(newItem)) {
    switch (field) {
      case "notes":
        {
          if (newItem["notes"].length === 0) break;
          if (getPref("saveAttachments") === true) {
            const noteIDs = oldItem.getNotes();
            if (noteIDs.length === 0) {
              saveNote(newItem, oldItem);
            } else {
              const results = [];
              for (const noteID of noteIDs) {
                const noteItem = Zotero.Items.get(noteID);
                const noteTitle = noteItem.getNoteTitle();
                const regex = /目录/;
                const result = regex.test(noteTitle);
                results.push(result);
              }
              if (!results.some((result) => result === true)) {
                saveNote(newItem, oldItem);
              }
            }
          }
        }
        break;
      case "attachments":
        {
          if (newItem["attachments"].length === 0) break;
          if (getPref("saveAttachments") === true) {
            const attachmentIDs = oldItem.getAttachments();
            if (attachmentIDs.length === 0) {
              saveAttachments(newItem, oldItem);
            } else {
              const results = [];
              for (const attachmentID of attachmentIDs) {
                const attachmentItem = Zotero.Items.get(attachmentID);
                if (attachmentItem.getField("title") === newItem["title"]) {
                  results.push(true);
                }
              }
              if (!results.some((result) => result === true)) {
                saveAttachments(newItem, oldItem);
              }
            }
          }
        }
        break;
      case "tags":
      case "seeAlso":
      case "itemType":
        break;
      case "creators":
        oldItem.setCreators(newItem["creators"]);
        ztoolkit.log("Update creators");
        break;
      default: {
        const newFieldValue = newItem[field] ?? "",
          // @ts-ignore field 已为 Zotero.Item.ItemField
          oldFieldValue = oldItem.getField(field);
        ztoolkit.log(
          `Update ${field} from ${oldFieldValue} to ${newFieldValue}`,
        );
        // @ts-ignore field 已为 Zotero.Item.ItemField
        oldItem.setField(field, newFieldValue);
        break;
      }
    }
  }
  await oldItem.saveTx();
  // return oldItem;
}
