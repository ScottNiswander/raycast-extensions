import { useState, useEffect } from "react";
import {
  Form,
  ActionPanel,
  SubmitFormAction,
  getPreferenceValues,
  showToast,
  Toast,
  Detail,
  Icon,
  Action,
  open,
  getSelectedFinderItems,
  Grid,
  Clipboard,
  Cache,
} from "@raycast/api";
import { useForm } from "@raycast/utils";
import { removeBackgroundFromImageFile } from "remove.bg";
import { existsSync, statSync, accessSync, constants, unlinkSync } from "fs";
import path from "path";
import { homedir } from "os";

/**
 * Interface representing the extension's preferences stored in Raycast settings.
 * These values are used as defaults for the form fields.
 */
interface Preferences {
  /** The remove.bg API key for authentication */
  apiKey: string;
  /** Whether to automatically crop images to content boundaries */
  cropToContent: boolean;
  /** Text to add to filenames when modifying them */
  filenameModifier: string;
  /** How to modify output filenames (nochange, prepend, or append) */
  filenameFormat: string;
  /** Default output size for processed images */
  defaultSize: string;
  /** Default output format for processed images */
  defaultFormat: string;
  /** Default object type to extract from images */
  defaultType: string;
  /** Default location to save processed images */
  defaultSaveLocation: string;
}

/**
 * Interface representing the form values submitted by the user.
 * These values override the default preferences when provided.
 */
interface FormValues {
  /** Array of file paths to process */
  filePath: string[];
  /** Whether to crop the image to content boundaries */
  crop: boolean;
  /** Type of object to extract from the image */
  type: string;
  /** Output size for the processed image */
  size: string;
  /** Output format for the processed image */
  format: string;
  /** Where to save the processed image */
  saveLocation: string;
  /** Custom output folder path (optional) */
  outputFolder?: string[];
  /** How to modify the output filename */
  filenameFormat: string;
  /** Text to add to the filename (optional) */
  filenameModifier?: string;
}

/**
 * Interface representing a processed image file with its metadata.
 */
interface ProcessedFile {
  /** Original input file path */
  inputPath: string;
  /** Output file path where the processed image was saved */
  outputPath: string;
  /** Base64 encoded preview of the processed image */
  base64img?: string;
  /** Detected foreground type */
  foregroundType?: string;
  /** Width of the result image */
  width?: number;
  /** Height of the result image */
  height?: number;
  /** Credits charged for this call */
  creditsCharged?: number;
}

/**
 * Interface for the remove.bg API account response.
 */
interface RemoveBgAccountResponse {
  data: {
    attributes: {
      credits: {
        total: number;
        subscription: number;
        payg: number;
        enterprise: number;
      };
      api: {
        free_calls: number;
        sizes: string;
      };
    };
  };
}

/**
 * Interface for the remove.bg API response.
 */
interface RemoveBgResult {
  /** Base64 encoded image data */
  base64img: string;
  /** Response headers containing metadata */
  headers?: {
    "x-type"?: string;
    "x-width"?: string;
    "x-height"?: string;
    "x-credits-charged"?: string;
  };
}

// Cache instance for storing API responses and credits
const cache = new Cache();

/**
 * Retrieves a cached response by key.
 * @param key - The cache key to look up
 * @returns The cached data or undefined if not found
 */
async function getCachedResponse(key: string): Promise<string | undefined> {
  return cache.get(key);
}

/**
 * Stores a response in the cache.
 * @param key - The cache key to store under
 * @param data - The data to cache
 */
async function setCachedResponse(key: string, data: string): Promise<void> {
  await cache.set(key, data);
}

/**
 * Formats file size to human readable format.
 * @param bytes - The file size in bytes
 * @returns A formatted string like "1.5 MB"
 */
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Validates a file for processing.
 * @param filePath - The path to the file to validate
 * @returns An error message if the file is invalid, or undefined if valid
 */
async function validateFile(filePath: string): Promise<string | undefined> {
  try {
    // Check if file exists
    if (!existsSync(filePath)) {
      return `File not found: ${path.basename(filePath)}`;
    }

    // Check file permissions
    try {
      accessSync(filePath, constants.R_OK);
    } catch (error) {
      return `Cannot read file: ${path.basename(filePath)}`;
    }

    // Check file type
    const ext = path.extname(filePath).toLowerCase();
    const validExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
    if (!validExtensions.includes(ext)) {
      return `Unsupported file type: ${ext}. Supported types: ${validExtensions.join(", ")}`;
    }

    // Check file size
    const stats = statSync(filePath);
    const maxSize = 25 * 1024 * 1024; // 25MB limit for remove.bg API
    if (stats.size > maxSize) {
      return `File too large: ${formatFileSize(stats.size)}. Maximum size is 25MB`;
    }

    // Check if file is a directory
    if (stats.isDirectory()) {
      return `Cannot process directory: ${path.basename(filePath)}`;
    }

    return undefined;
  } catch (error) {
    console.error(`Error validating file ${filePath}:`, error);
    return `Error validating file: ${path.basename(filePath)}`;
  }
}

/**
 * Creates an optimized cache key for the remove.bg API request.
 * @param filePath - The path to the file being processed
 * @param options - The processing options
 * @returns A cache key string
 */
function createCacheKey(filePath: string, options: {
  size: string;
  type: string;
  crop: boolean;
  format: string;
}): string {
  const stats = statSync(filePath);
  return `removebg_${stats.size}_${stats.mtimeMs}_${options.size}_${options.type}_${options.crop}_${options.format}`;
}

/**
 * Main command component for the Remove Background extension.
 * Handles file selection, processing, and displaying results.
 * 
 * Features:
 * - File selection from Finder or file picker
 * - Background removal using remove.bg API
 * - Multiple file processing
 * - Customizable output options
 * - Progress tracking and error handling
 * - Result preview and file management
 */
export default function Command() {
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [result, setResult] = useState<ProcessedFile[]>([]);
  const [customOutputDir, setCustomOutputDir] = useState<string>("");
  const [saveLocation, setSaveLocation] = useState<string>("same");
  const [credits, setCredits] = useState<number | null>(null);
  const preferences = getPreferenceValues<Preferences>();

  // Form handling with validation
  const { handleSubmit, itemProps } = useForm<FormValues>({
    onSubmit: async (values: FormValues) => {
      await handleFormSubmit(values);
    },
    validation: {
      filenameModifier: (value) => {
        if ((itemProps.filenameFormat.value === "prepend" || itemProps.filenameFormat.value === "append") && !value) {
          return "This field is required when modifying the filename. If you don't wish to modify the filename, select 'No Change' from the dropdown menu above.";
        }
      },
    },
  });

  // Initialize component
  useEffect(() => {
    fetchSelectedFiles();
    setSaveLocation(preferences.defaultSaveLocation || "same");
    checkCredits();
  }, []);

  /**
   * Fetches files selected in Finder and filters them to include only image files.
   * Validates each file and shows appropriate error messages if any files are invalid.
   */
  async function fetchSelectedFiles() {
    try {
      const files = await getSelectedFinderItems();
      const selectedPaths = files.map((file) => file.path);
      const invalidFiles: string[] = [];

      // Validate each file
      for (const filePath of selectedPaths) {
        const error = await validateFile(filePath);
        if (error) {
          invalidFiles.push(error);
        }
      }

      // If there are any invalid files, show them in a toast
      if (invalidFiles.length > 0) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Invalid Files Found",
          message: invalidFiles.join("\n"),
        });
        return;
      }

      // Filter to only include image files
      const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
      const imagePaths = selectedPaths.filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return imageExtensions.includes(ext);
      });

      if (imagePaths.length > 0) {
        setSelectedFiles(imagePaths);
      }
    } catch (error) {
      console.error("Error fetching selected files:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Error Selecting Files",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Handles the form submission, processing the selected images using the remove.bg API.
   * Manages the processing workflow including validation, API calls, and result handling.
   * 
   * @param values - The form values submitted by the user
   */
  async function handleFormSubmit(values: FormValues) {
    const filesToProcess = selectedFiles.length > 0 ? selectedFiles : values.filePath;
    const tempFiles: string[] = []; // Track temporary files for cleanup

    if (filesToProcess.length === 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No Files Selected",
        message: "Please select images in Finder or use the file picker",
      });
      return;
    }

    // Validate all files before processing
    const invalidFiles: string[] = [];
    const fileStats = new Map<string, { size: number; mtimeMs: number }>();
    
    for (const filePath of filesToProcess) {
      const error = await validateFile(filePath);
      if (error) {
        invalidFiles.push(error);
      } else {
        // Store file stats for later use
        const stats = statSync(filePath);
        fileStats.set(filePath, { size: stats.size, mtimeMs: stats.mtimeMs });
      }
    }

    if (invalidFiles.length > 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Invalid Files Found",
        message: invalidFiles.join("\n"),
      });
      return;
    }

    setIsLoading(true);
    const processedFiles: ProcessedFile[] = [];

    // Show initial processing toast
    const processingToast = await showToast({
      style: Toast.Style.Animated,
      title: "🪚 Removing background...",
      message: filesToProcess.length === 1 ? "Processing image..." : `Processing image 1 of ${filesToProcess.length}`,
    });

    try {
      for (let i = 0; i < filesToProcess.length; i++) {
        const inputFilePath = filesToProcess[i];
        if (!existsSync(inputFilePath)) {
          console.warn(`File does not exist: ${inputFilePath}`);
          continue;
        }

        // Update toast with current progress
        processingToast.message = filesToProcess.length === 1 
          ? "Processing image..." 
          : `Processing image ${i + 1} of ${filesToProcess.length}`;

        const fileName = path.basename(inputFilePath);
        const fileExt = path.extname(fileName);
        const fileNameWithoutExt = path.basename(fileName, fileExt);
        let outputName;

        // Determine output filename based on format
        switch (values.filenameFormat) {
          case "nochange":
            outputName = fileNameWithoutExt;
            break;
          case "append":
            outputName = `${fileNameWithoutExt}${values.filenameModifier || preferences.filenameModifier || ""}`;
            break;
          case "prepend":
            outputName = `${values.filenameModifier || preferences.filenameModifier || ""}${fileNameWithoutExt}`;
            break;
          default:
            outputName = fileNameWithoutExt;
        }

        // Add the correct extension based on the selected format
        const format = (values.format || preferences.defaultFormat || "png") as "png" | "jpg" | "zip" | "auto";
        outputName += format === "jpg" ? ".jpg" : format === "zip" ? ".zip" : ".png";

        // Determine output directory based on save location
        let outputDir;
        switch (saveLocation) {
          case "same":
            outputDir = path.dirname(inputFilePath);
            break;
          case "desktop":
            outputDir = path.join(homedir(), "Desktop");
            break;
          case "downloads":
            outputDir = path.join(homedir(), "Downloads");
            break;
          case "custom":
            outputDir = customOutputDir || path.join(homedir(), "Desktop");
            break;
          default:
            outputDir = path.join(homedir(), "Desktop");
        }

        if (!existsSync(outputDir)) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Output folder does not exist",
            message: `Folder not found: ${outputDir}`,
          });
          return;
        }

        const outputPath = path.join(outputDir, outputName);
        console.log(`Processing file: ${inputFilePath}`);
        console.log(`Output path: ${outputPath}`);

        // Create a cache key using the optimized function
        const options = {
          size: values.size || preferences.defaultSize || "auto",
          type: values.type || preferences.defaultType || "auto",
          crop: values.crop || preferences.cropToContent || false,
          format: format,
        };
        const cacheKey = createCacheKey(inputFilePath, options);

        try {
          // Check cache first
          const cachedResponse = await getCachedResponse(cacheKey);
          let response: RemoveBgResult;
          
          if (cachedResponse) {
            console.log("Using cached response");
            response = JSON.parse(cachedResponse);
          } else {
            console.log("Making API call");
            const apiOptions = {
              path: inputFilePath,
              apiKey: preferences.apiKey,
              ...options,
              type_level: "latest",
              outputFile: outputPath,
            };

            response = await removeBackgroundFromImageFile(apiOptions);
            
            // Cache the response
            await setCachedResponse(cacheKey, JSON.stringify(response));
          }

          // Get the raw response to access headers
          const rawResponse = await fetch("https://api.remove.bg/v1.0/removebg", {
            method: "POST",
            headers: {
              "X-Api-Key": preferences.apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              image_file_b64: response.base64img,
              ...options,
              type_level: "latest",
            }),
          });

          if (!rawResponse.ok) {
            const errorData = await rawResponse.json();
            throw new Error(
              `API Error: ${errorData.errors?.[0]?.title || rawResponse.statusText} (${rawResponse.status})`
            );
          }

          const headers = rawResponse.headers;
          processedFiles.push({
            inputPath: inputFilePath,
            outputPath: outputPath,
            base64img: response.base64img,
            foregroundType: headers.get("x-type") || undefined,
            width: headers.get("x-width") ? parseInt(headers.get("x-width")!) : undefined,
            height: headers.get("x-height") ? parseInt(headers.get("x-height")!) : undefined,
            creditsCharged: headers.get("x-credits-charged") ? parseFloat(headers.get("x-credits-charged")!) : undefined,
          });
        } catch (error) {
          console.error(`Error processing file ${inputFilePath}:`, error);
          
          // Provide more specific error messages
          let errorMessage = "Unknown error occurred";
          if (error instanceof Error) {
            if (error.message.includes("API Error")) {
              errorMessage = error.message;
            } else if (error.message.includes("ENOENT")) {
              errorMessage = "File not found or access denied";
            } else if (error.message.includes("ECONNREFUSED")) {
              errorMessage = "Connection refused. Please check your internet connection";
            } else if (error.message.includes("401")) {
              errorMessage = "Invalid API key. Please check your remove.bg API key";
            } else if (error.message.includes("402")) {
              errorMessage = "Insufficient credits. Please add more credits to your remove.bg account";
            }
          }

          await showToast({
            style: Toast.Style.Failure,
            title: `Failed to process ${fileName}`,
            message: errorMessage,
          });
        }
      }

      if (processedFiles.length > 0) {
        setResult(processedFiles);
        processingToast.style = Toast.Style.Success;
        processingToast.title = `Processed ${processedFiles.length} image${processedFiles.length > 1 ? 's' : ''}`;
        processingToast.message = `Saved to ${path.dirname(processedFiles[0].outputPath)}`;
      } else {
        processingToast.style = Toast.Style.Failure;
        processingToast.title = "No images were processed successfully";
        processingToast.message = "Please check your API key and file paths";
      }
    } catch (error) {
      console.error("General error:", error);
      processingToast.style = Toast.Style.Failure;
      processingToast.title = "Failed to process images";
      processingToast.message = error instanceof Error ? error.message : "Unknown error";
    } finally {
      // Clean up any temporary files
      for (const tempFile of tempFiles) {
        try {
          if (existsSync(tempFile)) {
            unlinkSync(tempFile);
          }
        } catch (error) {
          console.error(`Error cleaning up temporary file ${tempFile}:`, error);
        }
      }
      setIsLoading(false);
    }
  }

  /**
   * Handles changes to the save location dropdown.
   * Resets the custom directory when switching to custom mode.
   * 
   * @param value - The new save location value
   */
  async function handleSaveLocationChange(value: string) {
    setSaveLocation(value);
    if (value === "custom") {
      setCustomOutputDir(""); // Reset the custom directory when switching to custom mode
    }
  }

  /**
   * Checks the user's remove.bg API credits and shows warnings if low.
   * Caches the response to avoid frequent API calls.
   * Shows different toast messages based on credit amount.
   */
  async function checkCredits() {
    try {
      // Check cache first
      const cachedCredits = await getCachedResponse("removebg_credits");
      if (cachedCredits) {
        const { credits, timestamp } = JSON.parse(cachedCredits);
        // Only use cached credits if they're less than 5 minutes old
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          setCredits(credits);
          return;
        }
      }

      const response = await fetch("https://api.remove.bg/v1.0/account", {
        headers: {
          "X-Api-Key": preferences.apiKey,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `API Error: ${errorData.errors?.[0]?.title || response.statusText} (${response.status})`
        );
      }

      const data = await response.json() as RemoveBgAccountResponse;
      const totalCredits = Math.max(0, data.data.attributes.credits.total);
      const freeCalls = Math.max(0, data.data.attributes.api.free_calls);
      
      // Cache the credits with a timestamp
      await setCachedResponse("removebg_credits", JSON.stringify({
        credits: totalCredits,
        timestamp: Date.now(),
      }));
      
      setCredits(totalCredits);
      
      // Show different toast styles based on credit amount
      if (totalCredits <= 0) {
        await showToast({
          style: Toast.Style.Failure,
          title: "No Credits Available",
          message: "Add credits to your remove.bg account to continue",
        });
      } else if (totalCredits <= 5) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Low Credits Warning",
          message: `Only ${totalCredits} credits remaining. Consider adding more credits soon.`,
        });
      } else if (totalCredits <= 10) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Credits Running Low",
          message: `${totalCredits} credits remaining (${freeCalls} free calls)`,
        });
      } else {
        await showToast({
          style: Toast.Style.Success,
          title: "Credits Available",
          message: `${totalCredits} credits (${freeCalls} free calls)`,
        });
      }
    } catch (error) {
      console.error("Error checking credits:", error);
      let errorMessage = "Failed to check credits";
      
      if (error instanceof Error) {
        if (error.message.includes("401")) {
          errorMessage = "Invalid API key. Please check your remove.bg API key";
        } else if (error.message.includes("403")) {
          errorMessage = "Access denied. Please check your API key permissions";
        } else if (error.message.includes("429")) {
          errorMessage = "Too many requests. Please try again later";
        }
      }
      
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Check Credits",
        message: errorMessage,
      });
    }
  }

  if (result && result.length > 0) {
    if (result.length === 1) {
      // Single image - use Detail view
      const file = result[0];
      const fileSize = existsSync(file.outputPath) ? formatFileSize(statSync(file.outputPath).size) : undefined;
      const dimensions = file.width && file.height ? `${file.width} × ${file.height}` : undefined;
      const objectType = file.foregroundType || "Auto";

      return (
        <Detail
          markdown={`![Processed Image](data:image/png;base64,${file.base64img})`}
          metadata={
            <Detail.Metadata>
              <Detail.Metadata.Label title="Output File" text={path.basename(file.outputPath)} />
              <Detail.Metadata.Label title="Output Location" text={path.dirname(file.outputPath)} />
              <Detail.Metadata.Separator />
              <Detail.Metadata.Label title="File Size" text={fileSize} />
              <Detail.Metadata.Label title="Dimensions" text={dimensions} />
              <Detail.Metadata.Label title="Object Type" text={objectType} />
              <Detail.Metadata.Separator />
              <Detail.Metadata.TagList title="Status">
                <Detail.Metadata.TagList.Item text="Success" color="#4CAF50" />
              </Detail.Metadata.TagList>
            </Detail.Metadata>
          }
          actions={
            <ActionPanel>
              <ActionPanel.Section>
                <Action
                  title="Open Output Folder"
                  icon={Icon.Folder}
                  onAction={() => open(path.dirname(file.outputPath))}
                />
                <Action
                  title="Copy Output Path"
                  icon={Icon.Clipboard}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                  onAction={async () => {
                    try {
                      await Clipboard.copy(file.outputPath);
                      await showToast({
                        style: Toast.Style.Success,
                        title: "Copied Path",
                        message: "Output path copied to clipboard",
                      });
                    } catch (error) {
                      await showToast({
                        style: Toast.Style.Failure,
                        title: "Failed to Copy Path",
                        message: error instanceof Error ? error.message : "Unknown error",
                      });
                    }
                  }}
                />
                <Action
                  title="Open Output File"
                  icon={Icon.Document}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "o" }}
                  onAction={async () => {
                    try {
                      await open(file.outputPath);
                    } catch (error) {
                      await showToast({
                        style: Toast.Style.Failure,
                        title: "Failed to Open File",
                        message: error instanceof Error ? error.message : "Unknown error",
                      });
                    }
                  }}
                />
                <Action
                  title="Retry with Same Image"
                  icon={Icon.ArrowClockwise}
                  shortcut={{ modifiers: ["cmd"], key: "return" }}
                  onAction={() => {
                    setSelectedFiles([file.inputPath]);
                    setResult([]);
                  }}
                />
              </ActionPanel.Section>
              <ActionPanel.Section>
                <Action
                  title="New Background Removal"
                  icon={Icon.ArrowClockwise}
                  shortcut={{ modifiers: ["cmd"], key: "n" }}
                  onAction={() => {
                    setResult([]);
                    setSelectedFiles([]);
                    setCustomOutputDir("");
                  }}
                />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      );
    } else {
      // Multiple images - use Grid view
      const gridColumns = result.length === 2 || result.length === 4 ? 2 : 3;
      return (
        <Grid columns={gridColumns} inset={Grid.Inset.Medium}>
          {result.map((file, index) => {
            const fileSize = existsSync(file.outputPath) ? formatFileSize(statSync(file.outputPath).size) : undefined;
            const dimensions = file.width && file.height ? `${file.width} × ${file.height}` : undefined;
            const subtitle = [fileSize, dimensions].filter(Boolean).join(" - ");
            
            return (
              <Grid.Item
                key={index}
                content={{ source: `data:image/png;base64,${file.base64img}` }}
                title={path.basename(file.outputPath)}
                subtitle={subtitle}
                actions={
                  <ActionPanel>
                    <ActionPanel.Section>
                      <Action
                        title="Open Output Folder"
                        icon={Icon.Folder}
                        onAction={() => open(path.dirname(file.outputPath))}
                      />
                      <Action
                        title="Copy Output Path"
                        icon={Icon.Clipboard}
                        shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                        onAction={async () => {
                          try {
                            await Clipboard.copy(file.outputPath);
                            await showToast({
                              style: Toast.Style.Success,
                              title: "Copied Path",
                              message: "Output path copied to clipboard",
                            });
                          } catch (error) {
                            await showToast({
                              style: Toast.Style.Failure,
                              title: "Failed to Copy Path",
                              message: error instanceof Error ? error.message : "Unknown error",
                            });
                          }
                        }}
                      />
                      <Action
                        title="Open Output File"
                        icon={Icon.Document}
                        shortcut={{ modifiers: ["cmd", "shift"], key: "o" }}
                        onAction={async () => {
                          try {
                            await open(file.outputPath);
                          } catch (error) {
                            await showToast({
                              style: Toast.Style.Failure,
                              title: "Failed to Open File",
                              message: error instanceof Error ? error.message : "Unknown error",
                            });
                          }
                        }}
                      />
                      <Action
                        title="Retry with Same Image"
                        icon={Icon.ArrowClockwise}
                        shortcut={{ modifiers: ["cmd"], key: "return" }}
                        onAction={() => {
                          setSelectedFiles([file.inputPath]);
                          setResult([]);
                        }}
                      />
                    </ActionPanel.Section>
                    <ActionPanel.Section>
                      <Action
                        title="New Background Removal"
                        icon={Icon.ArrowClockwise}
                        shortcut={{ modifiers: ["cmd"], key: "n" }}
                        onAction={() => {
                          setResult([]);
                          setSelectedFiles([]);
                          setCustomOutputDir("");
                        }}
                      />
                    </ActionPanel.Section>
                  </ActionPanel>
                }
              />
            );
          })}
        </Grid>
      );
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <SubmitFormAction title="Remove Background" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      {selectedFiles.length > 0 ? (
        <Form.Description
          title="Selected Files"
          text={`${selectedFiles.length} file(s) selected from Finder${
            selectedFiles.length === 1 ? `: ${path.basename(selectedFiles[0])}` : ""
          }`}
        />
      ) : (
        <Form.FilePicker
          title="Select Images"
          allowMultipleSelection={true}
          info="Choose one or more image files to process. The selected images will have their backgrounds removed."
          {...itemProps.filePath}
        />
      )}
      <Form.Dropdown
        title="Save Location"
        defaultValue={preferences.defaultSaveLocation || "same"}
        info="Choose where to save the processed image. You can save it in the same folder as the input or select a different location."
        onChange={handleSaveLocationChange}
        {...itemProps.saveLocation}
      >
        <Form.Dropdown.Item value="same" title="Same as Input" />
        <Form.Dropdown.Item value="desktop" title="Desktop" />
        <Form.Dropdown.Item value="downloads" title="Downloads" />
        <Form.Dropdown.Item value="custom" title="Choose Folder..." />
      </Form.Dropdown>
      {saveLocation === "custom" && (
        <Form.FilePicker
          title="Output Folder"
          allowMultipleSelection={false}
          canChooseFiles={false}
          canChooseDirectories={true}
          id="customOutputFolder"
          info="Select a folder where you want to save the processed image"
          onChange={(value) => {
            if (value && value.length > 0) {
              setCustomOutputDir(value[0]);
            }
          }}
        />
      )}
      <Form.Separator />
      <Form.Checkbox
        title="Crop to Content"
        label="Automatically crop image to content boundaries"
        defaultValue={preferences.cropToContent || false}
        info="When enabled, the image will be automatically cropped to remove empty space around the main subject"
        {...itemProps.crop}
      />
      <Form.Dropdown
        title="Object Type"
        defaultValue={preferences.defaultType || "auto"}
        info="Choose the type of object to extract from the image. This helps the AI better identify the main subject."
        {...itemProps.type}
      >
        <Form.Dropdown.Item value="auto" title="Auto (Detect Automatically)" />
        <Form.Dropdown.Item value="person" title="Person" />
        <Form.Dropdown.Item value="product" title="Product" />
        <Form.Dropdown.Item value="car" title="Car" />
        <Form.Dropdown.Item value="animal" title="Animal" />
        <Form.Dropdown.Item value="graphic" title="Graphic" />
        <Form.Dropdown.Item value="transportation" title="Transportation" />
      </Form.Dropdown>
      <Form.Dropdown
        title="Output Size"
        defaultValue={preferences.defaultSize || "auto"}
        info="Choose the output size of the processed image. Preview (0.25 MP) is free but lower quality. Auto and Full sizes use credits but provide better quality. 50MP is best for large prints but uses the most credits."
        {...itemProps.size}
      >
        <Form.Dropdown.Item value="preview" title="Preview (0.25 MP)" />
        <Form.Dropdown.Item value="auto" title="Auto (Up to 25 MP)" />
        <Form.Dropdown.Item value="full" title="Full (Up to 25 MP)" />
        <Form.Dropdown.Item value="50MP" title="50MP (Up to 50 MP)" />
      </Form.Dropdown>
      <Form.Dropdown
        title="Output Format"
        defaultValue={preferences.defaultFormat || "png"}
        info="Choose the output format of the processed image. PNG supports transparency, JPG is smaller, and ZIP includes a mask."
        {...itemProps.format}
      >
        <Form.Dropdown.Item value="png" title="PNG" />
        <Form.Dropdown.Item value="jpg" title="JPG" />
        <Form.Dropdown.Item value="zip" title="ZIP (PNG + Mask)" />
      </Form.Dropdown>
      <Form.Separator />
      <Form.Dropdown
        title="Modify Filename"
        defaultValue={preferences.filenameFormat || "nochange"}
        info="Choose how to modify the output filename. You can add text before or after the original filename."
        {...itemProps.filenameFormat}
      >
        <Form.Dropdown.Item value="nochange" title="No Change" />
        <Form.Dropdown.Item value="prepend" title="Prepend Filename" />
        <Form.Dropdown.Item value="append" title="Append Filename" />
      </Form.Dropdown>
      {(itemProps.filenameFormat.value === "prepend" || itemProps.filenameFormat.value === "append") && (
        <Form.TextField
          title="Modifying Text"
          placeholder="Enter text to add to filename"
          defaultValue={preferences.filenameModifier || ""}
          info="Enter the text you want to add to the filename. This will be added before or after the original filename."
          {...itemProps.filenameModifier}
        />
      )}
    </Form>
  );
}