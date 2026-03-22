import { useChatsContext } from "../app/ChatsProvider";

export function useChats() {
  return useChatsContext();
}
