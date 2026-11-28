/**
 * Client-side AppRouter (uses BrowserRouter)
 * For SSR, see Router component in ./Router.tsx
 */

import type React from "react";
import { Router } from "./Router.js";

const AppRouter: React.FC = () => <Router />;

export default AppRouter;
