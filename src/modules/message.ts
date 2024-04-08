import { config } from "../../package.json";

export function progressWindow(text: string, type = "default", progress = 100) {
  return new ztoolkit.ProgressWindow(config.addonName, {
    closeOnClick: true,
  })
    .createLine({
      text: text,
      type: type,
      progress: progress,
    })
    .show();
}
