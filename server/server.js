import fastify from "fastify";
import sensible from "@fastify/sensible";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import dotenv from "dotenv";
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = fastify();

// Register CORS before defining routes
app.register(cors, {
  origin: process.env.CLIENT_URL,
  credentials: true,
});

app.register(sensible);
app.register(cookie, { secret: process.env.COOKIE_SECRET });

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Helper function to handle Supabase queries
async function queryDb(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

// Get current user ID
let CURRENT_USER_ID;
async function getCurrentUserId() {
  if (!CURRENT_USER_ID) {
    const { data } = await supabase
      .from('User')
      .select('id')
      .eq('username', 'juliusomo')
      .single();
    CURRENT_USER_ID = data.id;
  }
  return CURRENT_USER_ID;
}

// Middleware to handle cookies
app.addHook("onRequest", async (req, res) => {
  const currentUserId = await getCurrentUserId();
  if (req.cookies.userId != currentUserId) {
    req.cookies.userId = currentUserId;
    res.clearCookie("userId");
    res.setCookie("userId", currentUserId);
  }
});

// Define routes
app.get("/", (req, res) => {
  res.send("Server is running");
});

app.get("/posts", async (req, res) => {
  try {
    const posts = await queryDb(
      supabase.from('Post').select('id, title')
    );
    return posts;
  } catch (error) {
    console.error('Error fetching posts:', error);
    return res.status(500).send({ error: 'Failed to fetch posts', details: error.message });
  }
});

app.get("/posts/:id", async (req, res) => {
  try {
    // Fetch post data
    const { data: post, error: postError } = await supabase
      .from('Post')
      .select('id, title, body')
      .eq('id', req.params.id)
      .single();
    
    if (postError) throw postError;

    // Fetch comments data
    const { data: comments, error: commentsError } = await supabase
      .from('Comment')
      .select('id, message, createdAt, userId, postId')
      .eq('postId', req.params.id);

    if (commentsError) throw commentsError;

    // Fetch users
    const userIds = [...new Set(comments.map(comment => comment.userId))];
    const { data: users, error: usersError } = await supabase
      .from('User')
      .select('id, username')
      .in('id', userIds);

    if (usersError) throw usersError;

    // Create a map of users for quick lookup
    const userMap = users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {});

    // Attach user data to comments
    const enhancedComments = comments.map(comment => ({
      ...comment,
      user: userMap[comment.userId]
    }));

    // Attach likes count and user-like status
    const userId = req.cookies.userId;
    const commentIds = comments.map(comment => comment.id);
    const { data: likes, error: likesError } = await supabase
      .from('Like')
      .select('commentId, userId')
      .in('commentId', commentIds);

    if (likesError) throw likesError;

    const likeMap = likes.reduce((acc, like) => {
      if (!acc[like.commentId]) acc[like.commentId] = [];
      acc[like.commentId].push(like.userId);
      return acc;
    }, {});

    const finalComments = enhancedComments.map(comment => ({
      ...comment,
      likedByMe: likeMap[comment.id]?.includes(userId) || false,
      likeCount: likeMap[comment.id]?.length || 0
    }));

    return {
      ...post,
      comments: finalComments
    };
  } catch (error) {
    console.error('Error fetching post:', error);
    return res.status(500).send({ error: 'Failed to fetch post', details: error.message });
  }
});

app.post("/posts/:id/comments", async (req, res) => {
  try {
    if (!req.body.message || req.body.message.trim() === "") {
      return res.send(app.httpErrors.badRequest("Message is required"));
    }

    const comment = await queryDb(
      supabase
        .from('Comment')
        .insert({
          message: req.body.message,
          userId: req.cookies.userId,
          parentId: req.body.parentId,
          postId: req.params.id,
        })
        .select('id, message, parentId, createdAt, userId')
        .single()
    );

    return { 
      ...comment,
      likeCount: 0,
      likedByMe: false,
    };
  } catch (error) {
    console.error('Error adding comment:', error);
    return res.status(500).send({ error: 'Failed to add comment', details: error.message });
  }
});

app.put("/posts/:postId/comments/:commentId", async (req, res) => {
  try {
    if (!req.body.message || req.body.message.trim() === "") {
      return res.send(app.httpErrors.badRequest("Message is required"));
    }

    const { data: comment } = await supabase
      .from('Comment')
      .select('userId')
      .eq('id', req.params.commentId)
      .single();

    if (comment.userId !== req.cookies.userId) {
      return res.send(
        app.httpErrors.unauthorized("You do not have permission to edit this message")
      );
    }

    const updatedComment = await queryDb(
      supabase
        .from('Comment')
        .update({ message: req.body.message })
        .eq('id', req.params.commentId)
        .select('message')
        .single()
    );

    return updatedComment;
  } catch (error) {
    console.error('Error updating comment:', error);
    return res.status(500).send({ error: 'Failed to update comment', details: error.message });
  }
});

app.delete("/posts/:postId/comments/:commentId", async (req, res) => {
  try {
    const { data: comment } = await supabase
      .from('Comment')
      .select('userId')
      .eq('id', req.params.commentId)
      .single();

    if (comment.userId !== req.cookies.userId) {
      return res.send(
        app.httpErrors.unauthorized("You do not have permission to delete this message")
      );
    }

    const deletedComment = await queryDb(
      supabase
        .from('Comment')
        .delete()
        .eq('id', req.params.commentId)
        .select('id')
        .single()
    );

    return deletedComment;
  } catch (error) {
    console.error('Error deleting comment:', error);
    return res.status(500).send({ error: 'Failed to delete comment', details: error.message });
  }
});

app.post("/posts/:postId/comments/:commentId/toggleLike", async (req, res) => {
  try {
    const data = {
      commentId: req.params.commentId,
      userId: req.cookies.userId,
    };

    const { data: like, error: likeError } = await supabase
      .from('Like')
      .select()
      .match(data)
      .single();

    if (likeError) throw likeError;

    if (!like) {
      await queryDb(supabase.from('Like').insert(data));
      return { addLike: true };
    } else {
      await queryDb(
        supabase
          .from('Like')
          .delete()
          .match(data)
      );
      return { addLike: false };
    }
  } catch (error) {
    console.error('Error toggling like:', error);
    return res.status(500).send({ error: 'Failed to toggle like', details: error.message });
  }
});

// Error handling
app.setErrorHandler(function (error, request, reply) {
  console.error(error);
  reply.status(500).send({ error: 'Something went wrong', details: error.message });
});

// Export for Vercel
export default async (req, res) => {
  await app.ready();
  app.server.emit('request', req, res);
};
