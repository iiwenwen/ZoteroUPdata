import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getMeta } from "./metadata";

export function registerMenu() {
  const menuIcon = `chrome://${config.addonRef}/content/icons/favicon.png`;
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    id: "updateMetadata",
    label: getString("itemmenu-updateMetadata-label"),
    commandListener: (ev) => {
      getMeta();
    },
    icon: menuIcon,
  });
}

// 右键功能禁用
export async function disabledMeun() {
  const item = ZoteroPane.getSelectedItems()[0];
  const menuUpMeta = document.getElementById(`updateMetadata`);
  const regex = /^https?:\/\/\w+\.douban\.com/;
  const url = item.getField("url");
  if (!regex.test(url)) {
    menuUpMeta.setAttribute("disabled", "true");
  } else {
    menuUpMeta?.removeAttribute("disabled");
  }
}
// 右键事件监听
export async function selectoritem() {
  const itemsTreeElement = document.getElementById("zotero-items-tree");
  itemsTreeElement.addEventListener("contextmenu", () => disabledMeun());
}
