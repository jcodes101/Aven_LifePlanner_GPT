# Aven

Aven is an AI life planning application concept designed to help people understand where their habits, decisions, and goals may lead over time. Instead of prescribing what someone should do, Aven is built around questions like: “Where am I heading if I continue on my current path?” and “What could change if I adjust one part of my life?”

## Live Demo

[Click Here](https://jcodes101.github.io/Aven_LifePlanner_GPT/)

- Glassmorphism chat interface with the Aven lotus loading animation
- **Life Planning mode backed by a real LLM** (Google Gemini by default, free tier) through the Aven API server (`server/`), when that server is running and configured
- **Recent Chats**: conversations are saved in the browser and can be reopened and continued
- Responsive layout and an animated More menu
- SF Pro font stack and Framer Motion animations

Authentication is simulated, and the General, Financiality, and Wellness modes still return placeholder responses. The GitHub Pages site is static hosting, so Life Planning there shows a "not connected" message until the API server is deployed and `VITE_AVEN_API_URL` is set. Saved chats live only in this browser's storage and are not account-backed. See [docs/LIFE_PLANNING_AI_AND_RECENT_CHATS.md](docs/LIFE_PLANNING_AI_AND_RECENT_CHATS.md) for setup, architecture, and limitations.

## Built With

- React 19 and TypeScript
- Vite 8
- Tailwind CSS 4 with the Vite plugin
- Framer Motion
- React Icons
- HTML and CSS

## Design

Aven uses glassmorphism, soft atmospheric radial gradients, a minimal interface, SF Pro typography, and subtle motion to keep attention on the AI-focused interaction. The intended feel is calm, futuristic, personal, and premium while remaining responsive across screen sizes.

## Future Vision

Future versions could grow into a more complete AI life planning system. Ideas under consideration include personalized life profiles, deeper financial planning, wellness habit analysis, career planning, goal tracking, scenario simulation, “What If?” comparisons, long-term trajectory visualization, personalized AI conversations, Google authentication, persistent accounts, and database-backed profiles. These are future concepts, not claims about the current MVP.

## Senior Project

Aven is being developed as part of a Senior Project I / Senior Project II process. The current work establishes the product concept, UI/UX system, interaction model, and frontend foundation for later development.

## Getting Started

### Clone the repository

```bash
git clone https://github.com/jcodes101/Aven_LifePlanner_GPT.git
```

### Navigate into the project

```bash
cd Aven_LifePlanner_GPT
```

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

### (Optional) Start the Aven API server for Life Planning AI

```bash
cp .env.example .env   # set GEMINI_API_KEY (free: https://aistudio.google.com/apikey), server-side only
npm run models         # see which Gemini models your key can use; set AI_MODEL
npm run dev:server     # http://localhost:8787, proxied by Vite at /api
```

Without a key, the app still runs and Life Planning explains that the AI isn't configured.

### Run the tests

```bash
npm test -- --runInBand
npm run test:coverage
```

### Create a production build

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

## Deployment

The application is deployed to GitHub Pages with GitHub Actions. A push to `main` builds the Vite application and deploys the generated `dist` artifact. The Life Planning API server must be hosted separately; set the `VITE_AVEN_API_URL` repository variable to its URL (see the docs linked above). The published site is [https://jcodes101.github.io/Aven_LifePlanner_GPT/](https://jcodes101.github.io/Aven_LifePlanner_GPT/).

## Status

Active development. Aven is an evolving MVP/frontend prototype; additional AI and backend functionality is planned.

## License

This project currently does not include a formal open-source license.

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```
