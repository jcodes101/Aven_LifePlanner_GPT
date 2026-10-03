require("@testing-library/jest-dom");

jest.mock("framer-motion", () => {
  const React = require("react");
  const motion = new Proxy(
    {},
    {
      get: (_target, tag) =>
        React.forwardRef((props, ref) => {
          const {
            animate,
            exit,
            initial,
            layout,
            layoutId,
            onAnimationComplete,
            onLayoutAnimationComplete,
            transition,
            variants,
            viewport,
            whileFocus,
            whileHover,
            whileTap,
            ...domProps
          } = props;
          return React.createElement(tag, { ...domProps, ref });
        }),
    },
  );

  return {
    AnimatePresence: ({ children }) => children ?? null,
    LayoutGroup: ({ children }) => children ?? null,
    motion,
    useAnimate: () => [null, jest.fn()],
    useReducedMotion: jest.fn(() => false),
  };
});

jest.mock("react-spinners", () => ({
  CircleLoader: ({ color, size, speedMultiplier, loading }) =>
    loading
      ? require("react").createElement("span", {
          "data-testid": "circle-loader",
          "data-color": color,
          "data-size": size,
          "data-speed-multiplier": speedMultiplier,
        })
      : null,
}));

if (!window.matchMedia) {
  window.matchMedia = (media) => ({
    matches: false,
    media,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  });
}

if (!URL.createObjectURL) {
  URL.createObjectURL = jest.fn();
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = jest.fn();
}
