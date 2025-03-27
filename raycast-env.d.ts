/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `index` command */
  export type Index = ExtensionPreferences & {
  /** API Key - You can find your API key on the remove.bg Dashboard. */
  "apiKey": string,
  /** Default Save Location - Default location to save processed images */
  "defaultSaveLocation": "same" | "desktop" | "downloads",
  /** Crop Image to Content - Automatically crop image to content boundaries */
  "cropToContent": boolean,
  /** Default Object Type - Default object type to extract */
  "defaultType": "auto" | "person" | "product" | "car" | "animal" | "graphic" | "transportation",
  /** Default Size - Default output size */
  "defaultSize": "preview" | "auto" | "full" | "50MP",
  /** Default Format - Default output format */
  "defaultFormat": "png" | "jpg" | "zip",
  /** Modify Filename - How to modify output filenames */
  "filenameFormat": "nochange" | "prepend" | "append",
  /** Modifying Text - Text to add to filenames */
  "filenameModifier": string
}
}

declare namespace Arguments {
  /** Arguments passed to the `index` command */
  export type Index = {}
}

