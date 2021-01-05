export function mockUpload({
  file,
  onProgress,
}: {
  file: File;
  onProgress(progress: number): void;
}) {
  console.log('Uploading file:', file.name, 'type:', file.type);

  const mockProgressInterval = 250;
  let progress = 0;
  let resolve, reject, timeout, done;

  const promise = new Promise<{ url: string }>((res, rej) => {
    resolve = res;
    reject = rej;
    timeout = setTimeout(mockProgress, mockProgressInterval);

    function mockProgress() {
      progress += 10;
      onProgress(progress);

      if (progress >= 25 && file.name.includes('error')) {
        if (!done && reject) {
          done = true;
          reject({ status: 0 });
          clearTimeout(timeout);
          return;
        }
      }

      if (progress >= 100) {
        if (!done) {
          done = true;
          resolve({ url: URL.createObjectURL(file) });
        }
      } else {
        setTimeout(mockProgress, mockProgressInterval);
      }
    }
  });

  return {
    promise,

    cancel() {
      // Reject should do whatever XMLHttpRequest abort does:
      // The XMLHttpRequest.abort() method aborts the request if it has already been sent. When a request is aborted, its readyState is changed to XMLHttpRequest.UNSENT (0) and the request's status code is set to 0.
      console.log('I was canceled!');
      clearTimeout(timeout);
      if (!done && reject) {
        done = true;
        reject({ status: 0 });
      }
    },
  };
}
