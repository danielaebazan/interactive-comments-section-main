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
      .from('User')  // Ensure table name matches exactly
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
  return await queryDb(
    supabase.from('Post').select('id, title')  // Ensure table name and column names match exactly
  );
});

app.get("/posts/:id", async (req, res) => {
  const post = await queryDb(
    supabase
      .from('Post')  // Ensure table name matches exactly
      .select(`
        id, 
        body, 
        title, 
        comments:Comment (  // Ensure table name matches exactly
          id, 
          message, 
          parentId, 
          createdAt,
          user:User (id, username),  // Ensure table name matches exactly
          likes:Like (id, userId)  // Ensure table name matches exactly
        )
      `)
      .eq('id', req.params.id)
      .single()
  );

  const userId = req.cookies.userId;

  return {
    ...post,
    comments: post.comments.map(comment => ({
      ...comment,
      likedByMe: comment.likes.some(like => like.userId === userId),
      likeCount: comment.likes.length,
    }))
  };
});

app.post("/posts/:id/comments", async (req, res) => {
  if (req.body.message === "" || req.body.message == null) {
    return res.send(app.httpErrors.badRequest("Message is required"));
  }

  const comment = await queryDb(
    supabase
      .from('Comment')  // Ensure table name matches exactly
      .insert({
        message: req.body.message,
        userId: req.cookies.userId,
        parentId: req.body.parentId,
        postId: req.params.id,
      })
      .select('id, message, parentId, createdAt, user:User(id, username)')  // Ensure table name matches exactly
      .single()
  );

  return { 
    ...comment,
    likeCount: 0,
    likedByMe: false,
  };
});

app.put("/posts/:postId/comments/:commentId", async (req, res) => {
  if (req.body.message === "" || req.body.message == null) {
    return res.send(app.httpErrors.badRequest("Message is required"));
  }

  const { data: comment } = await supabase
    .from('Comment')  // Ensure table name matches exactly
    .select('userId')
    .eq('id', req.params.commentId)
    .single();

  if (comment.userId !== req.cookies.userId) {
    return res.send(
      app.httpErrors.unauthorized("You do not have permission to edit this message")
    );
  }

  return await queryDb(
    supabase
      .from('Comment')  // Ensure table name matches exactly
      .update({ message: req.body.message })
      .eq('id', req.params.commentId)
      .select('message')
      .single()
  );
});

app.delete("/posts/:postId/comments/:commentId", async (req, res) => {
  const { data: comment } = await supabase
    .from('Comment')  // Ensure table name matches exactly
    .select('userId')
    .eq('id', req.params.commentId)
    .single();

  if (comment.userId !== req.cookies.userId) {
    return res.send(
      app.httpErrors.unauthorized("You do not have permission to delete this message")
    );
  }

  return await queryDb(
    supabase
      .from('Comment')  // Ensure table name matches exactly
      .delete()
      .eq('id', req.params.commentId)
      .select('id')
      .single()
  );
});

app.post("/posts/:postId/comments/:commentId/toggleLike", async (req, res) => {
  const data = {
    commentId: req.params.commentId,
    userId: req.cookies.userId,
  };

  const { data: like } = await supabase
    .from('Like')  // Ensure table name matches exactly
    .select()
    .match(data)
    .single();

  if (!like) {
    await queryDb(supabase.from('Like').insert(data));  // Ensure table name matches exactly
    return { addLike: true };
  } else {
    await queryDb(
      supabase
        .from('Like')  // Ensure table name matches exactly
        .delete()
        .match(data)
    );
    return { addLike: false };
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