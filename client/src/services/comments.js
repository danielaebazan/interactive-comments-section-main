import { makeRequest } from "./makeRequest"

export function createComment({ postId, message, parentId }) {
  return makeRequest(`posts/${postId}`, {
    method: "POST",
    data: { message, parentId },
  })
}

export function updateComment({ postId, message, id }) {
  return makeRequest(`posts/${postId}/comments/${id}`, 
    { method: "PUT", 
      data: { commentId: id, message } 
    })
}

export function deleteComment({ postId, id }) {
  return makeRequest(`posts/${postId}/comments/${id}`, {
    method: "DELETE",
    data: { commentId: id },
  })
}

export function toggleCommentLike({ id, postId }) {
  return makeRequest(`posts/${postId}/toggleLike`, {
    method: "POST",
    data: { commentId: id },
  })
}