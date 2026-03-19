import { apiRequest } from "./http";
import type { Chat } from "../types/chat";
import type { FriendRequest } from "../types/friends";
import type { User } from "../types/user";

export function getIncomingFriendRequests() {
  return apiRequest<FriendRequest[]>("/friends/requests/incoming");
}

export function getOutgoingFriendRequests() {
  return apiRequest<FriendRequest[]>("/friends/requests/outgoing");
}

export function getFriends() {
  return apiRequest<User[]>("/friends");
}

export function createFriendRequest(toUserId: number) {
  return apiRequest<FriendRequest>("/friends/requests", {
    method: "POST",
    body: JSON.stringify({ to_user_id: toUserId }),
  });
}

export function acceptFriendRequest(requestId: number) {
  return apiRequest<FriendRequest>(`/friends/requests/${requestId}/accept`, {
    method: "POST",
  });
}

export function declineFriendRequest(requestId: number) {
  return apiRequest<FriendRequest>(`/friends/requests/${requestId}/decline`, {
    method: "POST",
  });
}
