# Remove Background

<div align="center">
<img src="./assets/command-icon.png" width="300" />

<h1>
    remove.bg
</h1>

Raycast extension to remove the background from images using the remove.bg API

<p>
    <a href="https://github.com/raycast/extensions/blob/master/LICENSE">
        <img
            src="https://img.shields.io/badge/license-MIT-blue.svg"
            alt="raycast-extensions is released under the MIT license."
        />
    </a>
    <img
        src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg"
        alt="PRs welcome!"
    />
    <a href="https://twitter.com/intent/follow?screen_name=JamieSchouten">
        <img
            src="https://img.shields.io/twitter/follow/JamieSchouten.svg?label=Follow%20@JamieSchouten"
            alt="Follow @JamieSchouten"
        />
    </a>
</p>
</div>

## Features

- Remove backgrounds from one or more images using the remove.bg API
- Support for multiple file processing from Finder selection
- Flexible save location options:
  - Same folder as input
  - Desktop
  - Downloads
  - Custom folder selection
- Enhanced filename formatting:
  - No change (preserve original)
  - Prepend text
  - Append text
- Multiple output format options:
  - PNG (with transparency)
  - JPG
  - ZIP (includes PNG + mask)
- Advanced object type detection:
  - Auto (detect automatically)
  - Person
  - Product
  - Car
  - Animal
  - Graphic
  - Transportation
- Output size options:
  - Preview (0.25 MP, free)
  - Auto (up to 25 MP)
  - Full (up to 25 MP)
  - 50MP (up to 50 MP)
- Real-time credit checking and warnings
- Image preview with metadata
- Automatic file validation
- Progress tracking for multiple files
- Cached API responses for better performance

## How to get the API key for remove.bg

1. Navigate to https://www.remove.bg
2. Sign in or create an account
3. Go to https://www.remove.bg/dashboard#api-key
4. Click the "Show" button
5. Copy your API key

## How to use

### Method 1: Select from Finder
1. Open Finder and select one or more images
2. Open Raycast and type "Remove Background"
3. Press Enter to open the extension
4. Your selected images will appear in the form
5. Adjust any options as needed
6. Click "Remove Background" to process

### Method 2: Use File Picker
1. Open Raycast and type "Remove Background"
2. Press Enter to open the extension
3. Click the file picker or press ⌘O
4. Select one or more images
5. Adjust any options as needed
6. Click "Remove Background" to process

### Output Options
- Choose where to save processed images
- Customize output filenames
- Select output format (PNG, JPG, or ZIP)
- Choose output size and quality
- Specify object type for better detection

### After Processing
- View processed image preview
- See file metadata (size, dimensions)
- Open output folder or file
- Copy output path to clipboard
- Process new images or retry with same image

## Asset Requirements

The extension uses the following assets:

### Command Icon
- Location: `assets/command-icon.png`
- Dimensions: 512x512 pixels
- Format: PNG with transparency
- Purpose: Extension icon in Raycast
- Requirements:
  - Must be a square image
  - Should have a transparent background
  - Should be clear and recognizable at small sizes
  - File size should be under 100KB
