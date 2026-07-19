type FrameCallback = (timestamp: number) => void;

type RafLifecycleOptions = {
  requestFrame: (callback: FrameCallback) => number;
  cancelFrame: (id: number) => void;
  render: FrameCallback;
};

export type RafLifecycle = {
  start: () => void;
  renderOnce: () => void;
  stop: () => void;
};

export function createRafLifecycle(options: RafLifecycleOptions): RafLifecycle {
  let continuous = false;
  let frameId: number | null = null;

  const schedule = () => {
    if (frameId !== null) return;
    frameId = options.requestFrame((timestamp) => {
      frameId = null;
      options.render(timestamp);
      if (continuous) schedule();
    });
  };

  return {
    start() {
      continuous = true;
      schedule();
    },
    renderOnce() {
      schedule();
    },
    stop() {
      continuous = false;
      if (frameId === null) return;
      options.cancelFrame(frameId);
      frameId = null;
    },
  };
}
