import { RouterProvider } from "react-router-dom";

import { AuthProvider } from "./AuthProvider";
import { ChatsProvider } from "./ChatsProvider";
import { router } from "../router";

export function App() {
  return (
    <AuthProvider>
      <ChatsProvider>
        <RouterProvider router={router} />
      </ChatsProvider>
    </AuthProvider>
  );
}
