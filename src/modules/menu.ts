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
function disabledMeun() {
  const item = ZoteroPane.getSelectedItems()[0];
  const menuUpMeta = document.getElementById(
    `updateMetadata`,
  ) as HTMLButtonElement | null;
  const regex = /^https?:\/\/\w+\.douban\.com/;
  const url = item?.getField("url");
  menuUpMeta?.setAttribute("disabled", regex.test(url) ? "" : "true");
}
// 右键事件监听
export async function selectoritem() {
  const itemsTreeElement = document.getElementById("zotero-items-tree");
  itemsTreeElement?.addEventListener("contextmenu", () => disabledMeun());
}
