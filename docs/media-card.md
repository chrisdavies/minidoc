# Media card

When the user pastes, drops, or picks (via toolbar) a file, the media card plugin will convert it to a media element (image, video, audio, or download link).

Applications can extend this behavior (e.g. adding support for more file types, such as PDF viewers) or attaching custom video players to the video elements, etc.

When a media card is added, it initiates a file upload. The media card may be copied / cut / pasted while the upload is in progress. This will not cause duplicate uploads. Multiple copies of a media element will simply point to the same underlying file reference (and ultimately share the same underlying URL).

However, copying a media card from one document to another will not work unless the media is already uploaded.

## Usage

Minidoc has no default usage. If you do not provide your minidoc editor with a media card plugin instance, files will be unsupported, and pasting images (as HTML, etc) is unsupported and will produce undefined behavior.

The most important parameter to the media card is the upload function. This takes a file and an onProgress function, and returns an object that has two properties:

- `promise` - the promise that resolves to the media card state object when the upload has completed
- `cancel` - a function which, if called, cancels the upload

Below is a working example, with the `getPresignedS3Upload` portion being the only part that is unimplemented.

```js
import { minidoc, mediaCardPlugin, defaultPlugins } from 'minidoc';

// The upload function takes a file and an onProgress function
// performs the upload (optionally calling onProgress), and returns
// a promise and a cancel function which cancels the upload.
function upload({ file, onProgress }) {
  let canceled = false;
  let uploader;

  const promise = getPresignedS3Upload(file)
    .then((presigned) => {
      if (!canceled) {
        uploader = uploadToS3({ file, onProgress, presigned });
        return uploader.promise.then(() => ({
          url: presigned.url,
          caption: file.name,
        }));
      }
    });

  return {
    promise,
    cancel() {
      canceled = true;
      uploader?.cancel();
    },
  };
}

// Upload to a presigned S3 location, and allow for cancellation.
function uploadToS3({ file, onProgress, presigned }) {
  const xhr = new XMLHttpRequest();
  const data = new FormData();

  data.append('Content-Type', file.type);
  data.append('key', presigned.fullKey);
  data.append('AWSAccessKeyId', presigned.awsAccessKeyId);
  data.append('acl', presigned.acl);
  data.append('policy', presigned.policy);
  data.append('signature', presigned.signature);
  data.append('file', file);

  const promise = new Promise((resolve, reject) => {
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr);
        } else {
          reject(xhr);
        }
      }
    };
    
    xhr.upload.addEventListener('progress', (e) => {
      onProgress(Math.ceil((e.loaded / e.total) * 100));
    });

    xhr.open('POST', presigned.url);
    xhr.send(data);
  });

  return {
    promise,
    cancel() {
      xhr.abort();
    },
  };
}

// Create a new minidoc editor with media support.
const editor = minidoc({
  doc,
  plugins: [mediaCardPlugin({ upload }), ...defaultPlugins],
});
```

## Tracking uploads

When an upload is in progress, we don't want undo / redo history to reflect the progress updates. So, we store upload data outside of the media card state. It is tracked internally in the media card instance. This allows for copied cards to share a single upload, and allows undo / redo to ignore the progress changes.
