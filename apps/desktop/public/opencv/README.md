# OpenCV.js Setup

This folder should contain the OpenCV.js WebAssembly build files.

## Required Files

1. `opencv.js` - Main JavaScript loader
2. `opencv_js.wasm` - WebAssembly binary (loaded by opencv.js)

## How to Get OpenCV.js

### Option 1: Download Pre-built (Recommended)

Download from the official OpenCV.js releases:

```bash
# Download OpenCV.js 4.x
curl -L https://docs.opencv.org/4.9.0/opencv.js -o opencv.js
```

Or visit: https://docs.opencv.org/4.x/d0/d84/tutorial_js_usage.html

### Option 2: Build from Source

For a smaller build with only required modules:

```bash
# Clone OpenCV
git clone https://github.com/opencv/opencv.git
cd opencv

# Build for WebAssembly (requires Emscripten)
python3 platforms/js/build_js.py build_wasm --build_wasm

# Copy output files
cp build_wasm/bin/opencv.js /path/to/sailcloud/apps/desktop/public/opencv/
```

### Option 3: Use CDN (Development Only)

For development, you can modify `opencv-loader.ts` to load from CDN:

```javascript
script.src = 'https://docs.opencv.org/4.9.0/opencv.js'
```

**Note:** CDN loading requires internet and may have CORS issues. Not recommended for production.

## File Size

- `opencv.js`: ~8-10 MB (includes WASM loader)
- Full build includes: core, imgproc, video, objdetect, features2d, etc.

For production, consider building a custom version with only:
- `core`
- `imgproc` (for Canny, GaussianBlur, cvtColor)

This reduces the size to ~3-4 MB.

## Verification

After placing the files, verify they load correctly:

1. Start the app: `npm run dev`
2. Open DevTools Console
3. Check for: "OpenCV.js runtime initialized"

## Troubleshooting

### WASM not loading
- Ensure `opencv_js.wasm` is in the same directory as `opencv.js`
- Check that your server serves `.wasm` files with correct MIME type

### Memory issues
- OpenCV.js uses ~50-100MB of memory
- For large images, resize before processing (see `resizeIfNeeded`)

### Performance
- First load takes 1-3 seconds (WASM compilation)
- Subsequent operations are fast (~100ms for edge detection)
