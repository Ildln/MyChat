import { RouterProvider } from "react-router-dom";

import { AuthProvider } from "./AuthProvider";
import { router } from "../router";

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
