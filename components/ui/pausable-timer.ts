export type PausableTimer = {
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  remaining: () => number;
};

// Starts running immediately. Pause keeps the time left; resume continues from it.
export function createPausableTimer(callback: () => void, ms: number): PausableTimer {
  let left = ms;
  let startedAt = Date.now();
  let handle: ReturnType<typeof setTimeout> | undefined;
  let done = false;

  const run = () => {
    startedAt = Date.now();
    handle = setTimeout(() => {
      done = true;
      handle = undefined;
      callback();
    }, left);
  };
  run();

  return {
    pause() {
      if (done || handle === undefined) return;
      clearTimeout(handle);
      handle = undefined;
      left = Math.max(0, left - (Date.now() - startedAt));
    },
    resume() {
      if (done || handle !== undefined) return;
      run();
    },
    cancel() {
      if (handle !== undefined) clearTimeout(handle);
      handle = undefined;
      done = true;
    },
    remaining() {
      if (done) return 0;
      return handle === undefined ? left : Math.max(0, left - (Date.now() - startedAt));
    },
  };
}
