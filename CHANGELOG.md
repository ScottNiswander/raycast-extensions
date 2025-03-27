# Changelog

## [1.3.0] - {PR_MERGE_DATE}

### Added
- Support for multiple file processing from Finder selection
- New save location options:
  - Same folder as input
  - Desktop
  - Downloads
  - Custom folder selection
- Enhanced filename formatting options:
  - No change (preserve original)
  - Prepend text
  - Append text
- Additional output format options:
  - PNG
  - JPG
  - ZIP (PNG + Mask)
- Extended object type detection options:
  - Animal
  - Graphic
  - Transportation
- Improved results display with image previews
- Action to open output folder after processing
- Ability to process a new image without restarting the extension
- Real-time credit checking and warnings
- Automatic file validation
- Progress tracking for multiple files
- Cached API responses for better performance

### Improved
- User interface with form separators for better organization
- Processing feedback with detailed success/error messages
- Error handling with specific error messages
- Input validation for file paths and folders
- File selection workflow
- Performance with API response caching

### Changed
- Added form description to show selected files
- Updated file selection methods to support both Finder and file picker
- Improved toast notifications for better progress tracking
- Enhanced error messages with more specific details

### Fixed
- Error handling for invalid file paths and non-existent output folders
- File validation to prevent processing of unsupported files
- Credit checking to prevent failed API calls
- Temporary file cleanup after processing

## [1.2.0] - 2022-03-21

### Added
- File picker support for selecting images
- Support for multiple output sizes
- Additional object type detection options

### Changed
- Updated file selection workflow
- Improved error handling

## [1.1.0] - 2022-02-15

### Added
- Support for cropping images to content
- Additional output size options
- More object type detection options

### Changed
- Updated UI layout
- Improved error messages

## [1.0.0] - 2022-01-01

### Added
- Initial release
- Basic background removal functionality
- Support for single image processing
- Basic output options