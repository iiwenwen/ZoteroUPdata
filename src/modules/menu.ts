import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getPref } from "../utils/prefs";
import { getMate } from "./matedate";
// import { hooks } from "../addon";

export function registerMenu() {
  const menuIcon = `chrome://${config.addonRef}/content/icons/favicon.png`;

  // getPref("showItemMenuTitleTranslation") &&
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    id: "updateMatedata",
    label: getString("itemmenu-updateMatedata-label"),
    commandListener: (ev) => {
      getMate().then((item) => {});
    },
    icon: menuIcon,
  });
}

// 右键功能禁用
export async function disabledMeun() {
  const item = ZoteroPane.getSelectedItems()[0];
  const menuUpMeta = document.getElementById(`updateMatedata`);
  const regex = /^https?:\/\/\w+\.douban\.com/;
  const url = item.getField("url");
  if (!regex.test(url)) {
    menuUpMeta.setAttribute("disabled", "true");
  }
}

export async function selectoritem() {
  const itemsTreeElement = document.getElementById("zotero-items-tree");
  itemsTreeElement.addEventListener("contextmenu", (event) => disabledMeun());
}
