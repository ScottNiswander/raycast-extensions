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
  /** Crop Image to Content - Automatically crop image to content boundaries */
  "cropToContent": boolean,
  /** Filename Format - How to modify output filenames */
  "filenameFormat": "nochange" | "prepend" | "append",
  /** Filename Modifier - Text to add to filenames */
  "fileNameModifier": string,
  /** Default Size - Default output size */
  "defaultSize": "preview" | "auto" | "full" | "50MP",
  /** Default Object Type - Default object type to extract */
  "defaultType": "auto" | "person" | "product" | "car" | "animal" | "graphic" | "transportation",
  /** Default Format - Default output format */
  "defaultFormat": "png" | "jpg" | "zip"
}
}

declare namespace Arguments {
  /** Arguments passed to the `index` command */
  export type Index = {}
}

